import { createClient } from '@/lib/supabase/server'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import CreateOrderClient from './CreateOrderClient'

export default async function CreateOrderPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const { draft } = await searchParams
  const supabase = await createClient()

  const { data: brands } = await supabase
    .from('brands')
    .select('id, code, name, domain')
    .order('code')

  let resumeDraft = null
  if (draft) {
    const { data } = await supabase
      .from('work_drafts')
      .select('*')
      .eq('id', draft)
      .single()
    resumeDraft = data
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={
          <Breadcrumbs
            items={[{ label: 'Orders', href: '/admin/orders' }, { label: 'Create Order' }]}
          />
        }
      />
      <CreateOrderClient brands={brands ?? []} resumeDraft={resumeDraft} />
    </div>
  )
}
