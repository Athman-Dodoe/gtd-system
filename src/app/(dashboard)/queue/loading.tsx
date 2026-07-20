export default function QueueLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-5 w-40 bg-slate-700/50 rounded" />
        <div className="h-3 w-64 bg-slate-700/30 rounded mt-1.5" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-panel p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-28 bg-slate-700/50 rounded" />
                  <div className="h-4 w-16 bg-slate-700/40 rounded-full" />
                </div>
                <div className="h-3 w-48 bg-slate-700/30 rounded" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-7 w-16 bg-slate-700/40 rounded-lg" />
                <div className="h-7 w-18 bg-slate-700/40 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="space-y-1">
                  <div className="h-2.5 w-14 bg-slate-700/30 rounded" />
                  <div className="h-3 w-20 bg-slate-700/40 rounded" />
                </div>
              ))}
            </div>
            <div className="h-2.5 w-36 bg-slate-700/30 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
