'use client'

import { useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { formatCurrency, cn } from '@/lib/utils'
import { TrendingUp, ShoppingCart, PieChart as PieIcon, Users } from 'lucide-react'

interface Order { id: string; status: string; amount_total: number; created_at: string; business_id: string }
interface Payment { id: string; amount: number; status: string; created_at: string; business_id: string }
interface Enquiry { id: string; pipeline_stage: string; created_at: string; business_id: string }
interface Business { id: string; name: string; colour?: string }

const BUSINESS_COLORS = ['#4f46e5', '#10b981', '#06b6d4', '#f59e0b', '#ec4899']

export default function DirectorClient({ orders, payments, enquiries, businesses }: {
  orders: Order[]; payments: Payment[]; enquiries: Enquiry[]; businesses: Business[]
}) {
  // Revenue by day (last 30 days)
  const revenueByDay = useMemo(() => {
    const map: Record<string, number> = {}
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000)
      const key = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      map[key] = 0
    }
    payments.filter(p => p.status === 'cleared').forEach(p => {
      const key = new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      if (map[key] !== undefined) map[key] += Number(p.amount)
    })
    return Object.entries(map).map(([date, revenue]) => ({ date, revenue }))
  }, [payments])

  // Orders by status
  const ordersByStatus = useMemo(() => {
    const map: Record<string, number> = {}
    orders.forEach(o => { map[o.status] = (map[o.status] ?? 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [orders])

  // Revenue by business
  const revenueByBusiness = useMemo(() => {
    return businesses.map((b, i) => ({
      name: b.name,
      revenue: payments
        .filter(p => p.business_id === b.id && p.status === 'cleared')
        .reduce((s, p) => s + Number(p.amount), 0),
      orders: orders.filter(o => o.business_id === b.id).length,
      color: b.colour ?? BUSINESS_COLORS[i % BUSINESS_COLORS.length],
    }))
  }, [businesses, payments, orders])

  // Enquiry funnel
  const enquiryFunnel = useMemo(() => {
    const stages = ['new', 'contacted', 'quoted', 'won', 'lost']
    return stages.map(stage => ({
      stage: stage.charAt(0).toUpperCase() + stage.slice(1),
      count: enquiries.filter(e => e.pipeline_stage === stage).length,
    }))
  }, [enquiries])

  // Summary stats
  const totalRevenue = payments.filter(p => p.status === 'cleared').reduce((s, p) => s + Number(p.amount), 0)
  const totalOrders = orders.length
  const paidOrders = orders.filter(o => o.status === 'paid').length
  const conversionRate = totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 100) : 0
  const wonEnquiries = enquiries.filter(e => e.pipeline_stage === 'won').length

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          label="Revenue (30d)"
          value={formatCurrency(totalRevenue)}
          iconBg="bg-emerald-50"
        />
        <KPICard
          icon={<ShoppingCart className="h-5 w-5 text-indigo-600" />}
          label="Orders (30d)"
          value={String(totalOrders)}
          iconBg="bg-indigo-50"
        />
        <KPICard
          icon={<PieIcon className="h-5 w-5 text-amber-600" />}
          label="Conversion Rate"
          value={`${conversionRate}%`}
          iconBg="bg-amber-50"
        />
        <KPICard
          icon={<Users className="h-5 w-5 text-sky-600" />}
          label="Enquiries Won (30d)"
          value={String(wonEnquiries)}
          iconBg="bg-sky-50"
        />
      </div>

      {/* Revenue trend */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-800 tracking-tight mb-4">Revenue Trend — Last 30 Days</h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={revenueByDay}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }}
              interval={Math.floor(revenueByDay.length / 6)} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(value: any) => typeof value === 'number' ? `£${value}` : value} />
            <Tooltip formatter={(value: any) => typeof value === 'number' ? formatCurrency(value) : value} labelStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.5}
              fill="url(#colorRevenue)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by business */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-800 tracking-tight mb-4">Revenue by Business</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueByBusiness}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(value: any) => typeof value === 'number' ? `£${value}` : value} />
              <Tooltip formatter={(value: any) => typeof value === 'number' ? formatCurrency(value) : value} />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {revenueByBusiness.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Orders by status */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-800 tracking-tight mb-4">Orders by Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={ordersByStatus} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) =>
                  `${name} ${Math.round((percent ?? 0) * 100)}%`}
                labelLine={false}>
                {ordersByStatus.map((_, i) => (
                  <Cell key={i} fill={['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#64748b', '#4f46e5'][i % 6]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Enquiry funnel */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-800 tracking-tight mb-4">Enquiry Pipeline (30d)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={enquiryFunnel} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: '#475569' }} width={80} />
            <Tooltip />
            <Bar dataKey="count" fill="#4f46e5" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function KPICard({ icon, label, value, iconBg }: { icon: React.ReactNode; label: string; value: string; iconBg: string }) {
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-5 hover:shadow-md transition-all duration-300 flex items-center gap-4 group">
      <div className={cn("rounded-xl p-3 transition-transform duration-300 group-hover:scale-105", iconBg)}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-800 tracking-tight">{value}</div>
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">{label}</div>
      </div>
    </div>
  )
}
