'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { EXPERTISE_LABELS } from '@/lib/constants'
import { SubmitWorkModal } from '@/components/my-work/submit-work-modal'
import { notifyDashboardRefresh } from '@/lib/notify-dashboard'

interface StaffProfile {
  id: string
  fullName: string
  designation: string
  seniority: string
}

interface TodayWorkload {
  hoursAllocated: number
  briefCount: number
  completedCount: number
}

interface Assignment {
  allocationId: string
  allocationMethod: string
  hoursAllocated: number
  allocatedAt: string
  notes: string | null
    brief: {
    id: string
    referenceNumber: string
    subject: string
    description: string | null
    expertiseArea: string
    subType: string
    urgency: string
    status: string
    dueDate: string | null
    estimatedHours: number
    submittingEntity: string | null
    attachments: {
      id: string
      fileName: string
      fileType: string
      fileSize: number
      storedPath: string
    }[]
  }
}

interface HistoryItem {
  allocationId: string
  hoursAllocated: number
  allocatedAt: string
  brief: {
    id: string
    referenceNumber: string
    subject: string
    status: string
    expertiseArea: string
  }
}

interface AllocationsResponse {
  staff: StaffProfile
  todayWorkload: TodayWorkload
  currentAssignments: Assignment[]
  history: HistoryItem[]
}

function statusBadgeVariant(status: string): 'default' | 'success' | 'danger' | 'warning' | 'info' {
  switch (status) {
    case 'COMPLETED':
      return 'success'
    case 'IN_PROGRESS':
      return 'warning'
    case 'ALLOCATED':
      return 'info'
    case 'CLOSED':
      return 'default'
    default:
      return 'default'
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  return `${diffDays}d ago`
}

function subTypeLabel(subType: string): string {
  const map: Record<string, string> = {
    CLEARANCE: 'Clearance Review',
    TERMINATION: 'Termination Review',
    LEGAL_OPINION: 'Legal Opinion',
    STANDARD: 'Standard Review',
    ADVISORY: 'Legal Advisory',
  }
  return map[subType] ?? subType.replace(/_/g, ' ')
}

function allocationMethodLabel(method: string): string {
  const map: Record<string, string> = {
    AUTO_EXPERTISE: 'Auto-assigned (Expertise Match)',
    AUTO_SENIORITY: 'Auto-assigned (Seniority Priority)',
    AUTO_REPEAT_MATTER: 'Assigned as Prior Handling Counsel',
    MANUAL_DSG: 'Manually Assigned by DSG',
  }
  return map[method] ?? method.replace(/_/g, ' ')
}

function cleanNotes(notes: string | null, allocationMethod: string): string | null {
  if (!notes) return null

  const autoMethods = ['AUTO_EXPERTISE', 'AUTO_SENIORITY', 'AUTO_REPEAT_MATTER']
  if (autoMethods.includes(allocationMethod)) {
    const genericFallback: Record<string, string> = {
      AUTO_EXPERTISE: 'Auto-allocated based on expertise area',
      AUTO_SENIORITY: 'Auto-allocated based on seniority (urgent brief)',
      AUTO_REPEAT_MATTER: 'Assigned as prior handling counsel',
    }
    return genericFallback[allocationMethod] ?? 'Automatically allocated'
  }

  return notes
    .replace(/\n?staffId=[^\s]*/g, '')
    .replace(/\n?seniority=[^\s]*/g, '')
    .replace(/\n?hoursToday=[^\s]*/g, '')
    .replace(/\n?expertise=[^\s]*/g, '')
    .trim() || null
}

interface UploadedFileInfo {
  fileName: string
  storedName: string
  fileType: string
  fileSize: number
}

interface CompletionData {
  completionNotes: string | null
  uploadedFiles: UploadedFileInfo[] | null
  uploadedFile: UploadedFileInfo | null
  followUpNotes: string | null
}

function parseCompletionNotes(notes: string | null): CompletionData | null {
  if (!notes) return null
  try {
    const parsed = JSON.parse(notes)
    if (parsed && (parsed.completionNotes || parsed.uploadedFile || parsed.uploadedFiles || parsed.followUpNotes)) {
      return {
        completionNotes: parsed.completionNotes ?? null,
        uploadedFiles: parsed.uploadedFiles ?? null,
        uploadedFile: parsed.uploadedFile ?? null,
        followUpNotes: parsed.followUpNotes ?? null,
      }
    }
    return null
  } catch {
    return null
  }
}

export default function MyWorkPage() {
  const [data, setData] = useState<AllocationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transitioningId, setTransitioningId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')
  const [selectedBrief, setSelectedBrief] = useState<Assignment | null>(null)
  const [submitModalAllocationId, setSubmitModalAllocationId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/me/allocations')
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `Request failed (${res.status})`)
      }
      const json: AllocationsResponse = await res.json()
      setData(json)

      setSelectedBrief((prev) => {
        if (!prev) return null
        const updated = json.currentAssignments.find(
          (a) => a.allocationId === prev.allocationId,
        )
        return updated ?? null
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load data'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectedBrief) {
        setSelectedBrief(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedBrief])

  const handleStatusTransition = useCallback(
    async (allocationId: string, newStatus: 'IN_PROGRESS' | 'COMPLETED') => {
      setTransitioningId(allocationId)
      try {
        const res = await fetch(`/api/me/allocations/${allocationId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error || `Transition failed (${res.status})`)
        }
        await fetchData()
        notifyDashboardRefresh()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update status'
        setError(message)
      } finally {
        setTransitioningId(null)
      }
    },
    [fetchData],
  )

  const handleOpenSubmitModal = useCallback((allocationId: string) => {
    setSubmitModalAllocationId(allocationId)
  }, [])

  const handleSubmitWork = useCallback(
    async (formData: { completionNotes: string; documents: File[]; followUpNotes: string }) => {
      if (!submitModalAllocationId) return

      setTransitioningId(submitModalAllocationId)
      try {
        const fd = new FormData()
        fd.append('status', 'COMPLETED')
        if (formData.completionNotes) fd.append('completionNotes', formData.completionNotes)
        if (formData.followUpNotes) fd.append('followUpNotes', formData.followUpNotes)
        for (const doc of formData.documents) {
          fd.append('document', doc)
        }

        const res = await fetch(`/api/me/allocations/${submitModalAllocationId}/status`, {
          method: 'PATCH',
          body: fd,
        })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error || `Transition failed (${res.status})`)
        }
        setSubmitModalAllocationId(null)
        await fetchData()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update status'
        setError(message)
      } finally {
        setTransitioningId(null)
      }
    },
    [submitModalAllocationId, fetchData],
  )

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="h-8 w-48 bg-slate-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-panel p-5 h-24 bg-slate-800/50 animate-pulse" />
          ))}
        </div>
        <div className="glass-panel p-6 h-64 bg-slate-800/50 animate-pulse" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="glass-panel p-8 text-center max-w-md">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-sm text-slate-300 mb-2">Unable to load your assignments</p>
          <p className="text-xs text-slate-500 mb-4">{error}</p>
          <button
            onClick={() => {
              setLoading(true)
              fetchData()
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const staff = data?.staff
  const workload = data?.todayWorkload
  const active = data?.currentAssignments ?? []
  const history = data?.history ?? []

  return (
    <div className="space-y-4 animate-fade-in">
      {error && (
        <div className="px-4 py-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
          </svg>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div>
        <h1 className="text-lg font-bold text-white">
          Welcome{staff?.fullName ? `, ${staff.fullName.split(' ')[0]}` : ''}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {staff?.designation}
          {staff?.seniority && (
            <span className="ml-1.5 text-amber-500/80">
              ({staff.seniority.replace(/_/g, ' ')})
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass-panel p-5 border border-slate-700/50 animate-slide-up">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Today&apos;s Hours
              </p>
              <p className="text-2xl font-bold text-white tabular-nums">
                {workload?.hoursAllocated ?? 0}
                <span className="text-sm font-normal text-slate-400 ml-0.5">h</span>
              </p>
            </div>
            <div className="w-10 h-10 flex items-center justify-center rounded-lg border bg-slate-700/30 text-slate-300 border-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 border border-slate-700/50 animate-slide-up" style={{ animationDelay: '0.05s' }}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Briefs Today
              </p>
              <p className="text-2xl font-bold text-white tabular-nums">
                {workload?.briefCount ?? 0}
              </p>
            </div>
            <div className="w-10 h-10 flex items-center justify-center rounded-lg border bg-amber-500/10 text-amber-400 border-amber-500/30">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 border border-slate-700/50 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Completed
              </p>
              <p className="text-2xl font-bold text-white tabular-nums">
                {workload?.completedCount ?? 0}
              </p>
            </div>
            <div className="w-10 h-10 flex items-center justify-center rounded-lg border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-slate-900/50 rounded-lg w-fit border border-slate-800/60">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'active'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Active
          {active.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-400">
              {active.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'history'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          History
          {history.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-slate-700 text-slate-300">
              {history.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'active' && (
        <div className="space-y-3 animate-fade-in">
          {active.length === 0 ? (
            <div className="glass-panel p-12 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-sm text-slate-300">No active assignments</p>
              <p className="text-xs text-slate-500 mt-1">New briefs assigned to you will appear here</p>
            </div>
          ) : (
            active.map((item) => {
              const isTransitioning = transitioningId === item.allocationId
              const isAllocated = item.brief.status === 'ALLOCATED'

              return (
                <div
                  key={item.allocationId}
                  className={`glass-panel p-5 border border-slate-700/50 transition-opacity cursor-pointer hover:border-slate-600/80 ${
                    isTransitioning ? 'opacity-60' : ''
                  }`}
                  onClick={() => setSelectedBrief(item)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-amber-400/80">
                          {item.brief.referenceNumber}
                        </span>
                        <Badge variant={statusBadgeVariant(item.brief.status)}>
                          {statusLabel(item.brief.status)}
                        </Badge>
                        {item.brief.urgency !== 'ROUTINE' && (
                          <Badge
                            variant={
                              item.brief.urgency === 'EMERGENCY' ? 'danger' : 'warning'
                            }
                          >
                            {item.brief.urgency}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-white font-medium leading-snug">
                        {item.brief.subject}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                        {item.brief.submittingEntity && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            {item.brief.submittingEntity}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {item.hoursAllocated}h allocated
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatRelativeDate(item.allocatedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 sm:ml-4" onClick={(e) => e.stopPropagation()}>
                      {isAllocated ? (
                        <button
                          onClick={() =>
                            handleStatusTransition(item.allocationId, 'IN_PROGRESS')
                          }
                          disabled={isTransitioning}
                          className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          {isTransitioning ? (
                            <>
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Processing...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Start Work
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            handleOpenSubmitModal(item.allocationId)
                          }
                          disabled={isTransitioning}
                          className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          {isTransitioning ? (
                            <>
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Processing...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Submit Work
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="glass-panel border border-slate-700/50 overflow-hidden animate-fade-in">
          {history.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-slate-300">No assignment history</p>
              <p className="text-xs text-slate-500 mt-1">Completed briefs will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Reference
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                      Subject
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">
                      Expertise
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Hours
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {history.map((item) => (
                    <tr
                      key={item.allocationId}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-amber-400/80 whitespace-nowrap">
                        {item.brief.referenceNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-200 max-w-xs truncate hidden sm:table-cell">
                        {item.brief.subject}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell whitespace-nowrap">
                        {item.brief.expertiseArea.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadgeVariant(item.brief.status)}>
                          {statusLabel(item.brief.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300 tabular-nums whitespace-nowrap">
                        {item.hoursAllocated}h
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400 text-xs whitespace-nowrap hidden sm:table-cell">
                        {new Date(item.allocatedAt).toLocaleDateString('en-KE', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedBrief && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 opacity-100"
            onClick={() => setSelectedBrief(null)}
          />
          <div className="fixed top-0 right-0 z-50 h-full w-full sm:w-[480px] bg-slate-950/95 border-l border-slate-800/60 backdrop-blur-xl shadow-2xl transform transition-transform duration-300 ease-out translate-x-0">
            <div className="flex flex-col h-full pb-6">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60 shrink-0">
                <h2 className="text-sm font-semibold text-white truncate">
                  Brief Details
                </h2>
                <button
                  onClick={() => setSelectedBrief(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
                  aria-label="Close details"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <span className="text-xs font-mono text-amber-400/80">
                        {selectedBrief.brief.referenceNumber}
                      </span>
                      <h3 className="text-lg font-bold text-white tracking-tight">
                        {selectedBrief.brief.subject}
                      </h3>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge variant={statusBadgeVariant(selectedBrief.brief.status)}>
                        {statusLabel(selectedBrief.brief.status)}
                      </Badge>
                      <Badge
                        variant={
                          selectedBrief.brief.urgency === 'EMERGENCY'
                            ? 'danger'
                            : selectedBrief.brief.urgency === 'URGENT'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {selectedBrief.brief.urgency}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500">Submitting Entity</span>
                    <p className="text-slate-200 mt-0.5">
                      {selectedBrief.brief.submittingEntity || '\u2014'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Expertise Area</span>
                    <p className="text-slate-200 mt-0.5 truncate">
                      {EXPERTISE_LABELS[selectedBrief.brief.expertiseArea as keyof typeof EXPERTISE_LABELS] || selectedBrief.brief.expertiseArea}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Sub Type</span>
                    <p className="text-slate-200 mt-0.5">
                      {subTypeLabel(selectedBrief.brief.subType)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Estimated Hours</span>
                    <p className="text-slate-200 mt-0.5">
                      {selectedBrief.brief.estimatedHours}h
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Hours Allocated</span>
                    <p className="text-slate-200 mt-0.5">
                      {selectedBrief.hoursAllocated}h
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Due Date</span>
                    <p className="text-slate-200 mt-0.5">
                      {selectedBrief.brief.dueDate
                        ? new Date(selectedBrief.brief.dueDate).toLocaleDateString('en-KE', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '\u2014'}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/60">
                  <span className="text-xs text-slate-500">Assignment</span>
                  <div className="mt-2 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Method</span>
                      <span className="text-slate-200">
                        {allocationMethodLabel(selectedBrief.allocationMethod)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Allocated</span>
                      <span className="text-slate-200">
                        {new Date(selectedBrief.allocatedAt).toLocaleString('en-KE', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedBrief.brief.description && (
                  <div className="pt-4 border-t border-slate-800/60">
                    <span className="text-xs text-slate-500">Description</span>
                    <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap">
                      {selectedBrief.brief.description}
                    </p>
                  </div>
                )}

                {selectedBrief.brief.attachments.length > 0 && (
                  <div className="pt-4 border-t border-slate-800/60">
                    <span className="text-xs text-slate-500">Attachments</span>
                    <div className="mt-2 space-y-2">
                      {selectedBrief.brief.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={`/api/uploads/briefs/${selectedBrief.brief.id}/${att.storedPath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 glass-panel p-3 hover:bg-slate-800/50 transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                            {att.fileType.includes('pdf') ? (
                              <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            ) : att.fileType.includes('image') ? (
                              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-200 truncate group-hover:text-amber-400 transition-colors">
                              {att.fileName}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {att.fileType.split('/').pop()?.toUpperCase()} · {Math.round(att.fileSize / 1024)} KB
                            </p>
                          </div>
                          <svg className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {selectedBrief.brief.status === 'COMPLETED' &&
                  parseCompletionNotes(selectedBrief.notes) && (
                    <div className="pt-4 border-t border-slate-800/60 space-y-3">
                      <span className="text-xs text-slate-500">Submission Details</span>
                      {(() => {
                        const cd = parseCompletionNotes(selectedBrief.notes)!
                        return (
                          <div className="space-y-3 text-xs">
                            {cd.completionNotes && (
                              <div>
                                <span className="text-slate-400">Work Summary</span>
                                <p className="text-slate-200 mt-0.5 whitespace-pre-wrap">
                                  {cd.completionNotes}
                                </p>
                              </div>
                            )}
                            {(() => {
                              const files = cd.uploadedFiles ?? (cd.uploadedFile ? [cd.uploadedFile] : [])
                              return files.length > 0 ? (
                                <div>
                                  <span className="text-slate-400">{files.length === 1 ? 'Uploaded Document' : 'Uploaded Documents'}</span>
                                  <div className="mt-1 space-y-1">
                                    {files.map((f, i) => (
                                      <p key={i}>
                                        <a
                                          href={`/api/uploads/completions/${selectedBrief.allocationId}/${f.storedName}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 underline underline-offset-2"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                          {f.fileName}
                                        </a>
                                        <span className="text-slate-500 ml-2">
                                          ({f.fileType.split('/').pop()?.toUpperCase()}, {Math.round(f.fileSize / 1024)} KB)
                                        </span>
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              ) : null
                            })()}
                            {cd.followUpNotes && (
                              <div>
                                <span className="text-slate-400">Follow-up Notes</span>
                                <p className="text-slate-200 mt-0.5 whitespace-pre-wrap">
                                  {cd.followUpNotes}
                                </p>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}

                {selectedBrief.brief.status !== 'COMPLETED' &&
                  cleanNotes(selectedBrief.notes, selectedBrief.allocationMethod) && (
                  <div className="pt-4 border-t border-slate-800/60">
                    <span className="text-xs text-slate-500">Notes</span>
                    <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap">
                      {cleanNotes(selectedBrief.notes, selectedBrief.allocationMethod)}
                    </p>
                  </div>
                )}
              </div>

              <div className="shrink-0 px-5 pt-4 border-t border-slate-800/60">
                {selectedBrief.brief.status === 'ALLOCATED' ? (
                  <button
                    onClick={() => {
                      handleStatusTransition(selectedBrief.allocationId, 'IN_PROGRESS')
                    }}
                    disabled={transitioningId === selectedBrief.allocationId}
                    className="w-full px-4 py-2.5 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {transitioningId === selectedBrief.allocationId ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Start Working
                      </>
                    )}
                  </button>
                ) : selectedBrief.brief.status === 'IN_PROGRESS' ? (
                  <button
                    onClick={() => {
                      handleOpenSubmitModal(selectedBrief.allocationId)
                    }}
                    disabled={transitioningId === selectedBrief.allocationId}
                    className="w-full px-4 py-2.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {transitioningId === selectedBrief.allocationId ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Mark as Complete
                      </>
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}

      {submitModalAllocationId && (() => {
        const target = active.find((a) => a.allocationId === submitModalAllocationId)
        if (!target) return null
        return (
          <SubmitWorkModal
            referenceNumber={target.brief.referenceNumber}
            subject={target.brief.subject}
            submitting={transitioningId === submitModalAllocationId}
            onSubmit={handleSubmitWork}
            onClose={() => setSubmitModalAllocationId(null)}
          />
        )
      })()}
    </div>
  )
}
