import { createClient } from '@supabase/supabase-js'

interface EmailPayload {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY
  
  console.log(`[EMAIL SENDING] TO: ${to} | SUBJECT: ${subject}`)
  console.log(`[EMAIL CONTENT]\n${html.replace(/<[^>]*>/g, ' ')}\n[END CONTENT]`)

  // Log in system notifications if the email belongs to an active user
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Find if there is a matching user in public.users
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', to)
      .maybeSingle()

    if (user) {
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'follow_up_due', // general notification type
        title: subject,
        body: html.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
      })
    }
  } catch (err) {
    console.error('Failed to create system notification for email:', err)
  }

  if (apiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
          to,
          subject,
          html,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error('Resend API response error:', errText)
      } else {
        console.log('Email sent successfully via Resend API')
      }
    } catch (apiErr) {
      console.error('Error calling Resend API:', apiErr)
    }
  } else {
    console.log('Resend API key not configured. Email simulated in logs.')
  }
}
