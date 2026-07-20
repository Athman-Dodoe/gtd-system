'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Portal } from '@/components/ui/portal'

interface SubmitWorkFormData {
  completionNotes: string
  documents: File[]
  followUpNotes: string
}

interface SubmitWorkModalProps {
  referenceNumber: string
  subject: string
  submitting: boolean
  onSubmit: (data: SubmitWorkFormData) => void
  onClose: () => void
}

const MAX_FILE_SIZE = 20 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.jpg', '.jpeg', '.png', '.webp',
])

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function SubmitWorkModal({
  referenceNumber,
  subject,
  submitting,
  onSubmit,
  onClose,
}: SubmitWorkModalProps) {
  const [completionNotes, setCompletionNotes] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [dragOver, setDragOver] = useState(false)
  const firstInputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, submitting])

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File exceeds the 20 MB limit (${formatFileSize(file.size)})`
    }
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return `File type "${ext}" is not supported`
    }
    return null
  }, [])

  const handleFilesSelect = useCallback((files: FileList | File[]) => {
    const newFiles: File[] = []
    const newErrors: string[] = []
    for (const file of Array.from(files)) {
      const error = validateFile(file)
      if (error) {
        newErrors.push(`${file.name}: ${error}`)
      } else {
        newFiles.push(file)
      }
    }
    if (newErrors.length > 0) {
      setErrors((prev) => ({ ...prev, documents: newErrors.join('; ') }))
    }
    if (newFiles.length > 0) {
      setUploadedFiles((prev) => [...prev, ...newFiles])
      setErrors((prev) => {
        const next = { ...prev }
        delete next.documents
        return next
      })
    }
  }, [validateFile])

  const handleRemoveFile = useCallback((index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      handleFilesSelect(e.dataTransfer.files)
    }
  }, [handleFilesSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()

      const newErrors: Record<string, string> = {}

      if (completionNotes.trim().length > 0 && completionNotes.trim().length < 20) {
        newErrors.completionNotes = 'Please provide at least 20 characters'
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors)
        return
      }

      onSubmit({
        completionNotes: completionNotes.trim(),
        documents: uploadedFiles,
        followUpNotes: followUpNotes.trim(),
      })
    },
    [completionNotes, uploadedFiles, followUpNotes, onSubmit],
  )

  return (
    <Portal>
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={submitting ? undefined : onClose}
      />
      <div className="relative z-10 w-full max-w-lg mx-4 bg-slate-950 border border-slate-800/80 rounded-xl shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="px-6 pt-6 pb-4 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Submit Work</h2>
              <div className="mt-1.5 space-y-0.5">
                <p className="text-xs font-mono text-amber-400/80">{referenceNumber}</p>
                <p className="text-sm text-slate-300 leading-snug">{subject}</p>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="completionNotes" className="block text-sm font-medium text-slate-300">
                Work Summary
              </label>
              <textarea
                ref={firstInputRef}
                id="completionNotes"
                rows={4}
                value={completionNotes}
                onChange={(e) => {
                  setCompletionNotes(e.target.value)
                  setErrors((prev) => {
                    const next = { ...prev }
                    delete next.completionNotes
                    return next
                  })
                }}
                placeholder="Summarise the work done, key findings, or recommendations..."
                disabled={submitting}
                className={`w-full bg-slate-800/50 border rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 disabled:opacity-50 resize-none ${
                  errors.completionNotes ? 'border-rose-500/50' : 'border-slate-700'
                }`}
              />
              {errors.completionNotes ? (
                <p className="text-xs text-rose-400 mt-1">{errors.completionNotes}</p>
              ) : (
                <p className="text-xs text-slate-500 mt-1">
                  {completionNotes.length > 0
                    ? `${completionNotes.length}/20 characters minimum`
                    : 'Optional — describe the work completed'}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-300">
                Upload Documents
              </label>
              {uploadedFiles.length > 0 ? (
                <div className="space-y-2">
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {uploadedFiles.map((file, idx) => (
                      <div key={`${file.name}-${idx}`} className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                        <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/30 shrink-0">
                          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{file.name}</p>
                          <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                        </div>
                        {!submitting && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(idx)}
                            className="text-slate-500 hover:text-rose-400 shrink-0"
                            aria-label={`Remove ${file.name}`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {!submitting && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-amber-400/80 hover:text-amber-400 underline underline-offset-2"
                    >
                      + Add more files
                    </button>
                  )}
                </div>
              ) : (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-amber-500/60 bg-amber-500/5'
                      : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/30'
                  }`}
                >
                  <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                  <div className="text-center">
                    <p className="text-sm text-slate-300">
                      <span className="text-amber-400 font-medium">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      PDF, DOCX, XLSX, images, TXT, CSV — max 20 MB per file
                    </p>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp"
                disabled={submitting}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesSelect(e.target.files)
                  }
                  e.target.value = ''
                }}
              />
              {errors.documents && (
                <p className="text-xs text-rose-400 mt-1">{errors.documents}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="followUpNotes" className="block text-sm font-medium text-slate-300">
                Any Concerns or Follow-up Required?
              </label>
              <textarea
                id="followUpNotes"
                rows={3}
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                placeholder="Note any issues, pending items, or recommended follow-up actions..."
                disabled={submitting}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 disabled:opacity-50 resize-none"
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-800/60 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting...
                </>
              ) : (
                'Submit Work'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  )
}
