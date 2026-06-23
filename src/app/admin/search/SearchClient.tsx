'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, cn } from '@/lib/utils'
import { ShoppingCart, Ticket, MessageSquare, CheckSquare, Search, ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Order {
  id: string
  first_name: string
  last_name: string
  email: string
  status: string
  amount_total: number
  created_at: string
}

interface TicketType {
  id: string
  number: number
  name: string
  status: string
  created_at: string
}

interface Enquiry {
  id: string
  customer_name: string
  customer_email: string
  subject: string
  pipeline_stage: string
  created_at: string
}

interface Task {
  id: string
  title: string
  status: string
  created_at: string
}

export default function SearchClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const query = searchParams.get('q') || ''
  
  const [orders, setOrders] = useState<Order[]>([])
  const [tickets, setTickets] = useState<TicketType[]>([])
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function performSearch() {
      if (!query.trim()) return
      setLoading(true)

      const term = `%${query}%`

      // 1. Search Orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, first_name, last_name, email, status, amount_total, created_at')
        .or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},phone.ilike.${term},title_number.ilike.${term},postcode.ilike.${term}`)
        .limit(10)

      // 2. Search Tickets
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select('id, number, name, status, created_at')
        .or(`name.ilike.${term},body.ilike.${term}`)
        .limit(10)

      // 3. Search Enquiries
      const { data: enquiriesData } = await supabase
        .from('help_requests')
        .select('id, customer_name, customer_email, subject, status, created_at')
        .or(`customer_name.ilike.${term},customer_email.ilike.${term},subject.ilike.${term},body.ilike.${term}`)
        .limit(10)

      // 4. Search Tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, title, status, created_at')
        .or(`title.ilike.${term},description.ilike.${term}`)
        .limit(10)

      setOrders(ordersData ?? [])
      setTickets(ticketsData ?? [])
      // Map help_requests data structure to our Enquiry interface
      setEnquiries((enquiriesData ?? []).map((e: any) => ({
        id: e.id,
        customer_name: e.customer_name || 'N/A',
        customer_email: e.customer_email || 'N/A',
        subject: e.subject || 'N/A',
        pipeline_stage: e.status || 'N/A',
        created_at: e.created_at
      })))
      setTasks(tasksData ?? [])
      setLoading(false)
    }

    performSearch()
  }, [query, supabase])

  const totalResults = orders.length + tickets.length + enquiries.length + tasks.length

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#f8f7fc]">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 shadow-sm">
          <Search className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Global Search Results</h2>
          <p className="text-xs text-slate-500 font-medium">Showing matches for &ldquo;<span className="font-bold text-purple-700">{query}</span>&rdquo;</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
          <span className="text-xs font-semibold text-slate-500">Searching records...</span>
        </div>
      ) : !query.trim() ? (
        <div className="text-center py-20 text-xs text-slate-500 font-medium">Enter a search query in the top bar to look up records.</div>
      ) : totalResults === 0 ? (
        <div className="text-center py-20 bg-white border border-purple-100 rounded-2xl shadow-sm">
          <Search className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-900">No matching records found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">We couldn&apos;t find any orders, tickets, enquiries, or tasks matching your search query.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Orders Section */}
          {orders.length > 0 && (
            <div className="bg-white border border-purple-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-purple-50 bg-slate-50/55 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-purple-600" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Matching Orders ({orders.length})</h3>
              </div>
              <div className="divide-y divide-purple-50/50">
                {orders.map(order => (
                  <Link key={order.id} href={`/admin/orders/${order.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-purple-50/20 transition-colors group">
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-purple-700 transition-colors">{order.first_name} {order.last_name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{order.email}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-900">{formatCurrency(order.amount_total)}</div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{order.status}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tickets Section */}
          {tickets.length > 0 && (
            <div className="bg-white border border-purple-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-purple-50 bg-slate-50/55 flex items-center gap-2">
                <Ticket className="h-4 w-4 text-purple-600" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Matching Tickets ({tickets.length})</h3>
              </div>
              <div className="divide-y divide-purple-50/50">
                {tickets.map(ticket => (
                  <Link key={ticket.id} href={`/admin/tickets/${ticket.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-purple-50/20 transition-colors group">
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-purple-700 transition-colors">Ticket #{ticket.number}: {ticket.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Created: {new Date(ticket.created_at).toLocaleDateString('en-GB')}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[9px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">{ticket.status}</span>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Enquiries Section */}
          {enquiries.length > 0 && (
            <div className="bg-white border border-purple-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-purple-50 bg-slate-50/55 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-purple-600" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Matching Enquiries ({enquiries.length})</h3>
              </div>
              <div className="divide-y divide-purple-50/50">
                {enquiries.map(enq => (
                  <Link key={enq.id} href={`/admin/help-requests/${enq.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-purple-50/20 transition-colors group">
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-purple-700 transition-colors">{enq.subject}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{enq.customer_name} &bull; {enq.customer_email}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[9px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{enq.pipeline_stage}</span>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tasks Section */}
          {tasks.length > 0 && (
            <div className="bg-white border border-purple-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-purple-50 bg-slate-50/55 flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-purple-600" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Matching Tasks ({tasks.length})</h3>
              </div>
              <div className="divide-y divide-purple-50/50">
                {tasks.map(task => (
                  <Link key={task.id} href={`/admin/tasks`} className="flex items-center justify-between px-5 py-4 hover:bg-purple-50/20 transition-colors group">
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-purple-700 transition-colors">{task.title}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Created: {new Date(task.created_at).toLocaleDateString('en-GB')}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">{task.status}</span>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
