'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import DataTable, { Column } from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'

interface Business { id: string; name: string }

export default function PaymentsClient({ businesses }: { businesses: Business[] }) {
  const supabase = createClient()
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')

  // Summary stats
  const [stats, setStats] = useState({ total_cleared: 0, pending: 0, refunded: 0 })

  const fetchData = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('payments')
      .select(`
        *, 
        order:orders(id, email, first_name, last_name, business_id),
        processor:users!payments_processed_by_fkey(id, full_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * 20, page * 20 - 1)

    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    if (methodFilter !== 'all') q = q.eq('method', methodFilter)

    const { data: d, count } = await q
    setData(d ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, statusFilter, methodFilter, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  // Fetch stats
  useEffect(() => {
    async function fetchStats() {
      const [cleared, pending, refunded] = await Promise.all([
        supabase.from('payments').select('amount').eq('status', 'cleared'),
        supabase.from('payments').select('amount').eq('status', 'pending'),
        supabase.from('payments').select('amount').eq('status', 'refunded'),
      ])
      const sum = (rows: { amount: number }[]) => rows.reduce((a, b) => a + Number(b.amount), 0)
      setStats({
        total_cleared: sum((cleared.data ?? []) as { amount: number }[]),
        pending: sum((pending.data ?? []) as { amount: number }[]),
        refunded: sum((refunded.data ?? []) as { amount: number }[]),
      })
    }
    fetchStats()
  }, [supabase])

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'id', label: 'Payment ID',
      render: v => <span className="font-mono text-xs">#{String(v).slice(-6).toUpperCase()}</span>
    },
    {
      key: 'order', label: 'Customer',
      render: (_, row) => {
        const o = row.order as { email: string; first_name?: string; last_name?: string } | null
        return (
          <div>
            <div className="text-sm">{[o?.first_name, o?.last_name].filter(Boolean).join(' ') || '—'}</div>
            <div className="text-xs text-ink-gray-4">{o?.email}</div>
          </div>
        )
      }
    },
    {
      key: 'amount', label: 'Amount',
      render: v => <span className="font-semibold">{formatCurrency(Number(v))}</span>
    },
    {
      key: 'method', label: 'Method',
      render: v => <Badge label={String(v).toUpperCase()} variant="gray" />
    },
    {
      key: 'status', label: 'Status',
      render: v => {
        const map: Record<string, 'green' | 'orange' | 'red'> = { cleared: 'green', pending: 'orange', refunded: 'red' }
        return <Badge label={String(v).toUpperCase()} variant={map[String(v)] ?? 'gray'} />
      }
    },
    {
      key: 'processor', label: 'Processed By',
      render: (_, row) => (row.processor as { full_name: string } | null)?.full_name ?? '—'
    },
    {
      key: 'created_at', label: 'Date',
      render: v => <span className="text-xs">{formatDateTime(String(v))}</span>
    },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 px-5 py-4 border-b bg-surface-gray-1">
        <div className="panel py-3">
          <div className="text-xs text-ink-gray-4 mb-1">Total Cleared</div>
          <div className="text-xl font-bold text-success-green">{formatCurrency(stats.total_cleared)}</div>
        </div>
        <div className="panel py-3">
          <div className="text-xs text-ink-gray-4 mb-1">Pending</div>
          <div className="text-xl font-bold text-warning-orange">{formatCurrency(stats.pending)}</div>
        </div>
        <div className="panel py-3">
          <div className="text-xs text-ink-gray-4 mb-1">Refunded</div>
          <div className="text-xl font-bold text-danger-red">{formatCurrency(stats.refunded)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-5 py-3 border-b">
        <select className="form-input py-1 text-xs w-36" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="all">All Statuses</option>
          <option value="cleared">Cleared</option>
          <option value="pending">Pending</option>
          <option value="refunded">Refunded</option>
        </select>
        <select className="form-input py-1 text-xs w-36" value={methodFilter} onChange={e => { setMethodFilter(e.target.value); setPage(1) }}>
          <option value="all">All Methods</option>
          <option value="stripe">Stripe</option>
          <option value="manual">Manual</option>
          <option value="bank_transfer">Bank Transfer</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={data}
        totalCount={total}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        loading={loading}
      />
    </div>
  )
}
