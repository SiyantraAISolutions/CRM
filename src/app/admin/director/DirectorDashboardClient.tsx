'use client'

import { Trophy, TrendingUp, Clock, Users, BarChart2, ShoppingCart, ArrowUpRight } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format, parseISO } from 'date-fns'

interface Props {
  revenue: number
  netRevenue: number
  pendingClearance: number
  profit: number
  orderCountMonth: number
  conversionRate: number
  leaderboard: { user_id: string; full_name: string; orders: number }[]
  teamActivity: { id: string; full_name: string; current_status: string | null; status_started_at: string | null }[]
  revenueByDay: { created_at: string; amount_total: number }[]
}

function kpiCard(label: string, value: string, sub?: string, icon?: React.ReactNode) {
  return (
    <div className="panel flex items-center gap-4">
      {icon && <div className="rounded-lg bg-surface-gray-1 p-2.5">{icon}</div>}
      <div>
        <div className="text-2xl font-bold text-ink-gray-9">{value}</div>
        <div className="text-xs text-ink-gray-5 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-ink-gray-4">{sub}</div>}
      </div>
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-success-green',
  break:     'bg-warning-orange',
  lunch:     'bg-warning-orange',
  toilet:    'bg-outline-gray-3',
  training:  'bg-accent-blue',
}

export default function DirectorDashboardClient({
  revenue, netRevenue, pendingClearance, profit, orderCountMonth, conversionRate,
  leaderboard, teamActivity, revenueByDay,
}: Props) {
  // Build chart data: group revenue by day
  const dayMap: Record<string, number> = {}
  for (const row of revenueByDay) {
    const day = format(parseISO(row.created_at), 'MMM d')
    dayMap[day] = (dayMap[day] ?? 0) + Number(row.amount_total)
  }
  const chartData = Object.entries(dayMap)
    .slice(-30)
    .map(([date, amount]) => ({ date, amount }))

  const sorted = [...leaderboard].sort((a, b) => b.orders - a.orders)

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCard('Revenue (Month)', formatCurrency(revenue), undefined, <TrendingUp className="h-5 w-5 text-success-green" />)}
        {kpiCard('Net Revenue', formatCurrency(netRevenue), 'After fees', <TrendingUp className="h-5 w-5 text-accent-blue" />)}
        {kpiCard('Pending Clearance', formatCurrency(pendingClearance), undefined, <Clock className="h-5 w-5 text-warning-orange" />)}
        {kpiCard('Est. Profit', formatCurrency(profit), undefined, <BarChart2 className="h-5 w-5 text-ink-gray-5" />)}
        {kpiCard('Orders (Month)', String(orderCountMonth), undefined, <ShoppingCart className="h-5 w-5 text-accent-blue" />)}
        {kpiCard('Conversion Rate', `${conversionRate}%`, 'Enquiry → Order', <ArrowUpRight className="h-5 w-5 text-success-green" />)}
      </div>

      {/* Revenue trend chart */}
      <div className="panel">
        <div className="text-sm font-semibold text-ink-gray-9 mb-4">Revenue — Last 30 Days</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value: any) => typeof value === 'number' ? `£${value}` : value} />
            <Tooltip formatter={(value: any) => typeof value === 'number' ? [formatCurrency(value), 'Revenue'] : [value, 'Revenue']} />
            <Line type="monotone" dataKey="amount" stroke="#1d4ed8" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Leaderboard */}
        <div className="panel">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <div className="text-sm font-semibold text-ink-gray-9">Today&apos;s Leaderboard</div>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {sorted.map((entry, i) => (
                <tr key={entry.user_id} className="border-t border-outline-gray-2">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-ink-gray-4 w-4">{i + 1}</span>
                      <Avatar label={entry.full_name} size="sm" />
                      <span className="font-medium text-ink-gray-9">{entry.full_name}</span>
                      {i === 0 && <Trophy className="h-3.5 w-3.5 text-yellow-500" />}
                    </div>
                  </td>
                  <td className="py-2.5 text-right font-semibold">{entry.orders}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={2} className="py-6 text-center text-sm text-ink-gray-4">No orders yet today</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Team Activity */}
        <div className="panel">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-ink-gray-5" />
            <div className="text-sm font-semibold text-ink-gray-9">Team Activity</div>
          </div>
          <div className="space-y-2">
            {teamActivity.map(member => (
              <div key={member.id} className="flex items-center gap-3">
                <Avatar label={member.full_name} size="sm" />
                <span className="flex-1 text-sm text-ink-gray-9">{member.full_name}</span>
                <span className={cn(
                  'h-2 w-2 rounded-full',
                  STATUS_COLORS[member.current_status ?? 'available'] ?? 'bg-outline-gray-3'
                )} />
                <span className="text-xs text-ink-gray-4 capitalize">{member.current_status ?? 'available'}</span>
              </div>
            ))}
            {teamActivity.length === 0 && (
              <p className="text-sm text-ink-gray-4 py-4 text-center">No other team members</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
