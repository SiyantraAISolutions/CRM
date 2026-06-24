import { createClient } from '@/lib/supabase/server'
import BlogEditorClient from './BlogEditorClient'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function BlogEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const isNew = id === 'new'
  
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (userData?.role !== 'admin' && userData?.role !== 'director') redirect('/admin')

  const { data: brands } = await supabase.from('brands').select('id, name, code').order('name')

  let initialData = null
  if (!isNew) {
    const { data: blog } = await supabase.from('blogs').select('*').eq('id', id).single()
    if (!blog) redirect('/admin/blogs')
    initialData = blog
  }

  return (
    <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden bg-[#f8f7fc]">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
          <BlogEditorClient brands={brands || []} initialData={initialData} />
        </div>
      </div>
    </div>
  )
}
