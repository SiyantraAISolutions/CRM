'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime, timeAgo } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import { toast } from 'sonner'

const STATUS_OPTIONS = ['pending', 'awaiting_internal', 'resolved', 'closed']
const statusBadge = (s: string) => {
  const map: Record<string, 'red' | 'orange' | 'green' | 'gray'> = {
    pending: 'red', awaiting_internal: 'orange', resolved: 'green', closed: 'gray'
  }
  return <Badge label={s.replace('_', ' ').toUpperCase()} variant={map[s] ?? 'gray'} />
}

const priorityBadge = (p: string) => {
  const map: Record<string, 'red' | 'orange' | 'gray'> = { high: 'red', medium: 'orange', low: 'gray' }
  return <Badge label={p.toUpperCase()} variant={map[p] ?? 'gray'} />
}

export default function TicketDetailClient({ ticket }: { ticket: Record<string, unknown> }) {
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatus] = useState(ticket.status as string)
  const [saving, setSaving] = useState(false)

  const brand = ticket.brand as { name: string; code: string } | null
  const user = ticket.user as { full_name: string; avatar_url?: string } | null

  async function updateStatus(newStatus: string) {
    setSaving(true)
    await supabase.from('tickets').update({ status: newStatus }).eq('id', ticket.id)
    setStatus(newStatus)
    setSaving(false)
    toast.success(`Ticket marked as ${newStatus.replace('_', ' ')}`)
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header card */}
        <div className="panel">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {statusBadge(status)}
                {priorityBadge(ticket.priority as string)}
                <span className="text-xs text-ink-gray-4">#{ticket.number as number}</span>
              </div>
              <h1 className="text-xl font-bold text-ink-gray-9">{ticket.name as string}</h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-ink-gray-5">
                <span>{brand?.code} — {brand?.name}</span>
                <span>·</span>
                <span>{ticket.department as string}</span>
                <span>·</span>
                <span>{formatDateTime(ticket.created_at as string)}</span>
              </div>
            </div>
            {user && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Avatar label={user.full_name} image={user.avatar_url} size="sm" />
                <span className="text-sm text-ink-gray-5">{user.full_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Ticket body */}
        <div className="panel">
          <div className="section-heading">Ticket Details</div>
          <p className="text-sm text-ink-gray-7 leading-relaxed whitespace-pre-wrap">{ticket.body as string}</p>
        </div>

        {/* Update status */}
        <div className="panel">
          <div className="section-heading">Update Status</div>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s}
                disabled={saving || status === s}
                onClick={() => updateStatus(s)}
                className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                  status === s
                    ? 'bg-navy text-white border-navy'
                    : 'bg-white text-ink-gray-7 border-outline-gray-3 hover:border-navy hover:text-navy'
                }`}
              >
                {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => router.push('/admin/tickets')} className="btn-ghost">
          ← Back to Tickets
        </button>
      </div>
    </div>
  )
}
