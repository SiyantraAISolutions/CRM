import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import DashboardClient from './DashboardClient'

interface Props {
  searchParams: Promise<{ business?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user-id')?.value
  const role = cookieStore.get('user-role')?.value

  if (!userId) redirect('/login')

  const { business } = await searchParams
  const activeBusinessId = business || 'all'
  const querySuffix = business ? `?business=${business}` : ''

  // Directors go to their own dashboard
  if (role === 'director') redirect(`/admin/director${querySuffix}`)
  // Sales go to their own dashboard
  if (role === 'sales') redirect(`/admin/sales${querySuffix}`)

  // Admin dashboard
  const supabase = await createClient()
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

  let activeCasesQuery = supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'processing')
  let docsPendingQuery = supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'processing').eq('document_delivered', false)
  let tasksDueTodayQuery = supabase.from('tasks').select('id', { count: 'exact', head: true })
    .eq('assigned_to', userId).not('status', 'eq', 'done')
    .gte('due_at', startOfDay).lte('due_at', endOfDay)
  let leaderboardQuery = supabase.from('orders')
    .select('user_id, users!orders_user_id_fkey(full_name)')
    .gte('created_at', startOfDay)
    .in('status', ['paid', 'processing', 'lead'])

  if (activeBusinessId !== 'all') {
    activeCasesQuery = activeCasesQuery.eq('business_id', activeBusinessId)
    docsPendingQuery = docsPendingQuery.eq('business_id', activeBusinessId)
    tasksDueTodayQuery = tasksDueTodayQuery.eq('business_id', activeBusinessId)
    leaderboardQuery = leaderboardQuery.eq('business_id', activeBusinessId)
  }

  const [
    { count: activeCases },
    { count: docsPending },
    { count: tasksDueToday },
    { data: ordersToday },
  ] = await Promise.all([
    activeCasesQuery,
    docsPendingQuery,
    tasksDueTodayQuery,
    leaderboardQuery,
  ])

  // Aggregate leaderboard
  const counts: Record<string, { full_name: string; orders: number }> = {}
  ordersToday?.forEach((o: any) => {
    if (!o.user_id) return
    const name = o.users?.full_name || 'Staff'
    if (!counts[o.user_id]) {
      counts[o.user_id] = { full_name: name, orders: 0 }
    }
    counts[o.user_id].orders++
  })
  const leaderboard = Object.entries(counts).map(([user_id, val]) => ({
    user_id,
    full_name: val.full_name,
    orders: val.orders,
  }))

  const stats = {
    totalToday: activeCases ?? 0,
    paidToday: docsPending ?? 0,
    openTickets: tasksDueToday ?? 0,
    helpRequests: 0,
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <DashboardClient
        stats={stats}
        leaderboard={leaderboard}
        currentUserId={userId}
      />
    </div>
  )
}
