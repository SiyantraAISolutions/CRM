import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { retrievePaymentIntent } from '@/lib/stripe'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * POST /api/stripe/confirm
 * Called after Stripe Elements successfully confirms a PaymentIntent on the client.
 * Records the payment in the DB and updates the order status.
 * 
 * Body: { payment_intent_id, order_id }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { payment_intent_id, order_id } = body

    if (!payment_intent_id || !order_id) {
      return NextResponse.json({ error: 'payment_intent_id and order_id are required' }, { status: 400 })
    }

    // Verify with Stripe that payment succeeded
    const pi = await retrievePaymentIntent(payment_intent_id)

    if (pi.status !== 'succeeded') {
      return NextResponse.json({ error: `Payment not succeeded. Status: ${pi.status}` }, { status: 400 })
    }

    const amount = pi.amount / 100 // pence to pounds
    const adminSupabase = getSupabaseAdmin()

    // Fetch order for business_id
    const { data: order } = await adminSupabase
      .from('orders')
      .select('business_id')
      .eq('id', order_id)
      .single()

    // Update order status to paid
    await adminSupabase.from('orders').update({
      status: 'paid',
      stripe_payment_intent_id: payment_intent_id,
      updated_at: new Date().toISOString(),
    }).eq('id', order_id)

    // Record payment
    await adminSupabase.from('payments').insert({
      order_id,
      business_id: order?.business_id ?? null,
      amount,
      method: 'stripe',
      status: 'cleared',
      processed_by: user.id,
      processed_at: new Date().toISOString(),
      stripe_payment_intent_id: payment_intent_id,
    })

    // Add timeline note
    await adminSupabase.from('order_notes').insert({
      order_id,
      user_id: user.id,
      message: `Payment of £${amount.toFixed(2)} taken via Stripe (CRM) — ${payment_intent_id}`,
      category: 'Payment',
    })

    return NextResponse.json({ success: true, amount })
  } catch (err: unknown) {
    console.error('Confirm payment error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
