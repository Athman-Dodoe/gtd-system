'use client'

import { useState, useEffect } from 'react'
import { SessionProvider, signOut, useSession } from 'next-auth/react'

function CounselHeader() {
  const [time, setTime] = useState(new Date())
  const { data: session } = useSession()

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const userName = session?.user?.name

  return (
    <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/60">
      <div className="flex items-center justify-between px-4 lg:px-6 h-16">
        <div className="flex items-center gap-3">
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
            {time.toLocaleDateString('en-KE', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            <span className="mx-1.5 text-slate-600">·</span>
            {time.toLocaleTimeString('en-KE', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-200 leading-tight">
                {userName || 'Counsel'}
              </p>
              <p className="text-[10px] text-amber-500 font-medium leading-tight">
                Counsel
              </p>
            </div>

            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <span className="text-xs font-bold text-amber-500">
                {userName?.charAt(0)?.toUpperCase() || 'C'}
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

export default function CounselLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <div className="flex h-screen overflow-hidden bg-slate-950">
        <div className="flex-1 flex flex-col min-w-0">
          <CounselHeader />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  )
}
