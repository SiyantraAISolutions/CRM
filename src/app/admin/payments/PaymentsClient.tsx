'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import DataTable, { Column } from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import { RotateCcw, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Business { id: string; name: string }

export default function PaymentsClient({ businesses }: { businesses: Business[] }) {
  const supabase = createClient()
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')

  // Current user role
  const [currentRole, setCurrentRole] = useState('')
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from('users').select('role').eq('id', data.user.id).single()
          .then(({ data: profile }) => setCurrentRole(profile?.role ?? ''))
      }
    })
  }, [supabase])

  // Refund modal
  const [refundingPaymentId, setRefundingPaymentId] = useState<string | null>(null)
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundOriginalAmount, setRefundOriginalAmount] = useState(0)
  const [refundReason, setRefundReason] = useState('requested_by_customer')
  const [processingRefund, setProcessingRefund] = useState(false)

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

  async function processRefund() {
    if (!refundingPaymentId) return
    setProcessingRefund(true)

    try {
      const res = await fetch('/api/stripe/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_intent_id: refundingPaymentId,
          amount: refundAmount ? Number(refundAmount) : undefined,
          reason: refundReason,
          order_id: refundOrderId,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success('Refund processed successfully')
      setRefundingPaymentId(null)
      setRefundOrderId(null)
      setRefundAmount('')
      fetchData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Refund failed'
      toast.error(message)
    } finally {
      setProcessingRefund(false)
    }
  }

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
      key: 'stripe_payment_intent_id', label: 'Stripe',
      render: v => v ? (
        <a
          href={`https://dashboard.stripe.com/payments/${v}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-accent-blue hover:underline font-mono"
        >
          {String(v).slice(0, 12)}... <ExternalLink className="h-3 w-3" />
        </a>
      ) : <span className="text-xs text-ink-gray-4">—</span>
    },
    {
      key: 'processor', label: 'Processed By',
      render: (_, row) => (row.processor as { full_name: string } | null)?.full_name ?? '—'
    },
    {
      key: 'created_at', label: 'Date',
      render: v => <span className="text-xs">{formatDateTime(String(v))}</span>
    },
    // Refund action (director only, cleared stripe payments)
    ...(currentRole === 'director' ? [{
      key: 'actions' as string,
      label: '',
      width: '80px',
      render: (_: unknown, row: Record<string, unknown>) => {
        const status = row.status as string
        const piId = row.stripe_payment_intent_id as string | undefined
        const order = row.order as { id: string } | null

        if (status === 'cleared' && piId) {
          return (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setRefundingPaymentId(piId)
                setRefundOrderId(order?.id ?? null)
                setRefundOriginalAmount(Number(row.amount))
              }}
              className="text-xs text-red-600 hover:text-red-800 font-semibold inline-flex items-center gap-1"
              title="Issue refund"
            >
              <RotateCcw className="h-3 w-3" /> Refund
            </button>
          )
        }
        return null
      }
    }] : []),
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

      {/* Refund Modal Overlay */}
      {refundingPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-ink-gray-9">Issue Refund</h3>
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <strong>⚠️ Warning:</strong> This will process a real refund on your Stripe account.
            </div>
            <div>
              <label className="form-label">Refund Amount (leave blank for full refund of {formatCurrency(refundOriginalAmount)})</label>
              <div className="relative w-48">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-gray-4 text-sm">£</span>
                <input
                  type="number"
                  step="0.01"
                  className="form-input pl-7 w-full"
                  placeholder={String(refundOriginalAmount)}
                  value={refundAmount}
                  onChange={e => setRefundAmount(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="form-label">Reason</label>
              <select className="form-input w-full" value={refundReason} onChange={e => setRefundReason(e.target.value)}>
                <option value="requested_by_customer">Requested by Customer</option>
                <option value="duplicate">Duplicate</option>
                <option value="fraudulent">Fraudulent</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => { setRefundingPaymentId(null); setRefundAmount('') }} className="btn-outline">Cancel</button>
              <button onClick={processRefund} disabled={processingRefund} className="btn-danger gap-2">
                {processingRefund ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                {processingRefund ? 'Processing...' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
