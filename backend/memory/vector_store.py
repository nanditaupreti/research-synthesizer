import json
import numpy as np
from typing import List, Dict, Optional, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import google.generativeai as genai
from config import DATABASE_URL, GEMINI_API_KEY, EMBEDDING_MODEL

genai.configure(api_key=GEMINI_API_KEY)


def get_connection():
    return psycopg2.connect(DATABASE_URL)


def get_embedding(text: str) -> List[float]:
    text = text.replace("\n", " ")[:8000]
    result = genai.embed_content(model=EMBEDDING_MODEL, content=text)
    return result["embedding"]


def store_document(content: str, source: str, topic: str, metadata: Dict = None) -> int:
    embedding = get_embedding(content)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO documents (content, source, topic, embedding, metadata)
                   VALUES (%s, %s, %s, %s::vector, %s) RETURNING id""",
                (content, source, topic, embedding, json.dumps(metadata or {}))
            )
            doc_id = cur.fetchone()[0]
        conn.commit()
    return doc_id


def search_similar(query: str, topic: str = None, limit: int = 5, threshold: float = 0.6) -> List[Dict]:
    query_embedding = get_embedding(query)
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if topic:
                cur.execute(
                    """SELECT id, content, source, topic, metadata,
                              1 - (embedding <=> %s::vector) AS similarity
                       FROM documents
                       WHERE topic = %s
                         AND 1 - (embedding <=> %s::vector) > %s
                       ORDER BY similarity DESC
                       LIMIT %s""",
                    (query_embedding, topic, query_embedding, threshold, limit)
                )
            else:
                cur.execute(
                    """SELECT id, content, source, topic, metadata,
                              1 - (embedding <=> %s::vector) AS similarity
                       FROM documents
                       WHERE 1 - (embedding <=> %s::vector) > %s
                       ORDER BY similarity DESC
                       LIMIT %s""",
                    (query_embedding, query_embedding, threshold, limit)
                )
            return [dict(row) for row in cur.fetchall()]


def get_document_count(topic: str = None) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            if topic:
                cur.execute("SELECT COUNT(*) FROM documents WHERE topic = %s", (topic,))
            else:
                cur.execute("SELECT COUNT(*) FROM documents")
            return cur.fetchone()[0]


def create_session(topic: str) -> str:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO research_sessions (topic, status) VALUES (%s, 'running') RETURNING id",
                (topic,)
            )
            session_id = str(cur.fetchone()[0])
        conn.commit()
    return session_id


def update_session(session_id: str, status: str, final_report: str = None):
    with get_connection() as conn:
        with conn.cursor() as cur:
            if final_report:
                cur.execute(
                    """UPDATE research_sessions
                       SET status = %s, final_report = %s, completed_at = NOW()
                       WHERE id = %s::uuid""",
                    (status, final_report, session_id)
                )
            else:
                cur.execute(
                    "UPDATE research_sessions SET status = %s WHERE id = %s::uuid",
                    (status, session_id)
                )
        conn.commit()


def log_agent_event(session_id: str, agent_name: str, status: str, message: str, data: Dict = None):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO agent_logs (session_id, agent_name, status, message, data)
                   VALUES (%s::uuid, %s, %s, %s, %s)""",
                (session_id, agent_name, status, message, json.dumps(data or {}))
            )
        conn.commit()


def get_sessions() -> List[Dict]:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """SELECT id, topic, status, created_at, completed_at,
                          LEFT(final_report, 200) AS report_preview
                   FROM research_sessions ORDER BY created_at DESC LIMIT 50"""
            )
            return [dict(row) for row in cur.fetchall()]


def get_session_logs(session_id: str) -> List[Dict]:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """SELECT * FROM agent_logs WHERE session_id = %s::uuid ORDER BY created_at""",
                (session_id,)
            )
            return [dict(row) for row in cur.fetchall()]


def get_session_report(session_id: str) -> Optional[Dict]:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM research_sessions WHERE id = %s::uuid",
                (session_id,)
            )
            row = cur.fetchone()
            return dict(row) if row else None
