import Link from 'next/link'

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  variant?: 'default' | 'warning' | 'danger' | 'success'
  trend?: { value: string; positive: boolean } | null
  href?: string
}

const variantAccent: Record<string, string> = {
  default: 'border-slate-700/50',
  warning: 'border-amber-700/50',
  danger: 'border-rose-700/50',
  success: 'border-emerald-700/50',
}

const variantIconBg: Record<string, string> = {
  default: 'bg-slate-700/30 text-slate-300 border-slate-600',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  danger: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
}

export function StatCard({
  label,
  value,
  icon,
  variant = 'default',
  trend = null,
  href,
}: StatCardProps) {
  const card = (
    <div
      className={`glass-panel p-5 animate-slide-up border ${variantAccent[variant]} ${href ? 'cursor-pointer hover:ring-1 hover:ring-amber-500/50 transition-all' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
          {trend && (
            <p
              className={`text-xs flex items-center gap-1 ${
                trend.positive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              <svg
                className={`w-3 h-3 ${trend.positive ? '' : 'rotate-180'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              {trend.value}
            </p>
          )}
        </div>
        <div
          className={`w-10 h-10 flex items-center justify-center rounded-lg border ${variantIconBg[variant]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{card}</Link>
  }

  return card
}
