import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MonitorClient from './MonitorClient'

export const dynamic = 'force-dynamic'

export default async function MonitorPage() {
  const supabase = await createClient()
  
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) {
    redirect('/auth/login')
  }

  // Fetch all brand services for the monitor
  const { data: formTypes } = await supabase
    .from('form_types')
    .select('id, name, code, brand:brands!inner(code, name)')

  return <MonitorClient formTypes={formTypes || []} />
}
