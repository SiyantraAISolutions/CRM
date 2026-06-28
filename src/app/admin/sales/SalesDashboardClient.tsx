'use client'

import { useState } from 'react'
import { Target, TrendingUp, Users, CalendarClock, Clock, ArrowRight, UserCheck, CheckCircle2, Phone, ShoppingCart, FileText, ChevronRight } from 'lucide-react'
import { formatCurrency, cn, formatDateTime } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type ActivityStatus = 'available' | 'break' | 'lunch' | 'toilet' | 'training'

interface FollowUp {
  id: string
  customer_name: string | null
  email: string | null
  follow_up_at: string | null
}

interface Order {
  id: string
  first_name: string | null
  last_name: string | null
  amount_total: number
  created_at: string
  status: string
  brand?: any
  form_type?: any
}

interface Enquiry {
  id: string
  customer_name: string | null
  email: string | null
  phone: string | null
  pipeline_stage: string
  created_at: string
  brand?: any
}

interface Props {
  userId: string
  userName: string
  activeLeads: number
  convertedToday: number
  salesTotalMonth: number
  salesTargetMonth: number
  followUps: FollowUp[]
  recentOrders: Order[]
  activeEnquiries: Enquiry[]
}

const activityButtons: { status: ActivityStatus; label: string; colorClass: string; activeClass: string }[] = [
  { status: 'break', label: 'Break', colorClass: 'border-purple-100 text-slate-600 bg-white hover:bg-purple-50 hover:border-purple-200', activeClass: 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm' },
  { status: 'lunch', label: 'Lunch', colorClass: 'border-purple-100 text-slate-600 bg-white hover:bg-purple-50 hover:border-purple-200', activeClass: 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm' },
  { status: 'toilet', label: 'Toilet', colorClass: 'border-purple-100 text-slate-600 bg-white hover:bg-purple-50 hover:border-purple-200', activeClass: 'bg-slate-100 border-slate-300 text-slate-700 shadow-sm' },
  { status: 'training', label: 'Training', colorClass: 'border-purple-100 text-slate-600 bg-white hover:bg-purple-50 hover:border-purple-200', activeClass: 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm' },
]

export default function SalesDashboardClient({
  userId,
  userName,
  activeLeads,
  convertedToday,
  salesTotalMonth,
  salesTargetMonth,
  followUps,
  recentOrders,
  activeEnquiries,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [activeStatus, setActiveStatus] = useState<ActivityStatus | null>(null)
  const [statusStart, setStatusStart] = useState<Date | null>(null)

  const targetPct = salesTargetMonth > 0 ? Math.min(100, Math.round((salesTotalMonth / salesTargetMonth) * 100)) : 0

  async function handleActivity(status: ActivityStatus) {
    if (activeStatus === status) {
      await supabase.from('activity_logs').insert({ user_id: userId, status, started_at: statusStart?.toISOString(), ended_at: new Date().toISOString() })
      await supabase.from('users').update({ current_status: 'available' }).eq('id', userId)
      setActiveStatus(null); setStatusStart(null)
    } else {
      if (activeStatus) {
        await supabase.from('activity_logs').insert({ user_id: userId, status: activeStatus, started_at: statusStart?.toISOString(), ended_at: new Date().toISOString() })
      }
      await supabase.from('users').update({ current_status: status }).eq('id', userId)
      setActiveStatus(status); setStatusStart(new Date())
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#f8f7fc] text-slate-900">
      
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 px-8 py-8 shadow-xl">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 h-80 w-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 -mb-12 h-64 w-64 rounded-full bg-purple-300/10 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-semibold text-white/90">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sales Desk Active
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Good day, {userName}
            </h1>
            <p className="text-sm text-purple-100 max-w-xl font-medium leading-relaxed">
              Track and convert incoming customer leads, monitor scheduled call backs, and manage your monthly conversion milestones.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 self-start md:self-auto">
            <TrendingUp className="h-4 w-4 text-purple-200 animate-pulse" />
            <div className="text-left">
              <div className="text-[10px] text-purple-200 font-bold uppercase tracking-wider">Target Status</div>
              <div className="text-xs font-bold text-white">{targetPct}% Cleared</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-purple-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-4 group">
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3.5 group-hover:scale-105 transition-transform"><Users className="h-5 w-5 text-blue-600" /></div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight group-hover:text-purple-700 transition-colors">{activeLeads}</div>
            <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mt-1">Active Leads</div>
          </div>
        </div>

        <div className="bg-white border border-purple-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-4 group">
          <div className="rounded-xl bg-violet-50 border border-violet-100 p-3.5 group-hover:scale-105 transition-transform"><UserCheck className="h-5 w-5 text-violet-600" /></div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight group-hover:text-violet-700 transition-colors">{convertedToday}</div>
            <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mt-1">Converted Today</div>
          </div>
        </div>

        <div className="bg-white border border-purple-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-4 group">
          <div className="rounded-xl bg-purple-50 border border-purple-100 p-3.5 group-hover:scale-105 transition-transform"><TrendingUp className="h-5 w-5 text-purple-600" /></div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight group-hover:text-purple-700 transition-colors">{formatCurrency(salesTotalMonth)}</div>
            <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mt-1">Sales (Month)</div>
          </div>
        </div>

        <div className="bg-white border border-purple-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-4 group">
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3.5 group-hover:scale-105 transition-transform"><Target className="h-5 w-5 text-amber-600" /></div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight group-hover:text-amber-700 transition-colors">
              {salesTargetMonth > 0 ? formatCurrency(salesTargetMonth) : '—'}
            </div>
            <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mt-1">Monthly Target</div>
          </div>
        </div>
      </div>

      {/* Target progress */}
      {salesTargetMonth > 0 && (
        <div className="bg-white border border-purple-100 rounded-2xl shadow-sm p-6 hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Monthly Target Progress</span>
              <span className="text-[11px] text-slate-500 font-medium">Accumulated sales value vs target</span>
            </div>
            <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-3 py-1 rounded-lg border border-purple-200">{targetPct}% Complete</span>
          </div>
          <div className="h-3.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200 p-[2px]">
            <div
              className={cn('h-full rounded-full transition-all duration-500', targetPct >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-purple-500 to-violet-500')}
              style={{ width: `${targetPct}%` }}
            />
          </div>
          <div className="text-xs font-semibold text-slate-500 mt-2.5">
            {formatCurrency(salesTotalMonth)} completed of {formatCurrency(salesTargetMonth)} target
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Follow-ups due today */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-purple-100 shadow-sm p-6 hover:shadow-md transition-all duration-300 flex flex-col">
          <div className="flex items-center justify-between mb-6 border-b border-purple-50 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-50 border border-violet-100 text-violet-600">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">Follow-ups Today</h2>
                <p className="text-[11px] text-slate-500 font-medium">Scheduled callback reminders and customer touchpoints</p>
              </div>
            </div>
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">Action required</span>
          </div>

          <div className="flex-1 space-y-3.5 overflow-y-auto max-h-[320px] pr-1 scrollbar-thin">
            {followUps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-xs gap-2">
                <div className="p-3 rounded-full bg-slate-50 text-slate-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <p className="font-semibold text-slate-600">All Clean!</p>
                <p className="text-[11px] text-slate-500">No follow-ups scheduled for today.</p>
              </div>
            ) : (
              followUps.map(f => (
                <div key={f.id} className="flex items-center justify-between rounded-xl border border-purple-100 px-4 py-3.5 hover:bg-purple-50/40 transition-colors">
                  <div>
                    <div className="text-xs font-bold text-slate-800">{f.customer_name ?? 'Unknown'}</div>
                    <div className="text-[11px] text-slate-500 mt-1 font-medium">{f.email}</div>
                  </div>
                  {f.follow_up_at && (
                    <span className="text-[10px] font-bold px-3 py-1.5 bg-purple-50 text-purple-700 rounded-xl border border-purple-200 shadow-sm flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-purple-600" />
                      {new Date(f.follow_up_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Activity controls */}
        <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-6 hover:shadow-md transition-all duration-300 flex flex-col">
          <div className="flex items-center gap-3 mb-6 border-b border-purple-50 pb-4">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Presence Management</h2>
              <p className="text-[11px] text-slate-500 font-medium">Configure your active operational presence</p>
            </div>
          </div>

          {activeStatus ? (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[11px] text-amber-800 shadow-sm">
              <div className="flex items-center gap-2 font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span>Active Break State: <strong className="capitalize text-amber-900">{activeStatus}</strong></span>
              </div>
              {statusStart && <div className="mt-1.5 text-amber-600 font-medium">Timer active since {statusStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>}
            </div>
          ) : (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[11px] text-emerald-800 flex items-center gap-2.5 shadow-sm font-semibold">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Available & Routing Inbound Leads</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 flex-1 justify-center items-center">
            {activityButtons.map(btn => (
              <button
                key={btn.status}
                onClick={() => handleActivity(btn.status)}
                className={cn(
                  'py-3.5 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer text-center',
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
                className="col-span-2 w-full mt-3 py-3.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                Back to Available <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sales Agent: Enquiries and Orders Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Active Call Enquiries */}
        <div className="bg-white border border-slate-200 rounded-md shadow-sm p-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-[16px] font-bold text-[#0B1B3A] flex items-center gap-2">
              <Phone className="h-5 w-5 text-indigo-600" /> Active Call Enquiries ({activeEnquiries.length})
            </h3>
            <button onClick={() => router.push('/admin/enquiries')} className="text-xs font-bold text-purple-600 hover:text-purple-800">
              View All →
            </button>
          </div>

          {activeEnquiries.length === 0 ? (
            <p className="text-xs font-medium text-slate-400 py-8 text-center">No active enquiries assigned to you</p>
          ) : (
            <div className="space-y-3">
              {activeEnquiries.map(enq => (
                <div key={enq.id} className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => router.push(`/admin/enquiries/${enq.id}`)}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-800 truncate">{enq.customer_name || 'No Name'}</h4>
                      {enq.brand && (
                        <span className="text-[9px] font-bold bg-white text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded uppercase">
                          {enq.brand.code}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{enq.email || enq.phone || 'No Contact Details'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded capitalize shrink-0">
                      {enq.pipeline_stage}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Orders */}
        <div className="bg-white border border-slate-200 rounded-md shadow-sm p-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-[16px] font-bold text-[#0B1B3A] flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-emerald-600" /> My Orders ({recentOrders.length})
            </h3>
            <button onClick={() => router.push('/admin/orders')} className="text-xs font-bold text-purple-600 hover:text-purple-800">
              View All →
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <p className="text-xs font-medium text-slate-400 py-8 text-center">No orders associated with you yet</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map(order => {
                const customerName = `${order.first_name || ''} ${order.last_name || ''}`.trim()
                return (
                  <div key={order.id} className="p-3 bg-slate-50 border border-slate-100 rounded-lg hover:border-purple-200 hover:bg-slate-100/50 transition-all flex items-center justify-between group cursor-pointer" onClick={() => router.push(`/admin/orders/${order.id}`)}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {customerName || 'Unknown Customer'}
                        </span>
                        {order.brand && (
                          <span className="text-[9px] font-bold bg-white text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded uppercase">
                            {order.brand.code}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 font-semibold">
                        {order.form_type?.name || 'Document Fee'} — {formatCurrency(order.amount_total)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      View <ChevronRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
