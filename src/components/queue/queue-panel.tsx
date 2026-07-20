'use client'

import { useState, useCallback } from 'react'
import { DAILY_CAPACITY_HOURS, EXPERTISE_LABELS } from '@/lib/constants'
import { notifyDashboardRefresh } from '@/lib/notify-dashboard'

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

interface StaffExpertise {
  expertiseArea: string
  isPrimary: boolean
}

interface StaffMember {
  id: string
  fullName: string
  designation: string
  seniority: string
  isActive: boolean
  expertiseAreas: StaffExpertise[]
  today: {
    hoursAllocated: number
    briefCount: number
  }
}

interface QueuePanelProps {
  queueItems: QueueItem[]
  staff: StaffMember[]
}

const URGENCY_STYLES: Record<string, string> = {
  ROUTINE: 'bg-slate-700/50 text-slate-300 border-slate-600',
  URGENT: 'bg-amber-950/50 text-amber-300 border-amber-700',
  EMERGENCY: 'bg-rose-950/50 text-rose-300 border-rose-700',
}

export function QueuePanel({ queueItems: initialItems, staff }: QueuePanelProps) {
  const [items, setItems] = useState<QueueItem[]>(initialItems)
  const [openAssignId, setOpenAssignId] = useState<string | null>(null)
  const [withdrawTarget, setWithdrawTarget] = useState<QueueItem | null>(null)
  const [withdrawNotes, setWithdrawNotes] = useState('')
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set())

  const activeStaff = staff.filter((s) => s.isActive)

  const getSortedStaff = useCallback(
    (brief: BriefInfo): StaffMember[] => {
      return [...activeStaff].sort((a, b) => {
        const aMatch = a.expertiseAreas.some((e) => e.expertiseArea === brief.expertiseArea) ? 1 : 0
        const bMatch = b.expertiseAreas.some((e) => e.expertiseArea === brief.expertiseArea) ? 1 : 0
        if (aMatch !== bMatch) return bMatch - aMatch
        return a.today.hoursAllocated - b.today.hoursAllocated
      })
    },
    [activeStaff],
  )

  const handleAssign = useCallback(
    async (queueId: string, brief: BriefInfo, staffId: string) => {
      setLoadingActions((prev) => new Set(prev).add(queueId))
      setActionErrors((prev) => {
        const next = { ...prev }
        delete next[queueId]
        return next
      })
      setOpenAssignId(null)

      setItems((prev) => prev.filter((i) => i.id !== queueId))

      try {
        const res = await fetch('/api/queue/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ briefId: brief.id, staffId }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error || 'Assignment failed')
        }
        notifyDashboardRefresh()
      } catch (err) {
        setItems((prev) => [
          ...prev,
          {
            id: queueId,
            queuedAt: new Date().toISOString(),
            queuedReason: err instanceof Error ? err.message : 'Assignment failed',
            brief,
          },
        ])
        setActionErrors((prev) => ({
          ...prev,
          [queueId]: err instanceof Error ? err.message : 'An unexpected error occurred',
        }))
      } finally {
        setLoadingActions((prev) => {
          const next = new Set(prev)
          next.delete(queueId)
          return next
        })
      }
    },
    [],
  )

  const handleWithdraw = useCallback(async () => {
    if (!withdrawTarget) return

    const { id: queueId, brief } = withdrawTarget

    setLoadingActions((prev) => new Set(prev).add(queueId))
    setActionErrors((prev) => {
      const next = { ...prev }
      delete next[queueId]
      return next
    })
    setWithdrawTarget(null)
    setWithdrawNotes('')

    setItems((prev) => prev.filter((i) => i.id !== queueId))

    try {
      const res = await fetch('/api/queue/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefId: brief.id,
          notes: withdrawNotes || undefined,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Withdrawal failed')
      }
      notifyDashboardRefresh()
    } catch (err) {
      setItems((prev) => [
        ...prev,
        {
          id: queueId,
          queuedAt: new Date().toISOString(),
          queuedReason: err instanceof Error ? err.message : 'Withdrawal failed',
          brief,
        },
      ])
      setActionErrors((prev) => ({
        ...prev,
        [queueId]: err instanceof Error ? err.message : 'An unexpected error occurred',
      }))
    } finally {
      setLoadingActions((prev) => {
        const next = new Set(prev)
        next.delete(queueId)
        return next
      })
    }
  }, [withdrawTarget, withdrawNotes])

  if (items.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-white">Queue is Clear</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          All briefs have been allocated. When staff reach capacity, new briefs will appear here for manual assignment.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="glass-panel p-4 space-y-3 animate-fade-in"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white truncate">
                    {item.brief.referenceNumber}
                  </span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${URGENCY_STYLES[item.brief.urgency] || URGENCY_STYLES.ROUTINE}`}>
                    {item.brief.urgency}
                  </span>
                </div>
                <p className="text-sm text-slate-300 truncate">{item.brief.subject}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="relative">
                  <button
                    onClick={() => setOpenAssignId(openAssignId === item.id ? null : item.id)}
                    disabled={loadingActions.has(item.id)}
                    className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                  >
                    Assign
                  </button>
                  {openAssignId === item.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setOpenAssignId(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 z-20 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                        {getSortedStaff(item.brief).map((staffMember) => {
                          const pct = Math.round(
                            (staffMember.today.hoursAllocated / DAILY_CAPACITY_HOURS) * 100,
                          )
                          return (
                            <button
                              key={staffMember.id}
                              onClick={() => handleAssign(item.id, item.brief, staffMember.id)}
                              className="w-full text-left px-3 py-2.5 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-white font-medium">
                                  {staffMember.fullName}
                                </span>
                                <span className="text-[10px] text-slate-400 tabular-nums">
                                  {staffMember.today.hoursAllocated.toFixed(1)}h / {DAILY_CAPACITY_HOURS}h
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-slate-500">{staffMember.designation}</span>
                                {staffMember.expertiseAreas.some(
                                  (e) => e.expertiseArea === item.brief.expertiseArea,
                                ) && (
                                  <span className="text-[10px] text-emerald-400 font-medium">
                                    Expertise match
                                  </span>
                                )}
                              </div>
                              <div className="mt-1.5 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    pct >= 85 ? 'bg-rose-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setWithdrawTarget(item)}
                  disabled={loadingActions.has(item.id)}
                  className="px-3 py-1.5 border border-slate-600 text-slate-400 rounded-lg text-xs font-medium hover:border-rose-500/30 hover:text-rose-400 transition-colors disabled:opacity-50"
                >
                  Withdraw
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500">Entity</span>
                <p className="text-slate-300 truncate mt-0.5">
                  {item.brief.submittingEntity || '—'}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Expertise</span>
                <p className="text-slate-300 truncate mt-0.5">
                  {EXPERTISE_LABELS[item.brief.expertiseArea as keyof typeof EXPERTISE_LABELS] || item.brief.expertiseArea}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Received</span>
                <p className="text-slate-300 mt-0.5">
                  {new Date(item.brief.receivedAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Est. Hours</span>
                <p className="text-slate-300 mt-0.5">{item.brief.estimatedHours}h</p>
              </div>
            </div>

            <div className="text-xs">
              <span className="text-slate-500">Queue reason: </span>
              <span className="text-slate-400">{item.queuedReason}</span>
            </div>

            {actionErrors[item.id] && (
              <div className="bg-rose-950/30 border border-rose-500/30 rounded-lg p-2 text-xs text-rose-300">
                {actionErrors[item.id]}
              </div>
            )}
          </div>
        ))}
      </div>

      {withdrawTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md p-5 animate-slide-up space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Withdraw Brief</h3>
              <p className="text-xs text-slate-400 mt-1">
                {withdrawTarget.brief.referenceNumber} — {withdrawTarget.brief.subject}
              </p>
            </div>

            <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">
              This will close the brief and remove it from the queue. The brief will no longer be eligible for automatic or manual allocation.
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-400">
                Reason for withdrawal
              </label>
              <textarea
                value={withdrawNotes}
                onChange={(e) => setWithdrawNotes(e.target.value)}
                placeholder="Optional justification..."
                rows={3}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => {
                  setWithdrawTarget(null)
                  setWithdrawNotes('')
                }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                className="px-4 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-500/20 transition-colors"
              >
                Confirm Withdrawal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
