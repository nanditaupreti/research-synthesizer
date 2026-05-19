import { useState, useCallback, useEffect } from 'react'
import { FlaskConical, Send, Database, Wifi, WifiOff, BookOpen } from 'lucide-react'
import AgentPipeline, { type AgentState, type AgentStatus } from './components/AgentPipeline'
import ActivityLog, { type LogEntry } from './components/ActivityLog'
import ReportViewer from './components/ReportViewer'
import SessionHistory from './components/SessionHistory'
import ProgressBar from './components/ProgressBar'
import { useWebSocket, type WSMessage } from './hooks/useWebSocket'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const DEFAULT_AGENTS: AgentState[] = [
  { name: 'Memory',      status: 'idle', message: 'Waiting to start' },
  { name: 'Researcher',  status: 'idle', message: 'Waiting to start' },
  { name: 'Analyzer',    status: 'idle', message: 'Waiting to start' },
  { name: 'Synthesizer', status: 'idle', message: 'Waiting to start' },
  { name: 'Reviewer',    status: 'idle', message: 'Waiting to start' },
]

interface FinalData {
  final_report: string
  metadata?: Record<string, unknown>
  scores?: Record<string, unknown>
}

interface Session { id: string; topic: string; status: string; created_at: string; completed_at?: string; report_preview?: string }

export default function App() {
  const [topic, setTopic] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle')
  const [agents, setAgents] = useState<AgentState[]>(DEFAULT_AGENTS)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [progress, setProgress] = useState(0)
  const [finalData, setFinalData] = useState<FinalData | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeTab, setActiveTab] = useState<'pipeline' | 'report' | 'history'>('pipeline')
  const [memoryCount, setMemoryCount] = useState<number | null>(null)
  const [docUpload, setDocUpload] = useState({ content: '', source: '', topic: '' })
  const [showUpload, setShowUpload] = useState(false)

  const addLog = useCallback((msg: WSMessage) => {
    setLogs(prev => [...prev, { ...msg, timestamp: new Date(), id: crypto.randomUUID() }])
  }, [])

  const updateAgent = useCallback((name: string, status: AgentStatus, message: string, data?: Record<string, unknown>) => {
    setAgents(prev => prev.map(a => a.name === name ? { ...a, status, message, data } : a))
  }, [])

  const handleWSMessage = useCallback((msg: WSMessage) => {
    addLog(msg)

    if (msg.type === 'pipeline_start') {
      setPipelineStatus('running')
      setProgress(5)
    }

    if (msg.type === 'agent_start' && msg.agent) {
      updateAgent(msg.agent, 'running', msg.message)
      const progressMap: Record<string, number> = {
        Memory: 5, Researcher: 15, Analyzer: 40, Synthesizer: 65, Reviewer: 85
      }
      setProgress(progressMap[msg.agent] ?? progress)
    }

    if (msg.type === 'agent_update' && msg.agent) {
      updateAgent(msg.agent, 'running', msg.message, msg.data)
    }

    if (msg.type === 'agent_complete' && msg.agent) {
      updateAgent(msg.agent, 'completed', msg.message, msg.data)
      const progressMap: Record<string, number> = {
        Memory: 10, Researcher: 35, Analyzer: 60, Synthesizer: 82, Reviewer: 98
      }
      setProgress(progressMap[msg.agent] ?? progress)
    }

    if (msg.type === 'agent_error' && msg.agent) {
      updateAgent(msg.agent, 'error', msg.message)
    }

    if (msg.type === 'pipeline_complete') {
      setPipelineStatus('completed')
      setProgress(100)
      if (msg.data) {
        setFinalData(msg.data as FinalData)
        setActiveTab('report')
      }
      fetchSessions()
      fetchMemoryStats()
    }

    if (msg.type === 'pipeline_error') {
      setPipelineStatus('error')
    }
  }, [addLog, updateAgent, progress])

  const { connected } = useWebSocket(sessionId, handleWSMessage)

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API}/sessions`)
      const data = await res.json()
      setSessions(data.sessions ?? [])
    } catch { /* backend may not be running */ }
  }

  const fetchMemoryStats = async () => {
    try {
      const res = await fetch(`${API}/memory/stats`)
      const data = await res.json()
      setMemoryCount(data.total_documents)
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchSessions()
    fetchMemoryStats()
  }, [])

  const startResearch = async () => {
    if (!topic.trim() || pipelineStatus === 'running') return

    setAgents(DEFAULT_AGENTS)
    setLogs([])
    setProgress(0)
    setFinalData(null)
    setPipelineStatus('running')
    setActiveTab('pipeline')

    try {
      const res = await fetch(`${API}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      })
      const data = await res.json()
      setSessionId(data.session_id)
    } catch (e) {
      setPipelineStatus('error')
      addLog({ type: 'pipeline_error', message: `Failed to connect to backend: ${e}` })
    }
  }

  const loadSession = async (id: string) => {
    try {
      const res = await fetch(`${API}/sessions/${id}`)
      const data = await res.json()
      if (data.session?.final_report) {
        setFinalData({ final_report: data.session.final_report })
        setActiveTab('report')
      }
    } catch { /* silent */ }
  }

  const uploadDocument = async () => {
    if (!docUpload.content || !docUpload.source || !docUpload.topic) return
    try {
      await fetch(`${API}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docUpload)
      })
      setDocUpload({ content: '', source: '', topic: '' })
      setShowUpload(false)
      fetchMemoryStats()
    } catch { /* silent */ }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FlaskConical size={20} className="text-blue-500" />
            <span className="font-bold text-white">Research Synthesizer</span>
            <span className="badge bg-blue-900/40 text-blue-400 ml-1">Multi-Agent AI</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {memoryCount !== null && (
              <span className="flex items-center gap-1.5">
                <Database size={13} className="text-purple-400" />
                <span className="text-gray-400">{memoryCount} docs in memory</span>
              </span>
            )}
            <span className={`flex items-center gap-1.5 ${connected ? 'text-green-400' : 'text-gray-600'}`}>
              {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
              {connected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && startResearch()}
              placeholder="Enter a research topic (e.g. 'Quantum computing applications in drug discovery')"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              disabled={pipelineStatus === 'running'}
            />
            <button
              onClick={startResearch}
              disabled={!topic.trim() || pipelineStatus === 'running'}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              <Send size={16} />
              {pipelineStatus === 'running' ? 'Researching...' : 'Research'}
            </button>
          </div>
        </div>

        {/* Progress */}
        {pipelineStatus !== 'idle' && (
          <div className="mb-6">
            <ProgressBar progress={progress} status={pipelineStatus} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-900 rounded-lg p-1 w-fit">
          {(['pipeline', 'report', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${activeTab === tab ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {tab === 'report' && finalData ? '✓ ' : ''}{tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-1 space-y-4">
            <AgentPipeline agents={agents} />

            <button
              onClick={() => setShowUpload(v => !v)}
              className="w-full text-left card px-4 py-3 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 transition-colors flex items-center gap-2"
            >
              <Database size={13} />
              {showUpload ? 'Hide' : 'Add document to vector memory'}
            </button>

            {showUpload && (
              <div className="card p-4 space-y-3">
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                  placeholder="Topic"
                  value={docUpload.topic}
                  onChange={e => setDocUpload(p => ({ ...p, topic: e.target.value }))}
                />
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                  placeholder="Source / URL"
                  value={docUpload.source}
                  onChange={e => setDocUpload(p => ({ ...p, source: e.target.value }))}
                />
                <textarea
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 h-24 resize-none"
                  placeholder="Document content..."
                  value={docUpload.content}
                  onChange={e => setDocUpload(p => ({ ...p, content: e.target.value }))}
                />
                <button onClick={uploadDocument} className="w-full btn-primary text-sm py-2">
                  Store in Vector Memory
                </button>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-4">
            {activeTab === 'pipeline' && (
              <ActivityLog entries={logs} />
            )}

            {activeTab === 'report' && finalData && (
              <ReportViewer
                report={finalData.final_report}
                metadata={finalData.metadata}
                scores={finalData.scores as Parameters<typeof ReportViewer>[0]['scores']}
              />
            )}

            {activeTab === 'report' && !finalData && (
              <div className="card p-12 text-center">
                <BookOpen size={32} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500">No report yet. Start a research session above.</p>
              </div>
            )}

            {activeTab === 'history' && (
              <SessionHistory
                sessions={sessions}
                onSelect={loadSession}
                activeId={sessionId}
              />
            )}

            {activeTab === 'pipeline' && logs.length === 0 && pipelineStatus === 'idle' && (
              <div className="card p-12 text-center">
                <FlaskConical size={36} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400 font-medium mb-1">Ready to research</p>
                <p className="text-gray-600 text-sm">Enter a topic above to start the 4-agent pipeline</p>
                <div className="mt-6 grid grid-cols-2 gap-2 text-xs text-left max-w-sm mx-auto">
                  {['Memory Agent — pgvector retrieval', 'Researcher — web + LLM search', 'Analyzer — theme & fact extraction', 'Reviewer — quality scoring'].map(s => (
                    <div key={s} className="flex items-center gap-1.5 text-gray-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
