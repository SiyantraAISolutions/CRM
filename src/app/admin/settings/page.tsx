import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user-role')?.value

  if (role !== 'director') redirect('/admin')

  const supabase = await createClient()


  const { data: settings } = await supabase.from('settings').select('key, value')
  const { data: businesses } = await supabase.from('businesses').select('*').order('name')

  const settingsMap = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={<Breadcrumbs items={[{ label: 'Settings' }]} />}
      />
      <SettingsClient settings={settingsMap} businesses={businesses ?? []} />
    </div>
  )
}
