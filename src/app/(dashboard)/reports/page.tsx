'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { EXPERTISE_LABELS } from '@/lib/constants'
import { BriefDetailDrawer } from '@/components/briefs/brief-detail-drawer'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

type Tab = 'register' | 'audit'

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

const eventTypeLabels: Record<string, string> = {
  BRIEF_RECEIVED: 'Brief Received',
  BRIEF_ALLOCATED: 'Brief Allocated',
  BRIEF_REALLOCATED: 'Brief Reallocated',
  BRIEF_QUEUED: 'Brief Queued',
  BRIEF_DEQUEUED: 'Brief Dequeued',
  BRIEF_STATUS_CHANGED: 'Status Changed',
  BRIEF_CLOSED: 'Brief Closed',
  STAFF_CREATED: 'Staff Created',
  STAFF_UPDATED: 'Staff Updated',
  STAFF_DEACTIVATED: 'Staff Deactivated',
  CAPACITY_OVERRIDE: 'Capacity Override',
  REPEAT_MATTER_DETECTED: 'Repeat Matter Detected',
  REPEAT_MATTER_FALLBACK: 'Repeat Matter Fallback',
  MANUAL_ASSIGNMENT_BY_DSG: 'Manual Assignment',
}

const allocationMethodLabels: Record<string, string> = {
  AUTO_EXPERTISE: 'Auto (Expertise)',
  AUTO_SENIORITY: 'Auto (Seniority)',
  AUTO_REPEAT_MATTER: 'Repeat Matter',
  MANUAL_DSG: 'Manual (DSG)',
}

function formatAuditDetails(eventType: string, payload: Record<string, unknown> | null): string {
  if (!payload) return '—'

  switch (eventType) {
    case 'BRIEF_ALLOCATED':
      return `Assigned to ${payload.staffName ?? '—'} via ${allocationMethodLabels[payload.method as string] ?? payload.method ?? '—'}`

    case 'BRIEF_REALLOCATED':
      return `Reassigned from ${payload.previousStaffName ?? '—'} to ${payload.newStaffName ?? '—'}`

    case 'BRIEF_QUEUED':
      return `Queued — ${payload.reason ?? 'No capacity available'}`

    case 'BRIEF_CLOSED':
      if (payload.action === 'DELETED') {
        return payload.previousStatus
          ? `Deleted from ${payload.previousStatus}`
          : 'Brief deleted by DSG'
      }
      return payload.previousStatus
        ? `Closed from ${payload.previousStatus}`
        : 'Brief closed by DSG'

    case 'BRIEF_STATUS_CHANGED': {
      const fields = payload.fieldsUpdated as string[] | undefined
      const fieldText = fields?.length ? `Fields updated: ${fields.join(', ')}` : ''
      return fieldText || 'Status updated'
    }

    case 'MANUAL_ASSIGNMENT_BY_DSG': {
      const base = `Manually assigned to ${payload.newStaffName ?? '—'}`
      return payload.notes ? `${base} — ${payload.notes}` : base
    }

    case 'STAFF_CREATED':
      return `New staff member added: ${payload.fullName ?? '—'}`

    case 'STAFF_UPDATED': {
      const fields = payload.fieldsUpdated as string[] | undefined
      return fields?.length ? `Updated: ${fields.join(', ')}` : 'Profile updated'
    }

    case 'STAFF_DEACTIVATED':
      return 'Staff member deactivated'

    case 'CAPACITY_OVERRIDE':
      return 'Capacity override applied'

    case 'REPEAT_MATTER_DETECTED':
      return 'Repeat matter — routed to prior counsel'

    case 'REPEAT_MATTER_FALLBACK':
      return 'Repeat matter — prior counsel at capacity, DSG alerted'

    case 'BRIEF_RECEIVED':
      return 'Brief received and logged'

    case 'BRIEF_DEQUEUED':
      return 'Brief removed from queue'

    default:
      return '—'
  }
}

interface BriefRow {
  id: string
  referenceNumber: string
  subject: string
  expertiseArea: string
  urgency: string
  status: string
  estimatedHours: number
  receivedAt: string
  assignedCounsel: string | null
  allocationMethod: string | null
  hoursAllocated: number | null
}

interface AuditEntry {
  id: string
  eventType: string
  occurredAt: string
  payload: Record<string, unknown>
  actorName: string | null
  briefReference: string | null
  staffName: string | null
}

const ALL_EVENT_TYPES = Object.keys(eventTypeLabels)

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsPageInner />
    </Suspense>
  )
}

function ReportsPageInner() {
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get('status') || ''
  const initialBriefId = searchParams.get('brief') || ''
  const [tab, setTab] = useState<Tab>('register')

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Reports</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Daily register and audit trail
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 glass-panel p-1 w-fit">
        <button
          onClick={() => setTab('register')}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'register'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Daily Register
        </button>
        <button
          onClick={() => setTab('audit')}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'audit'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Audit Trail
        </button>
      </div>

      {tab === 'register' ? <DailyRegister initialStatus={initialStatus} initialBriefId={initialBriefId} /> : <AuditTrail />}
    </div>
  )
}

const ALL_STATUSES = ['RECEIVED', 'QUEUED', 'ALLOCATED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED']

const statusLabels: Record<string, string> = {
  RECEIVED: 'Received',
  QUEUED: 'Queued',
  ALLOCATED: 'Allocated',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
}

function DailyRegister({ initialStatus = '', initialBriefId = '' }: { initialStatus?: string; initialBriefId?: string }) {
  const [date, setDate] = useState(todayISO())
  const [status, setStatus] = useState(initialStatus)
  const [briefs, setBriefs] = useState<BriefRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(initialBriefId || null)

  const fetchRegister = useCallback(async (d: string, s: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ date: d })
      if (s) params.set('status', s)
      const res = await fetch(`/api/reports/register?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Failed to load register')
      }
      const data = await res.json()
      setBriefs(data.briefs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setBriefs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (date) fetchRegister(date, status)
  }, [date, status, fetchRegister])

  const handleExportExcel = useCallback(() => {
    const methodLabels: Record<string, string> = {
      AUTO_EXPERTISE: 'Auto (Expertise)',
      AUTO_SENIORITY: 'Auto (Seniority)',
      AUTO_REPEAT_MATTER: 'Repeat Matter',
      MANUAL_DSG: 'Manual (DSG)',
    }

    const data = briefs.map((b) => ({
      'Reference Number': b.referenceNumber,
      'Subject': b.subject,
      'Expertise Area': EXPERTISE_LABELS[b.expertiseArea as keyof typeof EXPERTISE_LABELS] || b.expertiseArea,
      'Urgency': urgencyLabels[b.urgency] || b.urgency,
      'Assigned Counsel': b.assignedCounsel || '',
      'Allocation Method': b.allocationMethod ? (methodLabels[b.allocationMethod] || b.allocationMethod) : '',
      'Hours': b.hoursAllocated ?? '',
      'Status': b.status,
    }))

    const ws = XLSX.utils.json_to_sheet(data)

    ws['!cols'] = [
      { wch: 20 },
      { wch: 40 },
      { wch: 22 },
      { wch: 10 },
      { wch: 22 },
      { wch: 18 },
      { wch: 8 },
      { wch: 12 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Register')
    XLSX.writeFile(wb, `register-${date}.xlsx`)
  }, [briefs, date])

  const handleExportPDF = useCallback(() => {
    const methodLabels: Record<string, string> = {
      AUTO_EXPERTISE: 'Auto (Expertise)',
      AUTO_SENIORITY: 'Auto (Seniority)',
      AUTO_REPEAT_MATTER: 'Repeat Matter',
      MANUAL_DSG: 'Manual (DSG)',
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Daily Brief Register', 14, 18)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text(`Government Transactions Department  |  ${new Date(date + 'T00:00:00').toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 25)

    doc.setTextColor(140)
    doc.setFontSize(8)
    doc.text(`Generated: ${new Date().toLocaleString('en-KE')}`, 14, 30)

    doc.setTextColor(0)

    const tableData = briefs.map((b) => [
      b.referenceNumber,
      b.subject,
      EXPERTISE_LABELS[b.expertiseArea as keyof typeof EXPERTISE_LABELS] || b.expertiseArea,
      urgencyLabels[b.urgency] || b.urgency,
      b.assignedCounsel || '—',
      b.allocationMethod ? (methodLabels[b.allocationMethod] || b.allocationMethod) : '—',
      b.hoursAllocated != null ? `${b.hoursAllocated.toFixed(1)}h` : '—',
      b.status,
    ])

    autoTable(doc, {
      startY: 35,
      head: [['Reference', 'Subject', 'Expertise Area', 'Urgency', 'Counsel', 'Method', 'Hours', 'Status']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: 'linebreak',
        font: 'helvetica',
        lineColor: [200, 200, 200],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 72 },
        2: { cellWidth: 52 },
        3: { cellWidth: 18 },
        4: { cellWidth: 38 },
        5: { cellWidth: 28 },
        6: { cellWidth: 14, halign: 'center' as const },
        7: { cellWidth: 20 },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages()
        doc.setFontSize(7)
        doc.setTextColor(150)
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          pageWidth - 14,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'right' },
        )
      },
    })

    doc.save(`register-${date}.pdf`)
  }, [briefs, date])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-medium">Date:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-medium">Status:</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
          >
            <option value="">All Statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabels[s]}</option>
            ))}
          </select>
        </div>
        <div className="flex-1" />
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export Excel
        </button>
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Export PDF
        </button>
      </div>

      <div className="glass-panel overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-sm text-rose-400">
            {error}
          </div>
        ) : briefs.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-500">
            No briefs logged on this date
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Reference</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Subject</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Expertise Area</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Urgency</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Counsel</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Method</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Hours</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {briefs.map((b) => (
                <tr key={b.id} onClick={() => setSelectedBriefId(b.id)} className="border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-slate-200 font-medium whitespace-nowrap">
                    {b.referenceNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-300 max-w-[200px] truncate">
                    {b.subject}
                  </td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {EXPERTISE_LABELS[b.expertiseArea as keyof typeof EXPERTISE_LABELS] || b.expertiseArea}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={urgencyBadge[b.urgency] || 'default'}>
                      {urgencyLabels[b.urgency] || b.urgency}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {b.assignedCounsel || <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {b.allocationMethod
                      ? b.allocationMethod === 'AUTO_EXPERTISE'
                        ? 'Auto (Expertise)'
                        : b.allocationMethod === 'AUTO_SENIORITY'
                          ? 'Auto (Seniority)'
                          : b.allocationMethod === 'AUTO_REPEAT_MATTER'
                            ? 'Repeat Matter'
                            : b.allocationMethod === 'MANUAL_DSG'
                              ? 'Manual'
                              : b.allocationMethod
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-200 text-right tabular-nums whitespace-nowrap">
                    {b.hoursAllocated?.toFixed(1) ?? <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusBadge[b.status] || 'default'}>
                      {b.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <BriefDetailDrawer
        briefId={selectedBriefId}
        onClose={() => setSelectedBriefId(null)}
        onBriefUpdated={() => fetchRegister(date, status)}
      />
    </div>
  )
}

function AuditTrail() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [eventType, setEventType] = useState('')
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAudit = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (eventType) params.set('eventType', eventType)
      params.set('page', String(p))

      const res = await fetch(`/api/reports/audit?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Failed to load audit trail')
      }
      const data = await res.json()
      setLogs(data.logs || [])
      setTotalPages(data.totalPages || 1)
      setPage(data.page || 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [from, to, eventType])

  useEffect(() => {
    fetchAudit(1)
  }, [fetchAudit])

  return (
    <div className="space-y-4">
      <div className="glass-panel p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-medium">From:</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-medium">To:</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-medium">Event:</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
            >
              <option value="">All Events</option>
              {ALL_EVENT_TYPES.map((et) => (
                <option key={et} value={et}>{eventTypeLabels[et]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="glass-panel overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-sm text-rose-400">
            {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-500">
            No audit entries found
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Timestamp</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Event</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Actor</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Brief</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Staff</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap tabular-nums">
                    {new Date(l.occurredAt).toLocaleString('en-KE', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="info">
                      {eventTypeLabels[l.eventType] || l.eventType}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {l.actorName || <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {l.briefReference || <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {l.staffName || <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">
                    {(() => {
                      const detail = formatAuditDetails(l.eventType, l.payload)
                      return detail.length > 60 ? (
                        <span title={detail}>{detail.slice(0, 57)}...</span>
                      ) : (
                        <span>{detail}</span>
                      )
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => fetchAudit(page - 1)}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 bg-slate-800/50 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-700/50 transition-colors disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-slate-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => fetchAudit(page + 1)}
            disabled={page >= totalPages || loading}
            className="px-3 py-1.5 bg-slate-800/50 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-700/50 transition-colors disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
