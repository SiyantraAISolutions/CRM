import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { BusinessProvider } from '@/context/BusinessContext'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { UserRole } from '@/types'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user-id')?.value
  const userRole = (cookieStore.get('user-role')?.value ?? 'sales') as UserRole
  const userName = cookieStore.get('user-fullname')?.value ?? 'Staff'
  const userEmail = cookieStore.get('user-email')?.value ?? ''

  if (!userId) {
    redirect('/login')
  }

  return (
    <BusinessProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-surface-gray-1">
        <div className="h-full flex-shrink-0">
          <Sidebar userRole={userRole} />
        </div>
        <div className="flex flex-1 flex-col h-full overflow-hidden bg-white">
          <TopBar
            role={userRole}
            userName={userName}
            userEmail={userEmail}
            notificationCount={0}
          />
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </BusinessProvider>
  )
}


