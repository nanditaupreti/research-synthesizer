import asyncio
from typing import TypedDict, List, Dict, Any, Optional, Callable
from langgraph.graph import StateGraph, END
import memory.vector_store as vs
from agents.researcher import run_researcher
from agents.analyzer import run_analyzer
from agents.synthesizer import run_synthesizer
from agents.reviewer import run_reviewer


class ResearchState(TypedDict):
    topic: str
    session_id: str
    vector_context: List[Dict]
    research_data: Dict
    analysis_data: Dict
    synthesis_data: Dict
    review_data: Dict
    final_report: str
    error: Optional[str]
    progress: int


def make_node(agent_name: str, agent_fn: Callable, broadcast_fn: Callable):
    async def node(state: ResearchState) -> ResearchState:
        session_id = state["session_id"]
        topic = state["topic"]

        await broadcast_fn(session_id, {
            "type": "agent_start",
            "agent": agent_name,
            "message": f"{agent_name} is starting..."
        })
        vs.log_agent_event(session_id, agent_name, "running", f"{agent_name} started")

        try:
            loop = asyncio.get_event_loop()

            if agent_name == "Researcher":
                result = await loop.run_in_executor(
                    None, lambda: agent_fn(topic, state.get("vector_context", []))
                )
                new_state = {**state, "research_data": result, "progress": 25}

                for finding in result.get("findings", []):
                    try:
                        vs.store_document(
                            content=finding["content"],
                            source=finding["query"],
                            topic=topic,
                            metadata={"session_id": session_id, "sources": finding.get("sources", [])}
                        )
                    except Exception:
                        pass

                await broadcast_fn(session_id, {
                    "type": "agent_update",
                    "agent": agent_name,
                    "message": f"Found {result['total_findings']} research findings from {len(result['queries'])} queries",
                    "data": {
                        "queries": result["queries"],
                        "findings_count": result["total_findings"],
                        "sources": result["sources"][:5]
                    }
                })

            elif agent_name == "Analyzer":
                findings = state["research_data"].get("findings", [])
                result = await loop.run_in_executor(
                    None, lambda: agent_fn(topic, findings)
                )
                new_state = {**state, "analysis_data": result, "progress": 50}

                await broadcast_fn(session_id, {
                    "type": "agent_update",
                    "agent": agent_name,
                    "message": f"Analyzed {result['total_analyzed']} findings, avg reliability: {result['aggregate']['average_reliability']}",
                    "data": {
                        "total_analyzed": result["total_analyzed"],
                        "themes": result["aggregate"]["unique_themes"][:5],
                        "entities": result["aggregate"]["unique_entities"][:8],
                        "reliability": result["aggregate"]["average_reliability"]
                    }
                })

            elif agent_name == "Synthesizer":
                result = await loop.run_in_executor(
                    None, lambda: agent_fn(topic, state["analysis_data"])
                )
                new_state = {**state, "synthesis_data": result, "progress": 75}

                await broadcast_fn(session_id, {
                    "type": "agent_update",
                    "agent": agent_name,
                    "message": f"Synthesized report: {result['metadata']['word_count']} words, {result['metadata']['section_count']} sections",
                    "data": result["metadata"]
                })

            elif agent_name == "Reviewer":
                result = await loop.run_in_executor(
                    None, lambda: agent_fn(topic, state["synthesis_data"])
                )
                new_state = {
                    **state,
                    "review_data": result,
                    "final_report": result["final_report"],
                    "progress": 100
                }

                scores = result["review_scores"]
                await broadcast_fn(session_id, {
                    "type": "agent_update",
                    "agent": agent_name,
                    "message": f"Review complete. Quality score: {scores.get('overall_score', 7)}/10. Hallucination flags: {len(scores.get('hallucination_flags', []))}",
                    "data": {
                        "scores": scores,
                        "improvements_made": result["improvements_made"],
                        "final_word_count": result["final_metadata"]["final_word_count"]
                    }
                })

            else:
                new_state = state

            vs.log_agent_event(session_id, agent_name, "completed", f"{agent_name} completed successfully")
            await broadcast_fn(session_id, {
                "type": "agent_complete",
                "agent": agent_name,
                "message": f"{agent_name} completed successfully"
            })

            return new_state

        except Exception as e:
            error_msg = str(e)
            vs.log_agent_event(session_id, agent_name, "error", error_msg)
            await broadcast_fn(session_id, {
                "type": "agent_error",
                "agent": agent_name,
                "message": f"{agent_name} encountered an error: {error_msg}"
            })
            return {**state, "error": f"{agent_name}: {error_msg}"}

    return node


def build_pipeline(broadcast_fn: Callable) -> StateGraph:
    graph = StateGraph(ResearchState)

    graph.add_node("fetch_memory", make_fetch_memory_node(broadcast_fn))
    graph.add_node("researcher", make_node("Researcher", run_researcher, broadcast_fn))
    graph.add_node("analyzer", make_node("Analyzer", run_analyzer, broadcast_fn))
    graph.add_node("synthesizer", make_node("Synthesizer", run_synthesizer, broadcast_fn))
    graph.add_node("reviewer", make_node("Reviewer", run_reviewer, broadcast_fn))

    graph.set_entry_point("fetch_memory")
    graph.add_edge("fetch_memory", "researcher")
    graph.add_edge("researcher", "analyzer")
    graph.add_edge("analyzer", "synthesizer")
    graph.add_edge("synthesizer", "reviewer")
    graph.add_edge("reviewer", END)

    return graph.compile()


def make_fetch_memory_node(broadcast_fn: Callable):
    async def fetch_memory(state: ResearchState) -> ResearchState:
        session_id = state["session_id"]
        topic = state["topic"]

        await broadcast_fn(session_id, {
            "type": "agent_start",
            "agent": "Memory",
            "message": "Querying vector memory store for existing knowledge..."
        })

        try:
            loop = asyncio.get_event_loop()
            similar_docs = await loop.run_in_executor(
                None,
                lambda: vs.search_similar(topic, limit=10, threshold=0.5)
            )

            await broadcast_fn(session_id, {
                "type": "agent_complete",
                "agent": "Memory",
                "message": f"Retrieved {len(similar_docs)} relevant documents from vector memory",
                "data": {"documents_found": len(similar_docs)}
            })
            vs.log_agent_event(session_id, "Memory", "completed",
                               f"Retrieved {len(similar_docs)} documents from vector memory")

        except Exception as e:
            similar_docs = []
            await broadcast_fn(session_id, {
                "type": "agent_error",
                "agent": "Memory",
                "message": f"Vector memory unavailable, proceeding without context: {str(e)}"
            })

        return {**state, "vector_context": similar_docs, "progress": 5}

    return fetch_memory


async def run_pipeline(topic: str, session_id: str, broadcast_fn: Callable) -> Dict[str, Any]:
    pipeline = build_pipeline(broadcast_fn)

    initial_state: ResearchState = {
        "topic": topic,
        "session_id": session_id,
        "vector_context": [],
        "research_data": {},
        "analysis_data": {},
        "synthesis_data": {},
        "review_data": {},
        "final_report": "",
        "error": None,
        "progress": 0
    }

    final_state = await pipeline.ainvoke(initial_state)
    return final_state
