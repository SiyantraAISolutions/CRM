import type { UserRole } from '@/types'

// Route → allowed roles map
export const ROLE_ROUTES: Record<string, UserRole[]> = {
  '/admin/director':    ['director'],
  '/admin/enquiries':   ['director', 'sales', 'admin'],
  '/admin/payments':    ['director', 'admin'],
  '/admin/services':    ['director'],
  '/admin/team':        ['director'],
  '/admin/reports':     ['director'],
  '/admin/settings':    ['director'],
  '/admin/orders':      ['director', 'admin', 'sales'],
  '/admin/tasks':       ['director', 'admin', 'sales'],
  '/admin/create-order':['director', 'sales', 'admin'],
}

export function getDashboardPath(role: UserRole): string {
  switch (role) {
    case 'director': return '/admin/director'
    case 'sales':    return '/admin/sales'
    case 'admin':    return '/admin'
    default:         return '/admin'
  }
}

export function canAccess(role: UserRole, pathname: string): boolean {
  // Find the most specific matching route prefix
  const match = Object.entries(ROLE_ROUTES)
    .filter(([route]) => pathname.startsWith(route))
    .sort((a, b) => b[0].length - a[0].length)[0]

  if (!match) return true // no restriction defined → allow
  return match[1].includes(role)
}

export function getNavItems(role: UserRole) {
  const all = [
    { label: 'Dashboard',      href: '/admin',              roles: ['director', 'admin', 'sales'] as UserRole[] },
    { label: 'Enquiries',      href: '/admin/enquiries',    roles: ['director', 'sales'] as UserRole[] },
    { label: 'Orders & Cases', href: '/admin/orders',       roles: ['director', 'admin', 'sales'] as UserRole[] },
    { label: 'Payments',       href: '/admin/payments',     roles: ['director', 'admin'] as UserRole[] },
    { label: 'Create Order',   href: '/admin/create-order', roles: ['director', 'sales'] as UserRole[] },
    { label: 'Tasks',          href: '/admin/tasks',        roles: ['director', 'admin', 'sales'] as UserRole[] },
    { label: 'Services',       href: '/admin/services',     roles: ['director'] as UserRole[] },
    { label: 'Team',           href: '/admin/team',         roles: ['director'] as UserRole[] },
    { label: 'Reports',        href: '/admin/reports',      roles: ['director'] as UserRole[] },
    { label: 'Tickets',        href: '/admin/tickets',      roles: ['director', 'admin'] as UserRole[] },
    { label: 'Help Requests',  href: '/admin/help-requests',roles: ['director', 'admin'] as UserRole[] },
    { label: 'Settings',       href: '/admin/settings',     roles: ['director'] as UserRole[] },
  ]
  return all.filter(item => item.roles.includes(role))
}
