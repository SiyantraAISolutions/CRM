import Link from 'next/link'
import { getDashboardPath } from '@/lib/role'
import type { UserRole } from '@/types'
import { cookies } from 'next/headers'

export default async function ForbiddenPage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user-role')?.value
  let dashPath = '/admin'

  if (role) {
    dashPath = getDashboardPath(role as UserRole)
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 p-10">
      <div className="text-5xl font-bold text-ink-gray-3">403</div>
      <h1 className="text-xl font-semibold text-ink-gray-9">Access Denied</h1>
      <p className="text-sm text-ink-gray-5">You don&apos;t have permission to view this page.</p>
      <Link href={dashPath} className="btn-primary px-6 py-2">Back to Dashboard</Link>
    </div>
  )
}
