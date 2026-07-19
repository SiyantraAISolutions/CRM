import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getPhoneSuffix(num: string): string {
  const digits = num.replace(/\D/g, '')
  return digits.length > 9 ? digits.slice(-9) : digits
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  
  const parts = []
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  if (s > 0 || parts.length === 0) parts.push(`${s}s`)
  return parts.join(' ')
}

async function broadcastCallEvent(event: string, payload: any) {
  const supabase = getSupabaseAdmin()
  const channel = supabase.channel('sipgate-calls')
  return new Promise<void>((resolve) => {
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.send({
          type: 'broadcast',
          event,
          payload
        })
        supabase.removeChannel(channel)
        resolve()
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        resolve()
      }
    })
    setTimeout(() => {
      supabase.removeChannel(channel)
      resolve()
    }, 2500)
  })
}

export async function POST(req: NextRequest) {
  try {
    const text = await req.text()
    const params = new URLSearchParams(text)
    
    const event = params.get('event') || ''
    const direction = params.get('direction') || ''
    const from = params.get('from') || ''
    const to = params.get('to') || ''
    const callId = params.get('callId') || ''
    const cause = params.get('cause') || ''
    const sipgateUser = params.get('user[]') || params.get('user') || ''

    console.log(`[Sipgate Webhook] Event: ${event}, CallId: ${callId}, From: ${from}, To: ${to}, Direction: ${direction}, User: ${sipgateUser}`)

    const supabase = getSupabaseAdmin()

    // Host & Origin for Webhook Callback XML redirection
    const host = req.headers.get('host') || req.nextUrl.host
    const proto = req.headers.get('x-forwarded-proto') || 'https'
    const webhookUrl = `${proto}://${host}/api/webhooks/sipgate`

    if (event === 'newCall') {
      const customerPhone = direction === 'in' ? from : to
      const suffix = getPhoneSuffix(customerPhone)
      
      let matchedEnquiryId: string | null = null
      let matchedOrderId: string | null = null
      let customerName = ''

      if (suffix) {
        // Search enquiries
        const { data: enqs } = await supabase
          .from('enquiries')
          .select('id, customer_name')
          .like('phone', `%${suffix}`)
          .order('updated_at', { ascending: false })
          .limit(1)
        
        if (enqs && enqs.length > 0) {
          matchedEnquiryId = enqs[0].id
          customerName = enqs[0].customer_name || ''
        }

        // Search orders
        const { data: ords } = await supabase
          .from('orders')
          .select('id, first_name, last_name')
          .like('phone', `%${suffix}`)
          .order('updated_at', { ascending: false })
          .limit(1)

        if (ords && ords.length > 0) {
          matchedOrderId = ords[0].id
          if (!customerName) {
            customerName = `${ords[0].first_name || ''} ${ords[0].last_name || ''}`.trim()
          }
        }
      }

      // Save call state to settings table for tracking answered/hangup events
      const callState = {
        callId,
        from,
        to,
        direction,
        startTime: new Date().toISOString(),
        enquiryId: matchedEnquiryId,
        orderId: matchedOrderId,
        customerName
      }

      await supabase.from('settings').upsert({
        key: `sipgate_call_${callId}`,
        value: JSON.stringify(callState),
        updated_at: new Date().toISOString()
      })

      // Insert timeline note
      const directionLabel = direction === 'in' ? 'Inbound' : 'Outbound'
      const noteMessage = `📞 [Sipgate Call] Call ringing (${directionLabel} from ${from} to ${to})`
      
      if (matchedEnquiryId) {
        await supabase.from('enquiry_notes').insert({
          enquiry_id: matchedEnquiryId,
          message: noteMessage
        })
      }
      if (matchedOrderId) {
        await supabase.from('order_notes').insert({
          order_id: matchedOrderId,
          message: noteMessage,
          category: 'Call Log'
        })
      }

      // Broadcast event to Supabase Realtime
      await broadcastCallEvent('ringing', {
        callId,
        from,
        to,
        direction,
        enquiryId: matchedEnquiryId,
        orderId: matchedOrderId,
        customerName: customerName || null
      })

      // Respond with XML callback configuration to receive onAnswer and onHangup
      const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response onAnswer="${webhookUrl}" onHangup="${webhookUrl}"/>`
      
      return new NextResponse(xmlResponse, {
        headers: { 'Content-Type': 'application/xml' }
      })
    }

    if (event === 'onAnswer') {
      // Fetch active call state
      const { data: callSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `sipgate_call_${callId}`)
        .single()

      if (callSetting) {
        const callState = JSON.parse(callSetting.value)
        callState.answeredTime = new Date().toISOString()

        // Update call state in settings
        await supabase.from('settings').upsert({
          key: `sipgate_call_${callId}`,
          value: JSON.stringify(callState),
          updated_at: new Date().toISOString()
        })

        // Insert timeline note
        const noteMessage = `📞 [Sipgate Call] Call answered by ${sipgateUser || 'agent'}`
        
        if (callState.enquiryId) {
          await supabase.from('enquiry_notes').insert({
            enquiry_id: callState.enquiryId,
            message: noteMessage
          })
        }
        if (callState.orderId) {
          await supabase.from('order_notes').insert({
            order_id: callState.orderId,
            message: noteMessage,
            category: 'Call Log'
          })
        }

        // Map Sipgate username to CRM user ID
        let answeringUserId: string | null = null
        if (sipgateUser) {
          const { data: userMappingSettings } = await supabase
            .from('settings')
            .select('key')
            .eq('value', sipgateUser)
            .like('key', 'sipgate_username_user_%')
          
          if (userMappingSettings && userMappingSettings.length > 0) {
            answeringUserId = userMappingSettings[0].key.replace('sipgate_username_user_', '')
          }
        }

        // Broadcast event to Supabase Realtime
        await broadcastCallEvent('answered', {
          callId,
          userId: answeringUserId,
          enquiryId: callState.enquiryId,
          orderId: callState.orderId,
          customerName: callState.customerName || null
        })
      }
    }

    if (event === 'onHangup') {
      // Fetch active call state
      const { data: callSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `sipgate_call_${callId}`)
        .single()

      if (callSetting) {
        const callState = JSON.parse(callSetting.value)
        const endTime = new Date()
        const startTime = callState.startTime ? new Date(callState.startTime) : endTime
        const answeredTime = callState.answeredTime ? new Date(callState.answeredTime) : null
        
        let durationSec = 0
        if (answeredTime) {
          durationSec = Math.round((endTime.getTime() - answeredTime.getTime()) / 1000)
        }

        const durationText = formatDuration(durationSec)
        const statusText = answeredTime ? 'Completed' : 'Missed/No Answer'
        const causeLabel = cause ? ` (Reason: ${cause})` : ''
        
        const noteMessage = `📞 [Sipgate Call] Call ended. Duration: ${durationText}. Status: ${statusText}${causeLabel}`

        if (callState.enquiryId) {
          await supabase.from('enquiry_notes').insert({
            enquiry_id: callState.enquiryId,
            message: noteMessage
          })
        }
        if (callState.orderId) {
          await supabase.from('order_notes').insert({
            order_id: callState.orderId,
            message: noteMessage,
            category: 'Call Log'
          })
        }

        // Broadcast event to Supabase Realtime
        await broadcastCallEvent('hangup', {
          callId,
          enquiryId: callState.enquiryId,
          orderId: callState.orderId
        })

        // Clean up temporary call state
        await supabase.from('settings').delete().eq('key', `sipgate_call_${callId}`)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('Sipgate webhook error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
