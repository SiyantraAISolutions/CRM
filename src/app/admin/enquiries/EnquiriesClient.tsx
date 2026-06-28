'use client'

import { useState, useEffect, useCallback } from 'react'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime, timeAgo, cn } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import { Plus, Search } from 'lucide-react'
import { useBusiness } from '@/context/BusinessContext'

type Stage = 'new' | 'contacted' | 'quoted' | 'won' | 'lost'

const STAGES: { id: Stage; label: string; color: string }[] = [
  { id: 'new',       label: 'New',       color: 'bg-blue-50 border-blue-200' },
  { id: 'contacted', label: 'Contacted', color: 'bg-yellow-50 border-yellow-200' },
  { id: 'quoted',    label: 'Quoted',    color: 'bg-purple-50 border-purple-200' },
  { id: 'won',       label: 'Won',       color: 'bg-green-50 border-green-200' },
  { id: 'lost',      label: 'Lost',      color: 'bg-red-50 border-red-200' },
]

const stageBadge = (s: string) => {
  const map: Record<string, 'blue' | 'orange' | 'gray' | 'green' | 'red'> = {
    new: 'blue', contacted: 'orange', quoted: 'gray', won: 'green', lost: 'red',
  }
  return <Badge label={s.toUpperCase()} variant={map[s] ?? 'gray'} />
}

interface Business { id: string; name: string; domain?: string }
interface User { id: string; full_name: string }

interface Enquiry {
  id: string;
  customer_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  assigned: { id: string; full_name: string; avatar_url?: string } | null;
  business: { id: string; name: string } | null;
  pipeline_stage: string;
  follow_up_at: string | null;
}

export default function EnquiriesClient({ businesses, users }: { businesses: Business[]; users: User[] }) {
  const router = useRouter()
  const supabase = createClient()
  const { activeBusinessId } = useBusiness()
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const fetchEnquiries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        business_id: activeBusinessId,
        search,
      })
      
      const res = await fetch(`/api/enquiries/list?${params.toString()}`)
      const result = await res.json()
      if (result.error) {
        console.error('Error fetching enquiries:', result.error)
      } else {
        setEnquiries(result.data ?? [])
      }
    } catch (err) {
      console.error('Failed to fetch enquiries:', err)
    } finally {
      setLoading(false)
    }
  }, [search, activeBusinessId])

  useEffect(() => { fetchEnquiries() }, [fetchEnquiries])

  async function moveStage(id: string, stage: Stage) {
    await supabase.from('enquiries').update({ pipeline_stage: stage }).eq('id', id)
    setEnquiries(prev => prev.map(e => e.id === id ? { ...e, pipeline_stage: stage } : e))
  }

  const byStage = (stage: Stage) => enquiries.filter(e => e.pipeline_stage === stage)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filters */}
      <div className="flex items-center gap-3 px-5 py-3 border-b bg-surface-gray-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-gray-4" />
          <input className="form-input pl-8 py-1 w-56 text-sm" placeholder="Search enquiries..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex rounded-md border overflow-hidden ml-auto">
          {(['kanban', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={cn('px-3 py-1.5 text-xs font-medium transition-colors',
                view === v ? 'bg-navy text-white' : 'bg-white text-ink-gray-5 hover:bg-surface-gray-1')}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary gap-1">
          <Plus className="h-4 w-4" /> New Enquiry
        </button>
      </div>


      {loading ? (
        <div className="flex items-center justify-center flex-1 text-sm text-ink-gray-4">Loading...</div>
      ) : view === 'kanban' ? (
        // KANBAN VIEW
        <div className="flex-1 overflow-x-auto p-5">
          <div className="flex gap-4 h-full min-w-max">
            {STAGES.map(stage => (
              <div key={stage.id} className="w-72 flex flex-col">
                <div className={cn('rounded-t-lg border-l border-r border-t px-3 py-2 flex items-center justify-between', stage.color)}>
                  <span className="text-sm font-semibold text-ink-gray-7">{stage.label}</span>
                  <span className="text-xs text-ink-gray-4">{byStage(stage.id).length}</span>
                </div>
                <div className={cn('flex-1 rounded-b-lg border p-2 space-y-2 overflow-y-auto', stage.color)}>
                  {byStage(stage.id).map(enq => (
                    <div key={enq.id}
                      onClick={() => router.push(`/admin/enquiries/${enq.id}`)}
                      className="rounded-lg border bg-white p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                      <div className="font-medium text-sm text-ink-gray-9 truncate">
                        {enq.customer_name || enq.email || 'Unknown'}
                      </div>
                      {enq.phone && <div className="text-xs text-ink-gray-4 mt-0.5">{enq.phone}</div>}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-ink-gray-4">{timeAgo(enq.created_at)}</span>
                        {enq.assigned && (
                          <Avatar label={enq.assigned.full_name} size="xs" />
                        )}
                      </div>
                      {/* Quick move buttons */}
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {STAGES.filter(s => s.id !== stage.id).map(s => (
                          <button key={s.id}
                            onClick={e => { e.stopPropagation(); moveStage(enq.id, s.id) }}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-outline-gray-3 hover:border-accent-blue hover:text-accent-blue transition-colors text-ink-gray-4">
                            → {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {byStage(stage.id).length === 0 && (
                    <p className="text-xs text-center text-ink-gray-4 py-4">No enquiries</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // LIST VIEW
        <div className="flex-1 overflow-y-auto p-5">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Customer</th><th>Business</th><th>Stage</th><th>Assigned</th><th>Follow Up</th><th>Created</th>
              </tr>
            </thead>
            <tbody>
              {enquiries.map(enq => (
                <tr key={enq.id} className="cursor-pointer"
                  onClick={() => router.push(`/admin/enquiries/${enq.id}`)}>
                  <td>
                    <div className="font-medium">{enq.customer_name || '—'}</div>
                    <div className="text-xs text-ink-gray-4">{enq.email}</div>
                  </td>
                  <td className="text-sm">{enq.business?.name}</td>
                  <td>{stageBadge(enq.pipeline_stage)}</td>
                  <td>
                    {enq.assigned && (
                      <div className="flex items-center gap-1.5">
                        <Avatar label={enq.assigned.full_name} size="xs" />
                        <span className="text-sm">{enq.assigned.full_name}</span>
                      </div>
                    )}
                  </td>
                  <td className="text-xs">
                    {enq.follow_up_at ? formatDateTime(enq.follow_up_at) : '—'}
                  </td>
                  <td className="text-xs">{timeAgo(enq.created_at)}</td>
                </tr>
              ))}
              {enquiries.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-ink-gray-4 text-sm">No enquiries found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateEnquiryModal
          businesses={businesses}
          users={users}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchEnquiries() }}
        />
      )}
    </div>
  )
}

function CreateEnquiryModal({ businesses, users, onClose, onCreated }: {
  businesses: Business[]; users: User[]
  onClose: () => void; onCreated: () => void
}) {
  const supabase = createClient()
  const { activeBusinessId } = useBusiness()
  const [form, setForm] = useState({
    customer_name: '',
    email: '',
    phone: '',
    business_id: activeBusinessId !== 'all' ? activeBusinessId : '',
    assigned_to: '',
    message: ''
  })
  const [submitting, setSubmitting] = useState(false)

  function setF(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('enquiries').insert({
      ...form,
      assigned_to: form.assigned_to || user?.id,
      pipeline_stage: 'new',
    })
    setSubmitting(false)
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-ink-gray-9">New Enquiry</h2>
          <button onClick={onClose} className="btn-ghost p-1 text-lg">×</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div><label className="form-label">Customer Name</label>
            <input className="form-input" value={form.customer_name} onChange={e => setF('customer_name', e.target.value)} /></div>
          <div><label className="form-label">Email</label>
            <input type="email" className="form-input" value={form.email} onChange={e => setF('email', e.target.value)} /></div>
          <div><label className="form-label">Phone</label>
            <input className="form-input" value={form.phone} onChange={e => setF('phone', e.target.value)} /></div>
          <div><label className="form-label">Business</label>
            <select className="form-input" value={form.business_id} onChange={e => setF('business_id', e.target.value)}>
              <option value="">Select Business</option>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
          <div><label className="form-label">Assign To</label>
            <select className="form-input" value={form.assigned_to} onChange={e => setF('assigned_to', e.target.value)}>
              <option value="">Assign to me</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select></div>
          <div><label className="form-label">Notes</label>
            <textarea className="form-input resize-none" rows={3} value={form.message} onChange={e => setF('message', e.target.value)} /></div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Creating...' : 'Create Enquiry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
