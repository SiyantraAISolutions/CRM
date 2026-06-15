import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // Auth check — only directors
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'director') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, full_name, role } = await request.json()
  if (!email || !full_name || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Use service role client for admin invite
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Set role in public.users (trigger may not have fired yet, so upsert)
  await admin.from('users').upsert({
    id: data.user.id,
    email,
    full_name,
    role,
  }, { onConflict: 'id' })

  return NextResponse.json({ success: true })
}
