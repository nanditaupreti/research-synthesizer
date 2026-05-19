# Autonomous Multi-Agent Research Synthesizer

A production-grade multi-agent AI pipeline using **LangGraph + OpenAI** with a **pgvector** persistent memory layer and real-time React dashboard.

## Architecture

```
User Input
    │
    ▼
┌─────────────────────────────────────────────────┐
│              LangGraph Pipeline                  │
│                                                  │
│  [Memory Agent] → [Researcher] → [Analyzer]     │
│       │               │              │           │
│  pgvector query   Web/LLM search  Theme/fact     │
│  (PostgreSQL)     DuckDuckGo or   extraction     │
│                   Tavily + OpenAI                │
│                                                  │
│  [Synthesizer] → [Reviewer]                     │
│       │               │                          │
│  Full markdown   Quality scoring +               │
│  report          hallucination removal           │
└─────────────────────────────────────────────────┘
    │
    ▼ WebSocket stream
React Dashboard (real-time agent cards, logs, report)
```

## Quick Start (Docker — Recommended)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 2. Start everything
docker-compose up --build

# 3. Open the UI
open http://localhost:3000
```

## Local Development (No Docker)

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL with pgvector extension

### Backend
```bash
cd backend
pip install -r requirements.txt
cp ../.env.example .env  # edit with your keys

# Start PostgreSQL with pgvector and run init.sql manually, then:
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # → http://localhost:3000
```

## Agents

| Agent | Role | Key Output |
|-------|------|------------|
| **Memory** | Queries pgvector for existing knowledge | Relevant prior documents |
| **Researcher** | Generates queries, searches web/LLM | Raw research findings |
| **Analyzer** | Extracts themes, facts, reliability scores | Structured analysis |
| **Synthesizer** | Composes markdown report | Draft report (1000+ words) |
| **Reviewer** | Scores quality, removes hallucinations | Final polished report |

## Features

- **Real-time WebSocket** agent monitoring — watch each agent work live
- **pgvector persistent memory** — context retrieves across 50+ documents
- **Quality scoring** — completeness, accuracy, clarity, depth (0–10)
- **Hallucination detection** — reviewer flags and removes uncertain claims
- **Download reports** as Markdown
- **Session history** — view and reload past reports
- **Document upload** — manually add docs to vector memory

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ | Your OpenAI key |
| `TAVILY_API_KEY` | ❌ | Tavily for better web search |
| `OPENAI_MODEL` | ❌ | Default: `gpt-4o-mini` |
| `DATABASE_URL` | ❌ | Default: local postgres |
