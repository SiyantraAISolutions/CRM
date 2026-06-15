'use client'

import { useState } from 'react'
import { Target, TrendingUp, Users, CalendarClock, Clock, ArrowRight } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type ActivityStatus = 'available' | 'break' | 'lunch' | 'toilet' | 'training'

interface FollowUp {
  id: string
  customer_name: string | null
  email: string | null
  follow_up_at: string | null
}

interface Props {
  userId: string
  userName: string
  activeLeads: number
  convertedToday: number
  salesTotalMonth: number
  salesTargetMonth: number
  followUps: FollowUp[]
}

const activityButtons: { status: ActivityStatus; label: string; colorClass: string; activeClass: string }[] = [
  { status: 'break', label: 'Break', colorClass: 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100', activeClass: 'bg-amber-600 border-amber-600 text-white' },
  { status: 'lunch', label: 'Lunch', colorClass: 'border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100', activeClass: 'bg-orange-600 border-orange-600 text-white' },
  { status: 'toilet', label: 'Toilet', colorClass: 'border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100', activeClass: 'bg-gray-600 border-gray-600 text-white' },
  { status: 'training', label: 'Training', colorClass: 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100', activeClass: 'bg-indigo-600 border-indigo-600 text-white' },
]

export default function SalesDashboardClient({
  userId, userName, activeLeads, convertedToday, salesTotalMonth, salesTargetMonth, followUps,
}: Props) {
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
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-xl px-6 py-5 text-white shadow-md flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-bold tracking-tight">Good to see you, {userName}</h1>
          <p className="text-xs text-emerald-100/90 font-medium">Keep track of your leads, follow ups, and hit your monthly target.</p>
        </div>
        <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-sm border border-white/10">
          <TrendingUp className="h-3.5 w-3.5" />
          KWS Management Services CRM
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-100 rounded-xl p-5 hover:shadow-md transition-all duration-300 flex items-center gap-4 group">
          <div className="rounded-xl bg-blue-50 p-3 group-hover:scale-105 transition-transform"><Users className="h-5 w-5 text-blue-600" /></div>
          <div>
            <div className="text-2xl font-bold text-slate-800 tracking-tight">{activeLeads}</div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Active Leads</div>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-5 hover:shadow-md transition-all duration-300 flex items-center gap-4 group">
          <div className="rounded-xl bg-emerald-50 p-3 group-hover:scale-105 transition-transform"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
          <div>
            <div className="text-2xl font-bold text-slate-800 tracking-tight">{convertedToday}</div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Converted Today</div>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-5 hover:shadow-md transition-all duration-300 flex items-center gap-4 group">
          <div className="rounded-xl bg-teal-50 p-3 group-hover:scale-105 transition-transform"><Target className="h-5 w-5 text-teal-600" /></div>
          <div>
            <div className="text-2xl font-bold text-slate-800 tracking-tight">{formatCurrency(salesTotalMonth)}</div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Sales This Month</div>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-xl p-5 hover:shadow-md transition-all duration-300 flex items-center gap-4 group">
          <div className="rounded-xl bg-amber-50 p-3 group-hover:scale-105 transition-transform"><Target className="h-5 w-5 text-amber-600" /></div>
          <div>
            <div className="text-2xl font-bold text-slate-800 tracking-tight">
              {salesTargetMonth > 0 ? formatCurrency(salesTargetMonth) : '—'}
            </div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Monthly Target</div>
          </div>
        </div>
      </div>

      {/* Target progress */}
      {salesTargetMonth > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">Monthly Target Progress</span>
            <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{targetPct}%</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden border border-slate-50">
            <div
              className={cn('h-full rounded-full transition-all duration-500 shadow-sm', targetPct >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600')}
              style={{ width: `${targetPct}%` }}
            />
          </div>
          <div className="text-xs font-medium text-slate-400 mt-2">
            {formatCurrency(salesTotalMonth)} completed of {formatCurrency(salesTargetMonth)} target
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Follow-ups due today */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4.5 w-4.5 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800 tracking-tight">Follow-ups Today</h2>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Action required</span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] pr-2">
            {followUps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-sm">
                <CalendarClock className="h-8 w-8 text-slate-300 mb-2" />
                <p>All clean! No follow-ups scheduled for today.</p>
              </div>
            ) : (
              followUps.map(f => (
                <div key={f.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 hover:bg-slate-50/50 transition-colors">
                  <div>
                    <div className="text-sm font-bold text-slate-800">{f.customer_name ?? 'Unknown'}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{f.email}</div>
                  </div>
                  {f.follow_up_at && (
                    <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg">
                      {new Date(f.follow_up_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Activity controls */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="h-4.5 w-4.5 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800 tracking-tight">Session Activity</h2>
          </div>

          {activeStatus ? (
            <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50/50 p-4 text-sm text-amber-800">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span>Current Status: <strong className="capitalize">{activeStatus}</strong></span>
              </div>
              {statusStart && <div className="mt-1.5 text-xs text-amber-500 font-medium">since {statusStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>}
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-emerald-800 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Available & Receiving Leads</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 flex-1 justify-center items-center">
            {activityButtons.map(btn => (
              <button
                key={btn.status}
                onClick={() => handleActivity(btn.status)}
                className={cn(
                  'py-3 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer text-center',
                  activeStatus === btn.status
                    ? btn.activeClass + ' shadow-sm scale-[0.98]'
                    : btn.colorClass
                )}
              >
                {activeStatus === btn.status ? `End ${btn.label}` : `Start ${btn.label}`}
              </button>
            ))}

            {activeStatus && (
              <button
                onClick={() => handleActivity(activeStatus)}
                className="col-span-2 w-full mt-3 py-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-sm shadow-emerald-100 flex items-center justify-center gap-1.5"
              >
                Back to Available <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
