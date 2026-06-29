import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import HelpRequestsClient from './HelpRequestsClient'

export default async function HelpRequestsPage() {
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user-role')?.value || 'sales'

  const supabase = await createClient()
  const { data: brands } = await supabase.from('brands').select('id, code, name').order('code')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={<Breadcrumbs items={[{ label: 'Help Requests Queue' }]} />}
      />
      <HelpRequestsClient brands={brands ?? []} userRole={userRole} />
    </div>
  )
}
