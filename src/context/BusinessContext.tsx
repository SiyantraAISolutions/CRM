'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Business } from '@/types'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

interface BusinessContextType {
  businesses: Business[]
  activeBusinessId: string // 'all' or business UUID
  setActiveBusinessId: (id: string) => void
  loading: boolean
  refreshBusinesses: () => Promise<void>
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined)

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeBusinessId = searchParams.get('business') || 'all'

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const setActiveBusinessId = (id: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (id && id !== 'all') {
      params.set('business', id)
    } else {
      params.delete('business')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  async function fetchBusinesses() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const userId = session.user.id
      
      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()

      if (!user) return

      let fetched: Business[] = []

      if (user.role === 'director') {
        const { data, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('status', 'active')
          .order('name')
        if (error) throw error
        fetched = data || []
      } else {
        const { data, error } = await supabase
          .from('user_businesses')
          .select('businesses(*)')
          .eq('user_id', userId)
        if (error) throw error
        fetched = (data || [])
          .map((ub: any) => ub.businesses)
          .filter(Boolean)
          .filter((b: any) => b.status === 'active')
      }

      setBusinesses(fetched)
    } catch (err) {
      console.error('Error fetching businesses:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBusinesses()
  }, [])

  return (
    <BusinessContext.Provider
      value={{
        businesses,
        activeBusinessId,
        setActiveBusinessId,
        loading,
        refreshBusinesses: fetchBusinesses,
      }}
    >
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusiness() {
  const context = useContext(BusinessContext)
  if (context === undefined) {
    throw new Error('useBusiness must be used within a BusinessProvider')
  }
  return context
}
