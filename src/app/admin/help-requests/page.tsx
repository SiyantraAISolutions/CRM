import { createClient } from '@/lib/supabase/server'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import HelpRequestsClient from './HelpRequestsClient'

export default async function HelpRequestsPage() {
  const supabase = await createClient()
  const { data: brands } = await supabase.from('brands').select('id, code, name').order('code')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={<Breadcrumbs items={[{ label: 'Help Requests Queue' }]} />}
      />
      <HelpRequestsClient brands={brands ?? []} />
    </div>
  )
}
