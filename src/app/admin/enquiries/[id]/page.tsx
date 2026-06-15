import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import EnquiryDetailClient from './EnquiryDetailClient'

export default async function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: enquiry } = await supabase
    .from('enquiries')
    .select('*, business:businesses(id,name,domain), assigned:users(id,full_name,avatar_url)')
    .eq('id', id)
    .single()

  if (!enquiry) notFound()

  // Fetch enquiry notes
  const { data: notes } = await supabase
    .from('enquiry_notes')
    .select('*, user:users(id,full_name,avatar_url)')
    .eq('enquiry_id', id)
    .order('created_at', { ascending: false })

  // Fetch users for assignment dropdown
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .order('full_name')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={
          <Breadcrumbs
            items={[
              { label: 'Enquiries', href: '/admin/enquiries' },
              { label: enquiry.customer_name || enquiry.email || 'Enquiry Detail' },
            ]}
          />
        }
      />
      <EnquiryDetailClient enquiry={enquiry} initialNotes={notes ?? []} users={users ?? []} />
    </div>
  )
}
