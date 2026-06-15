import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import OrderDetailClient from './OrderDetailClient'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select(`
      *,
      brand:brands(*),
      form_type:form_types(*),
      user:users(id, full_name, email),
      items:order_items(*),
      notes:order_notes(*, user:users(id, full_name, avatar_url))
    `)
    .eq('id', id)
    .single()

  if (!order) notFound()

  // Related orders (same email)
  const { data: relatedOrders } = await supabase
    .from('orders')
    .select('id, status, amount_total, created_at, form_type:form_types(name)')
    .eq('email', order.email)
    .neq('id', id)
    .order('created_at', { ascending: false })
    .limit(10)

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
        relatedOrders={relatedOrders ?? []}
      />
    </div>
  )
}
