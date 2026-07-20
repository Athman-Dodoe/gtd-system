'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'

interface ActivityItem {
  id: string
  eventType: string
  occurredAt: string
  payload: Record<string, unknown> | null
  actorName: string | null
  briefReference: string | null
  briefSubject: string | null
  staffName: string | null
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function getEventInfo(eventType: string) {
  switch (eventType) {
    case 'BRIEF_ALLOCATED':
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ),
        ring: 'ring-emerald-500/30 bg-emerald-500/10 text-emerald-400',
      }
    case 'BRIEF_QUEUED':
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        ring: 'ring-amber-500/30 bg-amber-500/10 text-amber-400',
      }
    case 'BRIEF_REALLOCATED':
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        ),
        ring: 'ring-sky-500/30 bg-sky-500/10 text-sky-400',
      }
    case 'BRIEF_CLOSED':
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ),
        ring: 'ring-slate-500/30 bg-slate-500/10 text-slate-400',
      }
    case 'STAFF_CREATED':
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ),
        ring: 'ring-blue-500/30 bg-blue-500/10 text-blue-400',
      }
    case 'MANUAL_ASSIGNMENT_BY_DSG':
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        ),
        ring: 'ring-yellow-500/30 bg-yellow-500/10 text-yellow-400',
      }
    case 'BRIEF_STATUS_CHANGED':
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        ),
        ring: 'ring-violet-500/30 bg-violet-500/10 text-violet-400',
      }
    default:
      return {
        icon: (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        ring: 'ring-slate-600/30 bg-slate-600/10 text-slate-400',
      }
  }
}

function describeEvent(
  eventType: string,
  briefRef: string | null,
  staffName: string | null,
  payload: Record<string, unknown> | null,
): string {
  const ref = briefRef || 'Brief'

  switch (eventType) {
    case 'BRIEF_ALLOCATED':
      return `${ref} allocated to ${staffName || 'counsel'}`
    case 'BRIEF_QUEUED':
      return `${ref} queued — no capacity`
    case 'BRIEF_REALLOCATED':
      return `${ref} reallocated to ${staffName || 'counsel'}`
    case 'BRIEF_CLOSED':
      return `${ref} closed`
    case 'BRIEF_DEQUEUED':
      return `${ref} dequeued`
    case 'BRIEF_RECEIVED':
      return `${ref} received`
    case 'BRIEF_STATUS_CHANGED': {
      const prev = (payload?.previousStatus as string) || null
      const next = (payload?.newStatus as string) || null
      if (prev && next) {
        return `${ref} ${prev.replace(/_/g, ' ').toLowerCase()} → ${next.replace(/_/g, ' ').toLowerCase()}`
      }
      return `${ref} status changed`
    }
    case 'STAFF_CREATED':
      return `${staffName || 'New staff'} added to registry`
    case 'STAFF_UPDATED':
      return `${staffName || 'Staff'} updated`
    case 'STAFF_DEACTIVATED':
      return `${staffName || 'Staff'} deactivated`
    case 'CAPACITY_OVERRIDE':
      return `Capacity override for ${staffName || 'staff'}`
    case 'REPEAT_MATTER_DETECTED':
      return `Repeat matter detected — ${ref}`
    case 'REPEAT_MATTER_FALLBACK':
      return `Fallback applied for ${ref}`
    case 'MANUAL_ASSIGNMENT_BY_DSG':
      return `DSG manually assigned ${ref} to ${staffName || 'counsel'}`
    default:
      return `${eventType.replace(/_/g, ' ').toLowerCase()}`
  }
}

function Skeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-slate-700/50 shrink-0" />
            <div className="h-3 bg-slate-700/50 rounded w-32" />
          </div>
          <div className="h-2.5 bg-slate-700/30 rounded w-10" />
        </div>
      ))}
    </div>
  )
}

export function RecentActivity() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/activity')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = (await res.json()) as ActivityItem[]
      setItems(data)
    } catch {
      console.warn('[RecentActivity] fetch failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActivity()
    const id = setInterval(fetchActivity, 30_000)
    return () => clearInterval(id)
  }, [fetchActivity])

  const displayItems = items.slice(0, 5)

  return (
    <Card className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">
          Recent Activity{' '}
          <span className="text-slate-500 font-normal">· Latest 5</span>
        </h3>
        {!loading && (
          <span className="text-[10px] text-slate-500">30s refresh</span>
        )}
      </div>

      {loading ? (
        <Skeleton />
      ) : displayItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
          <div className="w-12 h-12 rounded-full bg-slate-700/30 border border-slate-600 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-400">No recent activity</p>
          <p className="text-xs text-slate-500 mt-1">System events will appear here</p>
        </div>
      ) : (
        <div className="space-y-2 flex-1">
          {displayItems.map((item, i) => {
            const info = getEventInfo(item.eventType)
            return (
              <div
                key={item.id}
                className="animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-7 h-7 rounded-full ring-1 flex items-center justify-center shrink-0 ${info.ring}`}>
                      {info.icon}
                    </div>
                    <p className="text-sm text-slate-200 truncate">
                      {describeEvent(item.eventType, item.briefReference, item.staffName, item.payload)}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500 tabular-nums shrink-0 ml-2">
                    {timeAgo(item.occurredAt)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 ml-9">
                  {item.actorName || 'System'}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
