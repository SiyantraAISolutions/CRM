'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { formatCurrency, cn } from '@/lib/utils'
import {
  TrendingUp, ShoppingCart, PieChart as PieIcon, Users, Trophy,
  Target, CheckSquare, Clock, Plus, ChevronRight, UserCheck,
  AlertCircle, BarChart2, ArrowUpRight, Zap, X, Calendar, Activity,
  Coffee, Utensils, Construction, CheckCircle2
} from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import { createClient } from '@/lib/supabase/client'

interface Order { id: string; status: string; amount_total: number; created_at: string; business_id: string; user_id: string }
interface Payment { id: string; amount: number; status: string; created_at: string; business_id: string }
interface Enquiry { id: string; pipeline_stage: string; created_at: string; business_id: string; assigned_to: string }
interface Business { id: string; name: string; colour?: string }
interface TeamMember { id: string; full_name: string; role: string; sales_target: number; current_status: string | null; status_started_at: string | null; avatar_url?: string }
interface Task { id: string; title: string; description: string | null; assigned_to: string | null; created_by: string | null; due_at: string | null; status: string; priority: string; created_at: string }
interface ActivityLog { id: string; user_id: string; status: string; started_at: string; ended_at: string | null }

const CHART_COLORS = ['#7c3aed', '#a855f7', '#c084fc', '#8b5cf6', '#6d28d9', '#5b21b6']
const STATUS_COLORS: Record<string, string> = {
  paid: '#10b981',
  processing: '#3b82f6',
  lead: '#f59e0b',
  dead: '#ef4444',
  no_answer: '#64748b',
  abandoned: '#f97316',
}

const PRESENCE_STATUS_COLORS: Record<string, string> = {
  available: 'bg-emerald-500',
  break: 'bg-amber-500',
  lunch: 'bg-orange-500',
  toilet: 'bg-slate-400',
  training: 'bg-purple-500',
}

export default function DirectorClient({ orders, payments, enquiries, businesses, teamMembers, tasks, activityLogs }: {
  orders: Order[]; payments: Payment[]; enquiries: Enquiry[]; businesses: Business[]; teamMembers: TeamMember[]; tasks: Task[]; activityLogs: ActivityLog[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assignedTo: '', priority: 'medium', dueAt: '' })
  const [assigningTask, setAssigningTask] = useState(false)

  // ─── Computed Data ───────────────────────────────
  const salesTeam = teamMembers.filter(m => m.role === 'sales' || m.role === 'director')

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

  // Orders by status for pie chart
  const ordersByStatus = useMemo(() => {
    const map: Record<string, number> = {}
    orders.forEach(o => { map[o.status] = (map[o.status] ?? 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name: name.replace('_', ' '), value }))
  }, [orders])

  // Revenue by business
  const revenueByBusiness = useMemo(() => {
    return businesses.map((b, i) => ({
      name: b.name,
      revenue: payments
        .filter(p => p.business_id === b.id && p.status === 'cleared')
        .reduce((s, p) => s + Number(p.amount), 0),
      orders: orders.filter(o => o.business_id === b.id).length,
      color: b.colour ?? CHART_COLORS[i % CHART_COLORS.length],
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

  // Individual agent performance
  const agentPerformance = useMemo(() => {
    return salesTeam.map(member => {
      const memberOrders = orders.filter(o => o.user_id === member.id)
      const paidOrders = memberOrders.filter(o => o.status === 'paid' || o.status === 'processing')
      const totalSales = paidOrders.reduce((s, o) => s + Number(o.amount_total), 0)
      const memberEnquiries = enquiries.filter(e => e.assigned_to === member.id)
      const wonEnquiries = memberEnquiries.filter(e => e.pipeline_stage === 'won').length
      const convRate = memberOrders.length > 0 ? Math.round((paidOrders.length / memberOrders.length) * 100) : 0
      const target = Number(member.sales_target) || 0
      const targetPct = target > 0 ? Math.min(100, Math.round((totalSales / target) * 100)) : 0
      const memberTasks = tasks.filter(t => t.assigned_to === member.id)
      const completedTasks = memberTasks.filter(t => t.status === 'done').length
      const openTasks = memberTasks.filter(t => t.status !== 'done').length

      return {
        ...member,
        totalOrders: memberOrders.length,
        paidOrders: paidOrders.length,
        totalSales,
        wonEnquiries,
        convRate,
        target,
        targetPct,
        completedTasks,
        openTasks,
        totalTasks: memberTasks.length,
      }
    }).sort((a, b) => b.totalSales - a.totalSales)
  }, [salesTeam, orders, enquiries, tasks])

  // Selected agent performance detailed view
  const selectedAgent = useMemo(() => {
    if (!selectedAgentId) return null
    const agent = agentPerformance.find(a => a.id === selectedAgentId)
    if (!agent) return null

    const agentLogs = activityLogs.filter(log => log.user_id === agent.id)

    // Unique days worked (where there was active log or presence status)
    const daysSet = new Set<string>()
    agentLogs.forEach(log => {
      if (log.started_at) {
        daysSet.add(new Date(log.started_at).toLocaleDateString('en-GB'))
      }
    })
    const daysWorked = daysSet.size

    // Calculate break-time status totals in minutes
    const breakStats: Record<string, number> = { break: 0, lunch: 0, toilet: 0, training: 0, available: 0 }
    agentLogs.forEach(log => {
      if (log.started_at && log.ended_at) {
        const durationMs = new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()
        const durationMins = Math.max(0, Math.round(durationMs / 60000))
        if (breakStats[log.status] !== undefined) {
          breakStats[log.status] += durationMins
        }
      }
    })

    const agentOrders = orders.filter(o => o.user_id === agent.id)
    const agentTasks = tasks.filter(t => t.assigned_to === agent.id)

    return {
      ...agent,
      daysWorked,
      breakStats,
      recentLogs: agentLogs.slice(0, 5),
      recentOrders: agentOrders.slice(0, 5),
      tasks: agentTasks,
    }
  }, [selectedAgentId, agentPerformance, activityLogs, orders, tasks])

  // Summary stats
  const totalRevenue = payments.filter(p => p.status === 'cleared').reduce((s, p) => s + Number(p.amount), 0)
  const totalOrders = orders.length
  const paidOrders = orders.filter(o => o.status === 'paid').length
  const conversionRate = totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 100) : 0
  const wonEnquiries = enquiries.filter(e => e.pipeline_stage === 'won').length
  const openTasksCount = tasks.filter(t => t.status !== 'done').length
  const overdueTasks = tasks.filter(t => t.status !== 'done' && t.due_at && new Date(t.due_at) < new Date()).length

  // Recent tasks
  const recentTasks = [...tasks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8)

  // Handle task creation
  async function handleCreateTask() {
    if (!taskForm.title.trim() || !taskForm.assignedTo) return
    setAssigningTask(true)
    await supabase.from('tasks').insert({
      title: taskForm.title,
      description: taskForm.description || null,
      assigned_to: taskForm.assignedTo,
      priority: taskForm.priority,
      due_at: taskForm.dueAt ? new Date(taskForm.dueAt).toISOString() : null,
    })
    setTaskForm({ title: '', description: '', assignedTo: '', priority: 'medium', dueAt: '' })
    setShowTaskModal(false)
    setAssigningTask(false)
    router.refresh()
  }

  // Format minutes to readable hours/minutes
  function formatMinutes(mins: number) {
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hrs}h ${remainingMins}m`
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#f8f7fc]">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-5">
        <KPICard icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} label="Revenue (30d)" value={formatCurrency(totalRevenue)} iconBg="bg-emerald-50 border-emerald-100" trend={12} />
        <KPICard icon={<ShoppingCart className="h-5 w-5 text-purple-600" />} label="Orders (30d)" value={String(totalOrders)} iconBg="bg-purple-50 border-purple-100" trend={8} />
        <KPICard icon={<PieIcon className="h-5 w-5 text-amber-600" />} label="Conversion" value={`${conversionRate}%`} iconBg="bg-amber-50 border-amber-100" trend={-2} />
        <KPICard icon={<UserCheck className="h-5 w-5 text-violet-600" />} label="Enquiries Won" value={String(wonEnquiries)} iconBg="bg-violet-50 border-violet-100" trend={15} />
        <KPICard icon={<CheckSquare className="h-5 w-5 text-blue-600" />} label="Open Tasks" value={String(openTasksCount)} iconBg="bg-blue-50 border-blue-100" sub={overdueTasks > 0 ? `${overdueTasks} overdue` : undefined} subColor="text-rose-600" />
        <KPICard icon={<Users className="h-5 w-5 text-fuchsia-600" />} label="Active Agents" value={String(teamMembers.filter(m => m.current_status === 'available').length)} iconBg="bg-fuchsia-50 border-fuchsia-100" sub={`of ${salesTeam.length} total`} />
      </div>

      {/* Revenue trend chart */}
      <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Revenue Trend — Last 30 Days</h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Daily cleared payment volume across all businesses</p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-[10px] font-bold text-purple-700">
            <BarChart2 className="h-3 w-3" /> 30d Window
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={revenueByDay}>
            <defs>
              <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f0f9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
              interval={Math.floor(revenueByDay.length / 6)} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }} tickLine={false} axisLine={false}
              tickFormatter={(value: any) => typeof value === 'number' ? `£${value}` : value} />
            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e9e5f5', borderRadius: '12px', fontSize: '11px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
              formatter={(value: any) => typeof value === 'number' ? [formatCurrency(value), 'Revenue'] : [value, 'Revenue']} />
            <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ─── INDIVIDUAL AGENT PERFORMANCE ─── */}
      <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Individual Agent Performance</h3>
              <p className="text-[11px] text-slate-500 font-medium">Click on any card to view detailed presence logs, active days, and tasks.</p>
            </div>
          </div>
          <button
            onClick={() => setShowTaskModal(true)}
            className="text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> Assign Task
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {agentPerformance.map((agent, i) => (
            <div
              key={agent.id}
              onClick={() => setSelectedAgentId(agent.id)}
              className={cn(
                "rounded-xl border p-5 transition-all cursor-pointer hover:shadow-lg hover:border-purple-300 group",
                i === 0 ? "border-purple-200 bg-purple-50/20" : "border-purple-100 bg-white"
              )}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                {/* Agent info */}
                <div className="flex items-center gap-3 min-w-[180px]">
                  <div className="relative">
                    <Avatar label={agent.full_name} size="sm" />
                    {i === 0 && (
                      <div className="absolute -top-1 -right-1 h-4 w-4 bg-amber-400 rounded-full flex items-center justify-center shadow-sm">
                        <Trophy className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 group-hover:text-purple-700 transition-colors">{agent.full_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{agent.role}</span>
                      <span className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        PRESENCE_STATUS_COLORS[agent.current_status ?? 'available'] ?? 'bg-slate-400'
                      )} />
                      <span className="text-[9px] capitalize text-slate-500 font-medium">{agent.current_status ?? 'available'}</span>
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="flex items-center gap-6 flex-wrap">
                  <MiniStat label="Orders" value={String(agent.totalOrders)} icon={<ShoppingCart className="h-3 w-3 text-purple-500" />} />
                  <MiniStat label="Converted" value={String(agent.paidOrders)} icon={<CheckSquare className="h-3 w-3 text-emerald-500" />} />
                  <MiniStat label="Revenue" value={formatCurrency(agent.totalSales)} icon={<TrendingUp className="h-3 w-3 text-violet-500" />} />
                  <MiniStat label="Conv. Rate" value={`${agent.convRate}%`} icon={<ArrowUpRight className="h-3 w-3 text-blue-500" />} />
                  <MiniStat label="Won Leads" value={String(agent.wonEnquiries)} icon={<UserCheck className="h-3 w-3 text-fuchsia-500" />} />
                  <MiniStat label="Tasks" value={`${agent.completedTasks}/${agent.totalTasks}`} icon={<CheckSquare className="h-3 w-3 text-amber-500" />} />
                </div>
              </div>

              {/* Target progress bar */}
              {agent.target > 0 && (
                <div className="mt-4 pt-3 border-t border-purple-100/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Target className="h-3 w-3 text-purple-500" />
                      <span className="text-[10px] font-bold text-slate-700">Monthly Target</span>
                    </div>
                    <span className={cn(
                      "text-[10px] font-black px-2 py-0.5 rounded-full border",
                      agent.targetPct >= 100
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : agent.targetPct >= 75
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : agent.targetPct >= 50
                        ? "bg-amber-50 border-amber-200 text-amber-700"
                        : "bg-rose-50 border-rose-200 text-rose-700"
                    )}>
                      {agent.targetPct}% — {formatCurrency(agent.totalSales)} / {formatCurrency(agent.target)}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        agent.targetPct >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-purple-500 to-violet-500'
                      )}
                      style={{ width: `${agent.targetPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
          {agentPerformance.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-500">No sales team members found.</div>
          )}
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue by Business (Custom HTML Bar Graph) */}
        <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-6 flex flex-col">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight mb-6">Revenue by Business</h3>
          <div className="flex-1 flex items-end justify-between gap-4 h-[240px] px-2 pb-2">
            {revenueByBusiness.map((entry, i) => {
              const maxRev = Math.max(...revenueByBusiness.map(b => b.revenue), 1)
              const pct = Math.max(5, Math.round((entry.revenue / maxRev) * 100))
              return (
                <div key={i} className="flex flex-col items-center gap-3 flex-1 group">
                  <div className="relative w-full flex justify-center h-full items-end">
                    <div 
                      className="w-full max-w-[48px] rounded-t-lg transition-all duration-700 ease-out group-hover:opacity-90 relative"
                      style={{ height: `${pct}%`, backgroundColor: entry.color }}
                    >
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg z-10 pointer-events-none">
                        {formatCurrency(entry.revenue)}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 text-center uppercase tracking-wider">{entry.name}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Orders by Status (Segmented Progress Bar) */}
        <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-6">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight mb-6">Orders by Status</h3>
          <div className="h-[240px] flex flex-col justify-center">
            {/* The Stacked Bar */}
            <div className="h-6 w-full flex rounded-full overflow-hidden shadow-inner mb-8 bg-slate-100">
              {ordersByStatus.map((entry, i) => {
                const total = Math.max(ordersByStatus.reduce((sum, item) => sum + item.value, 0), 1)
                const pct = (entry.value / total) * 100
                if (pct === 0) return null
                return (
                  <div 
                    key={i} 
                    className="h-full transition-all hover:opacity-90 cursor-default"
                    style={{ 
                      width: `${pct}%`, 
                      backgroundColor: STATUS_COLORS[entry.name.replace(' ', '_')] ?? CHART_COLORS[i % CHART_COLORS.length] 
                    }}
                    title={`${entry.name}: ${entry.value} (${Math.round(pct)}%)`}
                  />
                )
              })}
            </div>

            {/* Elegant Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-2">
              {ordersByStatus.map((entry, i) => {
                const total = Math.max(ordersByStatus.reduce((sum, item) => sum + item.value, 0), 1)
                const pct = Math.round((entry.value / total) * 100)
                const color = STATUS_COLORS[entry.name.replace(' ', '_')] ?? CHART_COLORS[i % CHART_COLORS.length]
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm shadow-sm flex-shrink-0" style={{ backgroundColor: color }} />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-slate-700 capitalize truncate leading-tight">{entry.name}</div>
                      <div className="text-[10px] font-semibold text-slate-500">{entry.value} ({pct}%)</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Enquiry funnel + Recent tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enquiry pipeline (Horizontal Funnel) */}
        <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-6">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight mb-6">Enquiry Pipeline (30d)</h3>
          <div className="h-[200px] flex flex-col justify-around">
            {enquiryFunnel.map((entry, i) => {
              const maxEnq = Math.max(...enquiryFunnel.map(e => e.count), 1)
              const pct = Math.max(2, Math.round((entry.count / maxEnq) * 100))
              return (
                <div key={i} className="flex items-center gap-4 group">
                  <div className="w-20 text-right text-[11px] font-bold text-slate-600 truncate">{entry.stage}</div>
                  <div className="flex-1 bg-slate-50 h-5 rounded-full overflow-hidden flex items-center relative">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                    <div className="absolute left-3 text-[10px] font-extrabold text-white drop-shadow-md">
                      {entry.count}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent tasks */}
        <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Recent Tasks</h3>
            <button
              onClick={() => setShowTaskModal(true)}
              className="text-[10px] font-bold text-purple-700 hover:text-purple-800 flex items-center gap-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" /> New
            </button>
          </div>
          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
            {recentTasks.map(task => {
              const assignee = teamMembers.find(m => m.id === task.assigned_to)
              return (
                <div key={task.id} className="flex items-center justify-between rounded-lg border border-purple-50 px-3.5 py-2.5 hover:bg-purple-50/40 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={cn(
                      "h-2 w-2 rounded-full flex-shrink-0",
                      task.status === 'done' ? 'bg-emerald-500' : task.priority === 'high' ? 'bg-rose-500' : 'bg-amber-400'
                    )} />
                    <span className={cn(
                      "text-xs font-semibold truncate",
                      task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'
                    )}>{task.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {assignee && (
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{assignee.full_name.split(' ')[0]}</span>
                    )}
                    <span className={cn(
                      "text-[8px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                      task.status === 'done' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : task.status === 'in_progress' ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    )}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              )
            })}
            {recentTasks.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-500">No tasks found.</div>
            )}
          </div>
        </div>
      </div>

      {/* ─── INDIVIDUAL AGENT DETAILS MODAL ─── */}
      {selectedAgent && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={() => setSelectedAgentId(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white border-l border-purple-100 shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between border-b border-purple-50 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <Avatar label={selectedAgent.full_name} size="md" />
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">{selectedAgent.full_name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{selectedAgent.role}</span>
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      PRESENCE_STATUS_COLORS[selectedAgent.current_status ?? 'available'] ?? 'bg-slate-400'
                    )} />
                    <span className="text-[10px] capitalize text-slate-600 font-bold">{selectedAgent.current_status ?? 'available'}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedAgentId(null)}
                className="p-1.5 rounded-lg border border-purple-100 hover:bg-purple-50 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6">
              {/* SaaS Metrics Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 text-center">
                  <Calendar className="h-5 w-5 text-purple-600 mx-auto mb-1.5" />
                  <div className="text-xl font-black text-slate-900">{selectedAgent.daysWorked}</div>
                  <div className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mt-0.5">Days Worked (30d)</div>
                </div>
                <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 text-center">
                  <Activity className="h-5 w-5 text-violet-600 mx-auto mb-1.5" />
                  <div className="text-xl font-black text-slate-900">
                    {formatMinutes(Object.values(selectedAgent.breakStats).reduce((a, b) => a + b, 0))}
                  </div>
                  <div className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mt-0.5">Logged Hours</div>
                </div>
                <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 text-center">
                  <Trophy className="h-5 w-5 text-amber-500 mx-auto mb-1.5" />
                  <div className="text-xl font-black text-slate-900">{selectedAgent.targetPct}%</div>
                  <div className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest mt-0.5">Target Progress</div>
                </div>
              </div>

              {/* Time Breakdown Card */}
              <div className="bg-white border border-purple-100 rounded-xl p-5">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-purple-500" /> Operational Presence Breakdown (30d)
                </h4>
                <div className="space-y-3">
                  <ProgressBarLabel label="Productive Hours (Available)" mins={selectedAgent.breakStats.available} maxMins={4800} icon={<Activity className="h-3.5 w-3.5 text-emerald-500" />} barColor="bg-emerald-500" />
                  <ProgressBarLabel label="Training Sessions" mins={selectedAgent.breakStats.training} maxMins={1200} icon={<Construction className="h-3.5 w-3.5 text-purple-500" />} barColor="bg-purple-500" />
                  <ProgressBarLabel label="Lunch Break" mins={selectedAgent.breakStats.lunch} maxMins={1200} icon={<Utensils className="h-3.5 w-3.5 text-orange-500" />} barColor="bg-orange-500" />
                  <ProgressBarLabel label="Short Breaks" mins={selectedAgent.breakStats.break} maxMins={600} icon={<Coffee className="h-3.5 w-3.5 text-amber-500" />} barColor="bg-amber-500" />
                  <ProgressBarLabel label="Auxiliary / Toilet" mins={selectedAgent.breakStats.toilet} maxMins={300} icon={<Clock className="h-3.5 w-3.5 text-slate-400" />} barColor="bg-slate-400" />
                </div>
              </div>

              {/* Agent Tasks */}
              <div className="bg-white border border-purple-100 rounded-xl p-5">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <CheckSquare className="h-4 w-4 text-purple-500" /> Agent Workload Checklist ({selectedAgent.tasks.length})
                </h4>
                <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
                  {selectedAgent.tasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between rounded-lg border border-purple-50 px-3.5 py-2.5 hover:bg-purple-50/40 transition-colors">
                      <div className="min-w-0">
                        <div className={cn(
                          "text-xs font-semibold truncate",
                          task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-800'
                        )}>{task.title}</div>
                        {task.due_at && (
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">Due: {new Date(task.due_at).toLocaleDateString('en-GB')}</div>
                        )}
                      </div>
                      <span className={cn(
                        "text-[8px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                        task.status === 'done' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      )}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                  {selectedAgent.tasks.length === 0 && (
                    <div className="text-center py-6 text-xs text-slate-400">No tasks assigned to this agent.</div>
                  )}
                </div>
              </div>

              {/* Agent Recent Closed Sales */}
              <div className="bg-white border border-purple-100 rounded-xl p-5">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <ShoppingCart className="h-4 w-4 text-purple-500" /> Recent Converted Sales ({selectedAgent.recentOrders.length})
                </h4>
                <div className="space-y-2.5">
                  {selectedAgent.recentOrders.map(order => (
                    <div key={order.id} className="flex items-center justify-between rounded-lg border border-purple-50 px-3.5 py-2.5 hover:bg-purple-50/40 transition-colors">
                      <div>
                        <div className="text-xs font-bold text-slate-800">Order ID: {order.id.slice(0, 8).toUpperCase()}</div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">{new Date(order.created_at).toLocaleDateString('en-GB')}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-900">{formatCurrency(order.amount_total)}</div>
                        <span className="text-[8px] font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">{order.status}</span>
                      </div>
                    </div>
                  ))}
                  {selectedAgent.recentOrders.length === 0 && (
                    <div className="text-center py-6 text-xs text-slate-400">No recent sales recorded.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ─── ASSIGN TASK MODAL ─── */}
      {showTaskModal && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={() => setShowTaskModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-purple-100 shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Assign New Task</h3>
                  <p className="text-[11px] text-slate-500">Create and assign a task to a team member</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1.5">Task Title *</label>
                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full rounded-lg border border-purple-100 bg-white px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 transition-all"
                    placeholder="e.g. Follow up with client about FR1 form"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1.5">Description</label>
                  <textarea
                    value={taskForm.description}
                    onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full rounded-lg border border-purple-100 bg-white px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 transition-all resize-none"
                    rows={2}
                    placeholder="Optional details..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1.5">Assign To *</label>
                    <select
                      value={taskForm.assignedTo}
                      onChange={e => setTaskForm(f => ({ ...f, assignedTo: e.target.value }))}
                      className="w-full rounded-lg border border-purple-100 bg-white px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 transition-all cursor-pointer"
                    >
                      <option value="">Select member...</option>
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1.5">Priority</label>
                    <select
                      value={taskForm.priority}
                      onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
                      className="w-full rounded-lg border border-purple-100 bg-white px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 transition-all cursor-pointer"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1.5">Due Date</label>
                  <input
                    type="datetime-local"
                    value={taskForm.dueAt}
                    onChange={e => setTaskForm(f => ({ ...f, dueAt: e.target.value }))}
                    className="w-full rounded-lg border border-purple-100 bg-white px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100 transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-purple-50">
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTask}
                  disabled={assigningTask || !taskForm.title.trim() || !taskForm.assignedTo}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-1.5"
                >
                  <Zap className="h-3.5 w-3.5" />
                  {assigningTask ? 'Assigning...' : 'Assign Task'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Helper Components ─────────────────────────

function KPICard({ icon, label, value, iconBg, sub, subColor, trend }: {
  icon: React.ReactNode; label: string; value: string; iconBg: string; sub?: string; subColor?: string; trend?: number
}) {
  return (
    <div className="bg-white border border-purple-100 rounded-2xl p-5 hover:shadow-md transition-all duration-300 shadow-sm relative overflow-hidden group">
      {/* Decorative gradient blur */}
      <div className={cn("absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-20 pointer-events-none transition-opacity duration-300 group-hover:opacity-40", iconBg.split(' ')[0])} />
      
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className={cn("rounded-xl p-2.5 border shadow-sm transition-transform duration-300 group-hover:scale-105", iconBg)}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className={cn(
            "flex items-center gap-0.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full border",
            trend > 0 ? "bg-emerald-50 border-emerald-100 text-emerald-600" : trend < 0 ? "bg-rose-50 border-rose-100 text-rose-600" : "bg-slate-50 border-slate-200 text-slate-500"
          )}>
            {trend > 0 ? <TrendingUp className="h-3 w-3" /> : trend < 0 ? <TrendingUp className="h-3 w-3 rotate-180" /> : null}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      
      <div className="relative z-10">
        <div className="text-2xl font-black text-slate-900 tracking-tight mb-1">{value}</div>
        <div className="flex items-end justify-between">
          <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">{label}</div>
          {sub && <div className={cn("text-[10px] font-bold", subColor ?? "text-slate-400")}>{sub}</div>}
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="text-center min-w-[60px]">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        {icon}
        <span className="text-sm font-black text-slate-900">{value}</span>
      </div>
      <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  )
}

function ProgressBarLabel({ label, mins, maxMins, icon, barColor }: {
  label: string; mins: number; maxMins: number; icon: React.ReactNode; barColor: string
}) {
  const pct = Math.min(100, Math.round((mins / maxMins) * 100))
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
          {icon}
          <span>{label}</span>
        </div>
        <span className="font-bold text-slate-900">{pct}% ({Math.floor(mins / 60)}h {mins % 60}m)</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
