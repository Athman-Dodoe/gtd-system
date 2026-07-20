interface ProgressBarProps {
  value: number
  max: number
  className?: string
  barClassName?: string
  showLabel?: boolean
}

function getColorClass(ratio: number): string {
  if (ratio < 0.6) return 'bg-emerald-500'
  if (ratio < 0.85) return 'bg-amber-500'
  return 'bg-rose-500'
}

export function ProgressBar({
  value,
  max,
  className = '',
  barClassName = '',
  showLabel = false,
}: ProgressBarProps) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0
  const pct = Math.round(ratio * 100)

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${getColorClass(ratio)} ${barClassName}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-slate-400 tabular-nums w-10 text-right">
          {pct}%
        </span>
      )}
    </div>
  )
}
