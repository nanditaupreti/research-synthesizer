import asyncio
import json
import uuid
from typing import Dict, Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import memory.vector_store as vs
from graph.pipeline import run_pipeline

app = FastAPI(title="Research Synthesizer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self.connections:
            self.connections[session_id] = set()
        self.connections[session_id].add(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket):
        if session_id in self.connections:
            self.connections[session_id].discard(websocket)

    async def broadcast(self, session_id: str, message: dict):
        if session_id in self.connections:
            dead = set()
            for ws in self.connections[session_id]:
                try:
                    await ws.send_text(json.dumps(message))
                except Exception:
                    dead.add(ws)
            self.connections[session_id] -= dead


manager = ConnectionManager()


class ResearchRequest(BaseModel):
    topic: str


class DocumentUpload(BaseModel):
    content: str
    source: str
    topic: str


@app.get("/health")
async def health_check():
    try:
        doc_count = vs.get_document_count()
        return {"status": "healthy", "documents_in_memory": doc_count}
    except Exception as e:
        return {"status": "degraded", "error": str(e)}


@app.post("/research")
async def start_research(request: ResearchRequest):
    if not request.topic.strip():
        raise HTTPException(status_code=400, detail="Topic cannot be empty")

    session_id = vs.create_session(request.topic)

    async def broadcast_to_session(sid: str, message: dict):
        await manager.broadcast(sid, message)

    asyncio.create_task(run_research_task(request.topic, session_id, broadcast_to_session))

    return {"session_id": session_id, "topic": request.topic, "status": "started"}


async def run_research_task(topic: str, session_id: str, broadcast_fn):
    try:
        await broadcast_fn(session_id, {
            "type": "pipeline_start",
            "message": f"Starting research pipeline for: {topic}",
            "session_id": session_id
        })

        final_state = await run_pipeline(topic, session_id, broadcast_fn)

        if final_state.get("error"):
            vs.update_session(session_id, "error")
            await broadcast_fn(session_id, {
                "type": "pipeline_error",
                "message": final_state["error"]
            })
        else:
            final_report = final_state.get("final_report", "")
            vs.update_session(session_id, "completed", final_report)

            await broadcast_fn(session_id, {
                "type": "pipeline_complete",
                "message": "Research pipeline completed successfully!",
                "data": {
                    "final_report": final_report,
                    "metadata": final_state.get("review_data", {}).get("final_metadata", {}),
                    "scores": final_state.get("review_data", {}).get("review_scores", {})
                }
            })

    except Exception as e:
        vs.update_session(session_id, "error")
        await broadcast_fn(session_id, {
            "type": "pipeline_error",
            "message": str(e)
        })


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(session_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)


@app.get("/sessions")
async def get_sessions():
    try:
        sessions = vs.get_sessions()
        return {"sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    try:
        session = vs.get_session_report(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        logs = vs.get_session_logs(session_id)
        return {"session": session, "logs": logs}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sessions/{session_id}/report")
async def get_report(session_id: str):
    try:
        session = vs.get_session_report(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return {
            "session_id": session_id,
            "topic": session["topic"],
            "status": session["status"],
            "final_report": session.get("final_report"),
            "created_at": str(session.get("created_at")),
            "completed_at": str(session.get("completed_at"))
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/documents")
async def upload_document(doc: DocumentUpload):
    try:
        doc_id = vs.store_document(
            content=doc.content,
            source=doc.source,
            topic=doc.topic,
            metadata={"manual_upload": True}
        )
        return {"id": doc_id, "message": "Document stored in vector memory"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/memory/stats")
async def memory_stats():
    try:
        total = vs.get_document_count()
        return {"total_documents": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/memory/search")
async def search_memory(q: str, limit: int = 5):
    try:
        results = vs.search_similar(q, limit=limit)
        return {"query": q, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
