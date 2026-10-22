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
  const statusFilter = searchParams.get('status_filter') || 'active'
  const sortKey = searchParams.get('sort_key') || 'created_at'
  const sortDir = searchParams.get('sort_dir') || 'desc'
  const page = Number(searchParams.get('page') || '1')
  const pageSize = Number(searchParams.get('page_size') || '10')

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Map frontend sort_key safely to DB column
  let dbSortColumn = 'created_at'
  if (sortKey === 'full_name' || sortKey === 'name') {
    dbSortColumn = 'first_name'
  } else if (sortKey === 'brand') {
    dbSortColumn = 'brand_id'
  } else if (['id', 'email', 'amount_total', 'created_at', 'priority', 'status', 'first_name', 'last_name', 'phone', 'postcode'].includes(sortKey)) {
    dbSortColumn = sortKey
  }

  let query = supabase
    .from('orders')
    .select(`
      *,
      brand:brands(id, code, name),
      form_type:form_types(id, name, code),
      user:users!orders_user_id_fkey(id, full_name),
      payments(id, method, status, processed_by, processor:users!payments_processed_by_fkey(id, full_name))
    `, { count: 'exact' })

  if (statusFilter === 'active') {
    query = query
      .neq('status', 'completed')
      .neq('status', 'Completed')
      .neq('status', 'abandoned')
      .neq('status', 'dead')
      .or('monitor_stage.is.null,monitor_stage.neq.completed')
  } else if (statusFilter === 'completed') {
    query = query.or('status.eq.completed,status.eq.Completed,monitor_stage.eq.completed')
  } else if (statusFilter === 'all') {
    query = query.neq('status', 'abandoned').neq('status', 'dead')
  } else {
    query = query.eq('status', statusFilter)
  }

  if (activeBusinessId && activeBusinessId !== 'all') query = query.eq('business_id', activeBusinessId)
  if (brandFilter && brandFilter !== 'all') query = query.eq('brand_id', brandFilter)
  if (formTypeFilter && formTypeFilter !== 'all') query = query.eq('form_type_id', formTypeFilter)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59')

  if (search && search.trim()) {
    const cleanSearch = search.replace(/^#/, '').trim()
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanSearch)

    if (isUuid) {
      query = query.eq('id', cleanSearch)
    } else {
      let matchedIds: string[] = []
      if (/^[0-9a-f]{4,36}$/i.test(cleanSearch)) {
        const { data: idMatches } = await supabase.from('orders').select('id')
        matchedIds = (idMatches || [])
          .filter(o => o.id.toLowerCase().includes(cleanSearch.toLowerCase()) || o.id.replace(/-/g, '').toLowerCase().includes(cleanSearch.toLowerCase()))
          .map(o => o.id)
      }

      const words = cleanSearch.split(/\s+/).filter(Boolean)
      const orClauses: string[] = []

      if (matchedIds.length > 0) {
        orClauses.push(`id.in.(${matchedIds.join(',')})`)
      }

      if (words.length > 1) {
        const w1 = words[0]
        const w2 = words.slice(1).join(' ')
        orClauses.push(
          `and(first_name.ilike.%${w1}%,last_name.ilike.%${w2}%)`,
          `and(first_name.ilike.%${w2}%,last_name.ilike.%${w1}%)`,
          `first_name.ilike.%${cleanSearch}%`,
          `last_name.ilike.%${cleanSearch}%`,
          `email.ilike.%${cleanSearch}%`,
          `address_line1.ilike.%${cleanSearch}%`
        )
      } else {
        orClauses.push(
          `first_name.ilike.%${cleanSearch}%`,
          `last_name.ilike.%${cleanSearch}%`,
          `email.ilike.%${cleanSearch}%`,
          `phone.ilike.%${cleanSearch}%`,
          `title_number.ilike.%${cleanSearch}%`,
          `postcode.ilike.%${cleanSearch}%`,
          `address_line1.ilike.%${cleanSearch}%`
        )
      }

      query = query.or(orClauses.join(','))
    }
  }

  const isStatusSort = sortKey === 'status' || sortKey === 'status_priority'

  if (isStatusSort) {
    const { data, count, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const getStatusRank = (status?: string | null): number => {
      const s = (status || '').trim().toLowerCase()
      if (s === 'lead') return 1 // New
      if (s === 'processing' || s === 'in_progress') return 2 // Processing
      if (s === 'paid') return 3 // Paid
      return 4 // Others
    }

    const sortedData = (data || []).slice().sort((a, b) => {
      const rankA = getStatusRank(a.status)
      const rankB = getStatusRank(b.status)
      if (rankA !== rankB) {
        return sortDir === 'desc' ? rankB - rankA : rankA - rankB
      }
      const timeA = new Date(a.created_at || 0).getTime()
      const timeB = new Date(b.created_at || 0).getTime()
      return timeB - timeA
    })

    const paginated = sortedData.slice((page - 1) * pageSize, page * pageSize)
    return NextResponse.json({ data: paginated, count: count ?? sortedData.length })
  }

  query = query
    .order(dbSortColumn, { ascending: sortDir === 'asc' })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, count, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, count })
}
