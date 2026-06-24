import LayoutHeader from '@/components/layout/LayoutHeader'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import TemplatesClient from './TemplatesClient'

export default function TemplatesPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={<Breadcrumbs items={[{ label: 'Email Templates' }]} />}
      />
      <TemplatesClient />
    </div>
  )
}
