import { createClient } from '@/lib/supabase/server'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import PaymentsClient from './PaymentsClient'

export default async function PaymentsPage() {
  const supabase = await createClient()
  const { data: businesses } = await supabase.from('businesses').select('id, name').eq('status', 'active')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={<Breadcrumbs items={[{ label: 'Payments' }]} />}
      />
      <PaymentsClient businesses={businesses ?? []} />
    </div>
  )
}
