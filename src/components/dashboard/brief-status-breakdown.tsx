'use client'

import { Card } from '@/components/ui/card'

interface BriefStatusItem {
  status: string
  count: number
}

interface BriefStatusBreakdownProps {
  statuses: BriefStatusItem[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  RECEIVED: { label: 'Received', color: 'text-slate-300', bg: 'bg-slate-500' },
  QUEUED: { label: 'Queued', color: 'text-amber-400', bg: 'bg-amber-500' },
  ALLOCATED: { label: 'Allocated', color: 'text-sky-400', bg: 'bg-sky-500' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-violet-400', bg: 'bg-violet-500' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500' },
  CLOSED: { label: 'Closed', color: 'text-slate-400', bg: 'bg-slate-600' },
}

export function BriefStatusBreakdown({ statuses }: BriefStatusBreakdownProps) {
  const total = statuses.reduce((sum, s) => sum + s.count, 0)

  if (total === 0) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Today&apos;s Brief Status</h3>
        <p className="text-xs text-slate-500 text-center py-2">No briefs received today</p>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Today&apos;s Brief Status</h3>
        <span className="text-xs text-slate-500">{total} received today</span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-slate-800 mb-3">
        {statuses.map((s) => {
          if (s.count === 0) return null
          const config = STATUS_CONFIG[s.status]
          return (
            <div
              key={s.status}
              className={`${config.bg} transition-all duration-500`}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${config.label}: ${s.count}`}
            />
          )
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-2">
        {statuses.map((s) => {
          const config = STATUS_CONFIG[s.status]
          return (
            <div key={s.status} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${config.bg} shrink-0`} />
              <span className={`text-xs ${config.color}`}>{s.count}</span>
              <span className="text-[10px] text-slate-500 truncate">{config.label}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
