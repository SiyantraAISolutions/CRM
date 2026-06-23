'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save, CreditCard, Link2, RotateCcw, Copy, Check, Loader2, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDateTime, timeAgo, cn } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import { toast } from 'sonner'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type Tab = 'information' | 'process' | 'related' | 'notes'

interface OrderItem { id: string; item_type: string; amount: number }
interface OrderNote { id: string; message: string; category?: string; created_at: string; user?: { full_name: string; avatar_url?: string } }

interface Props {
  order: Record<string, unknown>
  relatedOrders: Record<string, unknown>[]
  userRole?: string
}

const ITEM_TYPES = [
  'Deed Search [Application]', 'Deed Search [Extra]', 'Property Alert',
  'Application Pack', 'Conveyancing Pack', 'Document Fee',
  'Search & Processing Fee', 'HMLR Fee', 'Fast Track Fee',
  'Printed Copy Fee', 'SMS Updates Fee',
]

// ─── Stripe Elements Payment Form ────────────────────────────────────────
function StripePaymentForm({ orderId, amount, onSuccess, onCancel }: {
  orderId: string
  amount: number
  onSuccess: () => void
  onCancel: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setProcessing(true)
    setError(null)

    const { error: submitError } = await elements.submit()
    if (submitError) {
      setError(submitError.message ?? 'Validation error')
      setProcessing(false)
      return
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    })

    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed')
      setProcessing(false)
      return
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Record in DB
      const res = await fetch('/api/stripe/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_intent_id: paymentIntent.id,
          order_id: orderId,
        }),
      })

      if (res.ok) {
        toast.success(`Payment of ${formatCurrency(amount)} processed successfully!`)
        onSuccess()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to record payment')
      }
    }
    setProcessing(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="btn-outline" disabled={processing}>
          Cancel
        </button>
        <button type="submit" disabled={!stripe || processing} className="btn-success gap-2">
          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {processing ? 'Processing...' : `Pay ${formatCurrency(amount)}`}
        </button>
      </div>
    </form>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────
export default function OrderDetailClient({ order, relatedOrders, userRole }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<Tab>('information')
  const [items, setItems] = useState<OrderItem[]>((order.items as OrderItem[]) ?? [])
  const [newNote, setNewNote] = useState('')
  const [notes, setNotes] = useState<OrderNote[]>((order.notes as OrderNote[]) ?? [])
  const [saving, setSaving] = useState(false)

  // Stripe payment states
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('requested_by_customer')
  const [processingRefund, setProcessingRefund] = useState(false)

  // Fetch current user role
  const [currentRole, setCurrentRole] = useState(userRole || '')
  useEffect(() => {
    if (!userRole) {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          supabase.from('users').select('role').eq('id', data.user.id).single()
            .then(({ data: profile }) => setCurrentRole(profile?.role ?? ''))
        }
      })
    }
  }, [supabase, userRole])

  const shortId = String(order.id).slice(-6).toUpperCase()
  const brand = order.brand as { name: string; code: string } | null
  const formType = order.form_type as { name: string } | null
  const status = order.status as string | null
  const stripePaymentId = order.stripe_payment_intent_id as string | undefined

  const total = items.reduce((sum, item) => sum + Number(item.amount), 0)

  const canRefund = currentRole === 'director' && status === 'paid' && !!stripePaymentId

  function addItem() {
    setItems(prev => [...prev, { id: crypto.randomUUID(), item_type: ITEM_TYPES[0], amount: 0 }])
  }

  function updateItem(id: string, field: 'item_type' | 'amount', value: string | number) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(it => it.id !== id))
  }

  async function saveItems() {
    setSaving(true)
    await supabase.from('order_items').delete().eq('order_id', order.id)
    if (items.length > 0) {
      await supabase.from('order_items').insert(
        items.map(it => ({ order_id: order.id, item_type: it.item_type, amount: Number(it.amount) }))
      )
    }
    await supabase.from('orders').update({ amount_total: total }).eq('id', order.id)
    setSaving(false)
    toast.success('Line items saved')
  }

  async function setStatus(newStatus: string) {
    await supabase.from('orders').update({ status: newStatus }).eq('id', order.id)
    await addTimelineNote(`Status changed to ${newStatus}`, 'Status Change')
    toast.success(`Order marked as ${newStatus}`)
    router.refresh()
  }

  async function addTimelineNote(message: string, category?: string) {
    const { data: userData } = await supabase.auth.getUser()
    const { data: note } = await supabase
      .from('order_notes')
      .insert({ order_id: order.id, user_id: userData.user?.id, message, category })
      .select('*, user:users(id, full_name, avatar_url)')
      .single()
    if (note) setNotes(prev => [note as OrderNote, ...prev])
  }

  async function submitNote() {
    if (!newNote.trim()) return
    await addTimelineNote(newNote, 'Manual Note')
    setNewNote('')
  }

  // ─── Stripe: Send Payment Link ──────────────────────────
  async function sendPaymentLink() {
    setGeneratingLink(true)
    try {
      const res = await fetch('/api/stripe/payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          amount: total || order.amount_total,
          customer_email: order.email,
          description: `${formType?.name ?? 'Order'} — #${shortId}`,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      await navigator.clipboard.writeText(data.url)
      setCopiedLink(true)
      toast.success('Payment link copied to clipboard!')
      setTimeout(() => setCopiedLink(false), 3000)
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate payment link'
      toast.error(message)
    } finally {
      setGeneratingLink(false)
    }
  }

  // ─── Stripe: Take Payment on Call ───────────────────────
  async function startTakePayment() {
    try {
      const payAmount = total || Number(order.amount_total)
      const res = await fetch('/api/stripe/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          amount: payAmount,
          description: `${formType?.name ?? 'Order'} — #${shortId}`,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setPaymentClientSecret(data.client_secret)
      setShowPaymentForm(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initialize payment'
      toast.error(message)
    }
  }

  // ─── Stripe: Process Refund ─────────────────────────────
  async function processRefund() {
    if (!stripePaymentId) return
    setProcessingRefund(true)

    try {
      const res = await fetch('/api/stripe/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_intent_id: stripePaymentId,
          amount: refundAmount ? Number(refundAmount) : undefined,
          reason: refundReason,
          order_id: order.id,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success('Refund processed successfully')
      setShowRefundModal(false)
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Refund failed'
      toast.error(message)
    } finally {
      setProcessingRefund(false)
    }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'information', label: 'Information' },
    { id: 'process', label: 'Process' },
    { id: 'related', label: 'Related Orders', count: relatedOrders.length },
    { id: 'notes', label: 'Notes', count: notes.length },
  ]

  const infoFields = [
    { label: 'Order ID', value: `#${shortId}` },
    { label: 'Brand', value: `${brand?.code} — ${brand?.name}` },
    { label: 'Form Type', value: formType?.name },
    { label: 'Status', value: status },
    { label: 'Created', value: formatDateTime(order.created_at as string) },
    { label: 'Title', value: order.title as string },
    { label: 'First Name', value: order.first_name as string },
    { label: 'Middle Name', value: order.middle_name as string },
    { label: 'Surname', value: order.last_name as string },
    { label: 'Email', value: order.email as string },
    { label: 'Phone', value: order.phone as string },
    { label: 'Address Line 1', value: order.address_line1 as string },
    { label: 'Address Line 2', value: order.address_line2 as string },
    { label: 'City', value: order.city as string },
    { label: 'County', value: order.county as string },
    { label: 'Postcode', value: order.postcode as string },
    { label: 'Title Number', value: order.title_number as string },
    { label: 'Tenure', value: order.tenure as string },
    { label: 'Property Value', value: order.property_value ? formatCurrency(Number(order.property_value)) : '' },
    { label: 'HMLR Fee', value: order.hmlr_fee ? formatCurrency(Number(order.hmlr_fee)) : '' },
    { label: 'Tenancy Type', value: order.tenancy_type as string },
    { label: 'Mortgaged', value: order.is_mortgaged ? 'Yes' : 'No' },
    { label: 'Priority', value: order.priority as string },
    { label: 'Terms Accepted', value: order.terms_accepted ? 'Yes' : 'No' },
    ...(stripePaymentId ? [{ label: 'Stripe Payment ID', value: stripePaymentId }] : []),
  ].filter(f => f.value)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Order heading */}
      <div className="border-b px-5 py-3 bg-surface-gray-1">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold text-ink-gray-9">ORDER #{shortId}</h1>
          <span className="text-sm text-ink-gray-4">{formatDateTime(order.created_at as string)}</span>
          <div className="ml-2">{status ? <Badge
            label={status.replace('_', ' ')}
            variant={
              status === 'paid' ? 'green' :
              status === 'dead' ? 'red' :
              (status === 'lead' || status === 'no_answer') ? 'orange' :
              status === 'processing' ? 'blue' :
              'gray'
            }
          /> : null}</div>
        </div>
        <div className="text-sm text-ink-gray-5 mt-0.5">
          {brand?.name} · {formType?.name}
        </div>
      </div>

      {/* Tabs — Frappe style */}
      <div className="border-b px-5">
        <div className="flex gap-7 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-ink-gray-9 text-ink-gray-9'
                  : 'border-transparent text-ink-gray-5 hover:text-ink-gray-7'
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="rounded-full bg-surface-gray-2 px-1.5 py-0.5 text-xs text-ink-gray-5">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* INFORMATION TAB */}
        {activeTab === 'information' && (
          <div className="max-w-2xl">
            <table className="w-full text-sm">
              <tbody>
                {infoFields.map((f, i) => (
                  <tr key={f.label} className={cn(i % 2 === 0 ? 'bg-white' : 'bg-row-stripe/30')}>
                    <td className="py-2.5 px-3 font-medium text-ink-gray-5 w-48">{f.label}</td>
                    <td className="py-2.5 px-3 text-ink-gray-9">
                      {f.label === 'Stripe Payment ID' && f.value ? (
                        <a
                          href={`https://dashboard.stripe.com/payments/${f.value}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-accent-blue hover:underline inline-flex items-center gap-1"
                        >
                          {f.value} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : f.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PROCESS TAB */}
        {activeTab === 'process' && (
          <div className="max-w-2xl space-y-5">
            {/* Line items */}
            <div className="panel">
              <div className="section-heading">Line Items</div>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <select
                      className="form-input flex-1"
                      value={item.item_type}
                      onChange={e => updateItem(item.id, 'item_type', e.target.value)}
                    >
                      {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="relative w-32">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-gray-4 text-sm">£</span>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input pl-7 w-full"
                        value={item.amount}
                        onChange={e => updateItem(item.id, 'amount', e.target.value)}
                      />
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-danger-red hover:text-red-700 p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button onClick={addItem} className="btn-primary gap-1">
                  <Plus className="h-4 w-4" /> Add Item
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <span className="font-semibold text-ink-gray-7">Total</span>
                <span className="text-xl font-bold text-ink-gray-9">{formatCurrency(total)}</span>
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={saveItems} disabled={saving} className="btn-solid gap-1">
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Items'}
                </button>
              </div>
            </div>

            {/* Priority */}
            <div className="panel">
              <div className="section-heading">Priority</div>
              <select
                className="form-input w-48"
                defaultValue={order.priority as string}
                onChange={async e => {
                  await supabase.from('orders').update({ priority: e.target.value }).eq('id', order.id)
                  toast.success('Priority updated')
                }}
              >
                <option value="standard">Standard</option>
                <option value="fast_track">Fast Track</option>
              </select>
            </div>

            {/* ─── STRIPE PAYMENT ACTIONS ────────────────────────── */}
            {status !== 'paid' && status !== 'dead' && (
              <div className="panel">
                <div className="section-heading flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Actions
                </div>

                {/* Stripe Elements Payment Form */}
                {showPaymentForm && paymentClientSecret ? (
                  <div className="mt-3">
                    <div className="mb-3 rounded-lg bg-surface-blue border border-accent-blue/20 px-4 py-3 text-sm text-ink-blue">
                      <strong>Secure Card Payment</strong> — Enter the customer&apos;s card details below.
                      Card data is handled securely by Stripe and never touches our servers.
                    </div>
                    <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret: paymentClientSecret,
                        appearance: {
                          theme: 'stripe',
                          variables: {
                            colorPrimary: '#16243B',
                            borderRadius: '8px',
                          },
                        },
                      }}
                    >
                      <StripePaymentForm
                        orderId={order.id as string}
                        amount={total || Number(order.amount_total)}
                        onSuccess={() => {
                          setShowPaymentForm(false)
                          setPaymentClientSecret(null)
                          router.refresh()
                        }}
                        onCancel={() => {
                          setShowPaymentForm(false)
                          setPaymentClientSecret(null)
                        }}
                      />
                    </Elements>
                  </div>
                ) : (
                  <div className="space-y-2 mt-3">
                    {/* Send Payment Link */}
                    <button
                      onClick={sendPaymentLink}
                      disabled={generatingLink}
                      className="btn-primary w-full py-3 text-base font-semibold gap-2"
                    >
                      {generatingLink ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : copiedLink ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Link2 className="h-5 w-5" />
                      )}
                      {generatingLink ? 'Generating...' : copiedLink ? 'Link Copied!' : 'Send Payment Link'}
                    </button>

                    {/* Take Payment on Call */}
                    <button
                      onClick={startTakePayment}
                      className="btn-success w-full py-3 text-base font-semibold gap-2"
                    >
                      <CreditCard className="h-5 w-5" />
                      Take Payment on Call
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Stripe Payment Info (for paid orders) */}
            {status === 'paid' && stripePaymentId && (
              <div className="panel">
                <div className="section-heading flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Information
                </div>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-gray-5">Stripe Payment ID</span>
                    <a
                      href={`https://dashboard.stripe.com/payments/${stripePaymentId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-accent-blue hover:underline inline-flex items-center gap-1"
                    >
                      {stripePaymentId} <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-gray-5">Amount Paid</span>
                    <span className="font-semibold text-success-green">{formatCurrency(Number(order.amount_total))}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Refund Button (director only, paid orders with stripe ID) */}
            {canRefund && (
              <div className="panel border-red-200">
                <div className="section-heading flex items-center gap-2 text-danger-red">
                  <RotateCcw className="h-4 w-4" />
                  Refund
                </div>
                {showRefundModal ? (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      <strong>⚠️ Warning:</strong> This will process a real refund on your Stripe account.
                    </div>
                    <div>
                      <label className="form-label">Refund Amount (leave blank for full refund)</label>
                      <div className="relative w-48">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-gray-4 text-sm">£</span>
                        <input
                          type="number"
                          step="0.01"
                          className="form-input pl-7 w-full"
                          placeholder={String(order.amount_total)}
                          value={refundAmount}
                          onChange={e => setRefundAmount(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Reason</label>
                      <select
                        className="form-input w-64"
                        value={refundReason}
                        onChange={e => setRefundReason(e.target.value)}
                      >
                        <option value="requested_by_customer">Requested by Customer</option>
                        <option value="duplicate">Duplicate</option>
                        <option value="fraudulent">Fraudulent</option>
                      </select>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={processRefund}
                        disabled={processingRefund}
                        className="btn-danger gap-2"
                      >
                        {processingRefund ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        {processingRefund ? 'Processing...' : 'Confirm Refund'}
                      </button>
                      <button onClick={() => setShowRefundModal(false)} className="btn-outline">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowRefundModal(true)}
                    className="btn-danger w-full py-3 text-base font-semibold gap-2 mt-3"
                  >
                    <RotateCcw className="h-5 w-5" />
                    Issue Refund
                  </button>
                )}
              </div>
            )}

            {/* Status actions */}
            <div className="space-y-2">
              {status !== 'dead' && (
                <button onClick={() => setStatus('dead')} className="btn-danger w-full py-3 text-base font-semibold">
                  Dead
                </button>
              )}
              {status !== 'paid' && (
                <button onClick={() => setStatus('no_answer')} className="btn-warning w-full py-3 text-base font-semibold">
                  No Answer / Non-UK Phone Number
                </button>
              )}
            </div>
          </div>
        )}

        {/* RELATED ORDERS TAB */}
        {activeTab === 'related' && (
          <div className="max-w-2xl">
            {relatedOrders.length === 0 ? (
              <p className="text-sm text-ink-gray-4 py-4">No related orders found</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th><th>Form Type</th><th>Amount</th><th>Status</th><th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedOrders.map((r) => (
                    <tr key={r.id as string} className="cursor-pointer hover:bg-surface-gray-1"
                      onClick={() => router.push(`/admin/orders/${r.id}`)}>
                      <td className="font-mono text-xs">#{String(r.id).slice(-6).toUpperCase()}</td>
                      <td>{(r.form_type as { name: string } | null)?.name}</td>
                      <td>{formatCurrency(Number(r.amount_total))}</td>
                      <td><Badge label={String(r.status)} variant={r.status === 'paid' ? 'green' : 'gray'} /></td>
                      <td className="text-xs">{formatDateTime(r.created_at as string)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* NOTES / TIMELINE TAB */}
        {activeTab === 'notes' && (
          <div className="max-w-2xl space-y-4">
            {/* Add note */}
            <div className="panel">
              <textarea
                className="form-input w-full resize-none"
                rows={3}
                placeholder="Add a note..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
              />
              <div className="mt-2 flex justify-end">
                <button onClick={submitNote} className="btn-primary">Add Note</button>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-0">
              {notes.map((note, i) => (
                <div key={note.id} className="activity-item">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'mt-1 h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-medium',
                      'bg-surface-gray-2 text-ink-gray-5'
                    )}>
                      <Avatar label={note.user?.full_name ?? '?'} size="sm" image={note.user?.avatar_url} />
                    </div>
                    {i < notes.length - 1 && <div className="mt-1 w-px flex-1 bg-outline-gray-2" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-ink-gray-9">{note.user?.full_name ?? 'System'}</span>
                      {note.category && (
                        <span className="text-xs font-medium text-ink-gray-4">{note.category}</span>
                      )}
                      <span className="ml-auto text-xs text-ink-gray-4">{timeAgo(note.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink-gray-7">{note.message}</p>
                  </div>
                </div>
              ))}
              {notes.length === 0 && (
                <p className="text-sm text-ink-gray-4 py-4 text-center">No notes yet</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Copy link overlay */}
      {copiedLink && (
        <div className="fixed bottom-6 right-6 bg-navy text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium animate-in slide-in-from-bottom-4">
          <Copy className="h-4 w-4" />
          Payment link copied to clipboard
        </div>
      )}
    </div>
  )
}
