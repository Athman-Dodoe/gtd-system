export default function NewBriefLoading() {
  return (
    <div className="space-y-6 animate-pulse max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <div className="h-3 w-20 bg-slate-700/30 rounded" />
        <div className="h-3 w-2 bg-slate-700/30 rounded" />
        <div className="h-3 w-16 bg-slate-700/40 rounded" />
      </div>

      <div>
        <div className="h-5 w-32 bg-slate-700/50 rounded" />
        <div className="h-3 w-64 bg-slate-700/30 rounded mt-1.5" />
      </div>

      <div className="glass-panel p-5 space-y-5">
        <div className="h-4 w-28 bg-slate-700/40 rounded" />
        <div className="space-y-3">
          <div className="h-2.5 w-16 bg-slate-700/30 rounded" />
          <div className="h-9 w-full bg-slate-700/40 rounded-lg" />
        </div>
        <div className="space-y-3">
          <div className="h-2.5 w-24 bg-slate-700/30 rounded" />
          <div className="h-20 w-full bg-slate-700/40 rounded-lg" />
        </div>
        <div className="space-y-3">
          <div className="h-2.5 w-28 bg-slate-700/30 rounded" />
          <div className="h-9 w-full bg-slate-700/40 rounded-lg" />
        </div>
      </div>

      <div className="glass-panel p-5 space-y-5">
        <div className="h-4 w-28 bg-slate-700/40 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-2.5 w-20 bg-slate-700/30 rounded" />
              <div className="h-9 w-full bg-slate-700/40 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <div className="h-10 w-28 bg-slate-700/40 rounded-lg" />
      </div>
    </div>
  )
}
