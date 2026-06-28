'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lock, Mail, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f9fc] px-4 font-sans">
      <div className="w-full max-w-[420px]">
        
        {/* Brand & Logo */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="h-20 w-auto flex items-center justify-center mb-4">
            <img 
              src="/kws-removebg-preview.png" 
              alt="KWS Logo" 
              className="h-full w-auto object-contain rounded-xl"
            />
          </div>
          <h1 className="text-xl font-bold text-[#0B1B3A]">
            KWS Management Services
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Internal CRM & Operations Portal
          </p>
        </div>

        {/* Corporate Form Card */}
        <div className="bg-white border border-slate-200/80 rounded-lg shadow-sm p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-[#0B1B3A] focus:border-[#0B1B3A] transition-all"
                  placeholder="agent@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-[#0B1B3A] focus:border-[#0B1B3A] transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-start gap-2 font-medium">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0B1B3A] hover:bg-[#132c57] active:bg-[#071329] transition-colors text-white font-bold py-2.5 px-4 rounded shadow-sm text-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-slate-400 mt-6 font-semibold uppercase tracking-wider">
          Authorized Personnel Only • Session Monitored
        </p>

      </div>
    </div>
  )
}
