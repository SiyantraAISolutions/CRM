'use client'

import { useState, useEffect, useCallback } from 'react'

import { useRouter } from 'next/navigation'
import DataTable, { Column } from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import { useBusiness } from '@/context/BusinessContext'

interface Brand { id: string; code: string; name: string }

export default function HelpRequestsClient({ brands }: { brands: Brand[] }) {
  const router = useRouter()
  const supabase = createClient()
  const { activeBusinessId } = useBusiness()
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('all')

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('help_requests')
      .select('*, brand:brands(id,code,name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * 10, page * 10 - 1)

    if (activeBusinessId !== 'all') q = q.eq('business_id', activeBusinessId)
    if (brandFilter !== 'all') q = q.eq('brand_id', brandFilter)
    if (search) q = q.or(`customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,subject.ilike.%${search}%`)

    const { data: d, count } = await q
    setData(d ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, search, activeBusinessId, brandFilter, supabase])

  useEffect(() => {
    setPage(1)
  }, [activeBusinessId])

  useEffect(() => { fetch() }, [fetch])


  const columns: Column<Record<string, unknown>>[] = [
    { key: 'id', label: 'Request ID', render: (v) => <span className="font-mono text-xs">#{String(v).slice(-6).toUpperCase()}</span> },
    { key: 'subject', label: 'Title', sortable: true },
    {
      key: 'customer_email',
      label: 'Email / Name',
      render: (_, row) => (
        <div>
          <div className="text-sm">{String(row.customer_name ?? '')}</div>
          <div className="text-xs text-ink-gray-4">{String(row.customer_email ?? '')}</div>
        </div>
      )
    },
    {
      key: 'status', label: 'Status', sortable: true,
      render: (v) => <Badge label={String(v)} variant={v === 'resolved' ? 'green' : v === 'in_progress' ? 'blue' : 'orange'} />
    },
    { key: 'created_at', label: 'Date', render: (v) => <span className="text-xs">{formatDateTime(String(v))}</span> },
    {
      key: 'brand', label: 'Site',
      render: (v) => <span className="text-xs">{(v as { name: string } | null)?.name}</span>
    },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b bg-surface-gray-1">
        <select className="form-input py-1 text-xs w-44" value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setPage(1) }}>
          <option value="all">All Sites</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
        </select>
      </div>
      <DataTable
        columns={columns}
        data={data}
        onRowClick={row => router.push(`/admin/help-requests/${row.id}`)}
        totalCount={total}
        page={page}
        pageSize={10}
        onPageChange={setPage}
        onSearch={s => { setSearch(s); setPage(1) }}
        loading={loading}
      />
    </div>
  )
}
