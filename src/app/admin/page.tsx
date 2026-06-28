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

  let helpRequestsQuery = supabase.from('help_requests')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'in_progress'])

  let recentHelpRequestsQuery = supabase.from('help_requests')
    .select('id, subject, customer_name, customer_email, status, created_at, brand:brands(code,name)')
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(5)

  let recentPendingDocsQuery = supabase.from('orders')
    .select('id, first_name, last_name, amount_total, created_at, status, brand:brands(code,name), form_type:form_types(code,name)')
    .eq('status', 'processing')
    .eq('document_delivered', false)
    .order('created_at', { ascending: false })
    .limit(5)

  let tasksListQuery = supabase.from('tasks')
    .select('id, title, description, due_at, priority, status')
    .eq('assigned_to', userId)
    .not('status', 'eq', 'done')
    .gte('due_at', startOfDay)
    .lte('due_at', endOfDay)
    .order('due_at', { ascending: true })
    .limit(5)

  if (activeBusinessId !== 'all') {
    activeCasesQuery = activeCasesQuery.eq('business_id', activeBusinessId)
    docsPendingQuery = docsPendingQuery.eq('business_id', activeBusinessId)
    tasksDueTodayQuery = tasksDueTodayQuery.eq('business_id', activeBusinessId)
    helpRequestsQuery = helpRequestsQuery.eq('business_id', activeBusinessId)
    recentHelpRequestsQuery = recentHelpRequestsQuery.eq('business_id', activeBusinessId)
    recentPendingDocsQuery = recentPendingDocsQuery.eq('business_id', activeBusinessId)
    tasksListQuery = tasksListQuery.eq('business_id', activeBusinessId)
  }

  const [
    { count: activeCases },
    { count: docsPending },
    { count: tasksDueToday },
    { count: helpRequestsCount },
    { data: recentHelpRequests },
    { data: recentPendingDocs },
    { data: tasksList },
    { data: formTypes },
  ] = await Promise.all([
    activeCasesQuery,
    docsPendingQuery,
    tasksDueTodayQuery,
    helpRequestsQuery,
    recentHelpRequestsQuery,
    recentPendingDocsQuery,
    tasksListQuery,
    supabase.from('form_types').select('id, code, name, base_price, fee_scale')
  ])

  const userName = cookieStore.get('user-fullname')?.value ?? 'Admin'

  const stats = {
    totalToday: activeCases ?? 0,
    paidToday: docsPending ?? 0,
    openTickets: tasksDueToday ?? 0,
    helpRequests: helpRequestsCount ?? 0,
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <DashboardClient
        stats={stats}
        currentUserId={userId}
        userName={userName}
        tasks={tasksList ?? []}
        helpRequests={recentHelpRequests ?? []}
        pendingDocs={recentPendingDocs ?? []}
      />
    </div>
  )
}
