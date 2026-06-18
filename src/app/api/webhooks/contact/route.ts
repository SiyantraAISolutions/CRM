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

    const { error } = await supabase.from('help_requests').insert([
      {
        customer_name: name,
        customer_email: email,
        subject: subject || `Contact Form - ${source || 'Website'}`,
        body: message,
        status: 'pending',
        brand_id: brandId
      }
    ])

    if (error) {
      console.error('Error inserting help request:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500, headers: corsHeaders })
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: corsHeaders })
  }
}
