'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Phone, PhoneCall } from 'lucide-react'

interface Props {
  currentUserId?: string
}

export default function SipgateCallListener({ currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const activeToasts = useRef<Record<string, string | number>>({})

  useEffect(() => {
    if (!currentUserId) return

    console.log('Subscribing to Sipgate Realtime Call Broadcasts...')

    const channel = supabase.channel('sipgate-calls')
      .on('broadcast', { event: 'ringing' }, ({ payload }) => {
        const { callId, from, to, direction, enquiryId, orderId, customerName } = payload
        console.log(`[Ringing Alert] CallId: ${callId}, From: ${from}, Target: ${customerName || 'Unknown'}`)

        // If we already have a toast for this call, do nothing
        if (activeToasts.current[callId]) return

        const directionText = direction === 'in' ? 'Incoming Call' : 'Outgoing Call'
        const contactInfo = customerName ? `${customerName} (${from})` : from

        const toastId = toast.custom((t: any) => (
          <div className="flex flex-col gap-2 p-1.5 w-full text-slate-800 bg-white border border-slate-200 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <Phone className="h-4.5 w-4.5 text-emerald-500 animate-pulse" />
              <span className="font-bold text-sm text-slate-900">{directionText}</span>
            </div>
            <div className="text-xs space-y-1">
              <p className="font-medium text-slate-700">{contactInfo}</p>
              {customerName ? (
                <p className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 w-max">Matched Customer</p>
              ) : (
                <p className="text-[10px] text-slate-400">No CRM record found for this number</p>
              )}
            </div>
            <div className="flex gap-2 mt-2 pt-1 border-t border-slate-100">
              {enquiryId && (
                <button
                  onClick={() => {
                    router.push(`/admin/enquiries/${enquiryId}`)
                    toast.dismiss(t)
                    delete activeToasts.current[callId]
                  }}
                  className="bg-navy text-white text-[11px] font-semibold px-2.5 py-1 rounded hover:bg-opacity-95 transition-all"
                >
                  Open Enquiry
                </button>
              )}
              {orderId && (
                <button
                  onClick={() => {
                    router.push(`/admin/orders/${orderId}`)
                    toast.dismiss(t)
                    delete activeToasts.current[callId]
                  }}
                  className="bg-indigo-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded hover:bg-indigo-700 transition-all"
                >
                  Open Order
                </button>
              )}
              <button
                onClick={() => {
                  toast.dismiss(t)
                  delete activeToasts.current[callId]
                }}
                className="border border-slate-200 text-slate-500 text-[11px] font-medium px-2 py-1 rounded hover:bg-slate-50 transition-all ml-auto"
              >
                Dismiss
              </button>
            </div>
          </div>
        ), {
          duration: 30000 // Show for 30s during ringing
        })

        activeToasts.current[callId] = toastId
      })
      .on('broadcast', { event: 'answered' }, ({ payload }) => {
        const { callId, userId, enquiryId, orderId, customerName } = payload
        console.log(`[Answered Alert] CallId: ${callId}, answered by CRM User ID: ${userId}`)

        // Dismiss the ringing toast if it exists
        const ringToastId = activeToasts.current[callId]
        if (ringToastId) {
          toast.dismiss(ringToastId)
          delete activeToasts.current[callId]
        }

        // If the answering user is the current logged-in user, redirect them automatically!
        if (userId && userId === currentUserId) {
          toast.success(`Connected to ${customerName || 'customer'}! Opening profile...`, {
            icon: <PhoneCall className="h-4 w-4 text-emerald-600" />
          })

          if (enquiryId) {
            router.push(`/admin/enquiries/${enquiryId}`)
          } else if (orderId) {
            router.push(`/admin/orders/${orderId}`)
          }
        }
      })
      .on('broadcast', { event: 'hangup' }, ({ payload }) => {
        const { callId } = payload
        console.log(`[Hangup Alert] CallId: ${callId}`)

        // Dismiss any existing toast for this call
        const existingToastId = activeToasts.current[callId]
        if (existingToastId) {
          toast.dismiss(existingToastId)
          delete activeToasts.current[callId]
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, supabase, router])

  return null // Renderless helper component
}
