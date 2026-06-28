import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
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

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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
    .or(`user_id.eq.${userId},completed_by.eq.${userId}`)
    .in('status', ['paid', 'cleared', 'processing', 'completed'])
    .gte('created_at', startOfMonth)

  let followUpsQuery = supabase.from('enquiries').select('id, customer_name, email, follow_up_at')
    .eq('assigned_to', userId)
    .gte('follow_up_at', startOfToday)
    .lte('follow_up_at', endOfToday)
    .order('follow_up_at', { ascending: true })

  // Query actual lists for dashboard rendering
  let recentOrdersQuery = supabase.from('orders')
    .select('id, first_name, last_name, amount_total, created_at, status, brand:brands(code,name), form_type:form_types(code,name)')
    .order('created_at', { ascending: false })
    .limit(5)

  let activeEnquiriesQuery = supabase.from('enquiries')
    .select('id, customer_name, email, phone, pipeline_stage, created_at, brand:brands(code,name)')
    .not('pipeline_stage', 'in', '("won","lost")')
    .order('created_at', { ascending: false })
    .limit(5)

  if (activeBusinessId !== 'all') {
    activeLeadsQuery = activeLeadsQuery.eq('business_id', activeBusinessId)
    wonTodayQuery = wonTodayQuery.eq('business_id', activeBusinessId)
    myOrdersQuery = myOrdersQuery.eq('business_id', activeBusinessId)
    followUpsQuery = followUpsQuery.eq('business_id', activeBusinessId)
    recentOrdersQuery = recentOrdersQuery.eq('business_id', activeBusinessId)
    activeEnquiriesQuery = activeEnquiriesQuery.eq('business_id', activeBusinessId)
  }

  const [
    { count: activeLeads },
    { data: wonToday },
    { data: myOrders },
    { data: followUps },
    { data: recentOrders },
    { data: activeEnquiries },
  ] = await Promise.all([
    activeLeadsQuery,
    wonTodayQuery,
    myOrdersQuery,
    followUpsQuery,
    recentOrdersQuery,
    activeEnquiriesQuery,
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
      recentOrders={recentOrders ?? []}
      activeEnquiries={activeEnquiries ?? []}
    />
  )
}

