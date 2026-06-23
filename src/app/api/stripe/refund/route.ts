import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createRefund } from '@/lib/stripe'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * POST /api/stripe/refund
 * Issues a full or partial refund via Stripe.
 * 
 * Body: { payment_intent_id, amount?, reason?, order_id }
 * Returns: { refund_id, status }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only directors can issue refunds
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'director') {
      return NextResponse.json({ error: 'Only directors can issue refunds' }, { status: 403 })
    }

    const body = await req.json()
    const { payment_intent_id, amount, reason, order_id } = body

    if (!payment_intent_id) {
      return NextResponse.json({ error: 'payment_intent_id is required' }, { status: 400 })
    }

    const refund = await createRefund({
      paymentIntentId: payment_intent_id,
      amount: amount ? Number(amount) : undefined,
      reason: reason ?? 'requested_by_customer',
    })

    // Update payment record in DB
    const adminSupabase = getSupabaseAdmin()

    await adminSupabase
      .from('payments')
      .update({
        status: 'refunded',
        notes: `Refund: ${refund.id} — ${amount ? `£${Number(amount).toFixed(2)} partial` : 'full refund'}`,
      })
      .eq('stripe_payment_intent_id', payment_intent_id)

    // Update order status
    if (order_id) {
      await adminSupabase
        .from('orders')
        .update({ status: 'dead', updated_at: new Date().toISOString() })
        .eq('id', order_id)

      // Add timeline note
      await adminSupabase.from('order_notes').insert({
        order_id,
        user_id: user.id,
        message: `Refund processed: ${amount ? `£${Number(amount).toFixed(2)} (partial)` : 'Full refund'} — Stripe Refund ID: ${refund.id}`,
        category: 'Refund',
      })
    }

    return NextResponse.json({
      refund_id: refund.id,
      status: refund.status,
    })
  } catch (err: unknown) {
    console.error('Refund error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
