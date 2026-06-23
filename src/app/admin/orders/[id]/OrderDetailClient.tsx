'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDateTime, timeAgo, cn } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import { toast } from 'sonner'

type Tab = 'information' | 'process' | 'related' | 'notes'

interface OrderItem { id: string; item_type: string; amount: number }
interface OrderNote { id: string; message: string; category?: string; created_at: string; user?: { full_name: string; avatar_url?: string } }

interface Props {
  order: Record<string, unknown>
  relatedOrders: Record<string, unknown>[]
}

const ITEM_TYPES = [
  'Deed Search [Application]', 'Deed Search [Extra]', 'Property Alert',
  'Application Pack', 'Conveyancing Pack', 'Document Fee',
  'Search & Processing Fee', 'HMLR Fee', 'Fast Track Fee',
  'Printed Copy Fee', 'SMS Updates Fee',
]

export default function OrderDetailClient({ order, relatedOrders }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<Tab>('information')
  const [items, setItems] = useState<OrderItem[]>((order.items as OrderItem[]) ?? [])
  const [newNote, setNewNote] = useState('')
  const [notes, setNotes] = useState<OrderNote[]>((order.notes as OrderNote[]) ?? [])
  const [saving, setSaving] = useState(false)

  const shortId = String(order.id).slice(-6).toUpperCase()
  const brand = order.brand as { name: string; code: string } | null
  const formType = order.form_type as { name: string } | null
  const status = order.status as string | null

  const total = items.reduce((sum, item) => sum + Number(item.amount), 0)

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
    // Delete existing items
    await supabase.from('order_items').delete().eq('order_id', order.id)
    // Insert new
    if (items.length > 0) {
      await supabase.from('order_items').insert(
        items.map(it => ({ order_id: order.id, item_type: it.item_type, amount: Number(it.amount) }))
      )
    }
    // Update order total
    await supabase.from('orders').update({ amount_total: total }).eq('id', order.id)
    setSaving(false)
    toast.success('Line items saved')
  }

  async function setStatus(status: string) {
    await supabase.from('orders').update({ status }).eq('id', order.id)
    // Log note
    await addTimelineNote(`Status changed to ${status}`, 'Status Change')
    toast.success(`Order marked as ${status}`)
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
                    <td className="py-2.5 px-3 text-ink-gray-9">{f.value}</td>
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

            {/* Status actions */}
            <div className="space-y-2">
              <button onClick={() => setStatus('dead')} className="btn-danger w-full py-3 text-base font-semibold">
                Dead
              </button>
              <button onClick={() => setStatus('paid')} className="btn-success w-full py-3 text-base font-semibold">
                Take Payment
              </button>
              <button onClick={() => setStatus('no_answer')} className="btn-warning w-full py-3 text-base font-semibold">
                No Answer / Non-UK Phone Number
              </button>
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
    </div>
  )
}
