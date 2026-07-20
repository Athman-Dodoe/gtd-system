'use client'

import Link from 'next/link'
import { Portal } from '@/components/ui/portal'

export type AllocationOutcome =
  | {
      outcome: 'ALLOCATED'
      briefId: string
      referenceNumber: string
      staffId: string
      staffName: string | null
      method: string
      message: string
    }
  | {
      outcome: 'QUEUED'
      briefId: string
      referenceNumber: string
      message: string
      reason: string
    }
  | {
      outcome: 'REPEAT_MATTER_FALLBACK'
      briefId: string
      referenceNumber: string
      priorStaffId: string
      priorStaffName: string | null
      message: string
      reason: string
    }

interface OutcomeModalProps {
  outcome: AllocationOutcome
  onLogAnother: () => void
}

export function OutcomeModal({ outcome, onLogAnother }: OutcomeModalProps) {
  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-md p-6 animate-slide-up">
        {outcome.outcome === 'ALLOCATED' && (
          <AllocatedView outcome={outcome} onLogAnother={onLogAnother} />
        )}
        {outcome.outcome === 'QUEUED' && (
          <QueuedView outcome={outcome} onLogAnother={onLogAnother} />
        )}
        {outcome.outcome === 'REPEAT_MATTER_FALLBACK' && (
          <FallbackView outcome={outcome} onLogAnother={onLogAnother} />
        )}
      </div>
    </div>
    </Portal>
  )
}

function AllocatedView({
  outcome,
  onLogAnother,
}: {
  outcome: AllocationOutcome & { outcome: 'ALLOCATED' }
  onLogAnother: () => void
}) {
  return (
    <div className="text-center space-y-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
        <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white">Brief Allocated</h3>
        <p className="text-xs text-slate-500 mt-1 font-mono">{outcome.referenceNumber}</p>
        <p className="text-sm text-slate-400 mt-1">{outcome.message}</p>
      </div>
      <div className="bg-slate-800/50 rounded-lg p-3 text-left space-y-1">
        <p className="text-xs text-slate-500">Assigned to</p>
        <p className="text-sm font-medium text-white">{outcome.staffName ?? outcome.staffId}</p>
        <p className="text-xs text-slate-400">via {outcome.method.replace(/_/g, ' ')}</p>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          onClick={onLogAnother}
          className="flex-1 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-colors"
        >
          Log Another Brief
        </button>
        <Link
          href="/dashboard"
          className="flex-1 px-4 py-2.5 bg-slate-700/50 border border-slate-600 text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors text-center"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}

function QueuedView({
  outcome,
  onLogAnother,
}: {
  outcome: AllocationOutcome & { outcome: 'QUEUED' }
  onLogAnother: () => void
}) {
  return (
    <div className="text-center space-y-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
        <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white">Brief Queued</h3>
        <p className="text-xs text-slate-500 mt-1 font-mono">{outcome.referenceNumber}</p>
        <p className="text-sm text-slate-400 mt-1">{outcome.message}</p>
      </div>
      <div className="bg-slate-800/50 rounded-lg p-3 text-left">
        <p className="text-xs text-slate-400">{outcome.reason}</p>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          onClick={onLogAnother}
          className="flex-1 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-colors"
        >
          Log Another Brief
        </button>
        <Link
          href="/queue"
          className="flex-1 px-4 py-2.5 bg-amber-500 border border-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors text-center"
        >
          View Queue
        </Link>
      </div>
    </div>
  )
}

function FallbackView({
  outcome,
  onLogAnother,
}: {
  outcome: AllocationOutcome & { outcome: 'REPEAT_MATTER_FALLBACK' }
  onLogAnother: () => void
}) {
  return (
    <div className="text-center space-y-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
        <svg className="w-8 h-8 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white">Repeat Matter — Fallback</h3>
        <p className="text-xs text-slate-500 mt-1 font-mono">{outcome.referenceNumber}</p>
        <p className="text-sm text-slate-400 mt-1">{outcome.message}</p>
      </div>
      <div className="bg-slate-800/50 rounded-lg p-3 text-left space-y-1">
        <p className="text-xs text-slate-500">Prior counsel at capacity</p>
        <p className="text-sm font-medium text-white">{outcome.priorStaffName ?? outcome.priorStaffId}</p>
        <p className="text-xs text-slate-400">{outcome.reason}</p>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          onClick={onLogAnother}
          className="flex-1 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-colors"
        >
          Log Another Brief
        </button>
        <Link
          href="/queue"
          className="flex-1 px-4 py-2.5 bg-amber-500 border border-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors text-center"
        >
          View Queue
        </Link>
      </div>
    </div>
  )
}
