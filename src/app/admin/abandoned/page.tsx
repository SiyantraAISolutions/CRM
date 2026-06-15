import { createClient } from '@/lib/supabase/server'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import AbandonedClient from './AbandonedClient'

export default async function AbandonedPage() {
  const supabase = await createClient()
  const { data: brands } = await supabase.from('brands').select('id, code, name').order('code')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={<Breadcrumbs items={[{ label: 'Abandoned Orders' }]} />}
      />
      <AbandonedClient brands={brands ?? []} />
    </div>
  )
}
