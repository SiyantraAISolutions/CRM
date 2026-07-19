'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

interface HelpRequest {
  id: string;
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
  subject: string;
  brand_id: string | null;
  brand: { name: string; code: string; domain?: string } | null;
  description: string;
  body: string;
  status: string;
  assigned_to: string | null;
  resolution_notes: string | null;
}

interface User {
  id: string;
  full_name: string;
}

export default function HelpRequestDetailClient({ request }: { request: HelpRequest }) {
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatus] = useState(request.status)
  const [assignedTo, setAssignedTo] = useState<string | null>(request.assigned_to)
  const [resolutionNotes, setResolutionNotes] = useState(request.resolution_notes || '')
  const [staff, setStaff] = useState<User[]>([])
  const [saving, setSaving] = useState(false)
  
  const brand = request.brand
  const shortId = String(request.id).slice(-6).toUpperCase()

  useEffect(() => {
    async function loadStaff() {
      const { data } = await supabase.from('users').select('id, full_name').in('role', ['sales', 'admin', 'director'])
      if (data) setStaff(data)
    }
    loadStaff()
  }, [])

  const statusBadge = (s: string) => {
    const map: Record<string, 'orange' | 'blue' | 'green'> = { pending: 'orange', in_progress: 'blue', resolved: 'green' }
    return <Badge label={s.replace('_', ' ').toUpperCase()} variant={map[s] ?? 'gray'} />
  }

  async function updateStatus(newStatus: string) {
    await supabase.from('help_requests').update({ status: newStatus }).eq('id', request.id)
    setStatus(newStatus)
    toast.success('Status updated')
  }

  async function saveDetails() {
    setSaving(true)
    const { error } = await supabase.from('help_requests').update({ 
      assigned_to: assignedTo,
      resolution_notes: resolutionNotes
    }).eq('id', request.id)
    
    setSaving(false)
    if (error) {
      toast.error('Failed to save details')
    } else {
      toast.success('Help request updated')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="panel">
          <div className="flex items-center gap-3 mb-3">
            {statusBadge(status)}
            <h1 className="text-xl font-bold text-ink-gray-9">
              HELP REQUEST #{shortId} — {brand?.domain ?? brand?.name}
            </h1>
          </div>
          <div className="text-sm text-ink-gray-5">
            Received {formatDateTime(request.created_at)}
          </div>
        </div>

        {/* Customer details */}
        <div className="panel">
          <div className="section-heading">Customer Details</div>
          <table className="w-full text-sm">
            <tbody>
              {([
                ['Name', request.customer_name],
                ['Email', request.customer_email],
                ['Subject', request.subject],
                ['Site', brand?.name],
              ] as [string, string | null][]).filter(([, v]) => v).map(([label, value]) => (
                <tr key={label} className="border-t border-outline-gray-2">
                  <td className="py-2 pr-4 font-medium text-ink-gray-5 w-24">{label}</td>
                  <td className="py-2 text-ink-gray-9">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Message */}
        {request.body && (
          <div className="panel">
            <div className="section-heading">Request Message</div>
            <p className="text-sm text-ink-gray-7 leading-relaxed whitespace-pre-wrap">{request.body}</p>
          </div>
        )}

        {/* Assignment & Notes */}
        <div className="panel space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="section-heading mb-0">Management</div>
            <button onClick={saveDetails} disabled={saving} className="btn-solid gap-1 text-xs py-1.5 px-3">
              <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-gray-5 mb-1.5">Assigned To</label>
              <select 
                className="form-input text-sm w-full md:w-1/2" 
                value={assignedTo || ''}
                onChange={e => setAssignedTo(e.target.value || null)}
              >
                <option value="">-- Unassigned --</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-ink-gray-5 mb-1.5">Resolution Notes (Internal)</label>
              <textarea 
                className="form-input text-sm w-full min-h-[100px] resize-y"
                placeholder="Add notes about how this was resolved..."
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="panel">
          <div className="section-heading">Update Status</div>
          <div className="flex gap-2">
            {['pending', 'in_progress', 'resolved'].map(s => {
              const isActive = status === s
              let activeStyle = ''
              if (s === 'pending') activeStyle = 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-sm'
              else if (s === 'in_progress') activeStyle = 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700 shadow-sm'
              else if (s === 'resolved') activeStyle = 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm'

              return (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  className={`px-4 py-2 rounded-md text-sm font-bold border transition-all duration-200 cursor-pointer ${
                    isActive 
                      ? activeStyle 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </button>
              )
            })}
          </div>
        </div>

        <button onClick={() => router.push('/admin/help-requests')} className="btn-ghost">
          ← Back to Help Requests
        </button>
      </div>
    </div>
  )
}
