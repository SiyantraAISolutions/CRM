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
  MessageSquare, Building2,
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

  type NavItem = {
    label: string
    href: string
    icon: React.ComponentType<{ className?: string }>
    badge?: number
    roles?: string[]
  }

  const navItems: NavItem[] = [
    { label: 'All Our Services', href: '/admin', icon: LayoutDashboard },
    { label: 'Tickets', href: '/admin/tickets', icon: Ticket, badge: counts.tickets },
    { label: 'Orders', href: '/admin/orders', icon: ShoppingCart },
    { label: 'Enquiries', href: '/admin/enquiries', icon: MessageSquare },
    { label: 'Create Order', href: '/admin/create-order', icon: Plus },
    { label: 'Help Requests', href: '/admin/help-requests', icon: HelpCircle, badge: counts.helpRequests },
    { label: 'Abandoned', href: '/admin/abandoned', icon: Archive, badge: counts.abandoned },
    { label: 'Tasks', href: '/admin/tasks', icon: CheckSquare },
    { label: 'Payments', href: '/admin/payments', icon: CreditCard, roles: ['director'] },
    { label: 'Sales Info', href: '/admin/information/sales', icon: BookOpen },
    { label: 'Admin Info', href: '/admin/information/admin', icon: Shield },
    { label: 'Team', href: '/admin/team', icon: Users, roles: ['director'] },
    { label: 'Director View', href: '/admin/director', icon: TrendingUp, roles: ['director'] },
    { label: 'Settings', href: '/admin/settings', icon: Settings, roles: ['director'] },
  ]

  const visibleItems = navItems.filter(item => {
    if (userRole === 'admin') {
      return item.href === '/admin'
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
