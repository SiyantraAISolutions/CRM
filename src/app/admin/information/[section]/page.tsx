import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import KBClient from './KBClient'

export default async function InformationPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  if (!['sales', 'admin'].includes(section)) notFound()

  const supabase = await createClient()
  const { data: articles } = await supabase
    .from('kb_articles')
    .select('id, title, body, brand_id, sort_order')
    .eq('section', section)
    .order('sort_order', { ascending: true })

  const { data: brands } = await supabase.from('brands').select('id, code, name').order('code')

  const title = section === 'sales' ? 'Sales Information' : 'Admin Information'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={<Breadcrumbs items={[{ label: title }]} />}
      />
      <KBClient
        articles={articles ?? []}
        brands={brands ?? []}
        section={section as 'sales' | 'admin'}
      />
    </div>
  )
}
