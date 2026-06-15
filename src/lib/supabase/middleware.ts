import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { canAccess, getDashboardPath } from '@/lib/role'
import type { UserRole } from '@/types'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  // Exclude public webhook endpoints from auth checks
  if (pathname.startsWith('/api/webhooks/')) {
    return supabaseResponse
  }

  // Fast path check: if there is no Supabase auth token cookie, the user is unauthenticated
  const hasAuthCookie = request.cookies.getAll().some(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )

  if (!hasAuthCookie) {
    // Clear our cached cookies if any exist
    if (request.cookies.has('user-role') || request.cookies.has('user-id')) {
      supabaseResponse.cookies.set('user-role', '', { maxAge: 0, path: '/' })
      supabaseResponse.cookies.set('user-id', '', { maxAge: 0, path: '/' })
      supabaseResponse.cookies.set('user-fullname', '', { maxAge: 0, path: '/' })
      supabaseResponse.cookies.set('user-salestarget', '', { maxAge: 0, path: '/' })
      supabaseResponse.cookies.set('user-email', '', { maxAge: 0, path: '/' })
    }


    if (!pathname.startsWith('/login')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Retrieve cached user ID and role
  const cachedUserId = request.cookies.get('user-id')?.value
  const cachedUserRole = request.cookies.get('user-role')?.value

  let userId = cachedUserId
  let role = cachedUserRole

  if (!userId || !role) {
    // If not cached, perform the necessary Supabase API calls
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      if (!pathname.startsWith('/login')) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
      }
      return supabaseResponse
    }

    userId = user.id

    const { data: profile } = await supabase
      .from('users')
      .select('role, full_name, sales_target')
      .eq('id', user.id)
      .single()

    role = (profile?.role ?? 'sales') as UserRole
    const fullName = profile?.full_name ?? ''
    const salesTarget = String(profile?.sales_target ?? '0')

    // Cache the credentials in response cookies (expires in 1 hour)
    const cookieOptions = { maxAge: 60 * 60, path: '/' }
    supabaseResponse.cookies.set('user-id', userId, cookieOptions)
    supabaseResponse.cookies.set('user-role', role, cookieOptions)
    supabaseResponse.cookies.set('user-fullname', fullName, cookieOptions)
    supabaseResponse.cookies.set('user-salestarget', salesTarget, cookieOptions)
    supabaseResponse.cookies.set('user-email', user.email || '', cookieOptions)
  }


  // Redirect authenticated users away from login
  if (pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = getDashboardPath(role as UserRole)
    return NextResponse.redirect(url)
  }

  // Role-based access control for /admin routes
  if (pathname.startsWith('/admin')) {
    if (!canAccess(role as UserRole, pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/forbidden'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

