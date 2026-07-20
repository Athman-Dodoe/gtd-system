interface BadgeProps {
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info'
  children: React.ReactNode
  className?: string
}

const variantStyles: Record<string, string> = {
  default: 'bg-slate-700/60 text-slate-200 border-slate-600',
  success: 'bg-emerald-950/50 text-emerald-300 border-emerald-700',
  danger: 'bg-rose-950/50 text-rose-300 border-rose-700',
  warning: 'bg-amber-950/50 text-amber-300 border-amber-700',
  info: 'bg-sky-950/50 text-sky-300 border-sky-700',
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
