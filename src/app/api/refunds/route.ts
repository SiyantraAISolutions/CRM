import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const REFUND_STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  under_review: 'Under Quality Review (3–5 Working Days)',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
}

/**
 * POST /api/refunds
 * Register a new refund request.
 *
 * Body: { order_id, reason, refund_amount }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { order_id, reason, refund_amount } = body

    if (!order_id) {
      return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
    }
    if (!refund_amount || Number(refund_amount) <= 0) {
      return NextResponse.json({ error: 'A valid refund_amount is required' }, { status: 400 })
    }

    const adminSupabase = getSupabaseAdmin()

    // Create refund record
    const { data: refund, error: insertError } = await adminSupabase
      .from('refunds')
      .insert({
        order_id,
        status: 'requested',
        reason: reason || null,
        refund_amount: Number(refund_amount),
        manager_approval: false,
        created_by: user.id,
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('Insert refund error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Get user name for the note
    const { data: profile } = await adminSupabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single()

    // Add timeline note to the order
    await adminSupabase.from('order_notes').insert({
      order_id,
      user_id: user.id,
      message: `🔄 Refund Requested — £${Number(refund_amount).toFixed(2)}${reason ? ` — Reason: ${reason}` : ''} (by ${profile?.full_name || 'Staff'})`,
      category: 'Refund',
    })

    return NextResponse.json({ refund })
  } catch (err: unknown) {
    console.error('Refund create error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/refunds
 * Update refund status or manager approval.
 *
 * Body: { refund_id, status?, manager_approval? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { refund_id, status, manager_approval } = body

    if (!refund_id) {
      return NextResponse.json({ error: 'refund_id is required' }, { status: 400 })
    }

    const adminSupabase = getSupabaseAdmin()

    // Fetch existing refund
    const { data: existing } = await adminSupabase
      .from('refunds')
      .select('*')
      .eq('id', refund_id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Refund not found' }, { status: 404 })
    }

    // Build update payload
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (status && status !== existing.status) {
      updates.status = status
    }

    if (typeof manager_approval === 'boolean') {
      updates.manager_approval = manager_approval
      if (manager_approval) {
        updates.approved_by = user.id
      }
    }

    const { data: updated, error: updateError } = await adminSupabase
      .from('refunds')
      .update(updates)
      .eq('id', refund_id)
      .select('*')
      .single()

    if (updateError) {
      console.error('Update refund error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Get user name for the note
    const { data: profile } = await adminSupabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const staffName = profile?.full_name || 'Staff'

    // Add timeline note for status change
    if (status && status !== existing.status) {
      const label = REFUND_STATUS_LABELS[status] || status
      await adminSupabase.from('order_notes').insert({
        order_id: existing.order_id,
        user_id: user.id,
        message: `🔄 Refund status changed to "${label}" — £${Number(existing.refund_amount).toFixed(2)} (by ${staffName})`,
        category: 'Refund',
      })
    }

    // Add timeline note for director approval
    if (typeof manager_approval === 'boolean' && manager_approval !== existing.manager_approval) {
      await adminSupabase.from('order_notes').insert({
        order_id: existing.order_id,
        user_id: user.id,
        message: manager_approval
          ? `✅ Director Approval granted for refund of £${Number(existing.refund_amount).toFixed(2)} (by ${staffName})`
          : `❌ Director Approval revoked for refund of £${Number(existing.refund_amount).toFixed(2)} (by ${staffName})`,
        category: 'Refund',
      })
    }

    return NextResponse.json({ refund: updated })
  } catch (err: unknown) {
    console.error('Refund update error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
