import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import HelpRequestDetailClient from './HelpRequestDetailClient'

export default async function HelpRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: req } = await supabase
    .from('help_requests')
    .select('*, brand:brands(id,code,name)')
    .eq('id', id)
    .single()

  if (!req) notFound()

  const shortId = String(id).slice(-6).toUpperCase()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={
          <Breadcrumbs
            items={[
              { label: 'Help Requests', href: '/admin/help-requests' },
              { label: `Help Request #${shortId}` },
            ]}
          />
        }
      />
      <HelpRequestDetailClient request={req} />
    </div>
  )
}
