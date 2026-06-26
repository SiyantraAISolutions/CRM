'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDateTime, timeAgo, cn } from '@/lib/utils'
import DataTable, { Column } from '@/components/ui/DataTable'
import Badge from '@/components/ui/Badge'
import { RotateCcw, Plus, CheckCircle2, XCircle, Clock, ShieldCheck, Loader2, Search, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

type RefundStatus = 'requested' | 'under_review' | 'approved' | 'rejected' | 'paid'

const STATUS_CONFIG: Record<RefundStatus, { label: string; variant: 'orange' | 'blue' | 'green' | 'red' | 'gray'; icon: React.ReactNode }> = {
  requested: { label: 'Requested', variant: 'orange', icon: <Clock className="h-3 w-3" /> },
  under_review: { label: 'Under Review', variant: 'blue', icon: <Search className="h-3 w-3" /> },
  approved: { label: 'Approved', variant: 'green', icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: 'Rejected', variant: 'red', icon: <XCircle className="h-3 w-3" /> },
  paid: { label: 'Paid', variant: 'green', icon: <CheckCircle2 className="h-3 w-3" /> },
}

const NEXT_STATUS: Record<string, RefundStatus | null> = {
  requested: 'under_review',
  under_review: 'approved',
  approved: 'paid',
  rejected: null,
  paid: null,
}

interface Props {
  refunds: Record<string, any>[]
}

export default function RefundsClient({ refunds: initialRefunds }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [refunds, setRefunds] = useState(initialRefunds)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showNewRefundModal, setShowNewRefundModal] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [currentRole, setCurrentRole] = useState('')

  // New refund form
  const [searchOrderId, setSearchOrderId] = useState('')
  const [foundOrder, setFoundOrder] = useState<Record<string, any> | null>(null)
  const [searchingOrder, setSearchingOrder] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Fetch current user role
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from('users').select('role').eq('id', data.user.id).single()
          .then(({ data: profile }) => setCurrentRole(profile?.role ?? ''))
      }
    })
  }, [supabase])

  const filtered = statusFilter === 'all'
    ? refunds
    : refunds.filter(r => r.status === statusFilter)

  // Stats
  const stats = {
    requested: refunds.filter(r => r.status === 'requested').length,
    under_review: refunds.filter(r => r.status === 'under_review').length,
    approved: refunds.filter(r => r.status === 'approved').length,
    rejected: refunds.filter(r => r.status === 'rejected').length,
    paid: refunds.filter(r => r.status === 'paid').length,
    total_amount: refunds.reduce((sum, r) => sum + Number(r.refund_amount || 0), 0),
    paid_amount: refunds.filter(r => r.status === 'paid').reduce((sum, r) => sum + Number(r.refund_amount || 0), 0),
  }

  // Search for an order
  async function searchOrder() {
    if (!searchOrderId.trim()) return
    setSearchingOrder(true)
    setFoundOrder(null)

    const searchTerm = searchOrderId.trim()

    // Try to find by partial ID match or by email
    let query = supabase
      .from('orders')
      .select('id, first_name, last_name, email, amount_total, status, form_type:form_types(name)')

    // If it looks like an email, search by email
    if (searchTerm.includes('@')) {
      query = query.eq('email', searchTerm)
    } else {
      // Search by ID suffix (the short ID shown in the UI)
      query = query.ilike('id', `%${searchTerm.toLowerCase()}%`)
    }

    const { data } = await query.limit(1).single()

    if (data) {
      setFoundOrder(data)
      setRefundAmount(String(data.amount_total || ''))
    } else {
      toast.error('Order not found. Try a full Order ID or customer email.')
    }
    setSearchingOrder(false)
  }

  // Submit a new refund
  async function submitNewRefund() {
    if (!foundOrder) return
    if (!refundAmount || Number(refundAmount) <= 0) {
      toast.error('Please enter a valid refund amount')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: foundOrder.id,
          reason: refundReason,
          refund_amount: Number(refundAmount),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success('Refund registered successfully')
      setShowNewRefundModal(false)
      resetForm()
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to register refund'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  // Update refund status
  async function updateRefundStatus(refundId: string, newStatus: RefundStatus) {
    setUpdatingId(refundId)
    try {
      const res = await fetch('/api/refunds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refund_id: refundId, status: newStatus }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setRefunds(prev => prev.map(r =>
        r.id === refundId ? { ...r, status: newStatus, updated_at: new Date().toISOString() } : r
      ))
      toast.success(`Refund status updated to ${STATUS_CONFIG[newStatus].label}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update status'
      toast.error(message)
    } finally {
      setUpdatingId(null)
    }
  }

  // Toggle manager approval
  async function toggleManagerApproval(refundId: string, currentApproval: boolean) {
    setUpdatingId(refundId)
    try {
      const res = await fetch('/api/refunds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refund_id: refundId, manager_approval: !currentApproval }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setRefunds(prev => prev.map(r =>
        r.id === refundId ? { ...r, manager_approval: !currentApproval, updated_at: new Date().toISOString() } : r
      ))
      toast.success(!currentApproval ? 'Manager approval granted' : 'Manager approval revoked')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update approval'
      toast.error(message)
    } finally {
      setUpdatingId(null)
    }
  }

  function resetForm() {
    setSearchOrderId('')
    setFoundOrder(null)
    setRefundReason('')
    setRefundAmount('')
  }

  const isDirector = currentRole === 'director'
  const isAdminOrDirector = currentRole === 'admin' || currentRole === 'director'

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'id', label: 'Refund ID',
      render: v => <span className="font-mono text-xs">#{String(v).slice(-6).toUpperCase()}</span>
    },
    {
      key: 'order', label: 'Customer / Order',
      render: (_, row) => {
        const o = row.order as { id: string; first_name?: string; last_name?: string; email?: string; form_type?: { name: string } } | null
        return (
          <div>
            <div className="text-sm font-medium">{[o?.first_name, o?.last_name].filter(Boolean).join(' ') || '—'}</div>
            <div className="text-xs text-ink-gray-4">{o?.email} · {o?.form_type?.name}</div>
            <div className="text-[10px] font-mono text-ink-gray-4">#{String(o?.id || '').slice(-6).toUpperCase()}</div>
          </div>
        )
      }
    },
    {
      key: 'refund_amount', label: 'Amount',
      render: v => <span className="font-semibold text-danger-red">{formatCurrency(Number(v))}</span>
    },
    {
      key: 'reason', label: 'Reason',
      render: v => <span className="text-sm text-ink-gray-7 max-w-[200px] truncate block">{String(v || '—')}</span>
    },
    {
      key: 'status', label: 'Status',
      render: v => {
        const cfg = STATUS_CONFIG[v as RefundStatus] || { label: String(v), variant: 'gray' as const }
        return <Badge label={cfg.label.toUpperCase()} variant={cfg.variant} />
      }
    },
    {
      key: 'manager_approval', label: 'Director Approval',
      render: (v, row) => {
        const approved = !!v
        const approver = row.approved_by_user as { full_name: string } | null
        return (
          <div className="flex items-center gap-2">
            <span className={cn(
              'inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full',
              approved
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            )}>
              {approved ? <ShieldCheck className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {approved ? 'Approved' : 'Pending'}
            </span>
            {approved && approver && (
              <span className="text-[10px] text-ink-gray-4">by {approver.full_name}</span>
            )}
          </div>
        )
      }
    },
    {
      key: 'created_by_user', label: 'Registered By',
      render: (v) => {
        const u = v as { full_name: string } | null
        return <span className="text-sm">{u?.full_name || '—'}</span>
      }
    },
    {
      key: 'created_at', label: 'Date',
      render: v => (
        <div>
          <div className="text-xs">{formatDateTime(String(v))}</div>
          <div className="text-[10px] text-ink-gray-4">{timeAgo(String(v))}</div>
        </div>
      )
    },
    {
      key: 'actions', label: '',
      width: '180px',
      render: (_, row) => {
        const status = row.status as RefundStatus
        const nextStatus = NEXT_STATUS[status]
        const isUpdating = updatingId === row.id

        return (
          <div className="flex items-center gap-1.5">
            {/* Advance status (admin + director only) */}
            {isAdminOrDirector && nextStatus && (
              <button
                onClick={(e) => { e.stopPropagation(); updateRefundStatus(row.id as string, nextStatus) }}
                disabled={isUpdating}
                className="text-[11px] font-bold px-2.5 py-1.5 border rounded-md bg-white hover:bg-purple-50 text-purple-700 border-purple-200 transition-colors inline-flex items-center gap-1"
              >
                {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                {STATUS_CONFIG[nextStatus].label}
              </button>
            )}

            {/* Reject (admin + director only, not already rejected/paid) */}
            {isAdminOrDirector && status !== 'rejected' && status !== 'paid' && (
              <button
                onClick={(e) => { e.stopPropagation(); updateRefundStatus(row.id as string, 'rejected') }}
                disabled={isUpdating}
                className="text-[11px] font-bold px-2.5 py-1.5 border border-red-200 rounded-md bg-red-50 hover:bg-red-100 text-red-700 transition-colors"
              >
                Reject
              </button>
            )}

            {/* Director approval toggle (director only) */}
            {isDirector && status !== 'paid' && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleManagerApproval(row.id as string, !!row.manager_approval) }}
                disabled={isUpdating}
                className={cn(
                  "text-[11px] font-bold px-2.5 py-1.5 border rounded-md transition-colors inline-flex items-center gap-1",
                  row.manager_approval
                    ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                )}
              >
                <ShieldCheck className="h-3 w-3" />
                {row.manager_approval ? 'Revoke' : 'Approve'}
              </button>
            )}
          </div>
        )
      }
    },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 px-5 py-4 border-b bg-surface-gray-1">
        <div className="panel py-3">
          <div className="text-xs text-ink-gray-4 mb-1">Requested</div>
          <div className="text-xl font-bold text-amber-600">{stats.requested}</div>
        </div>
        <div className="panel py-3">
          <div className="text-xs text-ink-gray-4 mb-1">Under Review</div>
          <div className="text-xl font-bold text-blue-600">{stats.under_review}</div>
        </div>
        <div className="panel py-3">
          <div className="text-xs text-ink-gray-4 mb-1">Approved</div>
          <div className="text-xl font-bold text-emerald-600">{stats.approved}</div>
        </div>
        <div className="panel py-3">
          <div className="text-xs text-ink-gray-4 mb-1">Rejected</div>
          <div className="text-xl font-bold text-red-600">{stats.rejected}</div>
        </div>
        <div className="panel py-3">
          <div className="text-xs text-ink-gray-4 mb-1">Paid</div>
          <div className="text-xl font-bold text-emerald-700">{stats.paid}</div>
        </div>
        <div className="panel py-3">
          <div className="text-xs text-ink-gray-4 mb-1">Total Value</div>
          <div className="text-xl font-bold text-ink-gray-9">{formatCurrency(stats.total_amount)}</div>
        </div>
        <div className="panel py-3">
          <div className="text-xs text-ink-gray-4 mb-1">Paid Out</div>
          <div className="text-xl font-bold text-danger-red">{formatCurrency(stats.paid_amount)}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b">
        <div className="flex items-center gap-3">
          <select
            className="form-input py-1 text-xs w-44"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses ({refunds.length})</option>
            <option value="requested">Requested ({stats.requested})</option>
            <option value="under_review">Under Review ({stats.under_review})</option>
            <option value="approved">Approved ({stats.approved})</option>
            <option value="rejected">Rejected ({stats.rejected})</option>
            <option value="paid">Paid ({stats.paid})</option>
          </select>
        </div>
        <button
          onClick={() => { setShowNewRefundModal(true); resetForm() }}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" /> Register Refund
        </button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered as Record<string, unknown>[]}
        emptyMessage="No refunds found"
        onRowClick={(row) => router.push(`/admin/orders/${row.order_id}`)}
      />

      {/* New Refund Modal */}
      {showNewRefundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <RotateCcw className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink-gray-9">Register Refund</h3>
                <p className="text-xs text-ink-gray-4">Record a refund against an order</p>
              </div>
            </div>

            {/* Order search */}
            <div>
              <label className="form-label">Find Order</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="form-input flex-1 text-sm"
                  placeholder="Enter Order ID or customer email..."
                  value={searchOrderId}
                  onChange={e => setSearchOrderId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchOrder()}
                />
                <button
                  onClick={searchOrder}
                  disabled={searchingOrder}
                  className="btn-solid gap-1 text-xs"
                >
                  {searchingOrder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Search
                </button>
              </div>
            </div>

            {/* Found order preview */}
            {foundOrder && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-800">Order Found</span>
                  <span className="font-mono text-xs text-purple-600">#{String(foundOrder.id).slice(-6).toUpperCase()}</span>
                </div>
                <div className="text-sm text-slate-800">
                  {[foundOrder.first_name, foundOrder.last_name].filter(Boolean).join(' ')} · {foundOrder.email}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-600">
                  <span>{(foundOrder.form_type as any)?.name}</span>
                  <span>·</span>
                  <span className="font-semibold">{formatCurrency(Number(foundOrder.amount_total))}</span>
                  <span>·</span>
                  <Badge label={String(foundOrder.status).toUpperCase()} variant={foundOrder.status === 'paid' ? 'green' : 'gray'} />
                </div>
              </div>
            )}

            {/* Refund details */}
            {foundOrder && (
              <>
                <div>
                  <label className="form-label">Refund Amount</label>
                  <div className="relative w-48">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-gray-4 text-sm">£</span>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input pl-7 w-full"
                      placeholder={String(foundOrder.amount_total)}
                      value={refundAmount}
                      onChange={e => setRefundAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Reason</label>
                  <textarea
                    className="form-input w-full resize-none text-sm"
                    rows={3}
                    placeholder="Describe the reason for this refund..."
                    value={refundReason}
                    onChange={e => setRefundReason(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2 border-t">
              <button
                onClick={() => { setShowNewRefundModal(false); resetForm() }}
                className="btn-outline"
              >
                Cancel
              </button>
              {foundOrder && (
                <button
                  onClick={submitNewRefund}
                  disabled={submitting || !refundAmount}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors inline-flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  {submitting ? 'Registering...' : 'Register Refund'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
