'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Order } from '@/types'
import { cn } from '@/lib/utils'
import { 
  Search, ExternalLink, Clock, CheckCircle2, FileText, Send
} from 'lucide-react'
import { toast } from 'sonner'

interface FormType { id: string; name: string; code: string }

interface Props {
  formTypes: FormType[]
}

type MonitorStage = 'awaiting' | 'in_progress' | 'submitted' | 'completed'

export default function MonitorClient({ formTypes }: Props) {
  const supabase = createClient()
  const router = useRouter()
  // Add monitor_stage and submission_requirements to Order locally if needed, using any for now
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const formTypeIds = formTypes.map(f => f.id)
    if (formTypeIds.length === 0) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('orders')
      .select('*, user:users!orders_user_id_fkey(id, full_name, email)')
      .in('form_type_id', formTypeIds)
      .order('created_at', { ascending: false })
      .limit(300)

    if (error) {
      toast.error('Failed to load monitor orders')
      console.error(error)
    } else {
      setOrders(data || [])
    }
    setLoading(false)
  }, [supabase, formTypes])

  useEffect(() => {
    fetchOrders()

    const channel = supabase.channel('monitor-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders, supabase])

  const updateStage = async (orderId: string, newStage: MonitorStage) => {
    const { data: { user } } = await supabase.auth.getUser()
    const updatePayload: any = { monitor_stage: newStage }
    if (newStage === 'completed' && user) {
      updatePayload.completed_by = user.id
    }
    const { error } = await supabase.from('orders').update(updatePayload).eq('id', orderId)
    if (error) toast.error('Failed to update stage')
    else toast.success(`Application moved to ${newStage.replace('_', ' ')}`)
  }

  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData('orderId', orderId)
  }

  const handleDrop = (e: React.DragEvent, columnStage: MonitorStage) => {
    e.preventDefault()
    const orderId = e.dataTransfer.getData('orderId')
    if (orderId) {
      updateStage(orderId, columnStage)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // Group orders
  const filteredOrders = orders.filter(o => 
    (o.first_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.last_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.user?.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const awaiting = filteredOrders.filter(o => !o.monitor_stage || o.monitor_stage === 'awaiting')
  const inProgress = filteredOrders.filter(o => o.monitor_stage === 'in_progress')
  const submitted = filteredOrders.filter(o => o.monitor_stage === 'submitted')
  const completed = filteredOrders.filter(o => o.monitor_stage === 'completed')

  const columns = [
    { id: 'awaiting' as MonitorStage, title: 'Awaiting Info', icon: Clock, count: awaiting.length, items: awaiting, color: 'bg-amber-100 text-amber-800 border-amber-200' },
    { id: 'in_progress' as MonitorStage, title: 'In Progress', icon: FileText, count: inProgress.length, items: inProgress, color: 'bg-blue-100 text-blue-800 border-blue-200' },
    { id: 'submitted' as MonitorStage, title: 'Submitted', icon: Send, count: submitted.length, items: submitted, color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    { id: 'completed' as MonitorStage, title: 'Completed', icon: CheckCircle2, count: completed.length, items: completed, color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  ]

  const getRequirementsMetText = (reqs: any) => {
    if (!reqs) return '0/3 Requirements'
    const values = Object.values(reqs)
    const met = values.filter(v => v === true).length
    const total = values.length
    return `${met}/${total} Requirements`
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-[#f8f7fc]">
      <div className="p-6 bg-white border-b border-purple-100 flex items-center justify-between shadow-sm z-10">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Title Deed Monitor</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Track compliance and document submission for complex applications.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-purple-100 bg-slate-50 px-4 py-2 w-64 focus-within:border-purple-400 focus-within:ring-1 focus-within:ring-purple-100 transition-all">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search customer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none font-semibold"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-6 min-w-max h-full">
          {columns.map(col => {
            const Icon = col.icon
            return (
              <div 
                key={col.id} 
                className="flex flex-col w-[350px] bg-slate-50/50 rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                onDrop={(e) => handleDrop(e, col.id)}
                onDragOver={handleDragOver}
              >
                <div className={cn("p-4 border-b flex items-center justify-between bg-white/50 backdrop-blur", col.color)}>
                  <h3 className="text-sm font-bold tracking-tight flex items-center gap-1.5"><Icon className="h-4 w-4" /> {col.title}</h3>
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-white/50">{col.count}</span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
                  {col.items.map(order => {
                    const serviceName = formTypes.find(f => f.id === order.form_type_id)?.name || 'Unknown Service'
                    
                    return (
                      <div 
                        key={order.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, order.id)}
                        className="relative group bg-white rounded-xl p-4 shadow-sm border border-purple-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-all"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0 pr-2">
                            <h4 className="text-sm font-black text-slate-900 truncate">
                              {order.first_name} {order.last_name}
                            </h4>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5 truncate">
                              {serviceName}
                            </p>
                          </div>
                        </div>

                        <div className="text-xs text-slate-600 font-medium mb-3 flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' })}
                        </div>
                        
                        <div className="bg-slate-50 border border-slate-100 rounded p-2 flex justify-between items-center">
                          <span className="text-[10px] font-semibold text-slate-500">Checklist</span>
                          <span className="text-[10px] font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border shadow-sm">
                            {getRequirementsMetText(order.submission_requirements)}
                          </span>
                        </div>

                        {/* View Details Overlay */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => router.push(`/admin/orders/${order.id}`)} className="p-1.5 bg-white/90 shadow-sm border border-slate-200 rounded-md text-slate-600 hover:text-purple-600 hover:bg-purple-50 transition-colors">
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {col.items.length === 0 && (
                    <div className="text-center py-10">
                      <p className="text-xs font-semibold text-slate-400">No applications</p>
                      <p className="text-[10px] font-medium text-slate-400 mt-1">Drag and drop cards here</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
