export default function ReportsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-5 w-24 bg-slate-700/50 rounded" />
          <div className="h-3 w-36 bg-slate-700/30 rounded mt-1.5" />
        </div>
      </div>

      <div className="flex items-center gap-1 glass-panel p-1 w-fit">
        <div className="h-8 w-28 bg-slate-700/40 rounded-lg" />
        <div className="h-8 w-24 bg-slate-700/30 rounded-lg" />
      </div>

      <div className="flex items-center gap-3">
        <div className="h-2.5 w-10 bg-slate-700/30 rounded" />
        <div className="h-8 w-36 bg-slate-700/40 rounded-lg" />
        <div className="h-2.5 w-12 bg-slate-700/30 rounded" />
        <div className="h-8 w-32 bg-slate-700/40 rounded-lg" />
      </div>

      <div className="glass-panel overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800/60">
              {Array.from({ length: 8 }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <div className="h-3 w-16 bg-slate-700/40 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-slate-800/30">
                {Array.from({ length: 8 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-3 bg-slate-700/30 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
