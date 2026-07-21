import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createPaymentLink } from '@/lib/stripe'

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use admin client to bypass RLS for role check and order lookup
    const adminSupabase = getSupabaseAdmin()

    // Check role — director, admin, sales can generate payment links
    const { data: profile } = await adminSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['director', 'admin', 'sales'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { order_id, amount, customer_email, description } = body

    if (!order_id || !amount) {
      return NextResponse.json({ error: 'order_id and amount are required' }, { status: 400 })
    }

    // Fetch order to get business_id using admin client to bypass RLS
    const { data: order } = await adminSupabase
      .from('orders')
      .select('business_id, first_name, last_name')
      .eq('id', order_id)
      .single()

    const origin = req.headers.get('origin') || 'https://www.kws-managementservices.online'

    const session = await createPaymentLink({
      orderId: order_id,
      businessId: order?.business_id ?? undefined,
      amount: Number(amount),
      customerEmail: customer_email,
      description: description || `Payment for Order #${String(order_id).slice(-6).toUpperCase()}`,
      successUrl: `${origin}/admin/orders/${order_id}?payment=success`,
      cancelUrl: `${origin}/admin/orders/${order_id}?payment=cancelled`,
    })

    // Add timeline note
    await adminSupabase.from('order_notes').insert({
      order_id,
      user_id: user.id,
      message: `Payment link generated: £${Number(amount).toFixed(2)} — sent to ${customer_email || 'clipboard'}`,
      category: 'Payment Link',
    })

    return NextResponse.json({
      url: session.url,
      session_id: session.id,
    })
  } catch (err: unknown) {
    console.error('Payment link error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
