import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import DirectorClient from './DirectorClient'

interface Props {
  searchParams: Promise<{ business?: string }>
}

export default async function DirectorPage({ searchParams }: Props) {
  const cookieStore = await cookies()
  const role = cookieStore.get('user-role')?.value

  if (role !== 'director') redirect('/admin')

  const { business } = await searchParams
  const activeBusinessId = business || 'all'

  const supabase = await createClient()

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  let ordersQuery = supabase.from('orders').select('id, status, amount_total, created_at, business_id').gte('created_at', thirtyDaysAgo)
  let paymentsQuery = supabase.from('payments').select('id, amount, status, created_at, business_id')
  let enquiriesQuery = supabase.from('enquiries').select('id, pipeline_stage, created_at, business_id').gte('created_at', thirtyDaysAgo)

  if (activeBusinessId !== 'all') {
    ordersQuery = ordersQuery.eq('business_id', activeBusinessId)
    paymentsQuery = paymentsQuery.eq('business_id', activeBusinessId)
    enquiriesQuery = enquiriesQuery.eq('business_id', activeBusinessId)
  }

  const [{ data: ordersLast30 }, { data: payments }, { data: enquiries }, { data: businesses }] = await Promise.all([
    ordersQuery,
    paymentsQuery,
    enquiriesQuery,
    supabase.from('businesses').select('id, name, colour').eq('status', 'active'),
  ])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={<Breadcrumbs items={[{ label: 'Director Overview' }]} />}
      />
      <DirectorClient
        orders={ordersLast30 ?? []}
        payments={payments ?? []}
        enquiries={enquiries ?? []}
        businesses={businesses ?? []}
      />
    </div>
  )
}
