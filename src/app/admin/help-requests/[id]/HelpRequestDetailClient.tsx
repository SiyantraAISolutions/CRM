'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import { toast } from 'sonner'

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

export default function HelpRequestDetailClient({ request }: { request: HelpRequest }) {
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatus] = useState(request.status)
  const brand = request.brand
  const shortId = String(request.id).slice(-6).toUpperCase()

  const statusBadge = (s: string) => {
    const map: Record<string, 'orange' | 'blue' | 'green'> = { pending: 'orange', in_progress: 'blue', resolved: 'green' }
    return <Badge label={s.replace('_', ' ').toUpperCase()} variant={map[s] ?? 'gray'} />
  }

  async function updateStatus(newStatus: string) {
    await supabase.from('help_requests').update({ status: newStatus }).eq('id', request.id)
    setStatus(newStatus)
    toast.success('Status updated')
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

        {/* Actions */}
        <div className="panel">
          <div className="section-heading">Update Status</div>
          <div className="flex gap-2">
            {['pending', 'in_progress', 'resolved'].map(s => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                  status === s ? 'bg-navy text-white border-navy' : 'btn-outline'
                }`}
              >
                {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => router.push('/admin/help-requests')} className="btn-ghost">
          ← Back to Help Requests
        </button>
      </div>
    </div>
  )
}
