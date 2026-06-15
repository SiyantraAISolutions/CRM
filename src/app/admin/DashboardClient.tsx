'use client'

import { useState } from 'react'
import { Trophy, Users, ShoppingCart, Ticket, HelpCircle, Clock, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'

type ActivityStatus = 'available' | 'break' | 'lunch' | 'toilet' | 'training'

interface LeaderboardEntry {
  user_id: string
  full_name: string
  orders: number
}

interface Props {
  stats: { totalToday: number; paidToday: number; openTickets: number; helpRequests: number }
  leaderboard: LeaderboardEntry[]
  currentUserId: string
}

const activityButtons: { status: ActivityStatus; label: string; colorClass: string; activeClass: string }[] = [
  { status: 'break', label: 'Start Break', colorClass: 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100', activeClass: 'bg-amber-600 border-amber-600 text-white hover:bg-amber-700' },
  { status: 'lunch', label: 'Start Lunch', colorClass: 'border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100', activeClass: 'bg-orange-600 border-orange-600 text-white hover:bg-orange-700' },
  { status: 'toilet', label: 'Toilet Break', colorClass: 'border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100', activeClass: 'bg-gray-600 border-gray-600 text-white hover:bg-gray-700' },
  { status: 'training', label: 'Start Training', colorClass: 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100', activeClass: 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700' },
]

export default function DashboardClient({ stats, leaderboard, currentUserId }: Props) {
  const [activeStatus, setActiveStatus] = useState<ActivityStatus | null>(null)
  const [statusStart, setStatusStart] = useState<Date | null>(null)
  const supabase = createClient()

  async function handleActivityToggle(status: ActivityStatus) {
    if (activeStatus === status) {
      await supabase.from('activity_logs').insert({
        user_id: currentUserId,
        status: status,
        started_at: statusStart?.toISOString(),
        ended_at: new Date().toISOString(),
      })
      await supabase.from('users').update({ current_status: 'available' }).eq('id', currentUserId)
      setActiveStatus(null)
      setStatusStart(null)
    } else {
      if (activeStatus) {
        await supabase.from('activity_logs').insert({
          user_id: currentUserId,
          status: activeStatus,
          started_at: statusStart?.toISOString(),
          ended_at: new Date().toISOString(),
        })
      }
      await supabase.from('users').update({ current_status: status }).eq('id', currentUserId)
      setActiveStatus(status)
      setStatusStart(new Date())
    }
  }

  const sortedLeaderboard = [...leaderboard].sort((a, b) => b.orders - a.orders)
  const totalOrders = leaderboard.reduce((sum, e) => sum + e.orders, 0)

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 rounded-xl px-6 py-5 text-white shadow-md flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-bold tracking-tight">Welcome to KWS Management Services CRM</h1>
          <p className="text-xs text-indigo-100/90 font-medium">Take calls, process orders, and stay synced with your daily team targets.</p>
        </div>
        <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-sm border border-white/10">
          <Clock className="h-3.5 w-3.5" />
          Shift Status Active
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={<ShoppingCart className="h-5 w-5 text-indigo-600" />}
          label="Active Cases"
          value={stats.totalToday}
          iconBg="bg-indigo-50"
        />
        <StatCard
          icon={<ShoppingCart className="h-5 w-5 text-emerald-600" />}
          label="Pending Documents"
          value={stats.paidToday}
          iconBg="bg-emerald-50"
        />
        <StatCard
          icon={<Ticket className="h-5 w-5 text-amber-600" />}
          label="Tasks Due Today"
          value={stats.openTickets}
          iconBg="bg-amber-50"
        />
        <StatCard
          icon={<HelpCircle className="h-5 w-5 text-rose-600" />}
          label="Help Requests"
          value={stats.helpRequests}
          iconBg="bg-rose-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Trophy className="h-4.5 w-4.5 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-800 tracking-tight">Today&apos;s Leaderboard</h2>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Real-time</span>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 font-medium text-xs border-b border-slate-100">
                  <th className="text-left pb-3 uppercase tracking-wider font-semibold">Rank & Agent</th>
                  <th className="text-right pb-3 uppercase tracking-wider font-semibold">Orders Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedLeaderboard.map((entry, i) => (
                  <tr key={entry.user_id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center",
                          i === 0 ? "bg-amber-50 text-amber-600 border border-amber-200" :
                          i === 1 ? "bg-slate-100 text-slate-600" :
                          i === 2 ? "bg-orange-50 text-orange-600" : "text-slate-400"
                        )}>
                          {i + 1}
                        </span>
                        <Avatar label={entry.full_name} size="sm" />
                        <span className="font-semibold text-slate-700 group-hover:text-slate-900">{entry.full_name}</span>
                        {i === 0 && <Trophy className="h-3.5 w-3.5 text-amber-500 animate-bounce" />}
                      </div>
                    </td>
                    <td className="py-3.5 text-right font-bold text-slate-800">{entry.orders}</td>
                  </tr>
                ))}
                {sortedLeaderboard.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-12 text-center text-sm text-slate-400">
                      No orders registered yet today. Let&apos;s get started!
                    </td>
                  </tr>
                )}
              </tbody>
              {sortedLeaderboard.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-100">
                    <td className="py-3 font-semibold text-slate-500">Cumulative Daily Total</td>
                    <td className="py-3 text-right font-black text-slate-900 text-base">{totalOrders}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Your Activity */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="h-4.5 w-4.5 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-800 tracking-tight">Your Session Activity</h2>
          </div>

          {activeStatus ? (
            <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm text-indigo-800">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                <span>Active Status: <strong className="capitalize">{activeStatus}</strong></span>
              </div>
              {statusStart && (
                <div className="mt-1.5 text-xs text-indigo-500 font-medium">
                  Timer started at {statusStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-emerald-800 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Available & Processing Cases</span>
            </div>
          )}

          <div className="flex flex-col gap-2.5 flex-1 justify-center">
            {activityButtons.map((btn) => (
              <button
                key={btn.status}
                onClick={() => handleActivityToggle(btn.status)}
                className={cn(
                  'w-full py-3 px-4 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer text-center',
                  activeStatus === btn.status
                    ? btn.activeClass + ' shadow-sm scale-[0.98]'
                    : btn.colorClass
                )}
              >
                {activeStatus === btn.status
                  ? `End ${btn.label.replace('Start ', '')}`
                  : btn.label}
              </button>
            ))}

            {activeStatus && (
              <button
                onClick={() => handleActivityToggle(activeStatus)}
                className="w-full mt-3 py-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer shadow-sm shadow-indigo-100 flex items-center justify-center gap-1.5"
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

function StatCard({ icon, label, value, iconBg }: { icon: React.ReactNode; label: string; value: number; iconBg: string }) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-5 hover:shadow-md transition-all duration-300 flex items-center gap-4 group">
      <div className={cn("rounded-xl p-3 transition-transform duration-300 group-hover:scale-105", iconBg)}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-800 tracking-tight">{value}</div>
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-0.5">{label}</div>
      </div>
    </div>
  )
}
