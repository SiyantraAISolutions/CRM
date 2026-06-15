import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase admin client (service role) — bypasses RLS for webhook writes
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  // Verify webhook signature
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret || !sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Record<string, unknown>

  try {
    // Dynamic import to avoid bundling issues
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret) as unknown as Record<string, unknown>
  } catch (err) {
    console.error('Stripe webhook error:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  if (event.type === 'checkout.session.completed') {
    const session = event.data as { object: Record<string, unknown> }
    const sessionObj = session.object

    const orderId = (sessionObj.metadata as Record<string, string>)?.order_id
    const businessId = (sessionObj.metadata as Record<string, string>)?.business_id
    const amount = Number(sessionObj.amount_total ?? 0) / 100 // Stripe amounts in pence

    if (orderId) {
      // Update order status to paid
      await supabase.from('orders').update({
        status: 'paid',
        stripe_payment_intent_id: String(sessionObj.payment_intent ?? ''),
        updated_at: new Date().toISOString(),
      }).eq('id', orderId)

      // Record payment
      await supabase.from('payments').insert({
        order_id: orderId,
        business_id: businessId,
        amount,
        method: 'stripe',
        status: 'cleared',
        processed_at: new Date().toISOString(),
        stripe_payment_intent_id: String(sessionObj.payment_intent ?? ''),
      })

      // Add timeline note
      await supabase.from('order_notes').insert({
        order_id: orderId,
        message: `Payment of £${amount.toFixed(2)} received via Stripe`,
        category: 'Payment',
      })

      console.log(`Order ${orderId} marked as paid — £${amount}`)
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = (event.data as { object: Record<string, unknown> }).object
    const orderId = (pi.metadata as Record<string, string>)?.order_id

    if (orderId) {
      await supabase.from('order_notes').insert({
        order_id: orderId,
        message: `Payment failed: ${String(pi.last_payment_error ?? 'Unknown error')}`,
        category: 'Payment Failed',
      })
    }
  }

  return NextResponse.json({ received: true })
}
