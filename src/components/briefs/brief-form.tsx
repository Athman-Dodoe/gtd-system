'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { CreateBriefSchema } from '@/lib/schemas/brief'
import { EXPERTISE_LABELS } from '@/lib/constants'
import type { ExpertiseArea } from '@prisma/client'
import { OutcomeModal } from './outcome-modal'
import type { AllocationOutcome } from './outcome-modal'
import { FileUpload, type PendingFile } from './file-upload'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { notifyDashboardRefresh } from '@/lib/notify-dashboard'

interface ParentCandidate {
  id: string
  referenceNumber: string
  subject: string
}

interface BriefFormProps {
  parentCandidates: ParentCandidate[]
}

const EXPERTISE_AREAS = Object.keys(EXPERTISE_LABELS) as ExpertiseArea[]

const SUBTYPE_LABELS: Record<string, string> = {
  CLEARANCE: 'Clearance',
  TERMINATION: 'Termination',
  LEGAL_OPINION: 'Legal Opinion',
  STANDARD: 'Standard',
  ADVISORY: 'Advisory',
}

const URGENCY_LABELS: Record<string, string> = {
  ROUTINE: 'Routine',
  URGENT: 'Urgent',
  EMERGENCY: 'Emergency',
}

const FIELD_LABELS: Record<keyof FormData, string> = {
  subject: 'Subject',
  description: 'Description',
  submittingEntity: 'Submitting Entity',
  expertiseArea: 'Expertise Area',
  subType: 'Sub Type',
  urgency: 'Urgency',
  dueDate: 'Due Date',
  estimatedHours: 'Estimated Hours',
  isRepeatMatter: 'Repeat Matter',
  parentBriefId: 'Parent Brief',
  parentSearch: 'Search Parent Brief',
}

type FormData = {
  subject: string
  description: string
  submittingEntity: string
  expertiseArea: string
  subType: string
  urgency: string
  dueDate: string
  estimatedHours: number
  isRepeatMatter: boolean
  parentBriefId: string
  parentSearch: string
}

type ValidationErrors = Partial<Record<keyof FormData, string>>

const INITIAL_FORM: FormData = {
  subject: '',
  description: '',
  submittingEntity: '',
  expertiseArea: 'PUBLIC_PROCUREMENT_CONTRACTS',
  subType: 'STANDARD',
  urgency: 'ROUTINE',
  dueDate: '',
  estimatedHours: 1.0,
  isRepeatMatter: false,
  parentBriefId: '',
  parentSearch: '',
}

export function BriefForm({ parentCandidates }: BriefFormProps) {
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<AllocationOutcome | null>(null)
  const [parentOpen, setParentOpen] = useState(false)
  const [files, setFiles] = useState<PendingFile[]>([])
  const parentRef = useRef<HTMLDivElement>(null)
  const errorCount = Object.keys(errors).length
  const debouncedParentSearch = useDebounce(form.parentSearch)

  useEffect(() => {
    if (errorCount > 0) {
      const firstKey = Object.keys(errors)[0]
      const el = document.getElementById(`field-${firstKey}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.focus()
      }
    }
  }, [errors, errorCount])

  const filteredParents = useMemo(() => {
    if (!debouncedParentSearch.trim()) return parentCandidates.slice(0, 10)
    const q = debouncedParentSearch.toLowerCase()
    return parentCandidates.filter(
      (p) =>
        p.referenceNumber.toLowerCase().includes(q) ||
        p.subject.toLowerCase().includes(q),
    ).slice(0, 10)
  }, [debouncedParentSearch, parentCandidates])

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    const payload = {
      subject: form.subject,
      description: form.description || undefined,
      submittingEntity: form.submittingEntity || undefined,
      expertiseArea: form.expertiseArea,
      subType: form.subType,
      urgency: form.urgency,
      dueDate: form.dueDate || undefined,
      estimatedHours: form.estimatedHours,
      isRepeatMatter: form.isRepeatMatter,
      parentBriefId: form.isRepeatMatter ? form.parentBriefId : undefined,
    }

    const parsed = CreateBriefSchema.safeParse(payload)

    if (!parsed.success) {
      const fieldErrors: ValidationErrors = {}
      for (const issue of parsed.error.issues) {
        const path = issue.path[0] as keyof FormData
        if (!fieldErrors[path]) {
          fieldErrors[path] = issue.message
        }
      }
      setErrors(fieldErrors)
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        if (res.status === 422 && body?.issues) {
          const fieldErrors: ValidationErrors = {}
          for (const issue of body.issues) {
            const path = issue.path?.[0] as keyof FormData | undefined
            if (path && !fieldErrors[path]) {
              fieldErrors[path] = issue.message
            }
          }
          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors)
            setSubmitting(false)
            return
          }
        }
        throw new Error(body?.error || `Request failed (${res.status})`)
      }

      const data = await res.json()
      notifyDashboardRefresh()

      if (files.length > 0 && data.briefId) {
        const fd = new FormData()
        for (const pf of files) fd.append('files', pf.file)
        const uploadRes = await fetch(`/api/briefs/${data.briefId}/attachments`, {
          method: 'POST',
          body: fd,
        })
        if (!uploadRes.ok) {
          const uploadBody = await uploadRes.json().catch(() => null)
          console.error('[BRIEF FORM] Attachment upload failed:', uploadBody)
          // Brief was created but attachment upload failed — show a warning
          setSubmitError(
            uploadBody?.error
              ? `Brief logged successfully, but attachment upload failed: ${uploadBody.error}`
              : 'Brief logged successfully, but attachment(s) could not be saved. Please try uploading them again.',
          )
        } else {
          const uploaded = await uploadRes.json()
          console.log(`[BRIEF FORM] ${uploaded.length} attachment(s) uploaded`)
        }
      }

      if (data.outcome === 'ALLOCATED') {
        setOutcome({
          outcome: 'ALLOCATED',
          briefId: data.briefId,
          referenceNumber: data.referenceNumber,
          staffId: data.staffId,
          staffName: data.staffName ?? null,
          method: data.method,
          message: data.message,
        })
      } else if (data.outcome === 'QUEUED') {
        setOutcome({
          outcome: 'QUEUED',
          briefId: data.briefId,
          referenceNumber: data.referenceNumber,
          message: data.message,
          reason: data.reason,
        })
      } else if (data.outcome === 'REPEAT_MATTER_FALLBACK') {
        setOutcome({
          outcome: 'REPEAT_MATTER_FALLBACK',
          briefId: data.briefId,
          referenceNumber: data.referenceNumber,
          priorStaffId: data.priorStaffId,
          priorStaffName: data.priorStaffName ?? null,
          message: data.message,
          reason: data.reason,
        })
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }, [form, files])

  const handleReset = useCallback(() => {
    setForm(INITIAL_FORM)
    setErrors({})
    setSubmitError(null)
    setOutcome(null)
    setFiles([])
  }, [])

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {submitError && (
          <div className="bg-rose-950/30 border border-rose-500/30 rounded-lg p-3 text-sm text-rose-300">
            {submitError}
          </div>
        )}

        {errorCount > 0 && (
          <div className="bg-rose-950/20 border border-rose-500/25 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-rose-300">
                {errorCount} {errorCount === 1 ? 'field needs' : 'fields need'} attention
              </p>
            </div>
            <ul className="space-y-1 ml-6">
              {Object.entries(errors).map(([key, msg]) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`field-${key}`)
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        el.focus()
                      }
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 underline underline-offset-2 transition-colors"
                  >
                    {FIELD_LABELS[key as keyof FormData] || key}: {msg}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="glass-panel p-5 space-y-5">
          <h2 className="text-sm font-semibold text-white">Brief Details</h2>

          <FieldGroup label="Subject" error={errors.subject} required>
            <input
              id="field-subject"
              type="text"
              value={form.subject}
              onChange={(e) => updateField('subject', e.target.value)}
              placeholder="Brief subject line"
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
            />
          </FieldGroup>

          <FieldGroup label="Description" error={errors.description}>
            <textarea
              id="field-description"
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Optional extended description"
              rows={3}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 resize-none"
            />
          </FieldGroup>

          <FieldGroup label="Submitting Entity" error={errors.submittingEntity}>
            <input
              id="field-submittingEntity"
              type="text"
              value={form.submittingEntity}
              onChange={(e) => updateField('submittingEntity', e.target.value)}
              placeholder="Ministry, department, or entity"
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
            />
          </FieldGroup>
        </div>

        <div className="glass-panel p-5 space-y-5">
          <h2 className="text-sm font-semibold text-white">Classification</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FieldGroup label="Expertise Area" error={errors.expertiseArea} required>
              <select
                id="field-expertiseArea"
                value={form.expertiseArea}
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

            <FieldGroup label="Sub Type" error={errors.subType}>
              <select
                id="field-subType"
                value={form.subType}
                onChange={(e) => updateField('subType', e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
              >
                {Object.entries(SUBTYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FieldGroup>

            <FieldGroup label="Urgency" error={errors.urgency}>
              <select
                id="field-urgency"
                value={form.urgency}
                onChange={(e) => updateField('urgency', e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
              >
                {Object.entries(URGENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FieldGroup>
          </div>
        </div>

        <div className="glass-panel p-5 space-y-5">
          <h2 className="text-sm font-semibold text-white">Scheduling</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldGroup label="Due Date" error={errors.dueDate}>
              <input
                id="field-dueDate"
                type="date"
                value={form.dueDate}
                onChange={(e) => updateField('dueDate', e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
              />
            </FieldGroup>

            <FieldGroup label="Estimated Hours" error={errors.estimatedHours} required>
              <input
                id="field-estimatedHours"
                type="number"
                value={form.estimatedHours}
                onChange={(e) => updateField('estimatedHours', Number(e.target.value))}
                min={0.5}
                max={40}
                step={0.5}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
              />
            </FieldGroup>
          </div>
        </div>

        <div className="glass-panel p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Repeat Matter</h2>

          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={form.isRepeatMatter}
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

          {form.isRepeatMatter && (
            <div ref={parentRef} className="relative">
              <FieldGroup label="Search Parent Brief" error={errors.parentBriefId} required>
                <input
                  id="field-parentBriefId"
                  type="text"
                  value={form.parentSearch}
                  onChange={(e) => {
                    updateField('parentSearch', e.target.value)
                    setParentOpen(true)
                  }}
                  onFocus={() => setParentOpen(true)}
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
                        form.parentBriefId === p.id
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

        <div className="glass-panel p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Attachments</h2>
          <p className="text-xs text-slate-500">
            Upload supporting documents for this brief (optional)
          </p>
          <FileUpload
            files={files}
            onFilesChange={setFiles}
            disabled={submitting}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {submitting && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {submitting ? 'Submitting...' : 'Log Brief'}
          </button>
        </div>
      </form>

      {outcome && (
        <OutcomeModal outcome={outcome} onLogAnother={handleReset} />
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
      <div
        className={`rounded-lg transition-shadow ${
          error ? 'ring-2 ring-rose-500/40' : ''
        }`}
      >
        {children}
      </div>
      {error && (
        <p className="text-xs text-rose-400 flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}
