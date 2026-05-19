import { useEffect, useRef } from 'react'
import { Terminal, CheckCircle2, XCircle, PlayCircle, Info } from 'lucide-react'
import type { WSMessage } from '../hooks/useWebSocket'

interface LogEntry extends WSMessage {
  timestamp: Date
  id: string
}

const typeStyles: Record<string, { icon: React.ReactNode; color: string }> = {
  pipeline_start:    { icon: <PlayCircle size={13} />,    color: 'text-blue-400' },
  pipeline_complete: { icon: <CheckCircle2 size={13} />,  color: 'text-green-400' },
  pipeline_error:    { icon: <XCircle size={13} />,       color: 'text-red-400'   },
  agent_start:       { icon: <PlayCircle size={13} />,    color: 'text-blue-400'  },
  agent_update:      { icon: <Info size={13} />,          color: 'text-yellow-400'},
  agent_complete:    { icon: <CheckCircle2 size={13} />,  color: 'text-green-400' },
  agent_error:       { icon: <XCircle size={13} />,       color: 'text-red-400'   },
}

export default function ActivityLog({ entries }: { entries: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  return (
    <div className="card flex flex-col h-64">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800">
        <Terminal size={14} className="text-gray-500" />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Live Activity Log</span>
        <span className="ml-auto text-xs text-gray-600">{entries.length} events</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 font-mono text-xs">
        {entries.length === 0 && (
          <p className="text-gray-600 text-center mt-8">Waiting for pipeline to start...</p>
        )}
        {entries.map((entry) => {
          const style = typeStyles[entry.type] ?? { icon: <Info size={13} />, color: 'text-gray-400' }
          const time = entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

          return (
            <div key={entry.id} className="flex items-start gap-2 py-0.5">
              <span className="text-gray-600 shrink-0 w-18">{time}</span>
              <span className={`shrink-0 ${style.color} mt-px`}>{style.icon}</span>
              {entry.agent && (
                <span className="text-gray-500 shrink-0">[{entry.agent}]</span>
              )}
              <span className="text-gray-300 leading-tight">{entry.message}</span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export type { LogEntry }
