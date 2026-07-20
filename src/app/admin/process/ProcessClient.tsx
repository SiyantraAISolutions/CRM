'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderStatus } from '@/types'
import { formatCurrency, cn } from '@/lib/utils'
import { 
  Clock, AlertCircle, ArrowRight, CheckCircle2, 
  Mail, Truck, Search, Zap, ExternalLink, Calendar, X, Loader2
} from 'lucide-react'
import { toast } from 'sonner'

interface FormType { id: string; name: string; code: string }

interface Props {
  formTypes: FormType[]
}

export default function ProcessClient({ formTypes }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Deferral Modal State
  const [deferOrderId, setDeferOrderId] = useState<string | null>(null)
  const [deferDate, setDeferDate] = useState('')
  const [deferReason, setDeferReason] = useState('Awaiting documents')
  const [savingDefer, setSavingDefer] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*, user:users!orders_user_id_fkey(id, full_name, email)')
      .or('status.in.(paid,processing,in_progress,completed),deferred_until.not.is.null')
      .order('created_at', { ascending: false })
      .limit(300)

    if (error) {
      toast.error('Failed to load process orders')
      console.error(error)
    } else {
      setOrders(data || [])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchOrders()

    const channel = supabase.channel('process-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders, supabase])

  const handleDeferSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deferOrderId) return
    if (!deferDate) {
      toast.error('Please select a review date')
      return
    }

    setSavingDefer(true)
    const formattedDate = new Date(deferDate).toISOString()
    const { error } = await supabase.from('orders').update({
      deferred_until: formattedDate,
      deferred_reason: deferReason || 'Deferred via workload board'
    }).eq('id', deferOrderId)

    setSavingDefer(false)
    if (error) {
      toast.error('Failed to defer order')
    } else {
      toast.success('Order deferred successfully')
      setDeferOrderId(null)
      fetchOrders()
    }
  }

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    const { data: { user } } = await supabase.auth.getUser()

    if (newStatus === 'deferred' as any) {
      setDeferOrderId(orderId)
      const defaultDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      setDeferDate(defaultDate)
      setDeferReason('Awaiting documents')
      return
    }

    const updatePayload: any = { 
      status: newStatus,
      deferred_until: null,
      deferred_reason: null
    }
    if (newStatus === 'completed' && user) {
      updatePayload.completed_by = user.id
    }
    const { error } = await supabase.from('orders').update(updatePayload).eq('id', orderId)
    if (error) toast.error('Failed to update status')
    else toast.success(`Order moved to ${newStatus.replace('_', ' ')}`)
  }

  const updateTracking = async (orderId: string, provider: string, trackingNumber: string) => {
    const { error } = await supabase.from('orders').update({ 
      postage_provider: provider, 
      tracking_number: trackingNumber 
    }).eq('id', orderId)
    
    if (error) toast.error('Failed to save tracking info')
    else toast.success('Tracking info saved!')
  }

  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData('orderId', orderId)
  }

  const handleDrop = (e: React.DragEvent, columnStatus: OrderStatus) => {
    e.preventDefault()
    const orderId = e.dataTransfer.getData('orderId')
    if (orderId) {
      updateOrderStatus(orderId, columnStatus)
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

  const isDeferred = (o: any) => o.deferred_until && new Date(o.deferred_until).getTime() > new Date().getTime()
  const reviewDue = (o: any) => o.deferred_until && new Date(o.deferred_until).getTime() <= new Date().getTime()

  const inProcess = filteredOrders.filter(o => o.status === 'paid' && !isDeferred(o))
  const inProgress = filteredOrders.filter(o => (o.status === 'processing' || o.status === 'in_progress') && !isDeferred(o))
  const deferred = filteredOrders.filter(o => isDeferred(o) && o.status !== 'completed')
  const completed = filteredOrders.filter(o => o.status === 'completed')

  const columns = [
    { id: 'paid' as OrderStatus, title: 'In Process (New)', count: inProcess.length, items: inProcess, color: 'bg-amber-100 text-amber-800 border-amber-200' },
    { id: 'in_progress' as OrderStatus, title: 'In Progress', count: inProgress.length, items: inProgress, color: 'bg-blue-100 text-blue-800 border-blue-200' },
    { id: 'deferred' as any, title: 'Deferred', count: deferred.length, items: deferred, color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    { id: 'completed' as OrderStatus, title: 'Completed', count: completed.length, items: completed, color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  ]

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-[#f8f7fc]">
      {/* Header & Controls */}
      <div className="p-6 bg-white border-b border-purple-100 flex items-center justify-between shadow-sm z-10">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Daily Workload & Process Panel</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Live overview of active applications and services.</p>
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

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-6 min-w-max h-full">
          {columns.map(col => (
            <div 
              key={col.id} 
              className="flex flex-col w-[400px] bg-slate-50/50 rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              onDrop={(e) => handleDrop(e, col.id)}
              onDragOver={handleDragOver}
            >
              {/* Column Header */}
              <div className={cn("p-4 border-b flex items-center justify-between bg-white/50 backdrop-blur", col.color)}>
                <h3 className="text-sm font-bold tracking-tight">{col.title}</h3>
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-white/50">{col.count}</span>
              </div>

              {/* Column Items */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
                {col.items.map(order => {
                  const serviceName = formTypes.find(f => f.id === order.form_type_id)?.name || 'Unknown Service'
                  const isFastTrack = order.priority === 'fast_track'
                  const customerEmail = order.email || order.user?.email

                  return (
                    <div 
                      key={order.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, order.id)}
                      className={cn(
                        "relative group bg-white rounded-xl p-4 shadow-sm border cursor-grab active:cursor-grabbing hover:shadow-md transition-all",
                        isFastTrack ? "border-rose-400 ring-1 ring-rose-400 shadow-rose-100" : "border-purple-100"
                      )}
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
                        <div className="flex flex-col gap-1 items-end">
                          {isFastTrack && (
                            <div className="flex items-center gap-1 bg-rose-50 text-rose-700 px-2 py-1 rounded-md border border-rose-200">
                              <Zap className="h-3 w-3 fill-current" />
                              <span className="text-[9px] font-extrabold tracking-wider uppercase">Fast Track</span>
                            </div>
                          )}
                          {reviewDue(order) && (
                            <div className="flex items-center gap-1 bg-red-50 text-red-700 px-2 py-1 rounded-md border border-red-200">
                              <AlertCircle className="h-3 w-3" />
                              <span className="text-[9px] font-extrabold tracking-wider uppercase">Review Due</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 font-medium mb-4 flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' })}
                      </div>

                      {isDeferred(order) && (
                        <div className="mt-2 mb-4 p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-100 text-xs space-y-1">
                          <div className="flex items-center gap-1 text-indigo-700 font-semibold">
                            <Calendar className="h-3 w-3 text-indigo-500" />
                            <span>Deferred until: {new Date(order.deferred_until as string).toLocaleDateString('en-GB')}</span>
                          </div>
                          {order.deferred_reason && (
                            <p className="text-indigo-600/90 font-medium italic">
                              "{order.deferred_reason}"
                            </p>
                          )}
                        </div>
                      )}

                      {/* Completed / Shipping Section */}
                      {col.id === 'completed' && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <div className="text-[10px] font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                            <Truck className="h-3 w-3 text-purple-600" /> Postage / Shipping
                          </div>
                          <form 
                            onSubmit={(e) => {
                              e.preventDefault()
                              const fd = new FormData(e.currentTarget)
                              updateTracking(order.id, fd.get('provider') as string, fd.get('tracking') as string)
                            }}
                            className="space-y-2"
                          >
                            <select 
                              name="provider" 
                              defaultValue={order.postage_provider || ''}
                              className="w-full text-xs p-1.5 rounded border border-slate-200 font-medium"
                            >
                              <option value="">Select Provider...</option>
                              <option value="Royal Mail">Royal Mail</option>
                              <option value="DPD">DPD</option>
                              <option value="Evri">Evri</option>
                              <option value="DHL">DHL</option>
                              <option value="FedEx">FedEx</option>
                            </select>
                            <div className="flex gap-2">
                              <input 
                                name="tracking"
                                type="text"
                                defaultValue={order.tracking_number || ''}
                                placeholder="Tracking Number..."
                                className="flex-1 text-xs p-1.5 rounded border border-slate-200 font-medium"
                              />
                              <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold px-3 rounded transition-colors">
                                Save
                              </button>
                            </div>
                          </form>
                        </div>
                      )}

                      {/* Manual Move Buttons (Fallback for DND) */}
                      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                        {col.id !== 'paid' && (
                          <button 
                            onClick={() => updateOrderStatus(order.id, 'paid')}
                            className="text-[10px] font-bold text-slate-400 hover:text-amber-600"
                          >
                            ← In Process
                          </button>
                        )}
                        {col.id !== 'in_progress' && (
                          <button 
                            onClick={() => updateOrderStatus(order.id, 'in_progress')}
                            className="text-[10px] font-bold text-slate-400 hover:text-blue-600"
                          >
                            {col.id === 'paid' ? 'Start Progress →' : '← In Progress'}
                          </button>
                        )}
                        {col.id !== 'completed' && (
                          <button 
                            onClick={() => updateOrderStatus(order.id, 'completed')}
                            className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors"
                          >
                            Complete →
                          </button>
                        )}
                        {col.id !== 'deferred' && (
                          <button 
                            onClick={() => updateOrderStatus(order.id, 'deferred' as any)}
                            className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"
                          >
                            Defer...
                          </button>
                        )}
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
                    <p className="text-xs font-semibold text-slate-400">No orders here</p>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">Drag and drop cards here</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deferral Modal */}
      {deferOrderId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 text-left">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-600" />
                <h2 className="text-xl font-bold text-slate-800">Defer Application</h2>
              </div>
              <button 
                onClick={() => setDeferOrderId(null)} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleDeferSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Review Date</label>
                <input
                  type="date"
                  required
                  value={deferDate}
                  onChange={e => setDeferDate(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-indigo-500 focus:outline-none text-[15px] text-slate-800 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Reason for Deferral</label>
                <input
                  type="text"
                  required
                  value={deferReason}
                  onChange={e => setDeferReason(e.target.value)}
                  placeholder="e.g. Awaiting documents"
                  className="w-full h-11 px-3 bg-white border border-slate-300 rounded-md focus:border-indigo-500 focus:outline-none text-[15px] text-slate-800 shadow-sm"
                />
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeferOrderId(null)}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDefer}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all flex items-center gap-2"
                >
                  {savingDefer && <Loader2 className="h-4 w-4 animate-spin" />}
                  Defer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
