'use client'

import { useState, useEffect, useCallback } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'
import DataTable, { Column } from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { useBusiness } from '@/context/BusinessContext'
import { Zap } from 'lucide-react'
import { Order } from '@/types'

interface Props {
  brands: { id: string; code: string; name: string }[]
  formTypes: { id: string; name: string; code: string }[]
}

const statusBadge = (status: string) => {
  const map: Record<string, { variant: 'green' | 'red' | 'orange' | 'blue' | 'gray'; label: string }> = {
    paid: { variant: 'green', label: 'Paid' },
    dead: { variant: 'red', label: 'Dead' },
    no_answer: { variant: 'orange', label: 'No Answer' },
    processing: { variant: 'blue', label: 'Processing' },
    lead: { variant: 'orange', label: 'Lead' },
    abandoned: { variant: 'gray', label: 'Abandoned' },
  }
  const s = map[status] ?? { variant: 'gray', label: status }
  return <Badge label={s.label} variant={s.variant} />
}

export default function OrdersClient({ brands, formTypes }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const { activeBusinessId } = useBusiness()

  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const searchParams = useSearchParams()
  const [brandFilter, setBrandFilter] = useState('all')
  const [formTypeFilter, setFormTypeFilter] = useState(searchParams.get('form_type_id') || 'all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        business_id: activeBusinessId,
        brand_id: brandFilter,
        form_type_id: formTypeFilter,
        date_from: dateFrom,
        date_to: dateTo,
        search,
        sort_key: sortKey,
        sort_dir: sortDir,
        page: String(page),
        page_size: String(pageSize),
      })
      
      const res = await fetch(`/api/orders/list?${params.toString()}`)
      const result = await res.json()
      if (result.error) {
        console.error('Error fetching orders:', result.error)
      } else {
        setOrders(result.data ?? [])
        setTotal(result.count ?? 0)
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, activeBusinessId, brandFilter, formTypeFilter, dateFrom, dateTo, sortKey, sortDir])

  useEffect(() => {
    setPage(1)
  }, [activeBusinessId])

  useEffect(() => {
    const ft = searchParams.get('form_type_id')
    if (ft) {
      setFormTypeFilter(ft)
      setPage(1)
    } else {
      setFormTypeFilter('all')
      setPage(1)
    }
  }, [searchParams])

  useEffect(() => { fetchOrders() }, [fetchOrders])


  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
      width: '100px',
      render: (_, row) => (
        <span className="font-mono text-xs text-ink-gray-5">#{String(row.id).slice(-6).toUpperCase()}</span>
      ),
    },
    {
      key: 'brand',
      label: 'Site',
      render: (_, row) => {
        const brand = row.brand as { name: string; code: string } | null
        const ft = row.form_type as { name: string } | null
        return (
          <div>
            <div className="font-medium text-ink-gray-9">{brand?.name ?? '—'}</div>
            <div className="text-xs text-ink-gray-4">{ft?.name}</div>
          </div>
        )
      },
    },
    {
      key: 'full_name',
      label: 'Name',
      sortable: true,
      render: (_, row) => `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || '—',
    },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'amount_total',
      label: 'Amount',
      sortable: true,
      render: (v) => <span className="font-medium">{formatCurrency(Number(v ?? 0))}</span>,
    },
    {
      key: 'created_at',
      label: 'Order Date',
      sortable: true,
      render: (v) => <span className="text-xs">{formatDateTime(String(v))}</span>,
    },
    {
      key: 'manual_payment',
      label: 'Manual Payment',
      render: (v) => v ? <Badge label="Manual" variant="orange" /> : null,
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (v) => v === 'fast_track' ? <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-rose-200 flex items-center gap-1 w-max"><Zap className="h-3 w-3" /> Fast Track</span> : null,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (v) => statusBadge(String(v)),
    },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filters */}
      <div className="flex items-center gap-3 px-5 py-3 border-b bg-surface-gray-1">
        <div className="flex items-center gap-2">
          <label className="text-xs text-ink-gray-5">From</label>
          <input type="date" className="form-input py-1 text-xs w-36"
            value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-ink-gray-5">To</label>
          <input type="date" className="form-input py-1 text-xs w-36"
            value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} />
        </div>
        <select className="form-input py-1 text-xs w-44"
          value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setPage(1) }}>
          <option value="all">All Sites</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
        </select>
        <select className="form-input py-1 text-xs w-48"
          value={formTypeFilter} onChange={e => { setFormTypeFilter(e.target.value); setPage(1) }}>
          <option value="all">All Forms</option>
          {formTypes.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={orders as unknown as Record<string, unknown>[]}
        onRowClick={(row) => router.push(`/admin/orders/${row.id}`)}
        totalCount={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onSearch={(s) => { setSearch(s); setPage(1) }}
        onSort={(k, d) => { setSortKey(k); setSortDir(d); setPage(1) }}
        loading={loading}
      />
    </div>
  )
}
