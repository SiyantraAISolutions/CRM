import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import ServicesClient from './ServicesClient'

export default async function ServicesPage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user-role')?.value

  if (role !== 'director') redirect('/admin/forbidden')

  const supabase = await createClient()


  const [{ data: services }, { data: businesses }] = await Promise.all([
    supabase.from('form_types').select('*').order('name'),
    supabase.from('businesses').select('id, name').order('name'),
  ])

  return <ServicesClient services={services ?? []} businesses={businesses ?? []} />
}

