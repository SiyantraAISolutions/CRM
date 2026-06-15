import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 })
  }

  const clientId = process.env.CALENDLY_CLIENT_ID
  const clientSecret = process.env.CALENDLY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Calendly client credentials are not configured' }, { status: 500 })
  }

  const host = req.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const redirectUri = `${protocol}://${host}/api/calendly/callback`

  try {
    // Exchange authorization code for token
    const tokenResponse = await fetch('https://auth.calendly.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Failed to exchange code for token:', errorText)
      return NextResponse.json({ error: 'Failed to exchange token', details: errorText }, { status: 400 })
    }

    const tokenData = await tokenResponse.json()
    const { access_token, refresh_token, expires_in, organization, user } = tokenData

    // Calculate expiry timestamp
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    // Save tokens in Supabase settings table
    const supabase = getSupabaseAdmin()

    const upsertSettings = [
      { key: 'calendly_access_token', value: access_token, updated_at: new Date().toISOString() },
      { key: 'calendly_refresh_token', value: refresh_token, updated_at: new Date().toISOString() },
      { key: 'calendly_expires_at', value: expiresAt, updated_at: new Date().toISOString() },
      user ? { key: 'calendly_user_uri', value: user, updated_at: new Date().toISOString() } : null,
      organization ? { key: 'calendly_org_uri', value: organization, updated_at: new Date().toISOString() } : null,
    ].filter((item): item is { key: string; value: string; updated_at: string } => item !== null)

    const { error } = await supabase.from('settings').upsert(upsertSettings)

    if (error) {
      console.error('Failed to save Calendly tokens in Supabase:', error)
      return NextResponse.json({ error: 'Database error saving tokens', details: error.message }, { status: 500 })
    }

    // Redirect user back to the CRM settings panel with connected state
    const baseUrl = `${protocol}://${host}`
    return NextResponse.redirect(`${baseUrl}/admin/settings?tab=general&calendly=connected`)
  } catch (err: any) {
    console.error('OAuth callback error:', err)
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 })
  }
}
