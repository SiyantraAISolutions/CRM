import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import OrderDetailClient from './OrderDetailClient'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const userRole = cookieStore.get('user-role')?.value || 'sales'
  
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      brand:brands(*),
      form_type:form_types(*),
      user:users!orders_user_id_fkey(id, full_name, email),
      items:order_items(*),
      notes:order_notes(*, user:users(id, full_name, avatar_url))
    `)
    .eq('id', id)
    .single()

  if (error || !order) {
    const { data: fallbackOrder } = await supabase
      .from('orders')
      .select(`
        *,
        brand:brands(*),
        form_type:form_types(*),
        user:users(id, full_name, email),
        items:order_items(*),
        notes:order_notes(*)
      `)
      .eq('id', id)
      .single()

    order = fallbackOrder
  }

  if (!order) notFound()

  // Fetch current user details
  const clientSupabase = await createClient()
  const { data: { user } } = await clientSupabase.auth.getUser()
  let currentUserName = ''
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single()
    currentUserName = profile?.full_name || ''
  }

  // Related orders (same email)
  let relatedOrders: any[] = []
  if (order.email) {
    const { data: rel } = await supabase
      .from('orders')
      .select('id, status, amount_total, created_at, form_type:form_types(name)')
      .eq('email', order.email)
      .neq('id', id)
      .order('created_at', { ascending: false })
      .limit(10)
    relatedOrders = rel ?? []
  }

  const shortId = String(id).slice(-6).toUpperCase()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={
          <Breadcrumbs
            items={[
              { label: 'Orders', href: '/admin/orders' },
              { label: `Order #${shortId}` },
            ]}
          />
        }
      />
      <OrderDetailClient
        order={order}
        relatedOrders={relatedOrders}
        userRole={userRole}
        currentUserName={currentUserName}
      />
    </div>
  )
}
