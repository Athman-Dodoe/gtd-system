'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'upper', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'number', label: 'One number', test: (p: string) => /\d/.test(p) },
  { id: 'special', label: 'One special character (!@#$%^&*)', test: (p: string) => /[!@#$%^&*]/.test(p) },
]

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const allRulesPassed = RULES.every((r) => r.test(newPassword))
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0

  if (!token) {
    return (
      <div className="relative z-10 w-full max-w-md p-8 bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl text-center">
        <div className="p-4 bg-red-950/50 border border-red-500/30 text-red-200 text-sm rounded-lg">
          <p className="font-semibold text-red-400">Invalid reset link</p>
          <p className="text-xs text-slate-400 mt-1">
            This password reset link is invalid or missing a token. Please request a new one.
          </p>
        </div>
        <Link
          href="/login/forgot-password"
          className="inline-block mt-4 text-xs text-amber-500/80 hover:text-amber-400 transition-colors"
        >
          Request a new reset link
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!allRulesPassed) {
      setError('Password does not meet all requirements.')
      return
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to reset password. Please try again.')
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
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
        <h1 className="text-xl font-bold text-white mt-1">Reset Your Password</h1>
        <p className="text-sm text-slate-400 mt-2">
          Enter a new secure password for your account.
        </p>
      </div>

      {success ? (
        <div className="space-y-6">
          <div className="p-4 bg-emerald-950/50 border border-emerald-500/30 text-emerald-200 text-sm rounded-lg text-center space-y-1">
            <p className="font-semibold text-emerald-400">✓ Password updated successfully!</p>
            <p className="text-xs text-slate-400">
              Redirecting you to the login page…
            </p>
          </div>
          <Link
            href="/login"
            className="block w-full py-3 px-4 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-slate-950 font-semibold rounded-xl transition-all shadow-lg shadow-amber-900/20 text-sm text-center"
          >
            Log In Now
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
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

          {/* New Password */}
          <div className="space-y-2">
            <label htmlFor="newPassword" className="block text-xs font-medium text-slate-300">
              New Password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                required
                disabled={loading}
                placeholder="Enter your new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 pr-11 bg-slate-950/80 border border-slate-800 text-slate-100 rounded-xl placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors disabled:opacity-50 text-sm"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-300 transition-colors"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Password strength indicators */}
          {newPassword.length > 0 && (
            <ul className="space-y-1.5 px-1">
              {RULES.map((rule) => {
                const passed = rule.test(newPassword)
                return (
                  <li key={rule.id} className="flex items-center gap-2 text-xs">
                    <span className={passed ? 'text-emerald-400' : 'text-slate-600'}>
                      {passed ? '✓' : '○'}
                    </span>
                    <span className={passed ? 'text-emerald-300' : 'text-slate-500'}>
                      {rule.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Confirm Password */}
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-300">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                disabled={loading}
                placeholder="Repeat your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-3 pr-11 bg-slate-950/80 border text-slate-100 rounded-xl placeholder:text-slate-600 focus:outline-none focus:ring-1 transition-colors disabled:opacity-50 text-sm ${confirmPassword.length > 0
                  ? passwordsMatch
                    ? 'border-emerald-500/50 focus:ring-emerald-500/50'
                    : 'border-red-500/50 focus:ring-red-500/50'
                  : 'border-slate-800 focus:ring-amber-500/50 focus:border-amber-500/50'
                  }`}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-300 transition-colors"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-red-400">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !allRulesPassed || !passwordsMatch}
            className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-slate-950 font-semibold rounded-xl transition-all shadow-lg shadow-amber-900/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-sm"
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
              'Reset Password'
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
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100 px-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.8)_0%,rgba(2,6,23,1)_100%)] pointer-events-none" />
      <Suspense fallback={
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      }>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
