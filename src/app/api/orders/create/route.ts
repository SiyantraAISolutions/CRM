import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabaseUser = await createClient()
    const { data: { user } } = await supabaseUser.auth.getUser()

    const body = await request.json()
    const {
      brand_id,
      form_type_id,
      business_id,
      interaction_type,
      amount_total,
      terms_accepted,
      title,
      first_name,
      middle_name,
      last_name,
      email,
      phone,
      address_line1,
      address_line2,
      city,
      county,
      postcode,
      title_number,
      tenure,
      property_value,
      hmlr_fee,
      tenancy_type,
      is_mortgaged,
      form_data,
      order_items,
      creation_notes,
      draft_id,
    } = body

    if (!brand_id || !form_type_id) {
      return NextResponse.json({ error: 'Missing required order parameters' }, { status: 400 })
    }

    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Build base order payload
    const orderPayload: Record<string, any> = {
      brand_id,
      form_type_id,
      business_id: business_id || null,
      user_id: user?.id || null,
      is_inbound: interaction_type ? String(interaction_type).startsWith('inbound') : false,
      status: 'lead',
      priority: 'standard',
      amount_total: amount_total || 0,
      terms_accepted: !!terms_accepted,
      title: title || null,
      first_name: first_name || null,
      middle_name: middle_name || null,
      last_name: last_name || null,
      email: email || null,
      phone: phone || null,
      address_line1: address_line1 || null,
      address_line2: address_line2 || null,
      city: city || null,
      county: county || null,
      postcode: postcode || null,
      title_number: title_number || null,
      tenure: tenure || null,
      property_value: property_value ? Number(property_value) : null,
      hmlr_fee: hmlr_fee || null,
      tenancy_type: tenancy_type || null,
      is_mortgaged: !!is_mortgaged,
    }

    // Try inserting with form_data first; fallback if form_data column doesn't exist
    let newOrder: any = null
    let insertErr: any = null

    try {
      const res = await adminSupabase
        .from('orders')
        .insert({ ...orderPayload, form_data: form_data || {} })
        .select()
        .single()
      newOrder = res.data
      insertErr = res.error
    } catch (err) {
      insertErr = err
    }

    if (insertErr || !newOrder) {
      const res = await adminSupabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .single()

      newOrder = res.data
      if (res.error || !newOrder) {
        console.error('Database insert error:', res.error)
        return NextResponse.json({ error: res.error?.message || 'Failed to create order' }, { status: 500 })
      }
    }

    // Insert line items
    if (order_items && Array.isArray(order_items) && order_items.length > 0) {
      const itemsToInsert = order_items.map((item: any) => ({
        order_id: newOrder.id,
        item_type: item.item_type,
        amount: Number(item.amount),
      }))
      await adminSupabase.from('order_items').insert(itemsToInsert)
    }

    // Save formatted application details note
    if (form_data && typeof form_data === 'object' && Object.keys(form_data).length > 0) {
      const formattedDetails = Object.entries(form_data)
        .filter(([_, val]) => val !== undefined && val !== null && String(val).trim() !== '')
        .map(([key, val]) => {
          const label = key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase())
          return `• ${label}: ${val}`
        })
        .join('\n')

      if (formattedDetails) {
        await adminSupabase.from('order_notes').insert({
          order_id: newOrder.id,
          user_id: user?.id || null,
          message: `📋 Application Form Details Captured:\n\n${formattedDetails}`,
          category: 'Application Details',
        })
      }
    }

    // Save creation note
    let interactionLabel = 'inbound call'
    if (interaction_type === 'outbound') interactionLabel = 'outbound call'
    else if (interaction_type === 'inbound_bing') interactionLabel = 'inbound bing call'
    else if (interaction_type === 'inbound_google') interactionLabel = 'inbound google call'
    else if (interaction_type === 'help_request') interactionLabel = 'help request'
    else if (interaction_type === 'enquiry') interactionLabel = 'enquiry'
    else if (interaction_type === 'appointment') interactionLabel = 'appointment'

    await adminSupabase.from('order_notes').insert({
      order_id: newOrder.id,
      user_id: user?.id || null,
      message: `Order created via ${interactionLabel}`,
      category: 'Order Created',
    })

    if (creation_notes && String(creation_notes).trim()) {
      await adminSupabase.from('order_notes').insert({
        order_id: newOrder.id,
        user_id: user?.id || null,
        message: String(creation_notes).trim(),
        category: 'Creation Note',
      })
    }

    // Clean up work draft if provided
    if (draft_id) {
      await adminSupabase.from('work_drafts').delete().eq('id', draft_id)
    }

    return NextResponse.json({ order: newOrder })
  } catch (err: any) {
    console.error('Order creation API error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
