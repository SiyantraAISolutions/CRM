import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import TicketDetailClient from './TicketDetailClient'

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, brand:brands(id,code,name), user:users(id,full_name,avatar_url)')
    .eq('id', id)
    .single()

  if (!ticket) notFound()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={
          <Breadcrumbs
            items={[
              { label: 'Tickets', href: '/admin/tickets' },
              { label: `#${ticket.number} — ${ticket.name}` },
            ]}
          />
        }
      />
      <TicketDetailClient ticket={ticket} />
    </div>
  )
}
