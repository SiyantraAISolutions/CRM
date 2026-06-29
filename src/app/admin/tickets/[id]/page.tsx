import { createClient as createAdminClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import TicketDetailClient from './TicketDetailClient'

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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
