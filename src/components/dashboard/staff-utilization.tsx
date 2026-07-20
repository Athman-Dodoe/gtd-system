'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Badge } from '@/components/ui/badge'
import { DAILY_CAPACITY_HOURS } from '@/lib/constants'

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

interface StaffUtilizationProps {
  staff: StaffMember[]
}

const seniorityColor: Record<string, string> = {
  DEPUTY_CHIEF: 'warning',
  PRINCIPAL: 'info',
  SENIOR: 'default',
}

const SENIORITY_RANK: Record<string, number> = {
  DEPUTY_CHIEF: 3,
  PRINCIPAL: 2,
  SENIOR: 1,
}

export function StaffUtilization({ staff }: StaffUtilizationProps) {
  const active = staff.filter((s) => s.isActive)

  const top5 =
    active.length === 0
      ? []
      : (() => {
          const byHours = [...active].sort(
            (a, b) => b.today.hoursAllocated - a.today.hoursAllocated,
          )
          const allZero = byHours.every((s) => s.today.hoursAllocated === 0)
          if (allZero) {
            return [...active]
              .sort(
                (a, b) =>
                  (SENIORITY_RANK[b.seniority] || 0) -
                  (SENIORITY_RANK[a.seniority] || 0),
              )
              .slice(0, 5)
          }
          return byHours.slice(0, 5)
        })()

  if (top5.length === 0) {
    return (
      <Card className="h-full">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-700/30 border border-slate-600 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-400">No briefs assigned today</p>
          <p className="text-xs text-slate-500 mt-1">Staff with assigned briefs will appear here</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <h3 className="text-sm font-semibold text-white mb-4">
        Staff Utilization{' '}
        <span className="text-slate-500 font-normal">· Top 5</span>
      </h3>
      <div className="space-y-3 flex-1">
        {top5.map((member, i) => {
          const pct = Math.round(
            (member.today.hoursAllocated / DAILY_CAPACITY_HOURS) * 100,
          )
          return (
            <Link
              key={member.id}
              href={`/staff?staffId=${member.id}`}
              className="block animate-fade-in group"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-slate-200 truncate group-hover:text-amber-400 transition-colors">
                    {member.fullName}
                  </span>
                  {member.today.briefCount > 0 && (
                    <Badge variant="default">
                      {member.today.briefCount} brief
                      {member.today.briefCount !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  <Badge
                    variant={
                      (seniorityColor[member.seniority] as 'warning' | 'info' | 'default') ||
                      'default'
                    }
                    className="hidden sm:inline-flex"
                  >
                    {member.seniority.replace('_', ' ')}
                  </Badge>
                </div>
                <span className="text-xs text-slate-400 tabular-nums shrink-0 ml-2">
                  {member.today.hoursAllocated.toFixed(1)}h /{' '}
                  {DAILY_CAPACITY_HOURS}h
                </span>
              </div>
              <ProgressBar
                value={member.today.hoursAllocated}
                max={DAILY_CAPACITY_HOURS}
                showLabel
              />
              <p className="text-[10px] text-slate-600 mt-0.5">
                {member.designation}
                {pct >= 85 && (
                  <span className="text-rose-400 ml-2">· Near capacity</span>
                )}
              </p>
            </Link>
          )
        })}
      </div>
      <Link
        href="/staff"
        className="block text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors pt-3 border-t border-slate-800/50 mt-3"
      >
        View all staff →
      </Link>
    </Card>
  )
}
