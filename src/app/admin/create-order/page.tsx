import { createClient } from '@/lib/supabase/server'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import CreateOrderClient from './CreateOrderClient'

export default async function CreateOrderPage() {
  const supabase = await createClient()

  const { data: brands } = await supabase
    .from('brands')
    .select('id, code, name, domain')
    .order('code')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={
          <Breadcrumbs
            items={[{ label: 'Orders', href: '/admin/orders' }, { label: 'Create Order' }]}
          />
        }
      />
      <CreateOrderClient brands={brands ?? []} />
    </div>
  )
}
