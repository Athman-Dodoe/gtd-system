'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

interface BriefInfo {
  id: string
  referenceNumber: string
  subject: string
  submittingEntity: string | null
  urgency: string
  expertiseArea: string
  estimatedHours: number
  receivedAt: string
}

interface QueueItem {
  id: string
  queuedAt: string
  queuedReason: string
  brief: BriefInfo
}

interface QueueAlertsProps {
  items: QueueItem[]
}

const urgencyVariant: Record<string, 'warning' | 'danger' | 'info'> = {
  URGENT: 'warning',
  EMERGENCY: 'danger',
  ROUTINE: 'info',
}

export function QueueAlerts({ items }: QueueAlertsProps) {
  const router = useRouter()

  const handleAssign = useCallback(() => {
    router.push('/queue')
  }, [router])
  if (items.length === 0) {
    return (
      <Card className="h-full">
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-emerald-400">All briefs allocated</p>
          <p className="text-xs text-slate-500 mt-1">No items awaiting DSG action</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Queue Alerts</h3>
        <Badge variant="warning">{items.length} pending</Badge>
      </div>
      <div className="space-y-2 flex-1">
        {items.map((item, i) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700/30 hover:border-slate-600/50 transition-colors"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-mono text-slate-500">
                  {item.brief.referenceNumber}
                </span>
                <Badge
                  variant={urgencyVariant[item.brief.urgency] || 'default'}
                >
                  {item.brief.urgency}
                </Badge>
              </div>
              <p className="text-sm text-slate-200 truncate">
                {item.brief.subject}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {item.brief.submittingEntity || 'Unknown entity'} ·{' '}
                {item.brief.estimatedHours}h estimated
              </p>
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className="text-[10px] text-slate-500">
                {new Date(item.queuedAt).toLocaleDateString('en-KE', {
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
              <button
                onClick={handleAssign}
                className="mt-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                Assign →
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
