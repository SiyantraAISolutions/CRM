import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import SalesDashboardClient from './SalesDashboardClient'

interface Props {
  searchParams: Promise<{ business?: string }>
}

export default async function SalesDashboardPage({ searchParams }: Props) {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user-id')?.value
  const role = cookieStore.get('user-role')?.value
  const fullName = cookieStore.get('user-fullname')?.value ?? ''
  const salesTarget = Number(cookieStore.get('user-salestarget')?.value ?? '0')

  if (!userId) redirect('/login')
  if (role !== 'sales') redirect('/admin')

  const { business } = await searchParams
  const activeBusinessId = business || 'all'

  const supabase = await createClient()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

  let activeLeadsQuery = supabase.from('enquiries').select('id', { count: 'exact', head: true })
    .eq('assigned_to', userId)
    .not('pipeline_stage', 'in', '("won","lost")')

  let wonTodayQuery = supabase.from('enquiries').select('id')
    .eq('assigned_to', userId)
    .eq('pipeline_stage', 'won')
    .gte('updated_at', startOfToday)

  let myOrdersQuery = supabase.from('orders').select('amount_total')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .gte('created_at', startOfMonth)

  let followUpsQuery = supabase.from('enquiries').select('id, customer_name, email, follow_up_at')
    .eq('assigned_to', userId)
    .gte('follow_up_at', startOfToday)
    .lte('follow_up_at', endOfToday)
    .order('follow_up_at', { ascending: true })

  if (activeBusinessId !== 'all') {
    activeLeadsQuery = activeLeadsQuery.eq('business_id', activeBusinessId)
    wonTodayQuery = wonTodayQuery.eq('business_id', activeBusinessId)
    myOrdersQuery = myOrdersQuery.eq('business_id', activeBusinessId)
    followUpsQuery = followUpsQuery.eq('business_id', activeBusinessId)
  }

  const [
    { count: activeLeads },
    { data: wonToday },
    { data: myOrders },
    { data: followUps },
  ] = await Promise.all([
    activeLeadsQuery,
    wonTodayQuery,
    myOrdersQuery,
    followUpsQuery,
  ])

  const salesTotal = (myOrders ?? []).reduce((s, o) => s + Number(o.amount_total), 0)

  return (
    <SalesDashboardClient
      userId={userId}
      userName={fullName}
      activeLeads={activeLeads ?? 0}
      convertedToday={wonToday?.length ?? 0}
      salesTotalMonth={salesTotal}
      salesTargetMonth={salesTarget}
      followUps={followUps ?? []}
    />
  )
}

