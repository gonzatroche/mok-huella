import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Gestión de usuarios (solo admin). Usa service_role para listar/crear/editar
// usuarios de Auth y sincronizar la fila en user_profiles.
//
// Autenticación: valida el token Bearer que manda el cliente (robusto en
// producción/Vercel) y, como respaldo, la sesión por cookies.

async function requireAdmin(req: Request) {
  const admin = createAdminClient()

  // 1) Token Bearer enviado por el cliente.
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  let userId: string | null = null
  if (token) {
    const { data, error } = await admin.auth.getUser(token)
    if (!error && data.user) userId = data.user.id
  }

  // 2) Respaldo: sesión por cookies (SSR).
  if (!userId) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) userId = user.id
  }

  if (!userId) return { error: 'No autenticado', status: 401 as const }

  // Rol: sin perfil → admin (fallback, igual que en AppLayout).
  const { data: prof } = await admin.from('user_profiles').select('role').eq('id', userId).single()
  const role = (prof as any)?.role ?? 'admin'
  if (role !== 'admin') return { error: 'No autorizado', status: 403 as const }
  return { ok: true as const }
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const admin = createAdminClient()
  const { data: list, error } = await admin.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { data: profiles } = await admin.from('user_profiles').select('id, role, full_name')
  const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]))
  const users = list.users.map(u => ({
    id: u.id, email: u.email,
    full_name: byId.get(u.id)?.full_name ?? '',
    role: byId.get(u.id)?.role ?? 'admin',
  }))
  return NextResponse.json({ users })
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { email, password, full_name, role } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await admin.from('user_profiles').upsert({ id: data.user.id, email, full_name: full_name ?? null, role: role ?? 'general' })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id, email, role, full_name } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const admin = createAdminClient()
  await admin.from('user_profiles').upsert({ id, email: email ?? null, role, full_name: full_name ?? null })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await admin.from('user_profiles').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
