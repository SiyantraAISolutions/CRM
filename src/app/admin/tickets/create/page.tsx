import { createClient } from '@/lib/supabase/server'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import CreateTicketForm from './CreateTicketForm'

export default async function CreateTicketPage() {
  const supabase = await createClient()
  const { data: brands } = await supabase.from('brands').select('id, code, name').order('code')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={
          <Breadcrumbs
            items={[{ label: 'Tickets', href: '/admin/tickets' }, { label: 'Create Ticket' }]}
          />
        }
      />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold uppercase tracking-wide text-ink-gray-9 mb-6">Create Ticket</h1>
          <CreateTicketForm brands={brands ?? []} />
        </div>
      </div>
    </div>
  )
}
