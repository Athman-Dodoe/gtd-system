'use client'

import { useState, useCallback, useRef } from 'react'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.webp',
  '.doc', '.docx', '.xls', '.xlsx',
  '.txt', '.csv',
])

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) {
    return (
      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  }
  if (type === 'application/pdf') {
    return (
      <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

export interface PendingFile {
  file: File
  id: string
}

interface FileUploadProps {
  files: PendingFile[]
  onFilesChange: (files: PendingFile[]) => void
  disabled?: boolean
}

export function FileUpload({ files, onFilesChange, disabled }: FileUploadProps) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      setError(null)
      const next: PendingFile[] = []

      for (const f of Array.from(incoming)) {
        const ext = getExt(f.name)
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          setError(`"${f.name}" — file type not allowed`)
          continue
        }
        if (f.size > MAX_FILE_SIZE) {
          setError(`"${f.name}" — exceeds 20 MB limit`)
          continue
        }
        next.push({ file: f, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })
      }

      if (next.length > 0) {
        onFilesChange([...files, ...next])
      }
    },
    [files, onFilesChange],
  )

  const removeFile = useCallback(
    (id: string) => {
      onFilesChange(files.filter((f) => f.id !== id))
    },
    [files, onFilesChange],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (!disabled && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files)
      }
    },
    [disabled, addFiles],
  )

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          disabled
            ? 'border-slate-700 bg-slate-800/30 cursor-not-allowed opacity-50'
            : dragging
              ? 'border-amber-500/50 bg-amber-500/5'
              : 'border-slate-700 hover:border-slate-600 bg-slate-800/30 hover:bg-slate-800/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <div className="flex flex-col items-center gap-1.5">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-xs text-slate-400">
            <span className="text-amber-400 font-medium">Click to upload</span> or drag and drop
          </p>
          <p className="text-[10px] text-slate-600">
            PDF, Word, Excel, images, text — up to 20 MB
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-rose-400">{error}</p>
      )}

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2"
            >
              {getFileIcon(f.file.type)}
              <span className="text-sm text-slate-300 truncate flex-1 min-w-0">
                {f.file.name}
              </span>
              <span className="text-[10px] text-slate-500 tabular-nums shrink-0">
                {formatSize(f.file.size)}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(f.id) }}
                  className="text-slate-500 hover:text-rose-400 transition-colors shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
