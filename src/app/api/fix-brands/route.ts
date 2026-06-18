import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase env vars' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Insert Property-Detailer brand
  const { data, error } = await supabase.from('brands').insert([
    {
      code: 'PD',
      name: 'Property Detailer',
      domain: 'propertydetailer.co.uk'
    }
  ]).select().single()

  if (error) {
    // Maybe it already exists? Let's check
    const { data: existing } = await supabase.from('brands').select('*').eq('code', 'PD').single()
    if (existing) {
      return NextResponse.json({ message: 'Brand already exists', brand: existing })
    }
    return NextResponse.json({ error: error.message })
  }

  return NextResponse.json({ message: 'Brand created', brand: data })
}
