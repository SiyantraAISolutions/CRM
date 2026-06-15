import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface CalendlyTokenInfo {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: string | null
  userUri: string | null
  orgUri: string | null
}

export async function getCalendlyTokenInfo(): Promise<CalendlyTokenInfo> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [
      'calendly_access_token',
      'calendly_refresh_token',
      'calendly_expires_at',
      'calendly_user_uri',
      'calendly_org_uri',
    ])

  const settingsMap = Object.fromEntries((data ?? []).map(s => [s.key, s.value]))

  return {
    accessToken: settingsMap['calendly_access_token'] || null,
    refreshToken: settingsMap['calendly_refresh_token'] || null,
    expiresAt: settingsMap['calendly_expires_at'] || null,
    userUri: settingsMap['calendly_user_uri'] || null,
    orgUri: settingsMap['calendly_org_uri'] || null,
  }
}

export async function getValidCalendlyToken(): Promise<string | null> {
  const info = await getCalendlyTokenInfo()
  if (!info.accessToken) return null

  // If token is expired or expiring in the next 2 minutes, refresh it
  const isExpired =
    !info.expiresAt ||
    new Date(info.expiresAt).getTime() - Date.now() < 120 * 1000

  if (isExpired && info.refreshToken) {
    console.log('Calendly token expired or expiring soon, refreshing...')
    try {
      const clientId = process.env.CALENDLY_CLIENT_ID
      const clientSecret = process.env.CALENDLY_CLIENT_SECRET
      if (!clientId || !clientSecret) {
        throw new Error('Calendly client credentials not configured')
      }

      const response = await fetch('https://auth.calendly.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: info.refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to refresh Calendly token:', errorText)
        return null
      }

      const data = await response.json()
      const { access_token, refresh_token, expires_in } = data
      const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

      // Save new tokens
      const supabase = getSupabaseAdmin()
      await supabase.from('settings').upsert([
        { key: 'calendly_access_token', value: access_token, updated_at: new Date().toISOString() },
        { key: 'calendly_refresh_token', value: refresh_token, updated_at: new Date().toISOString() },
        { key: 'calendly_expires_at', value: expiresAt, updated_at: new Date().toISOString() },
      ])

      return access_token
    } catch (err) {
      console.error('Error refreshing Calendly token:', err)
      return null
    }
  }

  return info.accessToken
}

export async function fetchCalendlyUserDetails(accessToken: string) {
  const response = await fetch('https://api.calendly.com/users/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch user details: ${response.statusText}`)
  }

  const data = await response.json()
  return data.resource
}
