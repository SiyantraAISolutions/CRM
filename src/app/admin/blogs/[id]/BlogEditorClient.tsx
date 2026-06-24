'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Brand {
  id: string
  name: string
  code: string
}

interface Blog {
  id?: string
  title: string
  slug: string
  excerpt: string
  content: string
  author: string
  image_url: string
  date: string
  is_published: boolean
  brand_id: string
}

export default function BlogEditorClient({ brands, initialData }: { brands: Brand[], initialData?: Blog | null }) {
  const router = useRouter()
  const supabase = createClient()
  const isNew = !initialData

  const [formData, setFormData] = useState<Blog>(initialData || {
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    author: '',
    image_url: '',
    date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    is_published: false,
    brand_id: brands[0]?.id || ''
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      if (isNew) {
        const payload = { ...formData, brand_id: formData.brand_id || null }
        const { error } = await supabase.from('blogs').insert(payload)
        if (error) throw error
        toast.success('Blog created successfully!')
        router.push('/admin/blogs')
      } else {
        const payload = { ...formData, brand_id: formData.brand_id || null }
        const { error } = await supabase.from('blogs').update(payload).eq('id', formData.id)
        if (error) throw error
        toast.success('Blog updated successfully!')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save blog')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this blog post?')) return
    try {
      const { error } = await supabase.from('blogs').delete().eq('id', formData.id)
      if (error) throw error
      toast.success('Blog deleted')
      router.push('/admin/blogs')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden">
      <div className="p-6 border-b border-purple-100 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-4">
          <Link href="/admin/blogs" className="p-2 hover:bg-purple-100 rounded-lg text-slate-500 hover:text-purple-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">{isNew ? 'Create Blog Post' : 'Edit Blog Post'}</h2>
            <p className="text-xs font-semibold text-slate-500">HTML supported in content</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isNew && (
            <button onClick={handleDelete} className="text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={handleSubmit} 
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-all shadow-sm shadow-purple-200 flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Post'}
          </button>
        </div>
      </div>

      <div className="p-6">
        <form className="space-y-6 max-w-4xl" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Title</label>
              <input required type="text" name="title" value={formData.title} onChange={handleChange} className="w-full text-sm p-2.5 rounded-xl border border-slate-200 font-medium focus:border-purple-400 focus:ring-1 focus:ring-purple-100 outline-none" placeholder="E.g. Complete Guide to Title Deeds" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Slug (URL)</label>
              <input required type="text" name="slug" value={formData.slug} onChange={handleChange} className="w-full text-sm p-2.5 rounded-xl border border-slate-200 font-medium focus:border-purple-400 focus:ring-1 focus:ring-purple-100 outline-none" placeholder="complete-guide-to-title-deeds" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Website (Brand)</label>
              <select name="brand_id" value={formData.brand_id || ''} onChange={handleChange} className="w-full text-sm p-2.5 rounded-xl border border-slate-200 font-medium focus:border-purple-400 outline-none">
                <option value="">All Websites (Global)</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Author</label>
              <input type="text" name="author" value={formData.author} onChange={handleChange} className="w-full text-sm p-2.5 rounded-xl border border-slate-200 font-medium outline-none focus:border-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Date String</label>
              <input type="text" name="date" value={formData.date} onChange={handleChange} className="w-full text-sm p-2.5 rounded-xl border border-slate-200 font-medium outline-none focus:border-purple-400" placeholder="15th January 2025" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Image URL (Header Image)</label>
            <input type="text" name="image_url" value={formData.image_url} onChange={handleChange} className="w-full text-sm p-2.5 rounded-xl border border-slate-200 font-medium focus:border-purple-400 outline-none" placeholder="https://images.unsplash.com/photo-123" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Short Excerpt</label>
            <textarea name="excerpt" value={formData.excerpt} onChange={handleChange} rows={2} className="w-full text-sm p-2.5 rounded-xl border border-slate-200 font-medium focus:border-purple-400 outline-none" placeholder="A brief summary for the blog listing page..." />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Full Content (HTML)</label>
            <textarea required name="content" value={formData.content} onChange={handleChange} rows={15} className="w-full text-sm p-3 rounded-xl border border-slate-200 font-mono focus:border-purple-400 outline-none leading-relaxed" placeholder="<h2>Your heading</h2><p>Your paragraph...</p>" />
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <input type="checkbox" id="is_published" name="is_published" checked={formData.is_published} onChange={handleChange} className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500" />
            <label htmlFor="is_published" className="text-sm font-bold text-slate-800 cursor-pointer">Publish this post live to the website</label>
          </div>
        </form>
      </div>
    </div>
  )
}
