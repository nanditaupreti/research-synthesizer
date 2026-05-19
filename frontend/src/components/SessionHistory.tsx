import { Clock, CheckCircle2, XCircle, Loader2, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Session {
  id: string
  topic: string
  status: string
  created_at: string
  completed_at?: string
  report_preview?: string
}

interface Props {
  sessions: Session[]
  onSelect: (id: string) => void
  activeId?: string | null
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return (
    <span className="flex items-center gap-1 badge bg-green-900/40 text-green-400">
      <CheckCircle2 size={10} /> Done
    </span>
  )
  if (status === 'running') return (
    <span className="flex items-center gap-1 badge bg-blue-900/40 text-blue-400">
      <Loader2 size={10} className="animate-spin" /> Running
    </span>
  )
  if (status === 'error') return (
    <span className="flex items-center gap-1 badge bg-red-900/40 text-red-400">
      <XCircle size={10} /> Error
    </span>
  )
  return <span className="badge bg-gray-800 text-gray-400">{status}</span>
}

export default function SessionHistory({ sessions, onSelect, activeId }: Props) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800">
        <Clock size={14} className="text-gray-500" />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Research History</span>
        <span className="ml-auto text-xs text-gray-600">{sessions.length} sessions</span>
      </div>
      <div className="divide-y divide-gray-800 max-h-72 overflow-y-auto">
        {sessions.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-8">No sessions yet</p>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left px-4 py-3 hover:bg-gray-800/50 transition-colors flex items-start gap-3 ${activeId === s.id ? 'bg-gray-800/70' : ''}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-gray-200 truncate">{s.topic}</span>
                <StatusBadge status={s.status} />
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}</span>
                {s.report_preview && (
                  <span className="truncate text-gray-600">· {s.report_preview.slice(0, 60)}...</span>
                )}
              </div>
            </div>
            <ChevronRight size={14} className="text-gray-600 shrink-0 mt-0.5" />
          </button>
        ))}
      </div>
    </div>
  )
}
