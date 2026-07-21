import { createClient as createAdminClient } from '@supabase/supabase-js'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import OrdersClient from './OrdersClient'

export default async function OrdersPage() {
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: brands }, { data: formTypes }] = await Promise.all([
    supabase.from('brands').select('id, code, name').order('name'),
    supabase.from('form_types').select('id, name, code').order('name'),
  ])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={<Breadcrumbs items={[{ label: 'Orders' }]} />}
      />
      <OrdersClient brands={brands ?? []} formTypes={formTypes ?? []} />
    </div>
  )
}
