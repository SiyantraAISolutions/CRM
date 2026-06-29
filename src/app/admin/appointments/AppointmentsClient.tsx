'use client'

import { useState, useEffect } from 'react'
import { Users, UserPlus, Search, ArrowLeft, Calendar, Clock, Phone, Video, MapPin, FileText, CheckCircle2, AlertCircle, Trash2, CalendarDays, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/utils'

interface Customer {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
}

type ViewState = 'select' | 'existing-customer' | 'booking'

interface Solicitor {
  id: string
  full_name: string
  email: string
  is_active: boolean
}

interface Appointment {
  id: string
  scheduled_at: string
  status: 'scheduled' | 'completed' | 'cancelled'
  meeting_type: 'phone' | 'zoom' | 'in_person'
  notes: string | null
  solicitor_id?: string
  solicitor?: {
    full_name: string
    email: string
  }
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  order_id?: string
  enquiry_id?: string
}

export default function AppointmentsClient() {
  const supabase = createClient()
  
  const [view, setView] = useState<ViewState>('select')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [loadingCustomers, setLoadingCustomers] = useState(false)

  // Booking Form State
  const [solicitors, setSolicitors] = useState<Solicitor[]>([])
  const [selectedSolId, setSelectedSolId] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [meetingType, setMeetingType] = useState<'phone' | 'zoom' | 'in_person'>('phone')
  const [internalNotes, setInternalNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Manual Customer Details (for new customers)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')

  // Scheduled Appointments List State
  const [scheduledAppts, setScheduledAppts] = useState<Appointment[]>([])
  const [loadingAppts, setLoadingAppts] = useState(false)

  // Rescheduling State
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null)

  // Fetch active solicitors
  const fetchActiveSolicitors = async () => {
    try {
      const res = await fetch('/api/solicitors?active_only=true')
      const data = await res.json()
      if (res.ok) {
        setSolicitors(data)
      }
    } catch (err) {
      console.error('Failed to load active solicitors:', err)
    }
  }

  // Fetch scheduled appointments
  const fetchScheduledAppointments = async () => {
    setLoadingAppts(true)
    try {
      // Query appointments including joined solicitors
      const { data, error } = await supabase
        .from('appointments')
        .select('*, solicitor:solicitors(full_name, email)')
        .order('scheduled_at', { ascending: true })

      if (error) throw error

      // Retrieve customer info from either orders or enquiries
      const enriched: Appointment[] = await Promise.all((data || []).map(async (appt: any) => {
        let customer_name = 'Unknown'
        let customer_email = ''
        let customer_phone = ''

        if (appt.order_id) {
          const { data: order } = await supabase
            .from('orders')
            .select('first_name, last_name, email, phone')
            .eq('id', appt.order_id)
            .maybeSingle()
          if (order) {
            customer_name = `${order.first_name || ''} ${order.last_name || ''}`.trim() || 'Unknown'
            customer_email = order.email || ''
            customer_phone = order.phone || ''
          }
        } else if (appt.enquiry_id) {
          const { data: enq } = await supabase
            .from('enquiries')
            .select('customer_name, email, phone')
            .eq('id', appt.enquiry_id)
            .maybeSingle()
          if (enq) {
            customer_name = enq.customer_name || 'Unknown'
            customer_email = enq.email || ''
            customer_phone = enq.phone || ''
          }
        }

        return {
          ...appt,
          customer_name,
          customer_email,
          customer_phone,
        }
      }))

      setScheduledAppts(enriched)
    } catch (err: any) {
      toast.error('Failed to load appointments: ' + err.message)
    } finally {
      setLoadingAppts(false)
    }
  }

  // Fetch available slots when solicitor or date changes
  useEffect(() => {
    if (selectedSolId && selectedDate) {
      const fetchSlots = async () => {
        setLoadingSlots(true)
        setSelectedSlot('')
        try {
          const res = await fetch(`/api/appointments?solicitor_id=${selectedSolId}&date=${selectedDate}`)
          const data = await res.json()
          if (res.ok) {
            setAvailableSlots(data)
          } else {
            toast.error(data.error || 'Failed to load available slots')
          }
        } catch (err) {
          toast.error('Error loading slots')
        } finally {
          setLoadingSlots(false)
        }
      }
      fetchSlots()
    } else {
      setAvailableSlots([])
    }
  }, [selectedSolId, selectedDate])

  // Search existing customers
  useEffect(() => {
    if (view === 'existing-customer' && searchQuery.length > 0) {
      const fetchCustomers = async () => {
        setLoadingCustomers(true)
        const { data } = await supabase
          .from('orders')
          .select('id, first_name, last_name, email, phone')
          .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
          .order('created_at', { ascending: false })
          .limit(50)

        if (data) {
          const unique = data.reduce((acc: Customer[], curr) => {
            if (!acc.find(c => c.email === curr.email)) {
              acc.push(curr)
            }
            return acc
          }, [])
          setCustomers(unique)
        }
        setLoadingCustomers(false)
      }

      const debounce = setTimeout(fetchCustomers, 300)
      return () => clearTimeout(debounce)
    } else {
      setCustomers([])
    }
  }, [searchQuery, view, supabase])

  useEffect(() => {
    fetchActiveSolicitors()
    fetchScheduledAppointments()
  }, [])

  const handleNewCustomer = () => {
    setSelectedCustomer(null)
    setNewCustomerName('')
    setNewCustomerEmail('')
    setNewCustomerPhone('')
    setReschedulingAppt(null)
    setView('booking')
  }

  const handleExistingCustomer = () => {
    setReschedulingAppt(null)
    setView('existing-customer')
  }

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setReschedulingAppt(null)
    setView('booking')
  }

  const handleBack = () => {
    setView('select')
    setSelectedCustomer(null)
    setSearchQuery('')
    setReschedulingAppt(null)
    fetchScheduledAppointments()
  }

  // Cancel Appointment
  const handleCancelAppointment = async (apptId: string) => {
    if (!confirm('Are you sure you want to cancel this appointment? An email notification will be sent to the customer and solicitor.')) return

    try {
      const res = await fetch(`/api/appointments/${apptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' })
      })

      if (res.ok) {
        toast.success('Appointment cancelled')
        fetchScheduledAppointments()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to cancel appointment')
      }
    } catch (err) {
      toast.error('Error cancelling appointment')
    }
  }

  // Setup Rescheduling
  const handleSetupReschedule = (appt: Appointment) => {
    setReschedulingAppt(appt)
    setSelectedCustomer(null)
    setSelectedSolId(appt.solicitor_id || '')
    
    // Prefill date if future
    const apptDateStr = new Date(appt.scheduled_at).toISOString().split('T')[0]
    setSelectedDate(apptDateStr)
    setMeetingType(appt.meeting_type)
    setInternalNotes(appt.notes || '')
    
    setView('booking')
  }

  // Submit Booking/Rescheduling
  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSolId || !selectedDate || !selectedSlot) {
      toast.error('Please select solicitor, date and available slot')
      return
    }

    setSubmitting(true)

    try {
      // 1. Rescheduling logic
      if (reschedulingAppt) {
        const res = await fetch(`/api/appointments/${reschedulingAppt.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reschedule',
            date: selectedDate,
            time: selectedSlot,
            solicitor_id: selectedSolId,
            notes: internalNotes,
          })
        })

        const data = await res.json()
        if (res.ok) {
          toast.success('Appointment rescheduled successfully')
          setView('select')
          fetchScheduledAppointments()
        } else {
          toast.error(data.error || 'Failed to reschedule appointment')
        }
      } else {
        // 2. New Booking logic
        let cName = newCustomerName
        let cEmail = newCustomerEmail
        let cPhone = newCustomerPhone
        let orderId = undefined
        let enquiryId = undefined

        if (selectedCustomer) {
          cName = `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
          cEmail = selectedCustomer.email
          cPhone = selectedCustomer.phone || ''
          orderId = selectedCustomer.id
        } else {
          // If manual new customer, we create an enquiry first!
          // Fetch default business mapping
          const { data: defaultBizSetting } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'calendly_default_business_id')
            .maybeSingle()

          let businessId = defaultBizSetting?.value
          if (!businessId) {
            const { data: bizs } = await supabase.from('businesses').select('id').limit(1)
            businessId = bizs?.[0]?.id
          }

          // Create Enquiry
          const { data: enquiry, error: enqErr } = await supabase
            .from('enquiries')
            .insert({
              customer_name: cName,
              email: cEmail,
              phone: cPhone,
              source: 'CRM Scheduler',
              pipeline_stage: 'new',
              business_id: businessId,
            })
            .select()
            .single()

          if (enqErr) {
            toast.error('Failed to register customer enquiry')
            setSubmitting(false)
            return
          }
          enquiryId = enquiry.id
        }

        // Insert native appointment
        const res = await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: cName,
            email: cEmail,
            phone: cPhone,
            solicitor_id: selectedSolId,
            date: selectedDate,
            time: selectedSlot,
            meeting_type: meetingType,
            notes: internalNotes,
            order_id: orderId,
            enquiry_id: enquiryId,
          })
        })

        const data = await res.json()
        if (res.ok) {
          toast.success('Appointment booked successfully!')
          setView('select')
          fetchScheduledAppointments()
        } else {
          toast.error(data.error || 'Failed to book appointment')
        }
      }
    } catch (err) {
      toast.error('Error scheduling appointment')
    } finally {
      setSubmitting(false)
    }
  }

  // Select View - Choose Customer Type or see list
  if (view === 'select') {
    return (
      <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#f8f7fc] h-full scrollbar-thin">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
              ID Verification Appointments
            </h1>
            <p className="text-xs text-slate-500 font-bold">
              Book a new client verification appointment or manage active schedules
            </p>
          </div>

          {/* Booking Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* New Customer Card */}
            <button
              onClick={handleNewCustomer}
              className="group relative bg-white border border-purple-100 rounded-2xl p-6 hover:border-purple-300 hover:shadow-md transition-all duration-300 text-left overflow-hidden cursor-pointer"
            >
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center group-hover:bg-purple-600 transition-colors">
                  <UserPlus className="h-6 w-6 text-purple-600 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">New Customer</h2>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">Book and manually input details</p>
                </div>
              </div>
            </button>

            {/* Existing Customer Card */}
            <button
              onClick={handleExistingCustomer}
              className="group relative bg-white border border-purple-100 rounded-2xl p-6 hover:border-purple-300 hover:shadow-md transition-all duration-300 text-left overflow-hidden cursor-pointer"
            >
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center group-hover:bg-purple-600 transition-colors">
                  <Users className="h-6 w-6 text-purple-600 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Existing Customer</h2>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">Search CRM database by name/email</p>
                </div>
              </div>
            </button>
          </div>

          {/* Scheduled Appointments Table */}
          <div className="bg-white border border-purple-100 rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between border-b border-purple-50 pb-4 mb-6">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-purple-600" />
                Active Appointment Schedule
              </h3>
              <button
                onClick={fetchScheduledAppointments}
                className="text-slate-400 hover:text-purple-600 p-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                title="Refresh schedule"
              >
                <RefreshCw className={`h-4 w-4 ${loadingAppts ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingAppts ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
              </div>
            ) : scheduledAppts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-medium text-xs">
                No active verification calls booked.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="pb-3 px-3">Date/Time (UTC)</th>
                      <th className="pb-3 px-3">Customer</th>
                      <th className="pb-3 px-3">Solicitor</th>
                      <th className="pb-3 px-3">Meeting Type</th>
                      <th className="pb-3 px-3">Status</th>
                      <th className="pb-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {scheduledAppts.map(appt => {
                      const localTimeStr = formatDateTime(appt.scheduled_at)
                      const isScheduled = appt.status === 'scheduled'

                      return (
                        <tr key={appt.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="py-4 px-3 font-bold text-slate-700">{localTimeStr}</td>
                          <td className="py-4 px-3">
                            <div className="font-semibold text-slate-900">{appt.customer_name}</div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5">{appt.customer_email}</div>
                          </td>
                          <td className="py-4 px-3 font-medium text-slate-700">{appt.solicitor?.full_name || 'Unassigned'}</td>
                          <td className="py-4 px-3 font-bold text-purple-700 capitalize">{appt.meeting_type.replace('_', ' ')}</td>
                          <td className="py-4 px-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              appt.status === 'scheduled'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : appt.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-400 border-slate-200'
                            }`}>
                              {appt.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-right">
                            {isScheduled && (
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleSetupReschedule(appt)}
                                  className="text-xs font-bold text-purple-600 hover:bg-purple-50 border border-purple-200 hover:border-purple-300 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm"
                                >
                                  Reschedule
                                </button>
                                <button
                                  onClick={() => handleCancelAppointment(appt.id)}
                                  className="text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 hover:border-rose-300 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Existing Customer Search View
  if (view === 'existing-customer') {
    return (
      <div className="flex flex-col h-full bg-[#f8f7fc]">
        {/* Header */}
        <div className="bg-white border-b border-purple-100 shadow-sm p-6 shrink-0">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold mb-4 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Selection
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
            Search Existing Customer
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Enter customer name or email to retrieve their record from orders
          </p>
        </div>

        {/* Search Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white border border-purple-100 rounded-2xl shadow-sm p-6">
              {/* Search Input */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none z-10" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 focus:border-purple-500 focus:outline-none rounded-xl text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Results */}
              {loadingCustomers && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              )}

              {!loadingCustomers && searchQuery && customers.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-500 text-xs">No customers found matching "{searchQuery}"</p>
                </div>
              )}

              {!loadingCustomers && customers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-3 px-1">
                    Found {customers.length} customer{customers.length !== 1 ? 's' : ''}
                  </p>
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => handleSelectCustomer(customer)}
                      className="w-full text-left px-4 py-3 border-2 border-slate-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer group"
                    >
                      <div className="font-bold text-slate-900 group-hover:text-purple-900 mb-0.5 text-xs">
                        {customer.first_name} {customer.last_name}
                      </div>
                      <div className="text-[10px] text-slate-500 group-hover:text-purple-700">
                        {customer.email}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!searchQuery && (
                <div className="text-center py-12 text-slate-400">
                  <Search className="h-12 w-12 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs">Start typing to search for customers</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Booking Form View
  if (view === 'booking') {
    const isRescheduling = !!reschedulingAppt

    return (
      <div className="flex flex-col h-full bg-[#f8f7fc] overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-purple-100 shadow-sm p-6 shrink-0">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold mb-4 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Selection
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
            {isRescheduling ? 'Reschedule Appointment' : 'Book ID Verification Appointment'}
          </h1>
          <p className="text-xs text-slate-500 font-bold">
            Configure slots, solicitor and meeting details
          </p>
        </div>

        {/* Content */}
        <form onSubmit={handleBookAppointment} className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Left Column: Customer details, solicitor & meeting options */}
            <div className="space-y-6">
              
              {/* Customer Info Card */}
              <div className="bg-white border border-purple-100 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b pb-2">Customer Details</h3>
                
                {selectedCustomer ? (
                  <div className="space-y-1.5 text-xs">
                    <div><span className="font-semibold text-slate-500">Name:</span> <strong className="text-slate-800">{selectedCustomer.first_name} {selectedCustomer.last_name}</strong></div>
                    <div><span className="font-semibold text-slate-500">Email:</span> <strong className="text-slate-800">{selectedCustomer.email}</strong></div>
                    {selectedCustomer.phone && <div><span className="font-semibold text-slate-500">Phone:</span> <strong className="text-slate-800">{selectedCustomer.phone}</strong></div>}
                    <div className="text-[10px] text-purple-700 font-bold bg-purple-50 border border-purple-100 px-2.5 py-1.5 rounded-lg inline-block mt-2">
                      Linked Order: #{selectedCustomer.id.slice(-6).toUpperCase()}
                    </div>
                  </div>
                ) : isRescheduling ? (
                  <div className="space-y-1.5 text-xs">
                    <div><span className="font-semibold text-slate-500">Name:</span> <strong className="text-slate-800">{reschedulingAppt.customer_name}</strong></div>
                    <div><span className="font-semibold text-slate-500">Email:</span> <strong className="text-slate-800">{reschedulingAppt.customer_email}</strong></div>
                    {reschedulingAppt.customer_phone && <div><span className="font-semibold text-slate-500">Phone:</span> <strong className="text-slate-800">{reschedulingAppt.customer_phone}</strong></div>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="form-label text-[10px]">Full Name</label>
                      <input
                        type="text"
                        required
                        className="form-input text-xs w-full"
                        placeholder="e.g. John Doe"
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label text-[10px]">Email Address</label>
                      <input
                        type="email"
                        required
                        className="form-input text-xs w-full"
                        placeholder="e.g. john@example.com"
                        value={newCustomerEmail}
                        onChange={(e) => setNewCustomerEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label text-[10px]">Phone Number</label>
                      <input
                        type="tel"
                        className="form-input text-xs w-full"
                        placeholder="e.g. +447123456789"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Solicitor Selector */}
              <div className="bg-white border border-purple-100 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b pb-2">Assigned Solicitor</h3>
                <div>
                  <label className="form-label text-[10px] mb-1.5">Select Active Solicitor</label>
                  {solicitors.length === 0 ? (
                    <div className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" /> No active solicitors available.
                    </div>
                  ) : (
                    <select
                      required
                      value={selectedSolId}
                      onChange={(e) => {
                        setSelectedSolId(e.target.value)
                        setSelectedSlot('')
                      }}
                      className="form-input text-xs w-full"
                    >
                      <option value="">-- Choose Solicitor --</option>
                      {solicitors.map(s => (
                        <option key={s.id} value={s.id}>{s.full_name} ({s.email})</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Meeting Options */}
              <div className="bg-white border border-purple-100 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b pb-2">Meeting Type</h3>
                
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'phone', label: 'Phone', icon: Phone },
                    { type: 'zoom', label: 'Zoom', icon: Video },
                    { type: 'in_person', label: 'In Person', icon: MapPin },
                  ].map(m => {
                    const Icon = m.icon
                    const isSelected = meetingType === m.type
                    return (
                      <button
                        key={m.type}
                        type="button"
                        onClick={() => setMeetingType(m.type as any)}
                        className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-200 text-xs font-bold ${
                          isSelected
                            ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {m.label}
                      </button>
                    )
                  })}
                </div>

                <div className="pt-2">
                  <label className="form-label text-[10px]">Internal Notes</label>
                  <textarea
                    className="form-input text-xs w-full resize-none mt-1.5"
                    rows={3}
                    placeholder="Enter any private internal details..."
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                  />
                </div>
              </div>

            </div>

            {/* Right Column: Date selection & Slots */}
            <div className="space-y-6 flex flex-col">
              
              {/* Date & Time Slot Selector */}
              <div className="bg-white border border-purple-100 rounded-2xl p-6 shadow-sm space-y-4 flex-1 flex flex-col">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b pb-2">Calendar & Availability</h3>
                
                <div>
                  <label className="form-label text-[10px] mb-1.5">Select Appointment Date</label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value)
                      setSelectedSlot('')
                    }}
                    className="form-input text-xs w-full"
                  />
                </div>

                {/* Available Slots */}
                <div className="flex-1 flex flex-col pt-3 min-h-[250px]">
                  <label className="form-label text-[10px] mb-2">Available Time Slots</label>

                  {loadingSlots ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                    </div>
                  ) : !selectedSolId || !selectedDate ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 py-12 border-2 border-dashed border-slate-100 rounded-xl">
                      <Calendar className="h-10 w-10 text-slate-200 mb-2" />
                      <p className="text-[11px] font-semibold">Select solicitor & date to calculate slots</p>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-rose-500 py-12 border border-rose-100 bg-rose-50/30 rounded-xl">
                      <AlertCircle className="h-8 w-8 text-rose-400 mb-2" />
                      <p className="text-[11px] font-bold">No available slots on this date.</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Weekend, fully booked, or holiday.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 overflow-y-auto max-h-[300px] pr-1">
                      {availableSlots.map(slot => {
                        const isSelected = selectedSlot === slot
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`py-2 rounded-xl text-center text-xs font-bold border transition-all duration-200 cursor-pointer ${
                              isSelected
                                ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {slot}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Submit Action */}
                <div className="pt-6 border-t mt-auto">
                  <button
                    type="submit"
                    disabled={submitting || !selectedSolId || !selectedDate || !selectedSlot}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold py-3.5 rounded-xl transition-colors cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                  >
                    {submitting ? 'Scheduling...' : isRescheduling ? 'Reschedule Appointment' : 'Book Appointment'}
                  </button>
                </div>
              </div>

            </div>

          </div>
        </form>
      </div>
    )
  }

  return null
}
