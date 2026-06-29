import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { data, error } = await supabase
    .from('solicitor_blocked_dates')
    .select('*')
    .eq('solicitor_id', id)
    .order('blocked_date')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { blocked_date, notes } = await request.json()
  if (!blocked_date) {
    return NextResponse.json({ error: 'Missing date field' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('solicitor_blocked_dates')
    .insert({ solicitor_id: id, blocked_date, notes })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const blockedDateId = searchParams.get('id')
  const dateStr = searchParams.get('date')

  let query = supabase.from('solicitor_blocked_dates').delete().eq('solicitor_id', id)
  if (blockedDateId) {
    query = query.eq('id', blockedDateId)
  } else if (dateStr) {
    query = query.eq('blocked_date', dateStr)
  } else {
    return NextResponse.json({ error: 'Missing id or date parameter' }, { status: 400 })
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
