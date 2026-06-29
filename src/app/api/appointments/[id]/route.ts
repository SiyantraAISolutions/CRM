import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  // Auth check
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action, date, time, solicitor_id, notes } = body // action can be 'cancel' or 'reschedule'

  // Fetch current appointment
  const { data: appointment, error: fetchErr } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !appointment) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
  }

  // Get customer info from Order or Enquiry
  let customerName = 'Customer'
  let customerEmail = ''
  let customerPhone = ''

  if (appointment.order_id) {
    const { data: order } = await supabase
      .from('orders')
      .select('first_name, last_name, email, phone')
      .eq('id', appointment.order_id)
      .single()
    if (order) {
      customerName = `${order.first_name || ''} ${order.last_name || ''}`.trim() || 'Customer'
      customerEmail = order.email || ''
      customerPhone = order.phone || ''
    }
  } else if (appointment.enquiry_id) {
    const { data: enquiry } = await supabase
      .from('enquiries')
      .select('customer_name, email, phone')
      .eq('id', appointment.enquiry_id)
      .single()
    if (enquiry) {
      customerName = enquiry.customer_name || 'Customer'
      customerEmail = enquiry.email || ''
      customerPhone = enquiry.phone || ''
    }
  }

  // Get solicitor info
  const { data: currentSolicitor } = await supabase
    .from('solicitors')
    .select('full_name, email')
    .eq('id', appointment.solicitor_id)
    .single()

  const currentSolName = currentSolicitor?.full_name || 'Solicitor'
  const currentSolEmail = currentSolicitor?.email

  // Process Cancel Action
  if (action === 'cancel') {
    const { data: updatedAppt, error: updateErr } = await supabase
      .from('appointments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    const cancelMessage = `❌ ID Verification Cancelled: Appointment with ${currentSolName} was cancelled.`

    if (appointment.order_id) {
      await supabase.from('order_notes').insert({
        order_id: appointment.order_id,
        message: cancelMessage,
        category: 'Appointment',
        user_id: currentUser.id,
      })
    }

    if (appointment.enquiry_id) {
      await supabase.from('enquiry_notes').insert({
        enquiry_id: appointment.enquiry_id,
        message: cancelMessage,
        user_id: currentUser.id,
      })
    }

    // Send Cancellation Emails
    const cancelHtml = `
      <h2>Appointment Cancelled</h2>
      <p>Dear ${customerName},</p>
      <p>Your scheduled ID Verification appointment has been cancelled.</p>
      <p>If you did not request this change or would like to book a new appointment, please contact us.</p>
    `
    if (customerEmail) {
      await sendEmail({
        to: customerEmail,
        subject: `Cancelled: ID Verification Appointment`,
        html: cancelHtml,
      })
    }

    if (currentSolEmail) {
      const solCancelHtml = `
        <h2>Appointment Cancelled</h2>
        <p>Dear ${currentSolName},</p>
        <p>Your ID Verification appointment with customer <strong>${customerName}</strong> has been cancelled.</p>
      `
      await sendEmail({
        to: currentSolEmail,
        subject: `Cancelled Appointment: ${customerName}`,
        html: solCancelHtml,
      })
    }

    return NextResponse.json(updatedAppt)
  }

  // Process Reschedule Action
  if (action === 'reschedule') {
    if (!date || !time || !solicitor_id) {
      return NextResponse.json({ error: 'Missing date, time, or solicitor_id for reschedule' }, { status: 400 })
    }

    const newScheduledAt = new Date(`${date}T${time}:00Z`).toISOString()

    // Retrieve slot duration for new solicitor
    const dayOfWeek = new Date(date).getDay()
    const { data: avail } = await supabase
      .from('solicitor_availability')
      .select('slot_duration')
      .eq('solicitor_id', solicitor_id)
      .eq('day_of_week', dayOfWeek)
      .maybeSingle()

    const duration = avail?.slot_duration || 15

    // Build history entry
    const historyEntry = {
      scheduled_at: appointment.scheduled_at,
      solicitor_id: appointment.solicitor_id,
      rescheduled_at: new Date().toISOString(),
    }

    const updatedHistory = [...(appointment.reschedule_history || []), historyEntry]

    const { data: updatedAppt, error: updateErr } = await supabase
      .from('appointments')
      .update({
        solicitor_id,
        scheduled_at: newScheduledAt,
        duration,
        reschedule_history: updatedHistory,
        notes: notes || appointment.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Fetch new solicitor info
    const { data: newSolicitor } = await supabase
      .from('solicitors')
      .select('full_name, email')
      .eq('id', solicitor_id)
      .single()

    const newSolName = newSolicitor?.full_name || 'Solicitor'
    const newSolEmail = newSolicitor?.email

    const oldDateStr = new Date(appointment.scheduled_at).toLocaleDateString('en-GB')
    const oldTimeStr = new Date(appointment.scheduled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    const newDateStr = date
    const newTimeStr = time

    const rescheduleMessage = `🔄 ID Verification Rescheduled: Moved from ${oldDateStr} at ${oldTimeStr} UTC to ${newDateStr} at ${newTimeStr} UTC (with ${newSolName}).`

    if (appointment.order_id) {
      await supabase.from('order_notes').insert({
        order_id: appointment.order_id,
        message: rescheduleMessage,
        category: 'Appointment',
        user_id: currentUser.id,
      })
    }

    if (appointment.enquiry_id) {
      await supabase.from('enquiry_notes').insert({
        enquiry_id: appointment.enquiry_id,
        message: rescheduleMessage,
        user_id: currentUser.id,
      })
    }

    // Send Rescheduled Emails
    const displayMeetingType = appointment.meeting_type === 'in_person' ? 'In Person' : appointment.meeting_type === 'zoom' ? 'Zoom Call' : 'Phone Call'

    const rescheduleHtml = `
      <h2>Appointment Rescheduled</h2>
      <p>Dear ${customerName},</p>
      <p>Your ID Verification appointment has been successfully rescheduled.</p>
      <ul>
        <li><strong>New Date:</strong> ${newDateStr}</li>
        <li><strong>New Time:</strong> ${newTimeStr} UTC</li>
        <li><strong>Assigned Solicitor:</strong> ${newSolName}</li>
        <li><strong>Meeting Type:</strong> ${displayMeetingType}</li>
      </ul>
      <p>If you have any questions, please contact our support team.</p>
    `
    if (customerEmail) {
      await sendEmail({
        to: customerEmail,
        subject: `Rescheduled: ID Verification Appointment`,
        html: rescheduleHtml,
      })
    }

    // Notify old solicitor
    if (currentSolEmail && currentSolEmail !== newSolEmail) {
      const oldSolHtml = `
        <h2>Appointment Rescheduled (Removed)</h2>
        <p>Dear ${currentSolName},</p>
        <p>The appointment with customer <strong>${customerName}</strong> scheduled with you on ${oldDateStr} at ${oldTimeStr} has been rescheduled and reassigned to another solicitor.</p>
      `
      await sendEmail({
        to: currentSolEmail,
        subject: `Reassigned: Appointment with ${customerName}`,
        html: oldSolHtml,
      })
    }

    // Notify new solicitor
    if (newSolEmail) {
      const newSolHtml = `
        <h2>New Appointment Assigned (Rescheduled)</h2>
        <p>Dear ${newSolName},</p>
        <p>An appointment has been rescheduled and assigned to you with customer <strong>${customerName}</strong>.</p>
        <ul>
          <li><strong>Customer Name:</strong> ${customerName}</li>
          <li><strong>Customer Email:</strong> ${customerEmail || 'Not provided'}</li>
          <li><strong>Customer Phone:</strong> ${customerPhone || 'Not provided'}</li>
          <li><strong>New Date:</strong> ${newDateStr}</li>
          <li><strong>New Time:</strong> ${newTimeStr} UTC</li>
          <li><strong>Meeting Type:</strong> ${displayMeetingType}</li>
          <li><strong>Notes:</strong> ${notes || appointment.notes || 'None'}</li>
        </ul>
      `
      await sendEmail({
        to: newSolEmail,
        subject: `Rescheduled Appointment: ${customerName} on ${newDateStr}`,
        html: newSolHtml,
      })
    }

    return NextResponse.json(updatedAppt)
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
