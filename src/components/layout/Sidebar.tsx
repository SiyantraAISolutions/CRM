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

const KWSLogo = () => (
  <div className="flex flex-col items-start">
    <div className="text-white font-bold text-2xl leading-none tracking-tight">KWS</div>
    <div className="text-white/60 text-[10px] leading-tight tracking-wide uppercase">Management Services</div>
  </div>
)

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
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Tickets', href: '/admin/tickets', icon: Ticket, badge: counts.tickets },
    { label: 'Orders', href: '/admin/orders', icon: ShoppingCart },
    { label: 'Enquiries', href: '/admin/enquiries', icon: MessageSquare },
    { label: 'Create Order', href: '/admin/create-order', icon: Plus },
    { label: 'Help Requests', href: '/admin/help-requests', icon: HelpCircle, badge: counts.helpRequests },
    { label: 'Abandoned', href: '/admin/abandoned', icon: Archive, badge: counts.abandoned },
    { label: 'Tasks', href: '/admin/tasks', icon: CheckSquare },
    { label: 'Payments', href: '/admin/payments', icon: CreditCard, roles: ['director', 'admin'] },
    { label: 'Sales Info', href: '/admin/information/sales', icon: BookOpen },
    { label: 'Admin Info', href: '/admin/information/admin', icon: Shield },
    { label: 'Team', href: '/admin/team', icon: Users, roles: ['director'] },
    { label: 'Director View', href: '/admin/director', icon: TrendingUp, roles: ['director'] },
    { label: 'Settings', href: '/admin/settings', icon: Settings, roles: ['director'] },
  ]

  const visibleItems = navItems.filter(item =>
    !item.roles || item.roles.includes(userRole)
  )

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
        'relative flex h-full flex-col bg-navy border-r border-white/5 transition-all duration-300 ease-in-out',
        collapsed ? 'w-14' : 'w-[220px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center border-b border-white/10 h-[50px]',
        collapsed ? 'justify-center px-2' : 'px-4'
      )}>
        {collapsed
          ? <div className="text-white font-bold text-base">KWS</div>
          : <KWSLogo />
        }
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-sm font-medium transition-colors',
                active
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:bg-white/8 hover:text-white',
                collapsed && 'justify-center px-0'
              )}
            >
              {active && !collapsed && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-white/80" />
              )}
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {!!item.badge && item.badge > 0 && (
                    <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                      {item.badge > 9999 ? '9999+' : item.badge.toLocaleString()}
                    </span>
                  )}
                </>
              )}
              {/* Collapsed badge dot */}
              {collapsed && !!item.badge && item.badge > 0 && (
                <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-danger-red" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-2 py-2 space-y-0.5">
        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-sm font-medium text-white/50 transition-colors hover:bg-white/8 hover:text-red-300',
            collapsed && 'justify-center px-0'
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand' : 'Collapse'}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-sm font-medium text-white/30 transition-colors hover:bg-white/8 hover:text-white/60',
            collapsed && 'justify-center px-0'
          )}
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4" />
            : <><ChevronLeft className="h-4 w-4 flex-shrink-0" /><span>Collapse</span></>
          }
        </button>
      </div>
    </div>
  )
}
