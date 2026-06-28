import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const role = cookieStore.get('user-role')?.value
  
  if (!role || !['admin', 'director', 'sales'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const activeBusinessId = searchParams.get('business_id')
  const search = searchParams.get('search')

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let q = supabase
    .from('enquiries')
    .select('*, business:businesses(id,name,domain), assigned:users!enquiries_assigned_to_fkey(id,full_name,avatar_url)')
    .order('created_at', { ascending: false })

  if (activeBusinessId && activeBusinessId !== 'all') q = q.eq('business_id', activeBusinessId)
  if (search) q = q.or(`customer_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
