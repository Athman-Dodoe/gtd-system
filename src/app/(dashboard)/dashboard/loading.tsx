export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-5 w-24 bg-slate-700/50 rounded" />
          <div className="h-3 w-36 bg-slate-700/30 rounded mt-1.5" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-panel p-4 space-y-3">
            <div className="h-3 w-20 bg-slate-700/40 rounded" />
            <div className="h-6 w-12 bg-slate-700/50 rounded" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-panel p-4 space-y-3">
          <div className="h-4 w-32 bg-slate-700/40 rounded" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg">
              <div className="h-3 w-20 bg-slate-700/40 rounded" />
              <div className="h-3 flex-1 bg-slate-700/30 rounded" />
              <div className="h-5 w-14 bg-slate-700/40 rounded-full" />
            </div>
          ))}
        </div>
        <div className="glass-panel p-4 space-y-3">
          <div className="h-4 w-28 bg-slate-700/40 rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg">
              <div className="h-8 w-8 bg-slate-700/40 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3 w-24 bg-slate-700/40 rounded" />
                <div className="h-2 w-16 bg-slate-700/30 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
