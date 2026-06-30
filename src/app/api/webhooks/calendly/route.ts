import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { getValidCalendlyToken } from '@/lib/calendly'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function verifySignature(body: string, signatureHeader: string | null, signingKey: string) {
  if (!signatureHeader) return false

  const parts = signatureHeader.split(',')
  const tPart = parts.find(p => p.startsWith('t='))
  const vPart = parts.find(p => p.startsWith('v1='))

  if (!tPart || !vPart) return false

  const t = tPart.split('=')[1]
  const v1 = vPart.split('=')[1]

  // Prevent replay attacks (within 5 minutes)
  const timestamp = parseInt(t, 10)
  if (isNaN(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) {
    console.warn('Calendly webhook timestamp verification failed.')
    return false
  }

  const payload = `${t}.${body}`

  const expectedSignature = crypto
    .createHmac('sha256', signingKey)
    .update(payload)
    .digest('hex')

  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expectedSignature))
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('calendly-webhook-signature')

  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY
  if (!signingKey) {
    console.error('CALENDLY_WEBHOOK_SIGNING_KEY not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  if (!verifySignature(body, sig, signingKey)) {
    console.error('Invalid Calendly webhook signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let eventObj: any
  try {
    eventObj = JSON.parse(body)
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { event, payload } = eventObj

  if (event === 'invitee.created') {
    const inviteeName = payload.name || `${payload.first_name || ''} ${payload.last_name || ''}`.trim() || 'Anonymous'
    const inviteeEmail = payload.email
    
    let inviteePhone = payload.phone_number || payload.text_reminder_number || ''
    if (!inviteePhone && payload.questions_and_answers && Array.isArray(payload.questions_and_answers)) {
      const phoneQA = payload.questions_and_answers.find((qa: any) => {
        const q = qa.question.toLowerCase()
        return q.includes('phone') || q.includes('mobile') || q.includes('contact')
      })
      if (phoneQA && phoneQA.answer) {
        inviteePhone = phoneQA.answer
      }
    }

    const eventUri = payload.event

    let eventName = 'Scheduled Call'
    let startTime = ''
    let startRaw = ''
    let eventMemberships: any[] = []

    // Fetch scheduled event details using Calendly API
    try {
      const token = await getValidCalendlyToken()
      if (token) {
        const response = await fetch(eventUri, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const resData = await response.json()
          eventName = resData.resource.name || eventName
          eventMemberships = resData.resource.event_memberships || []
          startRaw = resData.resource.start_time || ''
          startTime = startRaw
            ? new Date(startRaw).toLocaleString('en-GB', { timeZone: 'Europe/London' }) + ' (UK Time)'
            : ''
        } else {
          console.error('Failed to fetch scheduled event details:', await response.text())
        }
      }
    } catch (apiErr) {
      console.error('Error calling Calendly API for event details:', apiErr)
    }

    // Try to find matching solicitor in users table by host email
    let solicitorId = null
    let solicitorName = ''
    if (eventMemberships && eventMemberships.length > 0) {
      const hostEmail = eventMemberships[0].user_email
      if (hostEmail) {
        const { data: sol } = await supabase
          .from('users')
          .select('id, full_name')
          .eq('email', hostEmail)
          .maybeSingle()
        if (sol) {
          solicitorId = sol.id
          solicitorName = sol.full_name
        }
      }
    }

    // Compile questions and answers
    let notes = `Scheduled Call: ${eventName}\n`
    if (startTime) notes += `Time: ${startTime}\n`
    notes += `\nQuestions & Answers:\n`

    if (payload.questions_and_answers && Array.isArray(payload.questions_and_answers)) {
      payload.questions_and_answers.forEach((qa: any) => {
        notes += `- Q: ${qa.question}\n  A: ${qa.answer || 'No answer'}\n\n`
      })
    }

    // 1. Check if there is an active order with this customer email
    const { data: order } = await supabase
      .from('orders')
      .select('id, business_id')
      .eq('email', inviteeEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (order) {
      // Create a linked appointment in the database
      const { error: apptErr } = await supabase.from('appointments').insert({
        order_id: order.id,
        solicitor_id: solicitorId,
        scheduled_at: startRaw || new Date().toISOString(),
        status: 'scheduled',
        notes: `Booked via Calendly: ${eventName}`
      })

      if (apptErr) {
        console.error('Error inserting appointment from Calendly:', apptErr)
        return NextResponse.json({ error: 'Database save error (appointment)' }, { status: 500 })
      }

      // Add timeline note to the order
      await supabase.from('order_notes').insert({
        order_id: order.id,
        message: `📅 ID Verification Booked via Calendly: Scheduled for ${startTime || startRaw}${solicitorName ? ' with ' + solicitorName : ''}`,
        category: 'Appointment'
      })

      console.log(`Successfully recorded Calendly appointment for order ${order.id}`)
    } else {
      // 2. If no active order, fallback to Enquiry creation
      const utmSource = (payload.tracking?.utm_source || '').toLowerCase()
      let businessId = null

      if (utmSource.includes('lrt') || utmSource.includes('transfers') || utmSource.includes('landregistrytransfers')) {
        const { data: biz } = await supabase
          .from('businesses')
          .select('id')
          .eq('domain', 'landregistrytransfers.com')
          .single()
        businessId = biz?.id
      } else if (utmSource.includes('ort') || utmSource.includes('olr') || utmSource.includes('online') || utmSource.includes('onlinelandregistry')) {
        const { data: biz } = await supabase
          .from('businesses')
          .select('id')
          .eq('domain', 'onlinelandregistry.uk')
          .single()
        businessId = biz?.id
      }

      if (!businessId) {
        // Retrieve default business mapping
        const { data: defaultBizSetting } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'calendly_default_business_id')
          .single()
        businessId = defaultBizSetting?.value
      }

      if (!businessId) {
        const { data: biz } = await supabase
          .from('businesses')
          .select('id')
          .eq('domain', 'landregistrytransfers.com')
          .single()
        businessId = biz?.id
      }

      if (!businessId) {
        const { data: bizs } = await supabase
          .from('businesses')
          .select('id')
          .limit(1)
        businessId = bizs?.[0]?.id
      }

      const { error: insertErr } = await supabase.from('enquiries').insert({
        customer_name: inviteeName,
        email: inviteeEmail,
        phone: inviteePhone,
        message: `Booked: ${eventName} ${startTime ? 'on ' + startTime : ''}`,
        source: utmSource ? `Calendly (${utmSource.toUpperCase()})` : 'Calendly',
        pipeline_stage: 'new',
        business_id: businessId,
        notes: notes,
      })

      if (insertErr) {
        console.error('Error inserting enquiry from Calendly:', insertErr)
        return NextResponse.json({ error: 'Database save error (enquiry)' }, { status: 500 })
      }

      console.log(`Successfully recorded Calendly enquiry for ${inviteeEmail}`)
    }
  }

  if (event === 'invitee.canceled') {
    const inviteeEmail = payload.email
    const cancelReason = payload.cancellation?.reason || 'No reason provided'

    // 1. Check if there are orders for this email
    const { data: matchedOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('email', inviteeEmail)
    
    const orderIds = (matchedOrders || []).map(o => o.id)

    let appointmentCancelled = false

    if (orderIds.length > 0) {
      // Find latest scheduled appointment for these orders
      const { data: appts } = await supabase
        .from('appointments')
        .select('id, order_id')
        .in('order_id', orderIds)
        .eq('status', 'scheduled')
        .order('scheduled_at', { ascending: false })
        .limit(1)

      if (appts && appts.length > 0) {
        const appt = appts[0]
        // Mark appointment as cancelled
        await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id)
        // Add timeline note to the order
        await supabase.from('order_notes').insert({
          order_id: appt.order_id,
          message: `❌ Calendly call cancelled. Reason: ${cancelReason}`,
          category: 'Appointment'
        })
        console.log(`Cancelled appointment ID ${appt.id} for order ${appt.order_id}`)
        appointmentCancelled = true
      }
    }

    if (!appointmentCancelled) {
      // Fallback: Find latest enquiry with this email and add cancel note
      const { data: enqs } = await supabase
        .from('enquiries')
        .select('id')
        .eq('email', inviteeEmail)
        .order('created_at', { ascending: false })
        .limit(1)

      if (enqs && enqs.length > 0) {
        const enquiryId = enqs[0].id
        
        // Add enquiry note about cancellation
        const { error: noteErr } = await supabase.from('enquiry_notes').insert({
          enquiry_id: enquiryId,
          message: `❌ Calendly call cancelled. Reason: ${cancelReason}`,
        })

        if (noteErr) {
          console.error('Error inserting cancellation note:', noteErr)
        } else {
          console.log(`Recorded cancellation note for enquiry ID ${enquiryId}`)
        }
      } else {
        console.log(`No active enquiry or appointment found to cancel for email ${inviteeEmail}`)
      }
    }
  }

  return NextResponse.json({ received: true })
}
