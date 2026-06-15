'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Article { id: string; title: string; body: string; brand_id?: string; sort_order: number }
interface Brand { id: string; code: string; name: string }

interface Props {
  articles: Article[]
  brands: Brand[]
  section: 'sales' | 'admin'
}

export default function KBClient({ articles, brands, section }: Props) {
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(articles[0]?.id ?? null)

  const filtered = useMemo(() => {
    return articles.filter(a => {
      const matchesBrand = brandFilter === 'all' || !a.brand_id || a.brand_id === brandFilter
      const matchesSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.body.toLowerCase().includes(search.toLowerCase())
      return matchesBrand && matchesSearch
    })
  }, [articles, brandFilter, search])

  const selected = articles.find(a => a.id === selectedId)

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left pane — topic list */}
      <div className="w-72 flex-shrink-0 border-r flex flex-col h-full">
        {/* Filters */}
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-gray-4" />
            <input
              className="form-input pl-8 py-1.5 text-sm w-full"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="form-input py-1 text-xs w-full" value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
            <option value="all">All Sites</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
          </select>
        </div>

        {/* Article list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map(article => (
            <button
              key={article.id}
              onClick={() => setSelectedId(article.id)}
              className={cn(
                'flex items-center justify-between w-full px-4 py-3 text-sm text-left border-b border-outline-gray-2 transition-colors',
                selectedId === article.id
                  ? 'bg-surface-blue text-ink-blue font-medium'
                  : 'hover:bg-surface-gray-1 text-ink-gray-7'
              )}
            >
              <span className="truncate">{article.title}</span>
              {selectedId === article.id && <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="p-4 text-sm text-ink-gray-4 text-center">No articles found</p>
          )}
        </div>
      </div>

      {/* Right pane — content */}
      <div className="flex-1 overflow-y-auto p-8">
        {selected ? (
          <div className="max-w-3xl">
            <h1 className="text-2xl font-bold text-ink-gray-9 mb-6">{selected.title}</h1>
            <div
              className="prose prose-sm max-w-none text-ink-gray-7 leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: selected.body.replace(/\n/g, '<br/>') }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-ink-gray-4">
            Select a topic from the list
          </div>
        )}
      </div>
    </div>
  )
}
