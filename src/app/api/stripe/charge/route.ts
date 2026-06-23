import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPaymentIntent } from '@/lib/stripe'

/**
 * POST /api/stripe/charge
 * Creates a PaymentIntent for Stripe Elements client-side confirmation.
 * 
 * Body: { order_id, amount, description? }
 * Returns: { client_secret, payment_intent_id }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check role — director & admin can take payments
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['director', 'admin', 'sales'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { order_id, amount, description } = body

    if (!order_id || !amount) {
      return NextResponse.json({ error: 'order_id and amount are required' }, { status: 400 })
    }

    // Fetch order details
    const { data: order } = await supabase
      .from('orders')
      .select('business_id, email, first_name, last_name')
      .eq('id', order_id)
      .single()

    const paymentIntent = await createPaymentIntent({
      amount: Number(amount),
      orderId: order_id,
      businessId: order?.business_id ?? undefined,
      customerEmail: order?.email ?? undefined,
      description: description || `CRM Payment — Order #${String(order_id).slice(-6).toUpperCase()}`,
    })

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    })
  } catch (err: unknown) {
    console.error('Charge error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
