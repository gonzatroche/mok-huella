import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Refresca la sesión de Supabase en cada request y sincroniza las cookies,
// para que las rutas server (route handlers / componentes server) puedan leer
// la sesión del usuario de forma confiable.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // Importante: refresca el token si hace falta (escribe las cookies nuevas).
  await supabase.auth.getUser()

  return response
}

export const config = {
  // Corre en todo menos assets estáticos.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
