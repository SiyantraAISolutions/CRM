import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

interface EmailPayload {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailPayload) {
  const resendApiKey = process.env.RESEND_API_KEY
  const resendFrom = process.env.RESEND_FROM || 'Online Land Registry <sales@onlinelandregistry.uk>'

  const smtpHost = process.env.SMTP_HOST
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587
  const smtpSecure = process.env.SMTP_SECURE === 'true'
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpFrom = process.env.SMTP_FROM || 'Online Land Registry <noreply@onlinelandregistry.com>'

  console.log(`[EMAIL SENDING] TO: ${to} | SUBJECT: ${subject}`)
  
  // Log in system notifications if the email belongs to an active user
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', to)
        .maybeSingle()

      if (user) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'follow_up_due',
          title: subject,
          body: html.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
        })
      }
    }
  } catch (err) {
    console.error('Failed to create system notification for email:', err)
  }

  // 1. Send via Resend if API key configured
  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [to],
          subject: subject,
          html: html,
          text: html.replace(/<[^>]*>/g, ' '),
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error('Resend API error:', errText)
        let errorMsg = 'Failed to send email via Resend'
        try {
          const parsed = JSON.parse(errText)
          errorMsg = parsed.message || parsed.error || errText
        } catch {
          errorMsg = errText
        }
        throw new Error(`Resend Error: ${errorMsg}`)
      }

      console.log(`Email sent successfully to ${to} via Resend`)
      return
    } catch (error: any) {
      console.error(`Failed to send email to ${to} via Resend:`, error)
      throw error
    }
  }

  // 2. Send via SMTP if configured
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      })

      await transporter.sendMail({
        from: smtpFrom,
        to: to,
        subject: subject,
        html: html,
        text: html.replace(/<[^>]*>/g, ' '),
      })
      console.log(`Email sent successfully to ${to} via SMTP`)
      return
    } catch (error: any) {
      console.error(`Failed to send email to ${to} via SMTP:`, error)
      throw new Error(`SMTP Error: ${error.message || error}`)
    }
  }

  // 3. If in production and no email provider is configured, throw an error!
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Email service not configured. Please set RESEND_API_KEY or SMTP credentials in your production environment variables.')
  }

  // 4. Local development simulation
  console.log('=========================================')
  console.log(`EMAIL SIMULATION (TO: ${to})`)
  console.log(`SUBJECT: ${subject}`)
  console.log('-----------------------------------------')
  console.log(html.replace(/<[^>]*>/g, ' ').trim())
  console.log('=========================================')
}
