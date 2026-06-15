import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import TeamClient from './TeamClient'

export default async function TeamPage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user-role')?.value

  if (role !== 'director') redirect('/admin')

  const supabase = await createClient()

  const { data: users } = await supabase
    .from('users')
    .select(`
      id, full_name, email, role, current_status, sales_target, created_at,
      user_businesses(business_id)
    `)
    .order('full_name')

  const { data: businesses } = await supabase
    .from('businesses').select('id, name').eq('status', 'active')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={<Breadcrumbs items={[{ label: 'Team' }]} />}
      />
      <TeamClient users={users as any ?? []} businesses={businesses ?? []} />
    </div>
  )
}

