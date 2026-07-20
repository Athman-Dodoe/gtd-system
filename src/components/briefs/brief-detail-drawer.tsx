'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { DAILY_CAPACITY_HOURS, EXPERTISE_LABELS } from '@/lib/constants'
import { UpdateBriefSchema } from '@/lib/schemas/brief'
import type { ExpertiseArea } from '@prisma/client'
import { FileUpload, type PendingFile } from './file-upload'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { notifyDashboardRefresh } from '@/lib/notify-dashboard'

interface BriefAssignment {
  allocationId: string
  staffName: string
  designation: string
  allocationMethod: string
  allocatedAt: string
  hoursAllocated: number
  notes: string | null
}

interface BriefDetail {
  id: string
  referenceNumber: string
  subject: string
  description: string | null
  submittingEntity: string | null
  expertiseArea: string
  subType: string
  urgency: string
  status: string
  receivedAt: string
  dueDate: string | null
  estimatedHours: number
  isRepeatMatter: boolean
  parentBriefId: string | null
  parentBriefReference: string | null
  assignment: BriefAssignment | null
  attachments: {
    id: string
    fileName: string
    fileType: string
    fileSize: number
    storedPath: string
    createdAt: string
  }[]
}

interface StaffMember {
  id: string
  fullName: string
  designation: string
  seniority: string
  isActive: boolean
  expertiseAreas: { expertiseArea: string; isPrimary: boolean }[]
  today: { hoursAllocated: number; briefCount: number }
}

interface BriefDetailDrawerProps {
  briefId: string | null
  onClose: () => void
  onBriefUpdated?: () => void
}

interface EditFormData {
  referenceNumber: string
  subject: string
  description: string
  expertiseArea: string
  subType: string
  urgency: string
  dueDate: string
  estimatedHours: number
  submittingEntity: string
  isRepeatMatter: boolean
  parentBriefId: string
  parentSearch: string
}

const EXPERTISE_AREAS = Object.keys(EXPERTISE_LABELS) as ExpertiseArea[]

const urgencyBadge: Record<string, 'default' | 'warning' | 'danger'> = {
  ROUTINE: 'default',
  URGENT: 'warning',
  EMERGENCY: 'danger',
}

const urgencyLabels: Record<string, string> = {
  ROUTINE: 'Routine',
  URGENT: 'Urgent',
  EMERGENCY: 'Emergency',
}

const statusBadge: Record<string, 'default' | 'warning' | 'info' | 'success' | 'danger'> = {
  RECEIVED: 'default',
  QUEUED: 'warning',
  ALLOCATED: 'info',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CLOSED: 'success',
}

const subTypeLabels: Record<string, string> = {
  CLEARANCE: 'Clearance',
  TERMINATION: 'Termination',
  LEGAL_OPINION: 'Legal Opinion',
  STANDARD: 'Standard',
  ADVISORY: 'Advisory',
}

const allocationMethodLabels: Record<string, string> = {
  AUTO_EXPERTISE: 'Auto (Expertise)',
  AUTO_SENIORITY: 'Auto (Seniority)',
  AUTO_REPEAT_MATTER: 'Repeat Matter',
  MANUAL_DSG: 'Manual (DSG)',
}

const seniorityLabels: Record<string, string> = {
  DEPUTY_CHIEF: 'Deputy Chief',
  PRINCIPAL: 'Principal',
  SENIOR: 'Senior',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BriefDetailDrawer({ briefId, onClose, onBriefUpdated }: BriefDetailDrawerProps) {
  const [brief, setBrief] = useState<BriefDetail | null>(null)
  const briefRef = useRef<BriefDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<EditFormData | null>(null)
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const [showReassign, setShowReassign] = useState(false)
  const [counselList, setCounselList] = useState<StaffMember[]>([])
  const [loadingCounsel, setLoadingCounsel] = useState(false)
  const [reassigning, setReassigning] = useState(false)

  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [parentCandidates, setParentCandidates] = useState<{ id: string; referenceNumber: string; subject: string }[]>([])
  const [parentOpen, setParentOpen] = useState(false)

  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<string[]>([])

  const handleDeleteAttachment = useCallback((id: string) => {
    setDeletedAttachmentIds((prev) => [...prev, id])
  }, [])

  const handleRestoreAttachment = useCallback((id: string) => {
    setDeletedAttachmentIds((prev) => prev.filter((i) => i !== id))
  }, [])

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const fetchBrief = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    setBrief(null)

    try {
      const res = await fetch(`/api/briefs/${id}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Failed to load brief details')
      }
      const data = await res.json()
      setBrief(data)
      briefRef.current = data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (briefId) {
      fetchBrief(briefId)
    } else {
      setBrief(null)
      briefRef.current = null
      setError(null)
      setIsEditing(false)
      setEditForm(null)
      setEditErrors({})
      setShowReassign(false)
      setCounselList([])
      setShowCloseDialog(false)
      setCloseError(null)
      setShowDeleteDialog(false)
      setDeleteError(null)
    }
  }, [briefId, fetchBrief])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditForm(null)
    setEditErrors({})
    setPendingFiles([])
    setDeletedAttachmentIds([])
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && briefId) {
        if (showDeleteDialog) {
          setShowDeleteDialog(false)
        } else if (showCloseDialog) {
          setShowCloseDialog(false)
        } else if (isEditing) {
          cancelEdit()
        } else if (showReassign) {
          setShowReassign(false)
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [briefId, onClose, isEditing, showReassign, showCloseDialog, showDeleteDialog, cancelEdit])

  const enterEditMode = useCallback(async () => {
    const b = briefRef.current
    if (!b) return
    setEditForm({
      referenceNumber: b.referenceNumber,
      subject: b.subject,
      description: b.description || '',
      expertiseArea: b.expertiseArea,
      subType: b.subType,
      urgency: b.urgency,
      dueDate: b.dueDate ? b.dueDate.slice(0, 10) : '',
      estimatedHours: b.estimatedHours,
      submittingEntity: b.submittingEntity || '',
      isRepeatMatter: b.isRepeatMatter,
      parentBriefId: b.parentBriefId || '',
      parentSearch: b.isRepeatMatter && b.parentBriefReference ? `${b.parentBriefReference}` : '',
    })
    setEditErrors({})
    setIsEditing(true)
    setParentOpen(false)
    setPendingFiles([])
    setDeletedAttachmentIds([])

    try {
      const res = await fetch('/api/briefs?all=true')
      if (res.ok) {
        const data = await res.json()
        setParentCandidates(
          data.map((p: { id: string; referenceNumber: string; subject: string }) => ({
            id: p.id,
            referenceNumber: p.referenceNumber,
            subject: p.subject,
          })).filter((p: { id: string }) => p.id !== briefId),
        )
      }
    } catch {
      // Non-critical — parent search just won't have candidates
    }
  }, [briefId])

  const updateEditField = useCallback(<K extends keyof EditFormData>(key: K, value: EditFormData[K]) => {
    setEditForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    setEditErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!editForm || !briefId) return

    const b = briefRef.current
    if (!b) return

    const payload: Record<string, unknown> = {}
    if (editForm.referenceNumber !== b.referenceNumber) payload.referenceNumber = editForm.referenceNumber
    if (editForm.subject !== b.subject) payload.subject = editForm.subject
    if (editForm.description !== (b.description || '')) payload.description = editForm.description || undefined
    if (editForm.submittingEntity !== (b.submittingEntity || '')) payload.submittingEntity = editForm.submittingEntity || undefined
    if (editForm.expertiseArea !== b.expertiseArea) payload.expertiseArea = editForm.expertiseArea
    if (editForm.subType !== b.subType) payload.subType = editForm.subType
    if (editForm.urgency !== b.urgency) payload.urgency = editForm.urgency
    const currentDueDate = b.dueDate ? b.dueDate.slice(0, 10) : ''
    if (editForm.dueDate !== currentDueDate) payload.dueDate = editForm.dueDate || null
    if (editForm.estimatedHours !== b.estimatedHours) payload.estimatedHours = editForm.estimatedHours
    if (editForm.isRepeatMatter !== b.isRepeatMatter) payload.isRepeatMatter = editForm.isRepeatMatter
    if (editForm.parentBriefId) payload.parentBriefId = editForm.parentBriefId

    const hasFieldChanges = Object.keys(payload).length > 0
    const hasFileChanges = pendingFiles.length > 0 || deletedAttachmentIds.length > 0

    if (!hasFieldChanges && !hasFileChanges) {
      setIsEditing(false)
      return
    }

    if (hasFieldChanges) {
      const validatedFields = ['referenceNumber', 'subject', 'description', 'urgency', 'expertiseArea', 'subType']
      const needsValidation = validatedFields.some((f) => payload[f] !== undefined)
      if (needsValidation) {
        const parsed = UpdateBriefSchema.safeParse(payload)
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
      }
    }

    setSaving(true)

    try {
      if (hasFieldChanges) {
        const res = await fetch(`/api/briefs/${briefId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
          throw new Error(body?.error || 'Failed to update brief')
        }
      }

      if (deletedAttachmentIds.length > 0) {
        const delRes = await fetch(`/api/briefs/${briefId}/attachments`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attachmentIds: deletedAttachmentIds }),
        })
        if (!delRes.ok) {
          const delBody = await delRes.json().catch(() => null)
          console.error('[BRIEF EDIT] Attachment deletion failed:', delBody)
        }
      }

      if (pendingFiles.length > 0) {
        const fd = new FormData()
        for (const pf of pendingFiles) fd.append('files', pf.file)
        const uploadRes = await fetch(`/api/briefs/${briefId}/attachments`, {
          method: 'POST',
          body: fd,
        })
        if (!uploadRes.ok) {
          const uploadBody = await uploadRes.json().catch(() => null)
          console.error('[BRIEF EDIT] Attachment upload failed:', uploadBody)
        }
      }

      setIsEditing(false)
      setEditForm(null)
      setEditErrors({})
      setPendingFiles([])
      setDeletedAttachmentIds([])
      fetchBrief(briefId)
      onBriefUpdated?.()
      notifyDashboardRefresh()
      showToast('Brief updated successfully')
    } catch (err) {
      setEditErrors({
        _general: err instanceof Error ? err.message : 'An unexpected error occurred',
      })
    } finally {
      setSaving(false)
    }
  }, [editForm, briefId, fetchBrief, onBriefUpdated, showToast, pendingFiles, deletedAttachmentIds])

  const openReassign = useCallback(async () => {
    setShowReassign(true)
    setLoadingCounsel(true)
    try {
      const res = await fetch('/api/staff')
      if (!res.ok) throw new Error('Failed to load counsel')
      const data = await res.json()
      const active = data.filter((s: StaffMember) => s.isActive)
      const sorted = active.sort((a: StaffMember, b: StaffMember) => {
        return a.today.hoursAllocated - b.today.hoursAllocated
      })
      setCounselList(sorted)
    } catch {
      showToast('Failed to load counsel list', 'error')
      setShowReassign(false)
    } finally {
      setLoadingCounsel(false)
    }
  }, [showToast])

  const handleReassign = useCallback(async (staffId: string) => {
    if (!briefId) return

    setReassigning(true)
    try {
      const res = await fetch('/api/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId, staffId }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Reassignment failed')
      }

      setShowReassign(false)
      fetchBrief(briefId)
      onBriefUpdated?.()
      notifyDashboardRefresh()
      showToast('Brief reassigned successfully')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Reassignment failed', 'error')
    } finally {
      setReassigning(false)
    }
  }, [briefId, fetchBrief, onBriefUpdated, showToast])

  const handleCloseBrief = useCallback(async () => {
    if (!briefId) return

    setClosing(true)
    setCloseError(null)

    try {
      const res = await fetch(`/api/briefs/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CLOSE' }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Failed to close brief')
      }

      setShowCloseDialog(false)
      onClose()
      onBriefUpdated?.()
      notifyDashboardRefresh()
      showToast('Brief closed successfully')
    } catch (err) {
      setCloseError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setClosing(false)
    }
  }, [briefId, onClose, onBriefUpdated, showToast])

  const handleDelete = useCallback(async () => {
    if (!briefId) return

    setDeleting(true)
    setDeleteError(null)

    try {
      const res = await fetch(`/api/briefs/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE' }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Failed to delete brief')
      }

      setShowDeleteDialog(false)
      onClose()
      onBriefUpdated?.()
      notifyDashboardRefresh()
      showToast('Brief deleted successfully')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setDeleting(false)
    }
  }, [briefId, onClose, onBriefUpdated, showToast])

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${briefId ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[480px] bg-slate-950/95 border-l border-slate-800/60 backdrop-blur-xl shadow-2xl transform transition-transform duration-300 ease-out ${briefId ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        <div className="flex flex-col h-full pb-6">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60 shrink-0">
            <h2 className="text-sm font-semibold text-white truncate">
              {loading ? 'Loading...' : isEditing ? 'Edit Brief' : brief?.referenceNumber || 'Brief Details'}
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
                <p className="text-xs text-slate-400">Loading brief details...</p>
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
                  onClick={() => briefId && fetchBrief(briefId)}
                  className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-500/20 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && brief && (
              <div className="p-5 space-y-6">
                {isEditing && editForm ? (
                  <EditBriefForm
                    editForm={editForm}
                    editErrors={editErrors}
                    saving={saving}
                    updateField={updateEditField}
                    onSave={handleSaveEdit}
                    onCancel={cancelEdit}
                    parentCandidates={parentCandidates}
                    parentOpen={parentOpen}
                    setParentOpen={setParentOpen}
                    pendingFiles={pendingFiles}
                    onPendingFilesChange={setPendingFiles}
                    existingAttachments={brief.attachments}
                    deletedAttachmentIds={deletedAttachmentIds}
                    onDeleteAttachment={handleDeleteAttachment}
                    onRestoreAttachment={handleRestoreAttachment}
                  />
                ) : showReassign ? (
                  <ReassignPanel
                    counselList={counselList}
                    loadingCounsel={loadingCounsel}
                    reassigning={reassigning}
                    onSelect={handleReassign}
                    onCancel={() => setShowReassign(false)}
                    currentCounselName={brief.assignment?.staffName}
                    expertiseArea={brief.expertiseArea}
                  />
                ) : (
                  <BriefDetailView
                    brief={brief}
                    onEdit={enterEditMode}
                    onReassign={openReassign}
                    onCloseBrief={() => {
                      setCloseError(null)
                      setShowCloseDialog(true)
                    }}
                    onDelete={() => {
                      setDeleteError(null)
                      setShowDeleteDialog(true)
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCloseDialog && brief && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !closing && setShowCloseDialog(false)}
          />
          <div className="relative w-full max-w-md glass-panel p-6 space-y-4">
            <h3 className="text-base font-bold text-white">
              Close {brief.referenceNumber}?
            </h3>
            <p className="text-sm text-slate-300">
              This will mark {brief.referenceNumber} as <strong className="text-amber-400">CLOSED</strong>. The brief will remain in the system for record-keeping but will no longer appear as active work.
            </p>

            {closeError && (
              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/30">
                <p className="text-sm text-rose-400">{closeError}</p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowCloseDialog(false)}
                disabled={closing}
                className="flex-1 px-4 py-2 bg-slate-800/50 border border-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-700/50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseBrief}
                disabled={closing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {closing && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                Close Brief
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteDialog && brief && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setShowDeleteDialog(false)}
          />
          <div className="relative w-full max-w-md glass-panel p-6 space-y-4">
            <h3 className="text-base font-bold text-white">
              Delete {brief.referenceNumber}?
            </h3>
            <p className="text-sm text-slate-300">
              Are you sure you want to delete {brief.referenceNumber}? This brief will be permanently removed from the system.
            </p>

            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/30">
                <p className="text-sm text-rose-400">{deleteError}</p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-slate-800/50 border border-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-700/50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleting && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                Delete Brief
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-20 right-4 z-[70] animate-slide-up">
          <div className={`glass-panel px-4 py-3 pr-10 flex items-center gap-2 text-sm ${toast.type === 'success' ? 'border-emerald-500/30' : 'border-rose-500/30'
            }`}>
            {toast.type === 'success' ? (
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className={toast.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}>
              {toast.message}
            </span>
            <button
              onClick={() => setToast(null)}
              className="absolute top-2 right-2 text-slate-500 hover:text-slate-300"
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

function BriefDetailView({
  brief,
  onEdit,
  onReassign,
  onCloseBrief,
  onDelete,
}: {
  brief: BriefDetail
  onEdit: () => void
  onReassign: () => void
  onCloseBrief: () => void
  onDelete: () => void
}) {
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-white tracking-tight">
              {brief.referenceNumber}
            </h3>
            <p className="text-sm text-slate-300 mt-1">
              {brief.subject}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant={statusBadge[brief.status] || 'default'}>
              {brief.status}
            </Badge>
            <Badge variant={urgencyBadge[brief.urgency] || 'default'}>
              {urgencyLabels[brief.urgency] || brief.urgency}
            </Badge>
          </div>
        </div>

        {brief.description && (
          <div>
            <span className="text-xs text-slate-500">Description</span>
            <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap">
              {brief.description}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-500">Submitting Entity</span>
            <p className="text-slate-200 mt-0.5">{brief.submittingEntity || '—'}</p>
          </div>
          <div>
            <span className="text-slate-500">Expertise Area</span>
            <p className="text-slate-200 mt-0.5 truncate">
              {EXPERTISE_LABELS[brief.expertiseArea as keyof typeof EXPERTISE_LABELS] || brief.expertiseArea}
            </p>
          </div>
          <div>
            <span className="text-slate-500">Sub Type</span>
            <p className="text-slate-200 mt-0.5">{subTypeLabels[brief.subType] || brief.subType}</p>
          </div>
          <div>
            <span className="text-slate-500">Estimated Hours</span>
            <p className="text-slate-200 mt-0.5">{brief.estimatedHours}h</p>
          </div>
          <div>
            <span className="text-slate-500">Received At</span>
            <p className="text-slate-200 mt-0.5">{formatDate(brief.receivedAt)}</p>
          </div>
          <div>
            <span className="text-slate-500">Due Date</span>
            <p className="text-slate-200 mt-0.5">{brief.dueDate ? formatDate(brief.dueDate) : '—'}</p>
          </div>
        </div>

        <div className="text-xs">
          <span className="text-slate-500">Repeat Matter: </span>
          <span className="text-slate-200">
            {brief.isRepeatMatter ? (
              <>Yes{brief.parentBriefReference ? ` (parent: ${brief.parentBriefReference})` : ''}</>
            ) : (
              'No'
            )}
          </span>
        </div>
      </div>

      {brief.assignment && (
        <div className="pt-4 border-t border-slate-800/60">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Current Assignment
          </h4>
          <div className="glass-panel p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white font-medium">{brief.assignment.staffName}</span>
              <span className="text-xs text-slate-400">{brief.assignment.designation}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Method</span>
                <p className="text-slate-300 mt-0.5">
                  {allocationMethodLabels[brief.assignment.allocationMethod] || brief.assignment.allocationMethod}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Hours Allocated</span>
                <p className="text-slate-300 mt-0.5">{brief.assignment.hoursAllocated}h</p>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500">Allocated At</span>
                <p className="text-slate-300 mt-0.5">{formatDateTime(brief.assignment.allocatedAt)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {brief.attachments.length > 0 && (
        <div className="pt-4 border-t border-slate-800/60">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Attachments
          </h4>
          <div className="space-y-2">
            {brief.attachments.map((att) => (
              <a
                key={att.id}
                href={`/api/uploads/briefs/${brief.id}/${att.storedPath}`}
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
                    {att.fileType.split('/').pop()?.toUpperCase()} · {formatFileSize(att.fileSize)}
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

      {brief.status === 'COMPLETED' && brief.assignment?.notes && (() => {
        let completionData: {
          completionNotes: string | null
          uploadedFiles: { fileName: string; storedName: string; fileType: string; fileSize: number }[] | null
          uploadedFile: { fileName: string; storedName: string; fileType: string; fileSize: number } | null
          followUpNotes: string | null
        } | null = null
        try {
          const parsed = JSON.parse(brief.assignment.notes)
          if (parsed && (parsed.completionNotes || parsed.uploadedFile || parsed.uploadedFiles || parsed.followUpNotes)) {
            completionData = {
              completionNotes: parsed.completionNotes ?? null,
              uploadedFiles: parsed.uploadedFiles ?? null,
              uploadedFile: parsed.uploadedFile ?? null,
              followUpNotes: parsed.followUpNotes ?? null,
            }
          }
        } catch {
          // not JSON — legacy plain text notes, skip
        }
        if (!completionData) return null
        const files = completionData.uploadedFiles ?? (completionData.uploadedFile ? [completionData.uploadedFile] : [])
        return (
          <div className="pt-4 border-t border-slate-800/60">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Submission Details
            </h4>
            <div className="glass-panel p-3 space-y-3 text-xs">
              {completionData.completionNotes && (
                <div>
                  <span className="text-slate-500">Work Summary</span>
                  <p className="text-slate-200 mt-0.5 whitespace-pre-wrap">
                    {completionData.completionNotes}
                  </p>
                </div>
              )}
              {files.length > 0 && brief.assignment && (
                <div>
                  <span className="text-slate-500">{files.length === 1 ? 'Uploaded Document' : 'Uploaded Documents'}</span>
                  <div className="mt-1 space-y-1">
                    {files.map((f, i) => (
                      <p key={i}>
                        <a
                          href={`/api/uploads/completions/${brief.assignment!.allocationId}/${f.storedName}`}
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
              )}
              {completionData.followUpNotes && (
                <div>
                  <span className="text-slate-500">Follow-up Notes</span>
                  <p className="text-slate-200 mt-0.5 whitespace-pre-wrap">
                    {completionData.followUpNotes}
                  </p>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      <div className="pt-4 border-t border-slate-800/60 space-y-2">
        <button
          onClick={onEdit}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Brief
        </button>
        <button
          onClick={onReassign}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500/10 border border-sky-500/30 text-sky-400 rounded-lg text-sm font-medium hover:bg-sky-500/20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Reassign Brief
        </button>
        {brief.status !== 'CLOSED' && (
          <button
            onClick={onCloseBrief}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-950/30 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-950/50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Close Brief
          </button>
        )}
        <button
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-950/30 border border-rose-500/30 text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-950/50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Brief
        </button>
      </div>
    </>
  )
}

function EditBriefForm({
  editForm,
  editErrors,
  saving,
  updateField,
  onSave,
  onCancel,
  parentCandidates,
  parentOpen,
  setParentOpen,
  pendingFiles,
  onPendingFilesChange,
  existingAttachments,
  deletedAttachmentIds,
  onDeleteAttachment,
  onRestoreAttachment,
}: {
  editForm: EditFormData
  editErrors: Record<string, string>
  saving: boolean
  updateField: <K extends keyof EditFormData>(key: K, value: EditFormData[K]) => void
  onSave: () => void
  onCancel: () => void
  parentCandidates: { id: string; referenceNumber: string; subject: string }[]
  parentOpen: boolean
  setParentOpen: (open: boolean) => void
  pendingFiles: PendingFile[]
  onPendingFilesChange: (files: PendingFile[]) => void
  existingAttachments: { id: string; fileName: string; fileType: string; fileSize: number; storedPath: string }[]
  deletedAttachmentIds: string[]
  onDeleteAttachment: (id: string) => void
  onRestoreAttachment: (id: string) => void
}) {
  const debouncedParentSearch = useDebounce(editForm.parentSearch)
  const filteredParents = parentCandidates.filter((p) => {
    if (!debouncedParentSearch.trim()) return true
    const q = debouncedParentSearch.toLowerCase()
    return (
      p.referenceNumber.toLowerCase().includes(q) ||
      p.subject.toLowerCase().includes(q)
    )
  }).slice(0, 10)

  return (
    <div className="space-y-4">
      <FieldGroup label="Reference Number" error={editErrors.referenceNumber} required>
        <input
          type="text"
          value={editForm.referenceNumber}
          onChange={(e) => updateField('referenceNumber', e.target.value)}
          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
        />
      </FieldGroup>

      <FieldGroup label="Subject" error={editErrors.subject} required>
        <input
          type="text"
          value={editForm.subject}
          onChange={(e) => updateField('subject', e.target.value)}
          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
        />
      </FieldGroup>

      <FieldGroup label="Description" error={editErrors.description}>
        <textarea
          value={editForm.description}
          onChange={(e) => updateField('description', e.target.value)}
          rows={4}
          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 resize-none"
        />
      </FieldGroup>

      <FieldGroup label="Submitting Entity" error={editErrors.submittingEntity}>
        <input
          type="text"
          value={editForm.submittingEntity}
          onChange={(e) => updateField('submittingEntity', e.target.value)}
          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
        />
      </FieldGroup>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Expertise Area" error={editErrors.expertiseArea} required>
          <select
            value={editForm.expertiseArea}
            onChange={(e) => updateField('expertiseArea', e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
          >
            {EXPERTISE_AREAS.map((area) => (
              <option key={area} value={area}>
                {EXPERTISE_LABELS[area]}
              </option>
            ))}
          </select>
        </FieldGroup>

        <FieldGroup label="Sub Type" error={editErrors.subType}>
          <select
            value={editForm.subType}
            onChange={(e) => updateField('subType', e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
          >
            <option value="CLEARANCE">Clearance</option>
            <option value="TERMINATION">Termination</option>
            <option value="LEGAL_OPINION">Legal Opinion</option>
            <option value="STANDARD">Standard</option>
            <option value="ADVISORY">Advisory</option>
          </select>
        </FieldGroup>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Urgency" error={editErrors.urgency} required>
          <select
            value={editForm.urgency}
            onChange={(e) => updateField('urgency', e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
          >
            <option value="ROUTINE">Routine</option>
            <option value="URGENT">Urgent</option>
            <option value="EMERGENCY">Emergency</option>
          </select>
        </FieldGroup>

        <FieldGroup label="Estimated Hours" error={editErrors.estimatedHours}>
          <input
            type="number"
            min={0.5}
            max={40}
            step={0.5}
            value={editForm.estimatedHours}
            onChange={(e) => updateField('estimatedHours', parseFloat(e.target.value) || 1)}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
          />
        </FieldGroup>
      </div>

      <FieldGroup label="Due Date" error={editErrors.dueDate}>
        <input
          type="date"
          value={editForm.dueDate}
          onChange={(e) => updateField('dueDate', e.target.value)}
          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
        />
      </FieldGroup>

      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={editForm.isRepeatMatter}
              onChange={(e) => {
                updateField('isRepeatMatter', e.target.checked)
                if (!e.target.checked) {
                  updateField('parentBriefId', '')
                  updateField('parentSearch', '')
                }
              }}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-700 rounded-full peer-checked:bg-amber-500/30 peer-checked:border-amber-500/50 border border-slate-600 transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-slate-400 rounded-full peer-checked:bg-amber-400 peer-checked:translate-x-5 transition-all" />
          </div>
          <span className="text-sm text-slate-300">
            This brief relates to a previously logged matter
          </span>
        </label>

        {editForm.isRepeatMatter && (
          <div className="relative">
            <FieldGroup label="Search Parent Brief" error={editErrors.parentBriefId} required>
              <input
                type="text"
                value={editForm.parentSearch}
                onChange={(e) => {
                  updateField('parentSearch', e.target.value)
                  setParentOpen(true)
                }}
                onFocus={() => setParentOpen(true)}
                onBlur={() => setTimeout(() => setParentOpen(false), 200)}
                placeholder="Type reference number or subject..."
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
              />
            </FieldGroup>

            {parentOpen && filteredParents.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {filteredParents.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      updateField('parentBriefId', p.id)
                      updateField('parentSearch', `${p.referenceNumber} — ${p.subject}`)
                      setParentOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      editForm.parentBriefId === p.id
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <span className="font-medium">{p.referenceNumber}</span>
                    <span className="text-slate-500 ml-2">{p.subject}</span>
                  </button>
                ))}
              </div>
            )}

            {parentOpen && filteredParents.length === 0 && (
              <div className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-3 text-sm text-slate-500 text-center">
                No matching briefs found
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Attachments
        </h4>

        {existingAttachments.length > 0 && (
          <div className="space-y-1.5">
            {existingAttachments.map((att) => {
              const isDeleted = deletedAttachmentIds.includes(att.id)
              return (
                <div
                  key={att.id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                    isDeleted
                      ? 'bg-rose-950/20 border border-rose-500/20 opacity-60'
                      : 'bg-slate-800/50 border border-slate-700/50'
                  }`}
                >
                  <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    {att.fileType.includes('pdf') ? (
                      <svg className="w-3 h-3 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    ) : att.fileType.includes('image') ? (
                      <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs truncate ${isDeleted ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                      {att.fileName}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {att.fileType.split('/').pop()?.toUpperCase()} · {formatFileSize(att.fileSize)}
                    </p>
                  </div>
                  {isDeleted ? (
                    <button
                      type="button"
                      onClick={() => onRestoreAttachment(att.id)}
                      className="text-slate-500 hover:text-emerald-400 transition-colors shrink-0"
                      title="Restore attachment"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDeleteAttachment(att.id)}
                      className="text-slate-500 hover:text-rose-400 transition-colors shrink-0"
                      title="Remove attachment"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <FileUpload
          files={pendingFiles}
          onFilesChange={onPendingFilesChange}
          disabled={saving}
        />
      </div>

      {editErrors._general && (
        <div className="bg-rose-950/30 border border-rose-500/30 rounded-lg p-3 text-sm text-rose-300">
          {editErrors._general}
        </div>
      )}

      <div className="pt-2 flex items-center gap-3">
        <button
          onClick={onCancel}
          disabled={saving}
          className="flex-1 px-4 py-2.5 bg-slate-800/50 border border-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-700/50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving && (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          Save Changes
        </button>
      </div>
    </div>
  )
}

function ReassignPanel({
  counselList,
  loadingCounsel,
  reassigning,
  onSelect,
  onCancel,
  currentCounselName,
  expertiseArea,
}: {
  counselList: StaffMember[]
  loadingCounsel: boolean
  reassigning: boolean
  onSelect: (staffId: string) => void
  onCancel: () => void
  currentCounselName: string | null | undefined
  expertiseArea: string
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
          Reassign Brief
        </h4>
        {currentCounselName && (
          <p className="text-xs text-slate-500">
            Currently assigned to: <span className="text-slate-300">{currentCounselName}</span>
          </p>
        )}
      </div>

      {loadingCounsel ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {counselList.map((counsel) => {
            const pct = Math.round(
              (counsel.today.hoursAllocated / DAILY_CAPACITY_HOURS) * 100,
            )
            const expertiseMatch = counsel.expertiseAreas.some(
              (e) => e.expertiseArea === expertiseArea,
            )
            return (
              <button
                key={counsel.id}
                onClick={() => onSelect(counsel.id)}
                disabled={reassigning}
                className="w-full text-left glass-panel p-3 space-y-2 hover:bg-slate-800/50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white font-medium">{counsel.fullName}</span>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {counsel.today.hoursAllocated.toFixed(1)}h / {DAILY_CAPACITY_HOURS}h
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">{counsel.designation}</span>
                  <span className="text-[10px] text-slate-600">·</span>
                  <span className="text-[10px] text-slate-500">{seniorityLabels[counsel.seniority] || counsel.seniority}</span>
                  {expertiseMatch && (
                    <span className="text-[10px] text-emerald-400 font-medium">Expertise match</span>
                  )}
                </div>
                <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 85 ? 'bg-rose-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="pt-2">
        <button
          onClick={onCancel}
          disabled={reassigning}
          className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-700/50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
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
