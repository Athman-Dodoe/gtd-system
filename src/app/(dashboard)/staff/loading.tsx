export default function StaffLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-5 w-32 bg-slate-700/50 rounded" />
        <div className="h-3 w-72 bg-slate-700/30 rounded mt-1.5" />
      </div>

      <div className="glass-panel p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 flex-1 bg-slate-700/40 rounded-lg" />
          <div className="h-9 w-24 bg-slate-700/40 rounded-lg" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-6 w-18 bg-slate-700/30 rounded-full" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-panel p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5 flex-1">
                <div className="h-3.5 w-28 bg-slate-700/50 rounded" />
                <div className="h-2.5 w-20 bg-slate-700/30 rounded" />
              </div>
              <div className="h-5 w-16 bg-slate-700/40 rounded-full" />
            </div>
            <div className="flex gap-1">
              <div className="h-4 w-14 bg-slate-700/30 rounded-full" />
              <div className="h-4 w-12 bg-slate-700/30 rounded-full" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <div className="h-2.5 w-14 bg-slate-700/30 rounded" />
                <div className="h-2.5 w-16 bg-slate-700/30 rounded" />
              </div>
              <div className="h-1.5 w-full bg-slate-700/30 rounded-full" />
            </div>
            <div className="border-t border-slate-700/50 pt-3 mt-3 flex items-center justify-between">
              <div className="h-2.5 w-10 bg-slate-700/30 rounded" />
              <div className="h-5 w-10 bg-slate-700/40 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
