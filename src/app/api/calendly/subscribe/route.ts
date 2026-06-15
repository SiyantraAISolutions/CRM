import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getValidCalendlyToken,
  getCalendlyTokenInfo,
  fetchCalendlyUserDetails,
} from '@/lib/calendly'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  try {
    const token = await getValidCalendlyToken()
    if (!token) {
      return NextResponse.json({ connected: false })
    }

    const info = await getCalendlyTokenInfo()
    let userDetails = null
    try {
      userDetails = await fetchCalendlyUserDetails(token)
    } catch (e) {
      console.error('Error fetching Calendly user:', e)
    }

    const supabase = getSupabaseAdmin()
    const { data: subSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'calendly_webhook_subscription_uri')
      .single()

    const webhookSubscribed = !!subSetting?.value

    return NextResponse.json({
      connected: true,
      user: userDetails,
      webhookSubscribed,
      webhookUri: subSetting?.value || null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json()
    const token = await getValidCalendlyToken()
    if (!token) {
      return NextResponse.json({ error: 'Calendly is not connected' }, { status: 400 })
    }

    const info = await getCalendlyTokenInfo()
    const supabase = getSupabaseAdmin()

    if (action === 'subscribe') {
      const host = req.headers.get('host') || 'localhost:3000'
      const protocol = host.includes('localhost') ? 'http' : 'https'
      
      // Expose support for local testing tunnels (e.g. ngrok) via NEXT_PUBLIC_APP_URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL
      const webhookUrl = appUrl 
        ? `${appUrl}/api/webhooks/calendly`
        : `${protocol}://${host}/api/webhooks/calendly`

      let userUri = info.userUri
      let orgUri = info.orgUri

      if (!userUri || !orgUri) {
        try {
          const userDetails = await fetchCalendlyUserDetails(token)
          userUri = userUri || userDetails.uri
          orgUri = orgUri || userDetails.current_organization

          const saveFields = [
            userUri ? { key: 'calendly_user_uri', value: userUri, updated_at: new Date().toISOString() } : null,
            orgUri ? { key: 'calendly_org_uri', value: orgUri, updated_at: new Date().toISOString() } : null,
          ].filter((item): item is { key: string; value: string; updated_at: string } => item !== null)

          if (saveFields.length > 0) {
            await supabase.from('settings').upsert(saveFields)
          }
        } catch (e: any) {
          console.error('Failed to fetch user/org URIs for webhook:', e)
          return NextResponse.json({ error: 'Failed to fetch Calendly user/org details', details: e.message }, { status: 400 })
        }
      }

      if (!userUri || !orgUri) {
        return NextResponse.json({ error: 'Missing user or organization URI from Calendly account' }, { status: 400 })
      }

      // 1. Create webhook subscription in Calendly
      const response = await fetch('https://api.calendly.com/webhook_subscriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
          events: ['invitee.created', 'invitee.canceled'],
          scope: 'user',
          user: userUri,
          organization: orgUri,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error('Failed to subscribe to Calendly webhooks:', errText)
        return NextResponse.json({ error: 'Calendly subscription failed', details: errText }, { status: 400 })
      }

      const resData = await response.json()
      const subscriptionUri = resData.resource.uri

      // 2. Save webhook subscription URI in settings
      await supabase.from('settings').upsert({
        key: 'calendly_webhook_subscription_uri',
        value: subscriptionUri,
        updated_at: new Date().toISOString(),
      })

      return NextResponse.json({ success: true, uri: subscriptionUri })
    } else if (action === 'unsubscribe') {
      // Get the existing webhook subscription URI
      const { data: subSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'calendly_webhook_subscription_uri')
        .single()

      if (subSetting?.value) {
        // Delete webhook subscription in Calendly
        const response = await fetch(subSetting.value, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok && response.status !== 404) {
          const errText = await response.text()
          console.error('Failed to delete webhook in Calendly:', errText)
          return NextResponse.json({ error: 'Calendly delete failed', details: errText }, { status: 400 })
        }
      }

      // Remove from settings
      await supabase.from('settings').delete().eq('key', 'calendly_webhook_subscription_uri')

      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
