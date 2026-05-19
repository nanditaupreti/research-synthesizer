import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Download, Copy, CheckCheck, BarChart2 } from 'lucide-react'
import { useState } from 'react'

interface ReviewScores {
  overall_score?: number
  completeness_score?: number
  accuracy_score?: number
  clarity_score?: number
  depth_score?: number
  hallucination_flags?: string[]
  strengths?: string[]
}

interface Props {
  report: string
  metadata?: Record<string, unknown>
  scores?: ReviewScores
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = (value / 10) * 100
  const color = value >= 8 ? 'bg-green-500' : value >= 6 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-28 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-800 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{value}/10</span>
    </div>
  )
}

export default function ReportViewer({ report, metadata, scores }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([report], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'research-report.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {scores && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 size={16} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Quality Assessment</h3>
            {typeof scores.overall_score === 'number' && (
              <span className={`ml-auto badge ${scores.overall_score >= 8 ? 'bg-green-900/50 text-green-400' : scores.overall_score >= 6 ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'}`}>
                {scores.overall_score}/10 overall
              </span>
            )}
          </div>
          <div className="space-y-2">
            {typeof scores.completeness_score === 'number' && <ScoreBar label="Completeness" value={scores.completeness_score} />}
            {typeof scores.accuracy_score === 'number' && <ScoreBar label="Accuracy" value={scores.accuracy_score} />}
            {typeof scores.clarity_score === 'number' && <ScoreBar label="Clarity" value={scores.clarity_score} />}
            {typeof scores.depth_score === 'number' && <ScoreBar label="Depth" value={scores.depth_score} />}
          </div>
          {scores.hallucination_flags && scores.hallucination_flags.length > 0 && (
            <div className="mt-3 p-2 bg-yellow-950/40 border border-yellow-900/40 rounded-lg">
              <p className="text-xs text-yellow-400 font-medium mb-1">Hallucination flags reviewed & addressed:</p>
              {scores.hallucination_flags.map((f, i) => (
                <p key={i} className="text-xs text-yellow-300/70">• {f}</p>
              ))}
            </div>
          )}
          {scores.strengths && scores.strengths.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {scores.strengths.map((s, i) => (
                <span key={i} className="badge bg-green-900/30 text-green-400">{s}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {metadata && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          {typeof metadata.final_word_count === 'number' && <span>{metadata.final_word_count.toLocaleString()} words</span>}
          {typeof metadata.section_count === 'number' && <span>{metadata.section_count} sections</span>}
          {typeof metadata.topics_covered === 'number' && <span>{metadata.topics_covered} sources synthesized</span>}
          {typeof metadata.confidence === 'string' && <span className="capitalize">{metadata.confidence} confidence</span>}
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Research Report</span>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-800">
              {copied ? <CheckCheck size={13} className="text-green-400" /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={handleDownload} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-800">
              <Download size={13} />
              Download
            </button>
          </div>
        </div>
        <div className="p-6 report-content overflow-auto max-h-[70vh]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {report}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
