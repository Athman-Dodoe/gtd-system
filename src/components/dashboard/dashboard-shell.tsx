'use client'

import { useEffect, useState, useCallback } from 'react'
import { StatCard } from '@/components/dashboard/stat-card'
import { QueueAlerts } from '@/components/dashboard/queue-alerts'
import { StaffUtilization } from '@/components/dashboard/staff-utilization'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { BriefStatusBreakdown } from '@/components/dashboard/brief-status-breakdown'

interface BriefStatusItem {
  status: string
  count: number
}

interface QueueItem {
  id: string
  queuedAt: string
  queuedReason: string
  brief: {
    id: string
    referenceNumber: string
    subject: string
    submittingEntity: string | null
    urgency: string
    expertiseArea: string
    estimatedHours: number
    receivedAt: string
  }
}

interface StaffMember {
  id: string
  fullName: string
  designation: string
  seniority: string
  isActive: boolean
  today: {
    hoursAllocated: number
    briefCount: number
  }
}

interface DashboardData {
  activeCounselCount: number
  queueAlertCount: number
  briefsTodayCount: number
  completedTodayCount: number
  briefStatuses: BriefStatusItem[]
  queueItems: QueueItem[]
  assignedStaff: StaffMember[]
}

interface DashboardShellProps {
  initialData: DashboardData
}

export function DashboardShell({ initialData }: DashboardShellProps) {
  const [data, setData] = useState<DashboardData>(initialData)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats')
      if (!res.ok) throw new Error('Failed to fetch')
      const fresh = (await res.json()) as DashboardData
      setData(fresh)
    } catch {
      console.warn('[DashboardShell] stats fetch failed')
    }
  }, [])

  useEffect(() => {
    const onRefresh = () => fetchStats()
    window.addEventListener('dashboard:refresh', onRefresh)
    return () => window.removeEventListener('dashboard:refresh', onRefresh)
  }, [fetchStats])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchStats()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [fetchStats])

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Active Counsel"
          value={data.activeCounselCount}
          variant="success"
          href="/staff"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />

        <StatCard
          label="Queue Alerts"
          value={data.queueAlertCount}
          variant={data.queueAlertCount > 0 ? 'warning' : 'success'}
          href="/queue"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />

        <StatCard
          label="Briefs Today"
          value={data.briefsTodayCount}
          variant="default"
          href="/reports"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />

        <StatCard
          label="Completed Today"
          value={data.completedTodayCount}
          variant="success"
          href="/reports?status=COMPLETED"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      <BriefStatusBreakdown statuses={data.briefStatuses} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          <QueueAlerts items={data.queueItems} />
          <div className="flex-1">
            <RecentActivity />
          </div>
        </div>
        <div className="flex flex-col">
          <StaffUtilization staff={data.assignedStaff} />
        </div>
      </div>
    </div>
  )
}
