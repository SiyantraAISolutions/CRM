'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Ticket, ShoppingCart, Plus, HelpCircle,
  Archive, BookOpen, Shield, LogOut, ChevronLeft, ChevronRight,
  Bell, TrendingUp, CheckSquare, CreditCard, Users, Settings,
  MessageSquare, Building2, Layers, Mail, Calendar, Activity, PieChart
} from 'lucide-react'

interface BadgeCounts {
  tickets: number
  helpRequests: number
  abandoned: number
  notifications: number
}

interface SidebarProps {
  badgeCounts?: BadgeCounts
  userRole?: string
}

export default function Sidebar({ badgeCounts, userRole = 'sales' }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)
  const [counts, setCounts] = useState(badgeCounts ?? { tickets: 0, helpRequests: 0, abandoned: 0, notifications: 0 })
  const [services, setServices] = useState<{ id: string; name: string; code: string }[]>([])
  const [servicesExpanded, setServicesExpanded] = useState(false)
  const [emailTemplates, setEmailTemplates] = useState<{ id: string; name: string }[]>([])
  const [templatesExpanded, setTemplatesExpanded] = useState(false)

  // Live badge counts via Supabase realtime
  useEffect(() => {
    async function refreshCounts() {
      const [t, h, a] = await Promise.all([
        supabase.from('tickets').select('id', { count: 'exact', head: true }).in('status', ['pending', 'awaiting_internal']),
        supabase.from('help_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'abandoned'),
      ])
      setCounts(c => ({
        ...c,
        tickets: t.count ?? 0,
        helpRequests: h.count ?? 0,
        abandoned: a.count ?? 0,
      }))
    }
    refreshCounts()

    // Refresh every 60s
    const interval = setInterval(refreshCounts, 60000)
    return () => clearInterval(interval)
  }, [supabase])

  // Fetch Services & Templates Once
  useEffect(() => {
    async function fetchData() {
      const [{ data: sData }, { data: tData }] = await Promise.all([
        supabase.from('form_types').select('id, name, code').order('name'),
        supabase.from('email_templates').select('id, name').order('name')
      ])
      if (sData) setServices(sData)
      if (tData) setEmailTemplates(tData)
    }
    fetchData()
  }, [supabase])

  type NavItem = {
    label: string
    href: string
    icon: React.ComponentType<{ className?: string }>
    badge?: number
    roles?: string[]
  }

  const navItems: NavItem[] = [
    { label: 'All Our Services', href: '/admin', icon: LayoutDashboard },
    { label: 'Process Panel', href: '/admin/process', icon: Layers },
    { label: 'Deed Monitor', href: '/admin/monitor', icon: Activity },
    { label: 'Tickets', href: '/admin/tickets', icon: Ticket, badge: counts.tickets },
    { label: 'Orders', href: '/admin/orders', icon: ShoppingCart },
    { label: 'Enquiries', href: '/admin/enquiries', icon: MessageSquare },
    { label: 'Create Order', href: '/admin/create-order', icon: Plus },
    { label: 'ID Verifications', href: '/admin/appointments', icon: Calendar },
    { label: 'Help Requests', href: '/admin/help-requests', icon: HelpCircle, badge: counts.helpRequests },
    { label: 'Abandoned', href: '/admin/abandoned', icon: Archive, badge: counts.abandoned },
    { label: 'Tasks', href: '/admin/tasks', icon: CheckSquare },
    { label: 'Payments', href: '/admin/payments', icon: CreditCard, roles: ['director'] },
    { label: 'Team', href: '/admin/team', icon: Users, roles: ['director'] },
    { label: 'Director Portal', href: '/admin/director', icon: PieChart, roles: ['director'] },
    { label: 'Blogs', href: '/admin/blogs', icon: BookOpen },
    { label: 'Settings', href: '/admin/settings', icon: Settings, roles: ['director'] },
  ]

  const visibleItems = navItems.filter(item => {
    if (userRole === 'admin' && (item.href === '/admin/team' || item.href === '/admin/settings')) {
      return false
    }
    if (userRole === 'director') {
      return true
    }
    return !item.roles || item.roles.includes(userRole)
  })

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <div
      className={cn(
        'relative flex h-full flex-col bg-white border-r border-purple-100 transition-all duration-300 ease-in-out shadow-sm',
        collapsed ? 'w-14' : 'w-[220px]'
      )}
    >
      {/* Subtle Glow */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-purple-100/40 rounded-full blur-3xl pointer-events-none" />

      {/* Logo */}
      <div className={cn(
        'flex items-center border-b border-purple-100 h-[60px] relative z-10',
        collapsed ? 'justify-center px-2' : 'px-4'
      )}>
        {collapsed
          ? <img src="/kws_logo.jpeg" alt="K" className="h-8 w-auto rounded object-contain" />
          : (
            <div className="flex items-center w-full">
              <img src="/kws_logo.jpeg" alt="KWS Logo" className="h-10 w-auto max-w-full rounded object-contain" />
            </div>
          )
        }
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 relative z-10 scrollbar-none">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 group',
                active
                  ? 'bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 text-purple-900 shadow-sm'
                  : 'text-slate-600 hover:bg-purple-50/60 hover:text-slate-900 border border-transparent',
                collapsed && 'justify-center px-0'
              )}
            >
              {active && !collapsed && (
                <span className="absolute left-0 top-1/4 h-1/2 w-1 rounded-r bg-purple-600 shadow-sm" />
              )}
              <Icon className={cn(
                "h-4 w-4 flex-shrink-0 transition-transform group-hover:scale-105",
                active ? "text-purple-600" : "text-slate-400 group-hover:text-slate-600"
              )} />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate tracking-wide">{item.label}</span>
                  {!!item.badge && item.badge > 0 && (
                    <span className="rounded-md bg-purple-100 border border-purple-200 px-1.5 py-0.5 text-[9px] font-extrabold text-purple-700 tabular-nums">
                      {item.badge > 9999 ? '9999+' : item.badge.toLocaleString()}
                    </span>
                  )}
                </>
              )}
              {/* Collapsed badge dot */}
              {collapsed && !!item.badge && item.badge > 0 && (
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
              )}
            </Link>
          )
        })}

        {/* Dynamic Services List */}
        {!collapsed && services.length > 0 && (
          <div className="pt-4 pb-2 mt-4 border-t border-purple-100">
            <button
              onClick={() => setServicesExpanded(!servicesExpanded)}
              className="flex w-full items-center justify-between px-3 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <span className="uppercase tracking-wider text-[10px]">Active Services</span>
              <ChevronRight className={cn("h-3 w-3 transition-transform", servicesExpanded && "rotate-90")} />
            </button>
            
            {servicesExpanded && (
              <div className="mt-2 space-y-0.5">
                {services.map(service => (
                  <Link
                    key={service.id}
                    href={`/admin/create-order?form_type_id=${service.id}`}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-purple-50 hover:text-purple-700 transition-colors truncate"
                  >
                    <BookOpen className="h-3 w-3 flex-shrink-0 text-slate-400" />
                    <span className="truncate">{service.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Email Templates List */}
        {!collapsed && (
          <div className="pt-4 pb-2 mt-2 border-t border-purple-100">
            <button
              onClick={() => setTemplatesExpanded(!templatesExpanded)}
              className="flex w-full items-center justify-between px-3 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <span className="uppercase tracking-wider text-[10px]">Email Templates</span>
              <ChevronRight className={cn("h-3 w-3 transition-transform", templatesExpanded && "rotate-90")} />
            </button>
            
            {templatesExpanded && (
              <div className="mt-2 space-y-0.5">
                <Link
                  href="/admin/templates"
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-bold text-purple-600 hover:bg-purple-50 transition-colors"
                >
                  <Plus className="h-3 w-3 flex-shrink-0" />
                  <span>Manage / Add Templates</span>
                </Link>
                {emailTemplates.map(t => (
                  <Link
                    key={t.id}
                    href={`/admin/templates?id=${t.id}`}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-purple-50 hover:text-purple-700 transition-colors truncate"
                  >
                    <Mail className="h-3 w-3 flex-shrink-0 text-slate-400" />
                    <span className="truncate">{t.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-purple-100 px-3 py-3 space-y-1 relative z-10 bg-white/80 backdrop-blur-md">
        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition-all hover:bg-rose-50 hover:text-rose-600 border border-transparent hover:border-rose-200',
            collapsed && 'justify-center px-0'
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span className="tracking-wide">Logout</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand' : 'Collapse'}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-slate-400 transition-all hover:bg-purple-50 hover:text-slate-600 border border-transparent',
            collapsed && 'justify-center px-0'
          )}
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4 text-slate-400" />
            : <><ChevronLeft className="h-4 w-4 flex-shrink-0 text-slate-400" /><span className="tracking-wide text-slate-400">Collapse</span></>
          }
        </button>
      </div>
    </div>
  )
}
