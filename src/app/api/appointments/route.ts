import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'

// Helper to generate slots
function generateSlots(startTimeStr: string, endTimeStr: string, durationMin: number): string[] {
  const slots: string[] = []
  
  // Parse start and end times (HH:MM:SS or HH:MM)
  const [startH, startM] = startTimeStr.split(':').map(Number)
  const [endH, endM] = endTimeStr.split(':').map(Number)

  let currentMin = startH * 60 + startM
  const endTotalMin = endH * 60 + endM

  while (currentMin + durationMin <= endTotalMin) {
    const h = Math.floor(currentMin / 60)
    const m = currentMin % 60
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    slots.push(timeStr)
    currentMin += durationMin
  }

  return slots
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const solicitorId = searchParams.get('solicitor_id')
  const dateStr = searchParams.get('date') // YYYY-MM-DD

  if (!solicitorId || !dateStr) {
    return NextResponse.json({ error: 'Missing solicitor_id or date' }, { status: 400 })
  }

  const date = new Date(dateStr)
  const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, ...

  // 1. Get solicitor weekly availability for this day of week
  const { data: avail, error: availErr } = await supabase
    .from('solicitor_availability')
    .select('*')
    .eq('solicitor_id', solicitorId)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle()

  if (availErr) return NextResponse.json({ error: availErr.message }, { status: 500 })
  if (!avail) return NextResponse.json([]) // No availability configured for this day

  // 2. Check if date is blocked
  const { data: blocked, error: blockedErr } = await supabase
    .from('solicitor_blocked_dates')
    .select('id')
    .eq('solicitor_id', solicitorId)
    .eq('blocked_date', dateStr)
    .maybeSingle()

  if (blockedErr) return NextResponse.json({ error: blockedErr.message }, { status: 500 })
  if (blocked) return NextResponse.json([]) // Date is blocked

  // 3. Get existing scheduled appointments on this date
  const startOfDay = `${dateStr}T00:00:00Z`
  const endOfDay = `${dateStr}T23:59:59Z`

  const { data: existingAppts, error: apptsErr } = await supabase
    .from('appointments')
    .select('scheduled_at, duration')
    .eq('solicitor_id', solicitorId)
    .neq('status', 'cancelled')
    .gte('scheduled_at', startOfDay)
    .lte('scheduled_at', endOfDay)

  if (apptsErr) return NextResponse.json({ error: apptsErr.message }, { status: 500 })

  // 4. Generate candidate slots
  const allSlots = generateSlots(avail.start_time, avail.end_time, avail.slot_duration)

  // 5. Filter out slots that overlap with existing appointments
  const bookedTimes = (existingAppts || []).map(appt => {
    // Extract HH:MM from ISO string
    const d = new Date(appt.scheduled_at)
    const h = String(d.getUTCHours()).padStart(2, '0')
    const m = String(d.getUTCMinutes()).padStart(2, '0')
    return `${h}:${m}`
  })

  const availableSlots = allSlots.filter(slot => !bookedTimes.includes(slot))

  return NextResponse.json(availableSlots)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  
  // Auth check
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    customer_name,
    email,
    phone,
    solicitor_id,
    date, // YYYY-MM-DD
    time, // HH:MM
    meeting_type,
    notes,
    order_id,
    enquiry_id,
  } = body

  if (!customer_name || !email || !solicitor_id || !date || !time || !meeting_type) {
    return NextResponse.json({ error: 'Missing required booking fields' }, { status: 400 })
  }

  // Parse slot duration from solicitor availability
  const dayOfWeek = new Date(date).getDay()
  const { data: avail } = await supabase
    .from('solicitor_availability')
    .select('slot_duration')
    .eq('solicitor_id', solicitor_id)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle()

  const duration = avail?.slot_duration || 15

  // Combine date and time to ISO string (UTC)
  const scheduledAt = new Date(`${date}T${time}:00Z`).toISOString()

  // 1. Create appointment
  const { data: appointment, error: insertErr } = await supabase
    .from('appointments')
    .insert({
      order_id: order_id || null,
      enquiry_id: enquiry_id || null,
      solicitor_id,
      scheduled_at: scheduledAt,
      status: 'scheduled',
      notes: notes || null,
      meeting_type,
      duration,
      created_by_user_id: currentUser.id,
    })
    .select()
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // 2. Fetch solicitor email & name
  const { data: solicitor } = await supabase
    .from('solicitors')
    .select('full_name, email')
    .eq('id', solicitor_id)
    .single()

  const solicitorName = solicitor?.full_name || 'Assigned Solicitor'
  const solicitorEmail = solicitor?.email

  // 3. Log to timeline notes
  const formattedTime = `${date} at ${time} UTC`
  const noteMessage = `📅 ID Verification Booked: Scheduled for ${formattedTime} (${meeting_type}) with ${solicitorName}`

  if (order_id) {
    await supabase.from('order_notes').insert({
      order_id,
      message: noteMessage,
      category: 'Appointment',
      user_id: currentUser.id,
    })
  }

  if (enquiry_id) {
    await supabase.from('enquiry_notes').insert({
      enquiry_id,
      message: noteMessage,
      user_id: currentUser.id,
    })
  }

  // 4. Send Confirmation Emails
  const displayMeetingType = meeting_type === 'in_person' ? 'In Person' : meeting_type === 'zoom' ? 'Zoom Call' : 'Phone Call'
  
  // Customer Email
  const customerHtml = `
    <h2>Appointment Confirmation</h2>
    <p>Dear ${customer_name},</p>
    <p>Your ID Verification appointment has been successfully scheduled.</p>
    <ul>
      <li><strong>Date:</strong> ${date}</li>
      <li><strong>Time:</strong> ${time} UTC</li>
      <li><strong>Solicitor:</strong> ${solicitorName}</li>
      <li><strong>Meeting Type:</strong> ${displayMeetingType}</li>
    </ul>
    <p>If you have any questions or need to reschedule, please contact our support team.</p>
  `
  await sendEmail({
    to: email,
    subject: `Confirmed: ID Verification Appointment on ${date}`,
    html: customerHtml,
  })

  // Solicitor Email
  if (solicitorEmail) {
    const solicitorHtml = `
      <h2>New Appointment Scheduled</h2>
      <p>Dear ${solicitorName},</p>
      <p>A new ID Verification appointment has been scheduled with you.</p>
      <ul>
        <li><strong>Customer Name:</strong> ${customer_name}</li>
        <li><strong>Customer Email:</strong> ${email}</li>
        <li><strong>Customer Phone:</strong> ${phone || 'Not provided'}</li>
        <li><strong>Date:</strong> ${date}</li>
        <li><strong>Time:</strong> ${time} UTC</li>
        <li><strong>Meeting Type:</strong> ${displayMeetingType}</li>
        <li><strong>Order Ref:</strong> ${order_id || 'N/A'}</li>
        <li><strong>Internal Notes:</strong> ${notes || 'None'}</li>
      </ul>
    `
    await sendEmail({
      to: solicitorEmail,
      subject: `New Appointment: ${customer_name} on ${date}`,
      html: solicitorHtml,
    })
  }

  return NextResponse.json(appointment)
}
