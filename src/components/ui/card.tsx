interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`glass-panel p-5 ${hover ? 'glass-panel-hover' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
