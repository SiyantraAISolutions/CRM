'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import DataTable, { Column } from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import { Plus, Edit } from 'lucide-react'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'

interface Brand {
  id: string
  name: string
  code: string
}

interface Blog {
  id: string
  title: string
  slug: string
  is_published: boolean
  brand_id: string
  created_at: string
  updated_at: string
  brand?: { name: string }
}

export default function BlogsClient({ brands }: { brands: Brand[] }) {
  const supabase = createClient()
  const [blogs, setBlogs] = useState<Blog[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBlogs = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('blogs')
      .select('id, title, slug, is_published, created_at, updated_at, brand_id, brand:brands(name)')
      .order('created_at', { ascending: false })
    
    if (data) {
      setBlogs(data as any)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchBlogs()
  }, [fetchBlogs])

  const columns: Column<Blog>[] = [
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (v, row) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{row.title}</span>
          <span className="text-xs text-slate-500">/{row.slug}</span>
        </div>
      )
    },
    {
      key: 'brand_id',
      label: 'Website (Brand)',
      sortable: true,
      render: (v, row) => <span className={`text-xs font-semibold px-2 py-1 rounded-md ${row.brand_id ? 'bg-slate-100 text-slate-700' : 'bg-purple-100 text-purple-700'}`}>{row.brand?.name || 'All Websites'}</span>
    },
    {
      key: 'is_published',
      label: 'Status',
      sortable: true,
      render: (v) => v ? <Badge label="Published" variant="green" /> : <Badge label="Draft" variant="gray" />
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (v) => <span className="text-xs text-slate-500">{formatDateTime(String(v))}</span>
    },
    {
      key: 'id',
      label: 'Actions',
      render: (v) => (
        <Link 
          href={`/admin/blogs/${v}`}
          className="p-1.5 bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700 rounded-md transition-colors inline-flex"
        >
          <Edit className="w-4 h-4" />
        </Link>
      )
    }
  ]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden flex flex-col h-[700px]">
      <div className="p-4 border-b border-purple-100 flex justify-between items-center bg-slate-50/50">
        <h2 className="font-bold text-slate-800">All Blogs</h2>
        <Link 
          href="/admin/blogs/new"
          className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm shadow-purple-200 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Blog Post
        </Link>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <DataTable
          data={blogs as any}
          columns={columns as any}
          isLoading={loading}
        />
      </div>
    </div>
  )
}
