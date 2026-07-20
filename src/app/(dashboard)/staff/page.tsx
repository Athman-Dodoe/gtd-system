import { redirect } from 'next/navigation'
import { auth } from '@/server/auth'
import { listStaff } from '@/server/services/staff.service'
import { StaffRegistry } from '@/components/staff/staff-registry'

export const dynamic = 'force-dynamic'

export default async function StaffPage({
  searchParams,
}: {
  searchParams: { staffId?: string }
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  if (session.user.role !== 'DSG') {
    redirect('/dashboard')
  }

  const staff = await listStaff()

  const formattedStaff = staff.map((s) => ({
    ...s,
    dateJoined: s.dateJoined.toISOString(),
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold text-white">Staff Registry</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage counsel profiles, monitor capacity, and view workload history
        </p>
      </div>

      <StaffRegistry staff={formattedStaff} initialStaffId={searchParams.staffId} />
    </div>
  )
}
