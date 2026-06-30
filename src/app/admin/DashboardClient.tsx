'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, ArrowRight, Sparkles, CheckSquare, Ticket, FileText, ChevronRight, Calendar } from 'lucide-react'
import { cn, formatDateTime, formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type ActivityStatus = 'available' | 'break' | 'lunch' | 'toilet' | 'training'

interface Task {
  id: string
  title: string
  description: string | null
  due_at: string
  priority: string
  status: string
}

interface HelpRequest {
  id: string
  subject: string
  customer_name: string | null
  customer_email: string | null
  status: string
  created_at: string
  brand?: any
}

interface PendingDoc {
  id: string
  first_name: string | null
  last_name: string | null
  amount_total: number
  created_at: string
  status: string
  brand?: any
  form_type?: any
}

interface Props {
  stats: { totalToday: number; paidToday: number; openTickets: number; helpRequests: number }
  currentUserId: string
  userName: string
  tasks: Task[]
  helpRequests: HelpRequest[]
  pendingDocs: PendingDoc[]
}

const activityButtons: { status: ActivityStatus; label: string; colorClass: string; activeClass: string }[] = [
  { status: 'break', label: 'Break', colorClass: 'border-purple-100 text-slate-600 bg-white hover:bg-purple-50 hover:border-purple-200', activeClass: 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm' },
  { status: 'lunch', label: 'Lunch', colorClass: 'border-purple-100 text-slate-600 bg-white hover:bg-purple-50 hover:border-purple-200', activeClass: 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm' },
  { status: 'toilet', label: 'Toilet', colorClass: 'border-purple-100 text-slate-600 bg-white hover:bg-purple-50 hover:border-purple-200', activeClass: 'bg-slate-100 border-slate-300 text-slate-700 shadow-sm' },
  { status: 'training', label: 'Training', colorClass: 'border-purple-100 text-slate-600 bg-white hover:bg-purple-50 hover:border-purple-200', activeClass: 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm' },
]

export default function DashboardClient({
  stats,
  currentUserId,
  userName,
  tasks,
  helpRequests,
  pendingDocs
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [activeStatus, setActiveStatus] = useState<ActivityStatus | null>(null)
  const [statusStart, setStatusStart] = useState<Date | null>(null)

  async function handleActivity(status: ActivityStatus) {
    if (activeStatus === status) {
      await supabase.from('activity_logs').insert({ user_id: currentUserId, status, started_at: statusStart?.toISOString(), ended_at: new Date().toISOString() })
      await supabase.from('users').update({ current_status: 'available' }).eq('id', currentUserId)
      setActiveStatus(null); setStatusStart(null)
    } else {
      if (activeStatus) {
        await supabase.from('activity_logs').insert({ user_id: currentUserId, status: activeStatus, started_at: statusStart?.toISOString(), ended_at: new Date().toISOString() })
      }
      await supabase.from('users').update({ current_status: status }).eq('id', currentUserId)
      setActiveStatus(status); setStatusStart(new Date())
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#f8f7fc] text-slate-900">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-700 via-violet-700 to-indigo-800 px-8 py-8 shadow-xl">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 h-80 w-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 -mb-12 h-64 w-64 rounded-full bg-purple-300/10 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-semibold text-white/90">
              <Sparkles className="h-3.5 w-3.5 text-purple-200 animate-pulse" />
              Service Desk Portal
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Welcome back, {userName}
            </h1>
            <p className="text-sm text-purple-100 max-w-xl font-medium leading-relaxed">
              Launch application wizards, view fee scales, and generate new customer orders from our complete catalog of Land Registry & Conveyancing services.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 self-start md:self-auto">
            <Clock className="h-4 w-4 text-purple-200" />
            <div className="text-left">
              <div className="text-[10px] text-purple-200 font-bold uppercase tracking-wider">System Status</div>
              <div className="text-xs font-bold text-white">Active Catalog Online</div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity controls / Presence Management */}
      <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-6 hover:shadow-md transition-all duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-50 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Presence Management</h2>
              <p className="text-[11px] text-slate-500 font-medium">Configure your active operational presence state</p>
            </div>
          </div>

          {activeStatus ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-[11px] text-amber-800 shadow-sm flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>Active Break State: <strong className="capitalize text-amber-900">{activeStatus}</strong></span>
              {statusStart && <span className="text-amber-600 ml-2 font-medium">since {statusStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-[11px] text-emerald-800 flex items-center gap-2 shadow-sm font-semibold">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Available & Routing Inbound Calls</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {activityButtons.map(btn => (
            <button
              key={btn.status}
              onClick={() => handleActivity(btn.status)}
              className={cn(
                'px-6 py-2.5 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer',
                activeStatus === btn.status
                  ? btn.activeClass + ' scale-[0.98]'
                  : btn.colorClass
              )}
            >
              {activeStatus === btn.status ? `End ${btn.label}` : `Start ${btn.label}`}
            </button>
          ))}

          {activeStatus && (
            <button
              onClick={() => handleActivity(activeStatus)}
              className="py-2.5 px-6 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              Back to Available <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Priority Tasks, Tickets & Pending Orders Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Tasks & Priority Tickets */}
        <div className="space-y-6">
          
          {/* Tasks due today */}
          <div className="bg-white border border-slate-200 rounded-md shadow-sm p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-[16px] font-bold text-[#0B1B3A] flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-indigo-600" /> Tasks Due Today ({tasks.length})
              </h3>
              <button onClick={() => router.push('/admin/tasks')} className="text-xs font-bold text-purple-600 hover:text-purple-800">
                Manage Tasks →
              </button>
            </div>
            
            {tasks.length === 0 ? (
              <p className="text-xs font-medium text-slate-400 py-4 text-center">No tasks assigned for today</p>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => (
                  <div key={task.id} className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between hover:bg-slate-100 transition-colors">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{task.title}</h4>
                      {task.description && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>}
                    </div>
                    <span className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded border tracking-wide uppercase shrink-0 ml-4",
                      task.priority === 'high' 
                        ? "bg-red-50 border-red-200 text-red-700 font-extrabold"
                        : "bg-slate-100 border-slate-200 text-slate-600"
                    )}>
                      {task.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Help Requests */}
          <div className="bg-white border border-slate-200 rounded-md shadow-sm p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-[16px] font-bold text-[#0B1B3A] flex items-center gap-2">
                <Ticket className="h-5 w-5 text-purple-600" /> Active Help Tickets ({helpRequests.length})
              </h3>
              <button onClick={() => router.push('/admin/help-requests')} className="text-xs font-bold text-purple-600 hover:text-purple-800">
                View All →
              </button>
            </div>

            {helpRequests.length === 0 ? (
              <p className="text-xs font-medium text-slate-400 py-4 text-center">No active help tickets pending</p>
            ) : (
              <div className="space-y-3">
                {helpRequests.map(req => (
                  <div key={req.id} className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => router.push(`/admin/help-requests/${req.id}`)}>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 truncate">{req.subject}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {req.customer_name || req.customer_email || 'Anonymous'}
                        {req.brand && <span className="ml-2 px-1 py-0.5 bg-slate-200 text-slate-700 text-[8px] rounded uppercase font-bold">{req.brand.code}</span>}
                      </p>
                    </div>
                    <span className="text-[9px] text-slate-400 font-semibold shrink-0 ml-4">
                      {formatDateTime(req.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Pending Orders */}
        <div className="bg-white border border-slate-200 rounded-md shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-[16px] font-bold text-[#0B1B3A] flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" /> Orders in Processing ({pendingDocs.length})
              </h3>
              <button onClick={() => router.push('/admin/orders')} className="text-xs font-bold text-purple-600 hover:text-purple-800">
                Manage Orders →
              </button>
            </div>

            {pendingDocs.length === 0 ? (
              <p className="text-xs font-medium text-slate-400 py-8 text-center">No pending orders in processing state</p>
            ) : (
              <div className="space-y-3">
                {pendingDocs.map(doc => {
                  const customerName = `${doc.first_name || ''} ${doc.last_name || ''}`.trim()
                  return (
                    <div key={doc.id} className="p-4 bg-slate-50 border border-slate-100 rounded-lg hover:border-purple-200 hover:bg-slate-100/50 transition-all flex items-center justify-between group cursor-pointer" onClick={() => router.push(`/admin/orders/${doc.id}`)}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {customerName || 'Unknown Customer'}
                          </span>
                          {doc.brand && (
                            <span className="text-[9px] font-bold bg-white text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded uppercase">
                              {doc.brand.code}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 font-semibold">
                          {doc.form_type?.name || 'Document Fee'} — {formatCurrency(doc.amount_total)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Process <ChevronRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
