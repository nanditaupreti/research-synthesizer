import json
from typing import List, Dict, Any
import google.generativeai as genai
from config import GEMINI_API_KEY, GEMINI_MODEL, MAX_SEARCH_RESULTS, TAVILY_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


def _call_gemini(system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
    model = genai.GenerativeModel(GEMINI_MODEL, system_instruction=system_prompt)
    response = model.generate_content(
        user_prompt,
        generation_config=genai.GenerationConfig(temperature=temperature)
    )
    return response.text


def generate_search_queries(topic: str, existing_context: str = "") -> List[str]:
    context_note = f"\nExisting context available:\n{existing_context[:500]}" if existing_context else ""
    system = "You are a research strategist. Generate targeted search queries to comprehensively research a topic. Return ONLY a JSON array of 4 specific search query strings."
    user = f"Generate 4 specific search queries to research: '{topic}'{context_note}\n\nReturn format: [\"query1\", \"query2\", \"query3\", \"query4\"]"
    try:
        content = _call_gemini(system, user, temperature=0.7).strip()
        if "```" in content:
            content = content.split("```")[1].replace("json", "").strip()
        return json.loads(content)
    except Exception:
        return [
            f"{topic} overview and key concepts",
            f"{topic} recent developments 2024",
            f"{topic} challenges and solutions",
            f"{topic} future trends and applications"
        ]


def search_web(query: str) -> List[Dict]:
    if TAVILY_API_KEY:
        try:
            from tavily import TavilyClient
            tavily = TavilyClient(api_key=TAVILY_API_KEY)
            results = tavily.search(query, max_results=MAX_SEARCH_RESULTS)
            return [
                {"title": r.get("title", ""), "content": r.get("content", ""), "url": r.get("url", "")}
                for r in results.get("results", [])
            ]
        except Exception:
            pass

    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=MAX_SEARCH_RESULTS))
            return [
                {"title": r.get("title", ""), "content": r.get("body", ""), "url": r.get("href", "")}
                for r in results
            ]
    except Exception:
        pass

    return []


def research_with_llm(topic: str, query: str, vector_context: str = "") -> str:
    context_note = f"\n\nRelevant context from knowledge base:\n{vector_context}" if vector_context else ""
    system = "You are an expert research assistant. Provide detailed, factual information about the query. Include specific data points, statistics, expert opinions, and concrete examples where possible. Be comprehensive and informative."
    user = f"Research topic: {topic}\nSpecific query: {query}{context_note}\n\nProvide detailed research findings with specific facts, data, and insights. Minimum 200 words."
    return _call_gemini(system, user, temperature=0.3)


def run_researcher(topic: str, vector_context: List[Dict]) -> Dict[str, Any]:
    context_text = "\n\n".join([d["content"] for d in vector_context[:3]]) if vector_context else ""
    queries = generate_search_queries(topic, context_text)

    findings = []
    sources_used = []

    for query in queries:
        web_results = search_web(query)

        if web_results:
            combined_content = "\n\n".join([
                f"Source: {r['title']}\n{r['content']}"
                for r in web_results[:3]
            ])
            findings.append({
                "query": query,
                "content": combined_content,
                "sources": [r["url"] for r in web_results if r.get("url")]
            })
            sources_used.extend([r["url"] for r in web_results if r.get("url")])
        else:
            llm_content = research_with_llm(topic, query, context_text)
            findings.append({
                "query": query,
                "content": llm_content,
                "sources": ["LLM knowledge base"]
            })

    if vector_context:
        findings.append({
            "query": "Retrieved from knowledge base",
            "content": context_text,
            "sources": ["Vector memory store"]
        })

    return {
        "queries": queries,
        "findings": findings,
        "sources": list(set(sources_used)),
        "total_findings": len(findings)
    }
