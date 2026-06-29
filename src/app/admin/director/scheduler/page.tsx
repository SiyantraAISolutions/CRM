import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import SchedulerClient from './SchedulerClient'

export default async function SchedulerPage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user-role')?.value

  if (role !== 'director') redirect('/admin')

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8f7fc]">
      <LayoutHeader
        left={<Breadcrumbs items={[{ label: 'Director' }, { label: 'Scheduler Setup' }]} />}
      />
      <SchedulerClient />
    </div>
  )
}
