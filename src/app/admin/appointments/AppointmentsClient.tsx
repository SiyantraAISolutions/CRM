'use client'

import { useState, useEffect } from 'react'
import { Users, UserPlus, Search, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Customer {
  id: string
  first_name: string
  last_name: string
  email: string
}

type ViewState = 'select' | 'new-customer' | 'existing-customer' | 'calendly'

export default function AppointmentsClient() {
  const supabase = createClient()
  const calendlyLink = 'https://calendly.com/landregistrytransfers/30min'
  
  const [view, setView] = useState<ViewState>('select')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch customers when searching for existing customer
  useEffect(() => {
    if (view === 'existing-customer' && searchQuery.length > 0) {
      const fetchCustomers = async () => {
        setLoading(true)
        const { data } = await supabase
          .from('orders')
          .select('id, first_name, last_name, email')
          .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
          .order('created_at', { ascending: false })
          .limit(50)

        if (data) {
          // Remove duplicates based on email
          const unique = data.reduce((acc: Customer[], curr) => {
            if (!acc.find(c => c.email === curr.email)) {
              acc.push(curr)
            }
            return acc
          }, [])
          setCustomers(unique)
        }
        setLoading(false)
      }

      const debounce = setTimeout(fetchCustomers, 300)
      return () => clearTimeout(debounce)
    } else {
      setCustomers([])
    }
  }, [searchQuery, view, supabase])

  const handleNewCustomer = () => {
    setView('calendly')
    setSelectedCustomer(null)
  }

  const handleExistingCustomer = () => {
    setView('existing-customer')
  }

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setView('calendly')
  }

  const handleBack = () => {
    setView('select')
    setSelectedCustomer(null)
    setSearchQuery('')
  }

  // Construct Calendly URL with prefilled data
  const getCalendlyUrl = () => {
    if (selectedCustomer) {
      const params = new URLSearchParams({
        name: `${selectedCustomer.first_name} ${selectedCustomer.last_name}`.trim(),
        email: selectedCustomer.email,
      })
      return `${calendlyLink}?${params.toString()}`
    }
    return calendlyLink
  }

  // Select View - Choose Customer Type
  if (view === 'select') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-purple-50 via-white to-violet-50 p-6">
        <div className="max-w-4xl w-full">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">
              ID Verification Appointments
            </h1>
            <p className="text-lg text-slate-600 font-medium">
              Please select customer type to book verification
            </p>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* New Customer Card */}
            <button
              onClick={handleNewCustomer}
              className="group relative bg-white border-2 border-purple-200 rounded-2xl p-8 hover:border-purple-400 hover:shadow-xl transition-all duration-300 text-left overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-0" />
              
              <div className="relative z-10">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-600 transition-colors duration-300">
                  <UserPlus className="h-8 w-8 text-purple-600 group-hover:text-white transition-colors duration-300" />
                </div>
                
                <h2 className="text-2xl font-bold text-slate-900 mb-3">New Customer</h2>
                <p className="text-slate-600 leading-relaxed mb-6">
                  Book an ID verification appointment for a customer who hasn't used our services before.
                </p>
                
                <div className="inline-flex items-center gap-2 text-purple-600 font-semibold text-sm group-hover:gap-3 transition-all">
                  <span>Book Appointment</span>
                  <span className="text-xl">→</span>
                </div>
              </div>
            </button>

            {/* Existing Customer Card */}
            <button
              onClick={handleExistingCustomer}
              className="group relative bg-white border-2 border-violet-200 rounded-2xl p-8 hover:border-violet-400 hover:shadow-xl transition-all duration-300 text-left overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-100 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-0" />
              
              <div className="relative z-10">
                <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-violet-600 transition-colors duration-300">
                  <Users className="h-8 w-8 text-violet-600 group-hover:text-white transition-colors duration-300" />
                </div>
                
                <h2 className="text-2xl font-bold text-slate-900 mb-3">Existing Customer</h2>
                <p className="text-slate-600 leading-relaxed mb-6">
                  Book an ID verification appointment for a returning customer who has used our services before.
                </p>
                
                <div className="inline-flex items-center gap-2 text-violet-600 font-semibold text-sm group-hover:gap-3 transition-all">
                  <span>Book Appointment</span>
                  <span className="text-xl">→</span>
                </div>
              </div>
            </button>
          </div>

          {/* Info Note */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> The booking will be completed using Calendly scheduling.
            </p>
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
        <div className="bg-white border-b border-purple-100 shadow-sm p-6">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Selection
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
            Search Existing Customer
          </h1>
          <p className="text-sm text-slate-600">
            Enter customer name or email to find their record
          </p>
        </div>

        {/* Search Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white border border-purple-100 rounded-xl shadow-sm p-6">
              {/* Search Input */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none z-10" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  className="w-full pl-12 pr-4 py-3.5 border-2 border-slate-300 rounded-xl text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Results */}
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              )}

              {!loading && searchQuery && customers.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-500">No customers found matching "{searchQuery}"</p>
                </div>
              )}

              {!loading && customers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
                    Found {customers.length} customer{customers.length !== 1 ? 's' : ''}
                  </p>
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => handleSelectCustomer(customer)}
                      className="w-full text-left px-4 py-3.5 border-2 border-slate-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all group"
                    >
                      <div className="font-semibold text-slate-900 group-hover:text-purple-900 mb-1">
                        {customer.first_name} {customer.last_name}
                      </div>
                      <div className="text-sm text-slate-600 group-hover:text-purple-700">
                        {customer.email}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!searchQuery && (
                <div className="text-center py-12">
                  <Search className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Start typing to search for customers</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Calendly View
  if (view === 'calendly') {
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Header */}
        <div className="bg-white border-b border-purple-100 shadow-sm p-6 shrink-0">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Selection
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
            Book ID Verification Appointment
          </h1>
          {selectedCustomer && (
            <div className="inline-flex items-center gap-2 bg-violet-100 border border-violet-200 px-3 py-1.5 rounded-lg">
              <Users className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-semibold text-violet-900">
                {selectedCustomer.first_name} {selectedCustomer.last_name}
              </span>
            </div>
          )}
        </div>

        {/* Calendly Embed */}
        <div className="flex-1 overflow-hidden">
          <iframe
            src={getCalendlyUrl()}
            width="100%"
            height="100%"
            frameBorder="0"
            className="w-full h-full"
          />
        </div>
      </div>
    )
  }

  return null
}

