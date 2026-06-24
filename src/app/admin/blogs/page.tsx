import { createClient } from '@/lib/supabase/server'
import BlogsClient from './BlogsClient'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function BlogsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Check role
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'admin' && userData?.role !== 'director') {
    redirect('/admin')
  }

  const { data: brands } = await supabase.from('brands').select('id, name, code').order('name')

  return (
    <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden bg-[#f8f7fc]">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Blog Management</h1>
              <p className="text-sm text-slate-500 font-medium mt-1">Manage articles and content for all integrated websites.</p>
            </div>
          </div>
          
          <BlogsClient brands={brands || []} />
        </div>
      </div>
    </div>
  )
}
