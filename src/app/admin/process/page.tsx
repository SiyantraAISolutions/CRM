import { createClient } from '@/lib/supabase/server'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import ProcessClient from './ProcessClient'

export default async function ProcessPage() {
  const supabase = await createClient()

  // Fetch form types for mapping service names
  const { data: formTypes } = await supabase.from('form_types').select('id, name, code').order('name')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={<Breadcrumbs items={[{ label: 'Process Panel' }]} />}
      />
      <ProcessClient formTypes={formTypes ?? []} />
    </div>
  )
}
