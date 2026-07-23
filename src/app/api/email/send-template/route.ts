import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/mail'
import { createClient } from '@supabase/supabase-js'
import { generateProfessionalEmailHtml } from '@/lib/email-templates'

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body, orderId, recipientName, brandName } = await req.json()

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let parsedRecipientName = recipientName || ''
    let orderDetails: any = null
    let resolvedBrandName = brandName || 'Online Land Registry'

    if (orderId) {
      const { data: order } = await supabase
        .from('orders')
        .select('id, first_name, last_name, address_line1, postcode, title_number, amount_total, brand:brands(name)')
        .eq('id', orderId)
        .single()

      if (order) {
        if (!parsedRecipientName) {
          parsedRecipientName = `${order.first_name || ''} ${order.last_name || ''}`.trim()
        }
        if (order.brand && (order.brand as any).name) {
          resolvedBrandName = (order.brand as any).name
        }
        const fullAddress = [order.address_line1, order.postcode].filter(Boolean).join(', ')
        const shortId = String(order.id).slice(-6).toUpperCase()

        orderDetails = {
          orderId: shortId,
          titleNumber: order.title_number || undefined,
          address: fullAddress || undefined,
          amount: order.amount_total ? `£${Number(order.amount_total).toFixed(2)}` : undefined,
        }
      }
    }

    // Generate the professional HTML layout
    const formattedHtml = generateProfessionalEmailHtml({
      recipientName: parsedRecipientName || undefined,
      recipientEmail: to,
      subject,
      bodyText: body,
      brandName: resolvedBrandName,
      orderDetails,
      supportPhone: '0333 577 0077',
    })

    // Send email using existing mail handler
    await sendEmail({
      to,
      subject,
      html: formattedHtml,
    })

    // Log the sent email in the database
    try {
      await supabase.from('email_logs').insert({
        recipient: to,
        subject,
        body,
        order_id: orderId || null,
        sent_at: new Date().toISOString(),
      })
    } catch (logErr) {
      console.error('Failed to log sent email:', logErr)
    }

    return NextResponse.json({ success: true, message: `Email sent to ${to}` })
  } catch (error: any) {
    console.error('Send template email error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to send email' },
      { status: 500 }
    )
  }
}
