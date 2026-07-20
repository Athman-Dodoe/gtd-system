'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { DAILY_CAPACITY_HOURS } from '@/lib/constants'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { StaffProfileDrawer } from '@/components/staff/staff-profile-drawer'
import { AddStaffModal } from '@/components/staff/add-staff-modal'

interface StaffExpertise {
  expertiseArea: string
  isPrimary: boolean
}

interface StaffMember {
  id: string
  employeeNumber: string
  fullName: string
  designation: string
  seniority: string
  isActive: boolean
  dateJoined: string
  expertiseAreas: StaffExpertise[]
  today: {
    hoursAllocated: number
    briefCount: number
  }
}

interface StaffRegistryProps {
  staff: StaffMember[]
  initialStaffId?: string
}

const SENIORITY_OPTIONS = ['SENIOR', 'PRINCIPAL', 'DEPUTY_CHIEF'] as const

const seniorityStyles: Record<string, 'warning' | 'info' | 'default'> = {
  DEPUTY_CHIEF: 'warning',
  PRINCIPAL: 'info',
  SENIOR: 'default',
}

const seniorityLabels: Record<string, string> = {
  DEPUTY_CHIEF: 'Deputy Chief',
  PRINCIPAL: 'Principal',
  SENIOR: 'Senior',
}

const expertiseShortLabels: Record<string, string> = {
  PUBLIC_PROCUREMENT_CONTRACTS: 'Procurement',
  FINANCING_AGREEMENTS: 'Financing',
  PPP_PROJECT_AGREEMENTS: 'PPP',
  MEMORANDA_OF_UNDERSTANDING: 'MOUs',
  CABINET_MEMORANDA: 'Cabinet Memos',
  GENERAL_LEGAL_ADVISORY: 'Legal Advisory',
}

export function StaffRegistry({ staff: initialStaff, initialStaffId }: StaffRegistryProps) {
  const [staffList, setStaffList] = useState<StaffMember[]>(initialStaff)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery)
  const [seniorityFilter, setSeniorityFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(initialStaffId ?? null)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetchStaffList = useCallback(async () => {
    try {
      const res = await fetch('/api/staff')
      if (res.ok) {
        const data = await res.json()
        setStaffList(data)
      }
    } catch {
      // silently fail
    }
  }, [])

  const handleAddSuccess = useCallback(() => {
    setAddModalOpen(false)
    setToast({ message: 'Counsel added successfully', type: 'success' })
    fetchStaffList()
  }, [fetchStaffList])

  const handleStaffRemoved = useCallback((removedId: string) => {
    setStaffList((prev) => prev.filter((s) => s.id !== removedId))
    setSelectedStaffId(null)
    setToast({ message: 'Staff member removed successfully', type: 'success' })
  }, [])

  const handleStaffUpdated = useCallback(() => {
    fetchStaffList()
    setToast({ message: 'Staff profile updated successfully', type: 'success' })
  }, [fetchStaffList])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleToggleActive = useCallback(async (staffId: string, currentActive: boolean) => {
    setTogglingIds((prev) => new Set(prev).add(staffId))

    setStaffList((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, isActive: !currentActive } : s)),
    )

    try {
      const res = await fetch(`/api/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Failed to update status')
      }
    } catch {
      setStaffList((prev) =>
        prev.map((s) => (s.id === staffId ? { ...s, isActive: currentActive } : s)),
      )
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(staffId)
        return next
      })
    }
  }, [])

  const toggleSeniority = useCallback((level: string) => {
    setSeniorityFilter((prev) => {
      const next = new Set(prev)
      if (next.has(level)) {
        next.delete(level)
      } else {
        next.add(level)
      }
      return next
    })
  }, [])

  const filtered = staffList.filter((s) => {
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      if (!s.fullName.toLowerCase().includes(q) && !s.designation.toLowerCase().includes(q)) {
        return false
      }
    }

    if (seniorityFilter.size > 0 && !seniorityFilter.has(s.seniority)) {
      return false
    }

    if (statusFilter === 'active' && !s.isActive) return false
    if (statusFilter === 'inactive' && s.isActive) return false

    return true
  })

  return (
    <>
      <div className="space-y-4">
        <div className="glass-panel p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or designation..."
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
              />
            </div>
            <button
              onClick={() => setAddModalOpen(true)}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Staff
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 font-medium mr-1">Seniority:</span>
            {SENIORITY_OPTIONS.map((level) => (
              <button
                key={level}
                onClick={() => toggleSeniority(level)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  seniorityFilter.has(level)
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {seniorityLabels[level]}
              </button>
            ))}

            <span className="text-xs text-slate-500 font-medium ml-3 mr-1">Status:</span>
            {(['all', 'active', 'inactive'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setStatusFilter(opt)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  statusFilter === opt
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}

            {(searchQuery || seniorityFilter.size > 0 || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSeniorityFilter(new Set())
                  setStatusFilter('all')
                }}
                className="text-xs text-slate-500 hover:text-slate-300 ml-auto transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-700/30 border border-slate-600 flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-400">No counsel found</p>
              <p className="text-xs text-slate-500 mt-1">
                Try adjusting your search or filter criteria
              </p>
            </div>
          </Card>
        ) : (
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${selectedStaffId ? '' : 'lg:grid-cols-3'}`}>
            {filtered.map((member, i) => {
              const pct = Math.round(
                (member.today.hoursAllocated / DAILY_CAPACITY_HOURS) * 100,
              )
              return (
                <div
                  key={member.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <Card hover className="p-4 cursor-pointer">
                    <div
                      onClick={() => setSelectedStaffId(member.id)}
                      className="space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold truncate ${member.isActive ? 'text-white' : 'text-slate-500'}`}>
                              {member.fullName}
                            </span>
                            {!member.isActive && (
                              <span className="text-[10px] text-slate-500 font-medium px-1.5 py-0.5 rounded-full bg-slate-700/30 border border-slate-600 shrink-0">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 truncate">
                            {member.designation}
                          </p>
                        </div>
                        <Badge
                          variant={seniorityStyles[member.seniority] || 'default'}
                          className="shrink-0"
                        >
                          {seniorityLabels[member.seniority] || member.seniority}
                        </Badge>
                      </div>

                      {member.expertiseAreas.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {member.expertiseAreas.slice(0, 2).map((area) => (
                            <span
                              key={area.expertiseArea}
                              className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                area.isPrimary
                                  ? 'bg-amber-950/30 border-amber-700/40 text-amber-300'
                                  : 'bg-slate-700/30 border-slate-600 text-slate-400'
                              }`}
                            >
                              {expertiseShortLabels[area.expertiseArea] || area.expertiseArea}
                            </span>
                          ))}
                          {member.expertiseAreas.length > 2 && (
                            <span className="text-[10px] text-slate-500">
                              +{member.expertiseAreas.length - 2}
                            </span>
                          )}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-400">
                            Workload
                          </span>
                          <span className="text-xs text-slate-500 tabular-nums">
                            {member.today.hoursAllocated.toFixed(1)}h / {DAILY_CAPACITY_HOURS}h
                          </span>
                        </div>
                        <ProgressBar
                          value={member.today.hoursAllocated}
                          max={DAILY_CAPACITY_HOURS}
                        />
                        {pct >= 85 && member.isActive && (
                          <p className="text-[10px] text-rose-400 mt-1">
                            Near capacity
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-700/50 pt-3 mt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Active</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={member.isActive}
                          disabled={togglingIds.has(member.id)}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleActive(member.id, member.isActive)
                          }}
                          className={`relative w-10 h-5 rounded-full p-0.5 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${
                            member.isActive ? 'bg-emerald-500' : 'bg-slate-600'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                              member.isActive ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </Card>
                </div>
              )
            })}
          </div>
        )}

        <div className="text-xs text-slate-600 text-right">
          Showing {filtered.length} of {staffList.length} counsel
        </div>
      </div>

      <StaffProfileDrawer
        staffId={selectedStaffId}
        onClose={() => setSelectedStaffId(null)}
        onStaffRemoved={handleStaffRemoved}
        onStaffUpdated={handleStaffUpdated}
      />

      <AddStaffModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />

      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-up">
          <div
            className={`glass-panel px-4 py-3 pr-10 flex items-center gap-2 text-sm ${
              toast.type === 'success'
                ? 'border-emerald-500/30'
                : 'border-rose-500/30'
            }`}
          >
            {toast.type === 'success' ? (
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
              </svg>
            )}
            <span className={toast.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}>
              {toast.message}
            </span>
            <button
              onClick={() => setToast(null)}
              className="absolute top-3 right-3 text-slate-500 hover:text-slate-300"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
