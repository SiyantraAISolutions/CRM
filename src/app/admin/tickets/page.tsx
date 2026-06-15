import { createClient } from '@/lib/supabase/server'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import Link from 'next/link'
import TicketsClient from './TicketsClient'

export default async function TicketsPage() {
  const supabase = await createClient()
  const { data: brands } = await supabase.from('brands').select('id, code, name').order('code')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={<Breadcrumbs items={[{ label: 'Tickets' }]} />}
        right={
          <Link href="/admin/tickets/create" className="btn-primary gap-1">
            + Create Ticket
          </Link>
        }
      />
      <TicketsClient brands={brands ?? []} />
    </div>
  )
}
