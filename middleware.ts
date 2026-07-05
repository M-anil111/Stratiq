import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options as any))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const isPublic = path.startsWith('/login') || path.startsWith('/forgot-password') || path.startsWith('/reset-password') || path.startsWith('/request-access') || path.startsWith('/api/auth') || path.startsWith('/api/cron') || path.startsWith('/approve') || path.startsWith('/api/approve') || path.startsWith('/share') || path.startsWith('/api/share')
  if (isPublic) return response

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = userData?.role
  const isClient = role === 'client'
  const isPortal = path.startsWith('/portal')

  if (isClient && !isPortal) {
    return NextResponse.redirect(new URL('/portal', request.url))
  }
  if (!isClient && isPortal) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
