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
  const brandFilter = searchParams.get('brand_id')
  const formTypeFilter = searchParams.get('form_type_id')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const search = searchParams.get('search')
  const sortKey = searchParams.get('sort_key') || 'created_at'
  const sortDir = searchParams.get('sort_dir') || 'desc'
  const page = Number(searchParams.get('page') || '1')
  const pageSize = Number(searchParams.get('page_size') || '10')

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let query = supabase
    .from('orders')
    .select(`
      *,
      brand:brands(id, code, name),
      form_type:form_types(id, name, code),
      user:users!orders_user_id_fkey(id, full_name)
    `, { count: 'exact' })
    .order(sortKey, { ascending: sortDir === 'asc' })
    .range((page - 1) * pageSize, page * pageSize - 1)
    .not('status', 'in', '("abandoned","dead")')

  if (activeBusinessId && activeBusinessId !== 'all') query = query.eq('business_id', activeBusinessId)
  if (brandFilter && brandFilter !== 'all') query = query.eq('brand_id', brandFilter)
  if (formTypeFilter && formTypeFilter !== 'all') query = query.eq('form_type_id', formTypeFilter)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59')
  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
    )
  }

  const { data, count, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, count })
}
