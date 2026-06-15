'use client'

import { useState, useEffect, useCallback } from 'react'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime, timeAgo, cn } from '@/lib/utils'
import { Search } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { useBusiness } from '@/context/BusinessContext'

interface Brand { id: string; code: string; name: string }
interface Ticket {
  id: string; number: number; department: string; priority: string
  name: string; body: string; status: string; created_at: string
  brand?: Brand; user?: { full_name: string }
}

const priorityColors = {
  high: 'bg-danger-red/10 border-danger-red/20',
  medium: 'bg-surface-orange border-warning-orange/20',
  low: 'bg-white',
}

const statusBadge = (status: string) => {
  const map: Record<string, 'red' | 'orange' | 'green' | 'gray'> = {
    pending: 'red', awaiting_internal: 'orange', resolved: 'green', closed: 'gray',
  }
  return <Badge label={status.replace('_', ' ').toUpperCase()} variant={map[status] ?? 'gray'} />
}

export default function TicketsClient({ brands }: { brands: Brand[] }) {
  const router = useRouter()
  const supabase = createClient()
  const { activeBusinessId } = useBusiness()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('pending_awaiting')
  const [loading, setLoading] = useState(true)

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('tickets')
      .select('*, brand:brands(id,code,name), user:users(id,full_name)')
      .order('created_at', { ascending: false })

    if (activeBusinessId !== 'all') query = query.eq('business_id', activeBusinessId)
    if (statusFilter === 'pending_awaiting') query = query.in('status', ['pending', 'awaiting_internal'])
    else if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    if (brandFilter !== 'all') query = query.eq('brand_id', brandFilter)
    if (priorityFilter !== 'all') query = query.eq('priority', priorityFilter)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data } = await query
    setTickets((data as unknown as Ticket[]) ?? [])
    setLoading(false)
  }, [search, activeBusinessId, brandFilter, priorityFilter, statusFilter, supabase])

  useEffect(() => { fetchTickets() }, [fetchTickets])


  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b bg-surface-gray-1 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-gray-4" />
          <input className="form-input pl-8 py-1 w-56 text-sm" placeholder="Search tickets..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input py-1 text-xs w-40" value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
          <option value="all">All Sites</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
        </select>
        <select className="form-input py-1 text-xs w-36" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="all">Select Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="form-input py-1 text-xs w-52" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="pending_awaiting">Pending & Awaiting Internal</option>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="awaiting_internal">Awaiting Internal</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Ticket cards */}
      <div className="flex-1 overflow-y-auto p-5 space-y-2">
        {loading ? (
          <div className="text-center py-10 text-sm text-ink-gray-4">Loading...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-10 text-sm text-ink-gray-4">No tickets found</div>
        ) : (
          tickets.map(ticket => (
            <div
              key={ticket.id}
              onClick={() => router.push(`/admin/tickets/${ticket.id}`)}
              className={cn(
                'flex items-start justify-between rounded-lg border p-4 cursor-pointer hover:shadow-sm transition-shadow',
                priorityColors[ticket.priority as keyof typeof priorityColors] ?? 'bg-white'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {statusBadge(ticket.status)}
                  <span className="text-sm font-semibold text-ink-gray-9 truncate">{ticket.name}</span>
                </div>
                <p className="text-sm text-ink-gray-5 truncate">{ticket.body}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-ink-gray-4">
                  <span>{timeAgo(ticket.created_at)}</span>
                  <span>·</span>
                  <span>{formatDateTime(ticket.created_at)}</span>
                </div>
              </div>
              <div className="ml-4 text-right flex-shrink-0">
                <div className="text-sm font-medium text-ink-gray-7">{ticket.department} — #{ticket.number}</div>
                <div className="text-xs text-ink-gray-4 mt-1">{ticket.brand?.code}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
