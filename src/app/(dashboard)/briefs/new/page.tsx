import { prisma } from '@/server/db'
import { BriefForm } from '@/components/briefs/brief-form'

export const dynamic = 'force-dynamic'

export default async function NewBriefPage() {
  const parentCandidates = await prisma.brief.findMany({
    where: { deletedAt: null },
    select: { id: true, referenceNumber: true, subject: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <a href="/dashboard" className="hover:text-slate-300 transition-colors">
          Dashboard
        </a>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-400">Log Brief</span>
      </div>

      <div>
        <h1 className="text-lg font-bold text-white">Log New Brief</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Log an incoming brief and automatically allocate it to counsel
        </p>
      </div>

      <BriefForm parentCandidates={parentCandidates} />
    </div>
  )
}
