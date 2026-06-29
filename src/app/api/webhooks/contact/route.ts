import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, subject, message, source } = body

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders })
    }

    // Use Service Role Key to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase env vars')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500, headers: corsHeaders })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Lookup brand ID based on source ('OLR' or 'LRT')
    let brandId = null
    if (source) {
      const { data: brand } = await supabase.from('brands').select('id').eq('code', source).single()
      if (brand) brandId = brand.id
    }

    // Resolve business_id
    let businessId = null
    if (brandId) {
      // Find a form_type for this brand to get the business_id
      const { data: ft } = await supabase
        .from('form_types')
        .select('business_id')
        .contains('brand_ids', [brandId])
        .limit(1)
        .single()
      if (ft) businessId = ft.business_id
    }
    if (!businessId) {
      const { data: bizs } = await supabase.from('businesses').select('id').limit(1)
      if (bizs && bizs.length > 0) businessId = bizs[0].id
    }

    let error = null
    if (subject === 'Sales Enquiry') {
      const { error: insertErr } = await supabase.from('enquiries').insert([
        {
          customer_name: name,
          email: email,
          phone: '',
          message: message,
          source: source || 'Website',
          pipeline_stage: 'new',
          brand_id: brandId,
          business_id: businessId
        }
      ])
      error = insertErr
    } else {
      const { error: insertErr } = await supabase.from('help_requests').insert([
        {
          customer_name: name,
          customer_email: email,
          subject: subject || `Contact Form - ${source || 'Website'}`,
          body: message,
          status: 'pending',
          brand_id: brandId,
          business_id: businessId
        }
      ])
      error = insertErr
    }

    if (error) {
      console.error('Error inserting webhook data:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500, headers: corsHeaders })
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: corsHeaders })
  }
}
