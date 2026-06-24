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

  // Fetch only LRT brand services for the Title Deed Monitor
  const { data: formTypes } = await supabase
    .from('form_types')
    .select('id, name, code, brand:brands!inner(code)')
    .eq('brand.code', 'LRT')

  return <MonitorClient formTypes={formTypes || []} />
}
