import { createClient } from '@/lib/supabase/server'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import RefundsClient from './RefundsClient'

export default async function RefundsPage() {
  const supabase = await createClient()

  const { data: refunds } = await supabase
    .from('refunds')
    .select(`
      *,
      order:orders(id, first_name, last_name, email, amount_total, status, form_type:form_types(name)),
      created_by_user:users!refunds_created_by_fkey(id, full_name),
      approved_by_user:users!refunds_approved_by_fkey(id, full_name)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={
          <Breadcrumbs
            items={[{ label: 'Refunds' }]}
          />
        }
      />
      <RefundsClient refunds={refunds ?? []} />
    </div>
  )
}
