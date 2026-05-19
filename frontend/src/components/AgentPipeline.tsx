import { CheckCircle, Circle, AlertCircle, Loader2, Database, Search, BarChart3, FileText, Star } from 'lucide-react'

export type AgentStatus = 'idle' | 'running' | 'completed' | 'error'

export interface AgentState {
  name: string
  status: AgentStatus
  message: string
  data?: Record<string, unknown>
}

const AGENT_META: Record<string, { icon: React.ReactNode; color: string; desc: string }> = {
  Memory: {
    icon: <Database size={18} />,
    color: 'purple',
    desc: 'Queries pgvector store for existing knowledge'
  },
  Researcher: {
    icon: <Search size={18} />,
    color: 'blue',
    desc: 'Generates queries & gathers web/LLM data'
  },
  Analyzer: {
    icon: <BarChart3 size={18} />,
    color: 'yellow',
    desc: 'Extracts themes, facts & reliability scores'
  },
  Synthesizer: {
    icon: <FileText size={18} />,
    color: 'green',
    desc: 'Composes structured research report'
  },
  Reviewer: {
    icon: <Star size={18} />,
    color: 'orange',
    desc: 'Scores quality & removes hallucinations'
  },
}

const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
  blue:   { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400',   glow: 'shadow-blue-500/20'   },
  yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', glow: 'shadow-yellow-500/20' },
  green:  { bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400',  glow: 'shadow-green-500/20'  },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', glow: 'shadow-orange-500/20' },
}

function StatusIcon({ status }: { status: AgentStatus }) {
  if (status === 'completed') return <CheckCircle size={16} className="text-green-400 shrink-0" />
  if (status === 'running')   return <Loader2 size={16} className="text-blue-400 animate-spin shrink-0" />
  if (status === 'error')     return <AlertCircle size={16} className="text-red-400 shrink-0" />
  return <Circle size={16} className="text-gray-600 shrink-0" />
}

function AgentCard({ agent }: { agent: AgentState }) {
  const meta = AGENT_META[agent.name] ?? { icon: <Circle size={18} />, color: 'blue', desc: '' }
  const colors = colorMap[meta.color]
  const isActive = agent.status === 'running'

  return (
    <div className={`card p-4 transition-all duration-300 ${isActive ? `shadow-lg ${colors.glow} border-opacity-60` : ''} ${agent.status === 'completed' ? 'border-green-900/40' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${colors.bg} ${colors.border} border ${colors.text} shrink-0 ${isActive ? 'animate-pulse-slow' : ''}`}>
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm text-white">{agent.name} Agent</span>
            <StatusIcon status={agent.status} />
          </div>
          <p className="text-xs text-gray-500 mb-1">{meta.desc}</p>
          {agent.message && (
            <p className="text-xs text-gray-400 leading-relaxed truncate" title={agent.message}>
              {agent.message}
            </p>
          )}
          {agent.data && agent.status === 'completed' && <AgentDataChips data={agent.data} color={colors.text} />}
        </div>
      </div>
    </div>
  )
}

function AgentDataChips({ data, color }: { data: Record<string, unknown>; color: string }) {
  const chips: string[] = []

  if (typeof data.findings_count === 'number') chips.push(`${data.findings_count} findings`)
  if (typeof data.total_analyzed === 'number') chips.push(`${data.total_analyzed} analyzed`)
  if (typeof data.reliability === 'number') chips.push(`${(data.reliability * 100).toFixed(0)}% reliable`)
  if (typeof data.word_count === 'number') chips.push(`${data.word_count} words`)
  if (typeof data.final_word_count === 'number') chips.push(`${data.final_word_count} words`)
  if (typeof data.documents_found === 'number') chips.push(`${data.documents_found} docs retrieved`)
  if (data.scores && typeof data.scores === 'object') {
    const s = data.scores as Record<string, unknown>
    if (typeof s.overall_score === 'number') chips.push(`Score: ${s.overall_score}/10`)
  }

  if (!chips.length) return null

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {chips.map((c, i) => (
        <span key={i} className={`badge bg-gray-800 ${color}`}>{c}</span>
      ))}
    </div>
  )
}

export default function AgentPipeline({ agents }: { agents: AgentState[] }) {
  const AGENT_ORDER = ['Memory', 'Researcher', 'Analyzer', 'Synthesizer', 'Reviewer']

  const ordered = AGENT_ORDER.map(name =>
    agents.find(a => a.name === name) ?? { name, status: 'idle' as AgentStatus, message: '', data: undefined }
  )

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Agent Pipeline</h2>
      {ordered.map((agent, i) => (
        <div key={agent.name} className="relative">
          <AgentCard agent={agent} />
          {i < ordered.length - 1 && (
            <div className="flex justify-center my-1">
              <div className={`w-px h-3 ${agent.status === 'completed' ? 'bg-green-700' : 'bg-gray-800'}`} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
