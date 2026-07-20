'use client'

import { useState, useCallback } from 'react'
import { CreateStaffSchema } from '@/lib/schemas/staff'
import { EXPERTISE_LABELS } from '@/lib/constants'
import { notifyDashboardRefresh } from '@/lib/notify-dashboard'
import { Portal } from '@/components/ui/portal'

interface AddStaffModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const SENIORITY_OPTIONS = [
  { value: 'SENIOR', label: 'Senior' },
  { value: 'PRINCIPAL', label: 'Principal' },
  { value: 'DEPUTY_CHIEF', label: 'Deputy Chief' },
]

const EXPERTISE_AREAS = Object.keys(EXPERTISE_LABELS)

type FormData = {
  fullName: string
  email: string
  designation: string
  seniority: string
  primaryExpertise: string
  additionalExpertise: string[]
  dateJoined: string
  employeeNumber: string
}

type ValidationErrors = Partial<Record<keyof FormData, string>>

const INITIAL_FORM: FormData = {
  fullName: '',
  email: '',
  designation: '',
  seniority: 'SENIOR',
  primaryExpertise: 'PUBLIC_PROCUREMENT_CONTRACTS',
  additionalExpertise: [],
  dateJoined: '',
  employeeNumber: '',
}

export function AddStaffModal({ open, onClose, onSuccess }: AddStaffModalProps) {
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const toggleAdditionalExpertise = useCallback((area: string) => {
    setForm((prev) => {
      const current = prev.additionalExpertise
      const next = current.includes(area)
        ? current.filter((a) => a !== area)
        : [...current, area]
      return { ...prev, additionalExpertise: next }
    })
    setErrors((prev) => {
      const next = { ...prev }
      delete next.additionalExpertise
      return next
    })
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    const parsed = CreateStaffSchema.safeParse(form)

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
      const res = await fetch('/api/staff', {
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

      setForm(INITIAL_FORM)
      onSuccess()
      notifyDashboardRefresh()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }, [form, onSuccess])

  if (!open) return null

  const remainingExpertise = EXPERTISE_AREAS.filter(
    (area) => area !== form.primaryExpertise,
  )

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div
        className="glass-panel w-full max-w-lg max-h-[85vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Add New Counsel</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {submitError && (
            <div className="bg-rose-950/30 border border-rose-500/30 rounded-lg p-3 text-sm text-rose-300">
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldGroup label="Full Name" error={errors.fullName} required>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                placeholder="e.g. Jane Mwangi"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
              />
            </FieldGroup>

            <FieldGroup label="Email" error={errors.email} required>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="e.g. jane.mwangi@ag.go.ke"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
              />
            </FieldGroup>

            <FieldGroup label="Designation" error={errors.designation} required>
              <input
                type="text"
                value={form.designation}
                onChange={(e) => updateField('designation', e.target.value)}
                placeholder="e.g. Senior State Counsel"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
              />
            </FieldGroup>

            <FieldGroup label="Seniority" error={errors.seniority} required>
              <select
                value={form.seniority}
                onChange={(e) => updateField('seniority', e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
              >
                {SENIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FieldGroup>

            <FieldGroup label="Primary Expertise Area" error={errors.primaryExpertise} required>
              <select
                value={form.primaryExpertise}
                onChange={(e) => {
                  updateField('primaryExpertise', e.target.value)
                  setForm((prev) => ({
                    ...prev,
                    additionalExpertise: prev.additionalExpertise.filter(
                      (a) => a !== e.target.value,
                    ),
                  }))
                }}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
              >
                {EXPERTISE_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {EXPERTISE_LABELS[area as keyof typeof EXPERTISE_LABELS]}
                  </option>
                ))}
              </select>
            </FieldGroup>

            <FieldGroup label="Employee Number" error={errors.employeeNumber} required>
              <input
                type="text"
                value={form.employeeNumber}
                onChange={(e) => updateField('employeeNumber', e.target.value.toUpperCase())}
                placeholder="e.g. GTD-042"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
              />
            </FieldGroup>

            <FieldGroup label="Date Joined" error={errors.dateJoined} required>
              <input
                type="date"
                value={form.dateJoined}
                onChange={(e) => updateField('dateJoined', e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
              />
            </FieldGroup>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-400">
              Additional Expertise Areas
              <span className="text-slate-600 ml-1 font-normal">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {remainingExpertise.map((area) => {
                const selected = form.additionalExpertise.includes(area)
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleAdditionalExpertise(area)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                      selected
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    {EXPERTISE_LABELS[area as keyof typeof EXPERTISE_LABELS]}
                  </button>
                )
              })}
            </div>
            {errors.additionalExpertise && (
              <p className="text-xs text-rose-400">{errors.additionalExpertise}</p>
            )}
          </div>

          <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300 space-y-1">
            <p>
              <span className="font-medium">Default password: </span>
              <code className="bg-slate-900/50 px-1.5 py-0.5 rounded text-amber-200">***REDACTED***</code>
            </p>
            <p>The new counsel will be required to change their password on first login.</p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {submitting && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {submitting ? 'Creating...' : 'Add Counsel'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
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
