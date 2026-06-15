'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation'
import { Bell, Search, ChevronDown, LogOut, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import { useBusiness } from '@/context/BusinessContext'
import type { UserRole } from '@/types'

interface TopBarProps {
  role: UserRole
  userName: string
  userEmail: string
  avatarUrl?: string
  notificationCount: number
}

export default function TopBar({ role, userName, userEmail, avatarUrl, notificationCount }: TopBarProps) {
  const router = useRouter()
  const supabase = createClient()
  const { businesses, activeBusinessId, setActiveBusinessId } = useBusiness()
  const [searchQuery, setSearchQuery] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const roleLabel: Record<UserRole, string> = {
    director: 'Director',
    sales:    'Sales',
    admin:    'Admin',
  }

  return (
    <div className="flex h-12 items-center gap-3 border-b border-outline-gray-2 bg-white px-4 flex-shrink-0">
      {/* Business filter */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setActiveBusinessId('all')}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            activeBusinessId === 'all'
              ? 'bg-navy text-white'
              : 'text-ink-gray-5 hover:bg-surface-gray-1 hover:text-ink-gray-9'
          )}
        >
          All Businesses
        </button>
        {businesses.map(b => (
          <button
            key={b.id}
            onClick={() => setActiveBusinessId(b.id)}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              activeBusinessId === b.id
                ? 'bg-navy text-white'
                : 'text-ink-gray-5 hover:bg-surface-gray-1 hover:text-ink-gray-9'
            )}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className="mx-2 h-5 w-px bg-outline-gray-2" />

      {/* Global search */}
      <div className="flex flex-1 max-w-sm items-center gap-2 rounded-md border border-outline-gray-2 bg-surface-gray-1 px-3 py-1.5">
        <Search className="h-3.5 w-3.5 text-ink-gray-4 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search orders, customers..."
          className="flex-1 bg-transparent text-sm text-ink-gray-9 placeholder:text-ink-gray-4 outline-none"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex-1" />

      {/* Notifications */}
      <button className="relative rounded-md p-1.5 text-ink-gray-5 hover:bg-surface-gray-1 hover:text-ink-gray-9 transition-colors">
        <Bell className="h-4 w-4" />
        {notificationCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger-red text-[10px] font-bold text-white">
            {notificationCount > 99 ? '99+' : notificationCount}
          </span>
        )}
      </button>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-gray-1 transition-colors"
        >
          <Avatar label={userName} size="sm" image={avatarUrl} />
          <div className="hidden sm:flex flex-col items-start">
            <span className="text-xs font-medium text-ink-gray-9 leading-none">{userName}</span>
            <span className="text-[10px] text-ink-gray-4 leading-none mt-0.5">{roleLabel[role]}</span>
          </div>
          <ChevronDown className="h-3 w-3 text-ink-gray-4" />
        </button>

        {userMenuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
            <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-outline-gray-2 bg-white shadow-lg py-1">
              <div className="px-3 py-2 border-b border-outline-gray-2">
                <div className="text-sm font-medium text-ink-gray-9">{userName}</div>
                <div className="text-xs text-ink-gray-4 truncate">{userEmail}</div>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger-red hover:bg-surface-red-2 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
