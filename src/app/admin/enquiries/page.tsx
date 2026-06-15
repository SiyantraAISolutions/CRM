import { createClient } from '@/lib/supabase/server'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import EnquiriesClient from './EnquiriesClient'

export default async function EnquiriesPage() {
  const supabase = await createClient()
  const { data: businesses } = await supabase.from('businesses').select('id, name, domain').eq('status', 'active')
  const { data: users } = await supabase.from('users').select('id, full_name').in('role', ['sales', 'director'])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={<Breadcrumbs items={[{ label: 'Enquiries' }]} />}
      />
      <EnquiriesClient businesses={businesses ?? []} users={users ?? []} />
    </div>
  )
}
