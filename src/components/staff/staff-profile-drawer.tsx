'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { DAILY_CAPACITY_HOURS, EXPERTISE_LABELS } from '@/lib/constants'
import { UpdateStaffSchema } from '@/lib/schemas/staff'

interface ProfileExpertise {
  expertiseArea: string
  isPrimary: boolean
}

interface AllocationItem {
  id: string
  briefId: string
  brief: { referenceNumber: string; subject: string }
  allocationMethod: string
  hoursAllocated: number
  allocatedAt: string
  isActive: boolean
}

interface StaffProfile {
  id: string
  employeeNumber: string
  fullName: string
  designation: string
  email: string
  seniority: string
  isActive: boolean
  dateJoined: string
  expertiseAreas: ProfileExpertise[]
  today: { hoursAllocated: number; briefCount: number }
  allocations: AllocationItem[]
}

interface WorkloadEntry {
  workDate: string
  hoursAllocated: number
  briefCount: number
}

interface StaffProfileDrawerProps {
  staffId: string | null
  onClose: () => void
  onStaffRemoved?: (staffId: string) => void
  onStaffUpdated?: () => void
}

interface EditFormData {
  fullName: string
  designation: string
  email: string
  seniority: string
  isActive: boolean
  primaryExpertise: string
  additionalExpertise: string[]
}

const seniorityLabels: Record<string, string> = {
  DEPUTY_CHIEF: 'Deputy Chief',
  PRINCIPAL: 'Principal',
  SENIOR: 'Senior',
}

const seniorityBadgeVariant: Record<string, 'warning' | 'info' | 'default'> = {
  DEPUTY_CHIEF: 'warning',
  PRINCIPAL: 'info',
  SENIOR: 'default',
}

const CHART_WIDTH = 600
const CHART_HEIGHT = 220
const CHART_PAD = { top: 16, right: 16, bottom: 32, left: 40 }
const PLOT_W = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right
const PLOT_H = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function WorkloadChart({ data }: { data: WorkloadEntry[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-xs text-slate-500">
        No workload data available
      </div>
    )
  }

  const sorted = [...data].sort(
    (a, b) => new Date(a.workDate).getTime() - new Date(b.workDate).getTime(),
  )
  const n = sorted.length
  const maxHours = DAILY_CAPACITY_HOURS

  const xScale = (i: number) => CHART_PAD.left + (i / Math.max(n - 1, 1)) * PLOT_W
  const yScale = (v: number) => CHART_PAD.top + (1 - v / maxHours) * PLOT_H

  const areaPath = sorted
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(d.hoursAllocated).toFixed(1)}`)
    .join('')

  const linePath = areaPath

  const yTicks = [0, 2, 4, 6, 8]
  const xLabels = (() => {
    if (n <= 1) return [{ index: 0, label: formatDate(sorted[0].workDate) }]
    const count = Math.min(5, n)
    const step = Math.max(1, Math.floor((n - 1) / (count - 1)))
    const indices: number[] = []
    for (let i = 0; i < n; i += step) {
      indices.push(i)
    }
    if (indices[indices.length - 1] !== n - 1) {
      indices.push(n - 1)
    }
    return indices.map((i) => ({ index: i, label: formatDate(sorted[i].workDate) }))
  })()

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="30-day workload trend chart"
    >
      <defs>
        <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(245, 158, 11, 0.25)" />
          <stop offset="100%" stopColor="rgba(245, 158, 11, 0)" />
        </linearGradient>
      </defs>

      {yTicks.map((tick) => {
        const y = yScale(tick)
        return (
          <g key={tick}>
            <line
              x1={CHART_PAD.left}
              y1={y}
              x2={CHART_WIDTH - CHART_PAD.right}
              y2={y}
              stroke="#334155"
              strokeWidth="1"
            />
            <text
              x={CHART_PAD.left - 8}
              y={y + 4}
              textAnchor="end"
              className="text-[10px] fill-slate-500"
            >
              {tick}h
            </text>
          </g>
        )
      })}

      <path
        d={`${areaPath}L${xScale(n - 1).toFixed(1)},${CHART_PAD.top + PLOT_H}L${xScale(0).toFixed(1)},${CHART_PAD.top + PLOT_H}Z`}
        fill="url(#area-grad)"
      />

      <path
        d={linePath}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {sorted.map((d, i) => (
        <circle
          key={i}
          cx={xScale(i)}
          cy={yScale(d.hoursAllocated)}
          r="3"
          fill="#f59e0b"
          stroke="#0f172a"
          strokeWidth="1.5"
        />
      ))}

      {xLabels.map(({ index, label }) => (
        <text
          key={index}
          x={xScale(index)}
          y={CHART_HEIGHT - 6}
          textAnchor="middle"
          className="text-[9px] fill-slate-500"
        >
          {label}
        </text>
      ))}
    </svg>
  )
}

export function StaffProfileDrawer({ staffId, onClose, onStaffRemoved, onStaffUpdated }: StaffProfileDrawerProps) {
  const router = useRouter()
  const [profile, setProfile] = useState<StaffProfile | null>(null)
  const profileRef = useRef<StaffProfile | null>(null)
  const [workload, setWorkload] = useState<WorkloadEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [activeBriefs, setActiveBriefs] = useState<{ referenceNumber: string; subject: string }[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<EditFormData | null>(null)
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    setProfile(null)
    setWorkload([])

    try {
      const [profileRes, workloadRes] = await Promise.all([
        fetch(`/api/staff/${id}`),
        fetch(`/api/staff/${id}/workload?limit=30`),
      ])

      if (!profileRes.ok) {
        const body = await profileRes.json().catch(() => null)
        throw new Error(body?.error || 'Failed to load profile')
      }

      if (!workloadRes.ok) {
        const body = await workloadRes.json().catch(() => null)
        throw new Error(body?.error || 'Failed to load workload data')
      }

      const [profileData, workloadData] = await Promise.all([
        profileRes.json(),
        workloadRes.json(),
      ])

      setProfile(profileData)
      profileRef.current = profileData
      setWorkload(workloadData.workloads || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (staffId) {
      fetchData(staffId)
    } else {
      setProfile(null)
      profileRef.current = null
      setWorkload([])
      setError(null)
      setIsEditing(false)
      setEditForm(null)
      setEditErrors({})
    }
  }, [staffId, fetchData])

  const enterEditMode = useCallback(() => {
    const p = profileRef.current
    if (!p) return
    setEditForm({
      fullName: p.fullName,
      designation: p.designation,
      email: p.email,
      seniority: p.seniority,
      isActive: p.isActive,
      primaryExpertise:
        p.expertiseAreas.find((e) => e.isPrimary)?.expertiseArea || '',
      additionalExpertise: p.expertiseAreas
        .filter((e) => !e.isPrimary)
        .map((e) => e.expertiseArea),
    })
    setEditErrors({})
    setIsEditing(true)
  }, [])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditForm(null)
    setEditErrors({})
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && staffId) {
        if (isEditing) {
          cancelEdit()
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [staffId, onClose, isEditing, cancelEdit])

  const updateEditField = useCallback(<K extends keyof EditFormData>(key: K, value: EditFormData[K]) => {
    setEditForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    setEditErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const toggleAdditionalExpertise = useCallback((area: string) => {
    setEditForm((prev) => {
      if (!prev) return prev
      const current = prev.additionalExpertise
      const next = current.includes(area)
        ? current.filter((a) => a !== area)
        : [...current, area]
      return { ...prev, additionalExpertise: next }
    })
    setEditErrors((prev) => {
      const next = { ...prev }
      delete next.additionalExpertise
      return next
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (!editForm || !staffId) return

    const p = profileRef.current
    if (!p) return

    const payload: Record<string, unknown> = {}
    if (editForm.fullName !== p.fullName) payload.fullName = editForm.fullName
    if (editForm.designation !== p.designation) payload.designation = editForm.designation
    if (editForm.email !== p.email) payload.email = editForm.email
    if (editForm.seniority !== p.seniority) payload.seniority = editForm.seniority
    if (editForm.isActive !== p.isActive) payload.isActive = editForm.isActive

    const origPrimary = p.expertiseAreas.find((e) => e.isPrimary)?.expertiseArea
    const origSecondary = p.expertiseAreas.filter((e) => !e.isPrimary).map((e) => e.expertiseArea) || []
    if (
      editForm.primaryExpertise !== origPrimary ||
      JSON.stringify([...editForm.additionalExpertise].sort()) !== JSON.stringify([...origSecondary].sort())
    ) {
      payload.expertiseAreas = {
        primary: editForm.primaryExpertise,
        secondary: editForm.additionalExpertise.filter((a) => a !== editForm.primaryExpertise),
      }
    }

    if (Object.keys(payload).length === 0) {
      setIsEditing(false)
      return
    }

    const parsed = UpdateStaffSchema.safeParse(payload)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const path = issue.path[0] as string
        if (!fieldErrors[path]) {
          fieldErrors[path] = issue.message
        }
      }
      setEditErrors(fieldErrors)
      return
    }

    setSaving(true)

    try {
      const res = await fetch(`/api/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        if (res.status === 422 && body?.issues) {
          const fieldErrors: Record<string, string> = {}
          for (const issue of body.issues) {
            const path = issue.path?.[0] as string | undefined
            if (path && !fieldErrors[path]) {
              fieldErrors[path] = issue.message
            }
          }
          if (Object.keys(fieldErrors).length > 0) {
            setEditErrors(fieldErrors)
            return
          }
        }
        throw new Error(body?.error || 'Failed to update staff')
      }

      setIsEditing(false)
      setEditForm(null)
      setEditErrors({})
      fetchData(staffId)
      onStaffUpdated?.()
    } catch (err) {
      setEditErrors({
        _general: err instanceof Error ? err.message : 'An unexpected error occurred',
      })
    } finally {
      setSaving(false)
    }
  }, [editForm, staffId, fetchData, onStaffUpdated])

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${staffId ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[440px] bg-slate-950/95 border-l border-slate-800/60 backdrop-blur-xl shadow-2xl transform transition-transform duration-300 ease-out ${staffId ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        <div className="flex flex-col h-full pb-6">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60 shrink-0">
            <h2 className="text-sm font-semibold text-white truncate">
              {loading ? 'Loading...' : isEditing ? 'Edit Profile' : profile?.fullName || 'Counsel Profile'}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
                aria-label="Close drawer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                <p className="text-xs text-slate-400">Loading profile...</p>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center py-16 px-5 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-rose-950/30 border border-rose-500/30 flex items-center justify-center">
                  <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-rose-400">{error}</p>
                <button
                  onClick={() => staffId && fetchData(staffId)}
                  className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-500/20 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && profile && (
              <div className="p-5 space-y-6">
                {isEditing && editForm ? (
                  <>
                    <div className="space-y-4">
                      <FieldGroup label="Full Name" error={editErrors.fullName} required>
                        <input
                          type="text"
                          value={editForm.fullName}
                          onChange={(e) => updateEditField('fullName', e.target.value)}
                          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
                        />
                      </FieldGroup>

                      <FieldGroup label="Designation" error={editErrors.designation} required>
                        <input
                          type="text"
                          value={editForm.designation}
                          onChange={(e) => updateEditField('designation', e.target.value)}
                          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
                        />
                      </FieldGroup>

                      <FieldGroup label="Email" error={editErrors.email} required>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => updateEditField('email', e.target.value)}
                          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
                        />
                      </FieldGroup>

                      <FieldGroup label="Seniority" error={editErrors.seniority} required>
                        <select
                          value={editForm.seniority}
                          onChange={(e) => updateEditField('seniority', e.target.value)}
                          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
                        >
                          {Object.entries(seniorityLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </FieldGroup>

                      <FieldGroup label="Active Status" error={editErrors.isActive}>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={editForm.isActive}
                            onClick={() => updateEditField('isActive', !editForm.isActive)}
                            className={`relative w-10 h-5 rounded-full p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${editForm.isActive ? 'bg-emerald-500' : 'bg-slate-600'}`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${editForm.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                          <span className="text-xs text-slate-300">
                            {editForm.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </FieldGroup>

                      <FieldGroup label="Primary Expertise Area" error={editErrors.primaryExpertise || editErrors.expertiseAreas} required>
                        <select
                          value={editForm.primaryExpertise}
                          onChange={(e) => {
                            const newPrimary = e.target.value
                            updateEditField('primaryExpertise', newPrimary)
                            setEditForm((prev) => prev ? {
                              ...prev,
                              additionalExpertise: prev.additionalExpertise.filter((a) => a !== newPrimary),
                            } : prev)
                          }}
                          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
                        >
                          {Object.keys(EXPERTISE_LABELS).map((area) => (
                            <option key={area} value={area}>
                              {EXPERTISE_LABELS[area as keyof typeof EXPERTISE_LABELS]}
                            </option>
                          ))}
                        </select>
                      </FieldGroup>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-400">
                          Additional Expertise Areas
                          <span className="text-slate-600 ml-1 font-normal">(optional)</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(EXPERTISE_LABELS)
                            .filter((area) => area !== editForm.primaryExpertise)
                            .map((area) => {
                              const selected = editForm.additionalExpertise.includes(area)
                              return (
                                <button
                                  key={area}
                                  type="button"
                                  onClick={() => toggleAdditionalExpertise(area)}
                                  className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${selected
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                                    }`}
                                >
                                  {EXPERTISE_LABELS[area as keyof typeof EXPERTISE_LABELS]}
                                </button>
                              )
                            })}
                        </div>
                        {editErrors.additionalExpertise && (
                          <p className="text-xs text-rose-400">{editErrors.additionalExpertise}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs pt-2">
                        <div>
                          <span className="text-slate-500">Employee Number</span>
                          <p className="text-slate-200 mt-0.5">{profile.employeeNumber}</p>
                        </div>
                      </div>

                      {editErrors._general && (
                        <div className="bg-rose-950/30 border border-rose-500/30 rounded-lg p-3 text-sm text-rose-300">
                          {editErrors._general}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-800/60 flex items-center gap-3">
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="flex-1 px-4 py-2.5 bg-slate-800/50 border border-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-700/50 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {saving && (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                        Save Changes
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold text-white">
                            {profile.fullName}
                          </h3>
                          <p className="text-sm text-slate-400 mt-0.5">
                            {profile.designation}
                          </p>
                        </div>
                        <Badge
                          variant={seniorityBadgeVariant[profile.seniority] || 'default'}
                          className="shrink-0"
                        >
                          {seniorityLabels[profile.seniority] || profile.seniority}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500">Email</span>
                          <p className="text-slate-200 mt-0.5 truncate">
                            {profile.email}
                          </p>
                        </div>
                      </div>

                      <div>
                        <span className="text-xs text-slate-500">Status</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`w-2 h-2 rounded-full ${profile.isActive ? 'bg-emerald-500' : 'bg-slate-500'
                              }`}
                          />
                          <span className="text-xs text-slate-300">
                            {profile.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>

                      {profile.expertiseAreas.length > 0 && (
                        <div>
                          <span className="text-xs text-slate-500">Expertise Areas</span>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {profile.expertiseAreas.map((area) => (
                              <Badge
                                key={area.expertiseArea}
                                variant={area.isPrimary ? 'warning' : 'default'}
                              >
                                {EXPERTISE_LABELS[area.expertiseArea as keyof typeof EXPERTISE_LABELS] || area.expertiseArea}
                                {area.isPrimary && (
                                  <svg className="w-3 h-3 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                )}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Workload Trend
                        </h4>
                        <span className="text-[10px] text-slate-500">
                          Past {workload.length} days
                        </span>
                      </div>
                      <div className="glass-panel p-3">
                        <WorkloadChart data={workload} />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                        Allocation History
                      </h4>
                      {profile.allocations.length === 0 ? (
                        <p className="text-xs text-slate-500 py-4 text-center">
                          No allocation history
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {profile.allocations.map((alloc) => (
                            <button
                              key={alloc.id}
                              onClick={() => router.push(`/reports?brief=${alloc.briefId}`)}
                              className="w-full text-left glass-panel p-3 space-y-1.5 hover:bg-slate-800/50 transition-colors cursor-pointer"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs text-white font-medium truncate">
                                  {alloc.brief.referenceNumber || alloc.brief.subject}
                                </p>
                                <span className="text-[10px] text-slate-500 tabular-nums shrink-0">
                                  {alloc.hoursAllocated.toFixed(1)}h
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 line-clamp-2">
                                {alloc.brief.subject}
                              </p>
                              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                                <span>
                                  {alloc.allocationMethod === 'AUTO'
                                    ? 'Auto-assigned'
                                    : alloc.allocationMethod === 'MANUAL'
                                      ? 'Manually assigned'
                                      : alloc.allocationMethod === 'REPEAT_MATTER'
                                        ? 'Repeat matter'
                                        : alloc.allocationMethod}
                                </span>
                                <span>
                                  {new Date(alloc.allocatedAt).toLocaleDateString()}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-800/60 flex items-center gap-3">
                      <button
                        onClick={enterEditMode}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit Staff
                      </button>
                      <button
                        onClick={() => {
                          setDeleteError(null)
                          setActiveBriefs([])
                          setShowRemoveDialog(true)
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-950/30 border border-rose-500/30 text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-950/50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove Staff
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showRemoveDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setShowRemoveDialog(false)}
          />
          <div className="relative w-full max-w-md glass-panel p-6 space-y-4">
            <h3 className="text-base font-bold text-white">
              Remove {profile?.fullName}?
            </h3>
            <p className="text-sm text-slate-300">
              This will permanently remove {profile?.fullName} from the system. This action cannot be undone.
            </p>

            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/30 space-y-2">
                <p className="text-sm text-rose-400">{deleteError}</p>
                {activeBriefs.length > 0 && (
                  <ul className="space-y-1">
                    {activeBriefs.map((b, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                        <span className="text-rose-400 mt-0.5 shrink-0">•</span>
                        <span>{b.referenceNumber || b.subject}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowRemoveDialog(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-slate-800/50 border border-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-700/50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!staffId) return
                  setDeleting(true)
                  setDeleteError(null)
                  setActiveBriefs([])

                  try {
                    const res = await fetch(`/api/staff/${staffId}`, {
                      method: 'DELETE',
                    })

                    if (!res.ok) {
                      const body = await res.json().catch(() => null)
                      if (res.status === 409 && body?.activeBriefs) {
                        setDeleteError(body.error || 'Staff has active allocations')
                        setActiveBriefs(body.activeBriefs)
                        return
                      }
                      throw new Error(body?.error || 'Failed to remove staff')
                    }

                    setShowRemoveDialog(false)
                    onClose()
                    onStaffRemoved?.(staffId)
                  } catch (err) {
                    setDeleteError(
                      err instanceof Error ? err.message : 'An unexpected error occurred',
                    )
                  } finally {
                    setDeleting(false)
                  }
                }}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleting && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                Remove Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function FieldGroup({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-400">
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  )
}
