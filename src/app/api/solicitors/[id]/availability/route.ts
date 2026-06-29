import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const { data, error } = await supabase
    .from('solicitor_availability')
    .select('*')
    .eq('solicitor_id', id)
    .order('day_of_week')

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

  const { availabilities } = await request.json()
  if (!Array.isArray(availabilities)) {
    return NextResponse.json({ error: 'Availabilities must be an array' }, { status: 400 })
  }

  // Delete existing availability for this solicitor first
  const { error: deleteErr } = await supabase
    .from('solicitor_availability')
    .delete()
    .eq('solicitor_id', id)

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  if (availabilities.length === 0) {
    return NextResponse.json({ success: true, data: [] })
  }

  const rowsToInsert = availabilities.map((a: any) => ({
    solicitor_id: id,
    day_of_week: Number(a.day_of_week),
    start_time: a.start_time,
    end_time: a.end_time,
    slot_duration: Number(a.slot_duration || 15),
  }))

  const { data, error: insertErr } = await supabase
    .from('solicitor_availability')
    .insert(rowsToInsert)
    .select()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
  return NextResponse.json(data)
}
