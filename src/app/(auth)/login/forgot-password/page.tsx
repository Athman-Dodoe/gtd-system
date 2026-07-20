'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!email.endsWith('@ag.go.ke')) {
      setError('Please use your official @ag.go.ke email address.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to send reset link. Please try again.')
        return
      }

      setSent(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100 px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.8)_0%,rgba(2,6,23,1)_100%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md p-8 bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 flex items-center justify-center bg-amber-500/10 border border-amber-500/30 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-amber-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <h2 className="text-xs font-semibold tracking-widest text-amber-500 uppercase">
            Office of the Attorney General, Kenya
          </h2>
          <h1 className="text-xl font-bold text-white mt-1">Forgot Password</h1>
          <p className="text-sm text-slate-400 mt-2">
            Enter your official email address and we will send you a link to reset your password.
          </p>
        </div>

        {sent ? (
          <div className="space-y-6">
            <div className="p-4 bg-emerald-950/50 border border-emerald-500/30 text-emerald-200 text-sm rounded-lg text-center space-y-1">
              <p className="font-semibold text-emerald-400">✓ Reset link sent</p>
              <p className="text-xs text-slate-400">
                If an account with that email exists, a password reset link has been sent.
                Check your inbox and follow the instructions.
              </p>
            </div>
            <Link
              href="/login"
              className="block w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-slate-200 font-medium rounded-xl transition-all text-sm text-center"
            >
              Return to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-950/50 border border-red-500/30 text-red-200 text-xs rounded-lg flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-red-500 shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-medium text-slate-300">
                Official Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                disabled={loading}
                placeholder="name.surname@ag.go.ke"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 text-slate-100 rounded-xl placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors disabled:opacity-50 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="relative w-full py-3 px-4 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-slate-950 font-semibold rounded-xl transition-all shadow-lg shadow-amber-900/20 disabled:opacity-50 flex items-center justify-center text-sm"
            >
              {loading ? (
                <svg
                  className="animate-spin h-5 w-5 text-slate-950"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center border-t border-slate-800/60 pt-5">
          <Link href="/login" className="text-xs text-amber-500/80 hover:text-amber-400 transition-colors">
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
