import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function formatE164(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0') && !digits.startsWith('00')) {
    // UK conversion: e.g. 07700900077 to 447700900077
    return '44' + digits.slice(1)
  }
  if (digits.startsWith('00')) {
    return digits.slice(2)
  }
  return digits
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { callee } = await req.json()
    if (!callee) {
      return NextResponse.json({ error: 'Missing callee phone number' }, { status: 400 })
    }

    // Load settings from DB
    const { data: settings } = await supabase.from('settings').select('key, value')
    const settingsMap = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]))

    const tokenId = settingsMap['sipgate_token_id']
    const tokenSecret = settingsMap['sipgate_token_secret']
    const callerId = settingsMap['sipgate_caller_id']
    const defaultDevice = settingsMap['sipgate_default_device_id'] || 'e0'
    const userDevice = settingsMap[`sipgate_device_user_${user.id}`] || defaultDevice

    if (!tokenId || !tokenSecret) {
      return NextResponse.json({ 
        error: 'Sipgate calling is not configured. Please enter your API Token ID and Secret in Settings.' 
      }, { status: 400 })
    }

    const basicAuth = Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64')
    const formattedCallee = formatE164(callee)

    console.log(`Initiating call from device ${userDevice} to ${formattedCallee}...`)

    const response = await fetch('https://api.sipgate.com/v2/sessions/calls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        deviceId: userDevice,
        caller: callerId || userDevice,
        callee: formattedCallee,
        callerId: callerId || undefined
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Sipgate API Error:', errorText)
      let parsedError: any = {}
      try { parsedError = JSON.parse(errorText) } catch (e) {}
      return NextResponse.json({ 
        error: parsedError.description || parsedError.message || `Sipgate API error: ${response.statusText}` 
      }, { status: response.status })
    }

    const resData = await response.json()
    return NextResponse.json({ success: true, callId: resData.sessionId })
  } catch (err: any) {
    console.error('Click-to-call internal error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
