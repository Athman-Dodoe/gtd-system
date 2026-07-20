'use client'

import { useState, useEffect } from 'react'
import { signOut, useSession } from 'next-auth/react'

interface HeaderProps {
  onMenuToggle: () => void
}

function useCurrentTime() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  return time
}

export function Header({ onMenuToggle }: HeaderProps) {
  const now = useCurrentTime()
  const { data: session } = useSession()
  const userName = session?.user?.name
  const userRole = session?.user?.role

  return (
    <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/60">
      <div className="flex items-center justify-between px-4 lg:px-6 h-16">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/50 transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="hidden sm:block">
            <h1 className="text-sm font-semibold text-white">
              Government Transactions Department
            </h1>
            <p className="text-[10px] text-slate-500">
              Legal Brief Allocation System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <time className="text-xs text-slate-400 tabular-nums hidden sm:block">
            {now.toLocaleDateString('en-KE', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            <span className="mx-1.5 text-slate-600">·</span>
            {now.toLocaleTimeString('en-KE', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-200 leading-tight">
                {userName || 'User'}
              </p>
              <p className="text-[10px] text-amber-500 font-medium leading-tight">
                {userRole === 'DSG' ? 'Deputy Solicitor General' : 'Counsel'}
              </p>
            </div>

            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <span className="text-xs font-bold text-amber-500">
                {userName?.charAt(0)?.toUpperCase() || 'D'}
              </span>
            </div>

            <button
              onClick={() => signOut()}
              className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800/50 transition-colors"
              aria-label="Sign out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
