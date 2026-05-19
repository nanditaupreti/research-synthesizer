interface Props {
  progress: number
  status: 'idle' | 'running' | 'completed' | 'error'
}

export default function ProgressBar({ progress, status }: Props) {
  if (status === 'idle') return null

  const color =
    status === 'completed' ? 'bg-green-500' :
    status === 'error'     ? 'bg-red-500'   :
    'bg-blue-500'

  const label =
    status === 'completed' ? 'Pipeline complete!' :
    status === 'error'     ? 'Pipeline error'     :
    progress < 10          ? 'Initializing...'    :
    progress < 25          ? 'Querying memory...' :
    progress < 50          ? 'Researching...'     :
    progress < 75          ? 'Analyzing...'       :
    progress < 100         ? 'Synthesizing & reviewing...' :
    'Finalizing...'

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-300">{label}</span>
        <span className="text-sm font-semibold text-gray-400">{progress}%</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
        <div
          className={`${color} h-2 rounded-full transition-all duration-500 ease-out ${status === 'running' ? 'relative' : ''}`}
          style={{ width: `${progress}%` }}
        >
          {status === 'running' && (
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  )
}
