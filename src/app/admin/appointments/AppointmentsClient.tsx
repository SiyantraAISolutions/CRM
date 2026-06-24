'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfWeek, endOfWeek, addDays, subDays, isSameMonth, isSameDay, startOfMonth, endOfMonth, parseISO, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, X, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Appointment {
  id: string;
  order_id: string;
  solicitor_id: string | null;
  scheduled_at: string;
  status: string;
  notes: string | null;
  solicitor: { full_name: string } | null;
  order: { customer_name: string; customer_email: string } | null;
}

interface OrderItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function AppointmentsClient() {
  const router = useRouter()
  const supabase = createClient()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)

  // Booking Modal State
  const [showModal, setShowModal] = useState(false)
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchAppointments = async () => {
    setLoading(true)
    const start = startOfMonth(currentDate)
    const end = endOfMonth(currentDate)
    
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        solicitor:users(full_name),
        order:orders(first_name, last_name, email)
      `)
      .gte('scheduled_at', start.toISOString())
      .lte('scheduled_at', end.toISOString())
    
    if (!error && data) {
      const mapped = data.map(d => ({
        ...d,
        solicitor: Array.isArray(d.solicitor) ? d.solicitor[0] : d.solicitor,
        order: d.order ? {
          customer_name: `${(d.order as any).first_name || ''} ${(d.order as any).last_name || ''}`.trim(),
          customer_email: (d.order as any).email
        } : null
      })) as Appointment[]
      setAppointments(mapped)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAppointments()
  }, [currentDate, supabase])

  // Fetch recent orders for the booking modal
  useEffect(() => {
    if (showModal && orders.length === 0) {
      supabase.from('orders').select('id, first_name, last_name, email').order('created_at', { ascending: false }).limit(200)
        .then(({ data }) => {
          if (data) setOrders(data)
        })
    }
  }, [showModal, supabase])

  const handleBook = async () => {
    if (!selectedOrder || !appointmentDate || !appointmentTime) {
      toast.error('Please select an order, date, and time')
      return
    }
    setSaving(true)
    const scheduledAt = new Date(`${appointmentDate}T${appointmentTime}:00`).toISOString()
    const { error } = await supabase.from('appointments').insert({
      order_id: selectedOrder,
      scheduled_at: scheduledAt,
      status: 'scheduled'
    })
    
    setSaving(false)
    if (error) {
      toast.error('Failed to book appointment')
    } else {
      toast.success('Appointment booked successfully!')
      setShowModal(false)
      setSelectedOrder(null)
      setAppointmentDate('')
      setAppointmentTime('')
      fetchAppointments()
    }
  }

  const nextMonth = () => setCurrentDate(addDays(currentDate, 30))
  const prevMonth = () => setCurrentDate(subDays(currentDate, 30))
  
  // Generate calendar grid
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const dateFormat = "d"
  const rows = []
  
  let days = []
  let day = startDate
  let formattedDate = ""
  
  const getAppointmentsForDay = (d: Date) => {
    return appointments.filter(a => isSameDay(parseISO(a.scheduled_at), d)).sort((a,b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  }

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat)
      const cloneDay = day
      const dayAppts = getAppointmentsForDay(cloneDay)
      
      days.push(
        <div
          key={day.toString()}
          className={cn(
            "min-h-[120px] p-2 border-r border-b border-purple-100 flex flex-col transition-colors",
            !isSameMonth(day, monthStart) ? "bg-slate-50 text-slate-400" : "bg-white",
            isToday(day) ? "bg-purple-50/30" : ""
          )}
        >
          <div className="flex justify-between items-start mb-2">
            <span className={cn(
              "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
              isToday(day) ? "bg-purple-600 text-white" : "text-slate-700"
            )}>
              {formattedDate}
            </span>
            {dayAppts.length > 0 && (
              <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-md">
                {dayAppts.length}
              </span>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-none">
            {dayAppts.map(appt => (
              <div 
                key={appt.id} 
                onClick={() => router.push(`/admin/orders/${appt.order_id}`)}
                className={cn(
                  "text-[10px] p-1.5 rounded-md border cursor-pointer hover:shadow-sm transition-all text-left",
                  appt.status === 'completed' ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                  appt.status === 'rescheduled' ? "bg-amber-50 border-amber-200 text-amber-800" :
                  appt.status === 'cancelled' ? "bg-slate-100 border-slate-200 text-slate-500 line-through" :
                  "bg-purple-50 border-purple-200 text-purple-800"
                )}
              >
                <div className="font-bold truncate">{format(parseISO(appt.scheduled_at), 'HH:mm')}</div>
                <div className="truncate font-medium">{appt.order?.customer_name || 'Unknown'}</div>
                {appt.solicitor && <div className="truncate text-[9px] mt-0.5 opacity-80">{appt.solicitor.full_name}</div>}
              </div>
            ))}
          </div>
        </div>
      )
      day = addDays(day, 1)
    }
    rows.push(
      <div className="grid grid-cols-7" key={day.toString()}>
        {days}
      </div>
    )
    days = []
  }

  const filteredOrders = orders.filter(o => 
    `${o.first_name} ${o.last_name} ${o.email}`.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 10)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8f7fc] relative">
      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-white border-b border-purple-100 shadow-sm z-10">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-purple-600" />
            ID Verification Appointments
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-1">Manage solicitor schedules and customer verifications</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowModal(true)}
            className="btn-primary gap-2 bg-purple-600 hover:bg-purple-700 shadow-sm shadow-purple-600/20"
          >
            <Plus className="h-4 w-4" /> Book Verification
          </button>
          <div className="h-8 w-px bg-slate-200 mx-2" />
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1">
            <button onClick={prevMonth} className="p-2 hover:bg-white rounded-lg transition-colors text-slate-600">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="w-32 text-center font-bold text-sm text-slate-800">
              {format(currentDate, 'MMMM yyyy')}
            </div>
            <button onClick={nextMonth} className="p-2 hover:bg-white rounded-lg transition-colors text-slate-600">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Calendar View */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white border border-purple-100 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full max-w-6xl mx-auto">
          {/* Days of week */}
          <div className="grid grid-cols-7 border-b border-purple-100 bg-slate-50/50">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="py-3 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider border-r border-purple-100 last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          
          {/* Grid */}
          <div className="flex-1 flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : (
              rows
            )}
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-800">Book ID Verification</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Select Customer / Order</label>
                {!selectedOrder ? (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search name or email..." 
                      className="form-input w-full pl-9"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                        {filteredOrders.length > 0 ? filteredOrders.map(o => (
                          <div 
                            key={o.id} 
                            onClick={() => setSelectedOrder(o.id)}
                            className="px-3 py-2 hover:bg-purple-50 cursor-pointer border-b border-slate-50 last:border-0"
                          >
                            <div className="text-sm font-medium text-slate-800">{o.first_name} {o.last_name}</div>
                            <div className="text-xs text-slate-500 truncate">{o.email}</div>
                          </div>
                        )) : (
                          <div className="px-3 py-4 text-center text-sm text-slate-500">No results found</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium text-purple-900">
                      {orders.find(o => o.id === selectedOrder)?.first_name} {orders.find(o => o.id === selectedOrder)?.last_name}
                    </span>
                    <button onClick={() => setSelectedOrder(null)} className="text-purple-600 hover:text-purple-800 text-xs font-bold">
                      Change
                    </button>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date</label>
                  <input type="date" className="form-input w-full" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Time</label>
                  <input type="time" className="form-input w-full" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="btn-outline">Cancel</button>
              <button onClick={handleBook} disabled={saving || !selectedOrder || !appointmentDate || !appointmentTime} className="btn-primary">
                {saving ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
