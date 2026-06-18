'use client'

import { useState, useEffect } from 'react'

import { useRouter } from 'next/navigation'
import { Bell, Search, ChevronDown, LogOut, User, Volume2 } from 'lucide-react'
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

  // Generate a loud, attention-grabbing sound using Web Audio API
  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const playLoudBeep = (startTime: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        // 'square' wave is much louder and more piercing than 'sine'
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, startTime);
        
        // Full volume (1.0), quick fade to avoid clicking
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(1.0, startTime + 0.01);
        gain.gain.setValueAtTime(1.0, startTime + 0.15);
        gain.gain.linearRampToValueAtTime(0.01, startTime + 0.2);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + 0.2);
      };

      const now = ctx.currentTime;
      // Play 3 loud, rapid beeps
      playLoudBeep(now);
      playLoudBeep(now + 0.3);
      playLoudBeep(now + 0.6);
    } catch (e) {
      console.error("Audio API error:", e);
    }
  };

  // Listen for new help requests
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'help_requests' },
        (payload) => {
          playNotificationSound();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const roleLabel: Record<UserRole, string> = {
    director: 'Director',
    sales:    'Sales',
    admin:    'Admin',
  }

  return (
    <div className="flex h-12 items-center gap-3 border-b border-purple-100 bg-white px-6 flex-shrink-0 relative z-20 shadow-sm">
      {/* Business filter */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveBusinessId('all')}
          className={cn(
            'rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all duration-200 border cursor-pointer',
            activeBusinessId === 'all'
              ? 'bg-purple-50 border-purple-200 text-purple-700 shadow-sm'
              : 'bg-slate-50 border-transparent text-slate-500 hover:bg-purple-50 hover:text-purple-700'
          )}
        >
          All Brands
        </button>
        {businesses.map(b => (
          <button
            key={b.id}
            onClick={() => setActiveBusinessId(b.id)}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all duration-200 border cursor-pointer',
              activeBusinessId === b.id
                ? 'bg-purple-50 border-purple-200 text-purple-700 shadow-sm'
                : 'bg-slate-50 border-transparent text-slate-500 hover:bg-purple-50 hover:text-purple-700'
            )}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className="mx-2 h-5 w-px bg-purple-100" />

      {/* Global search */}
      <div className="flex flex-1 max-w-xs items-center gap-2 rounded-xl border border-purple-100 bg-slate-50 px-3.5 py-1.5 hover:border-purple-200 transition-all duration-200 focus-within:border-purple-400 focus-within:ring-1 focus-within:ring-purple-100">
        <Search className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search records..."
          className="flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none font-medium"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex-1" />

      {/* Notifications */}
      <div className="flex items-center gap-1">
        <button 
          onClick={playNotificationSound}
          title="Test Notification Sound"
          className="rounded-xl p-2 border border-transparent text-slate-400 hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 cursor-pointer"
        >
          <Volume2 className="h-4 w-4" />
        </button>
        <button className="relative rounded-xl p-2 border border-transparent text-slate-500 hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 cursor-pointer">
          <Bell className="h-4 w-4" />
          {notificationCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-purple-600 text-[9px] font-black text-white shadow-sm shadow-purple-500/50">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>
      </div>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center gap-2 rounded-xl border border-transparent hover:border-purple-100 hover:bg-purple-50/50 px-3 py-1.5 transition-all duration-200 cursor-pointer"
        >
          <Avatar label={userName} size="sm" image={avatarUrl} />
          <div className="hidden sm:flex flex-col items-start text-left">
            <span className="text-xs font-bold text-slate-800 leading-none">{userName}</span>
            <span className="text-[9px] text-slate-500 leading-none mt-1 font-extrabold uppercase tracking-wider">{roleLabel[role]}</span>
          </div>
          <ChevronDown className="h-3 w-3 text-slate-400" />
        </button>

        {userMenuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
            <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-purple-100 bg-white shadow-xl py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-3 py-2 border-b border-purple-50">
                <div className="text-xs font-bold text-slate-800">{userName}</div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5 font-medium">{userEmail}</div>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
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
