import { createClient } from '@supabase/supabase-js'

// Cliente admin con service_role. SOLO usar en código server-side (route handlers).
// Nunca importar esto en componentes cliente: expondría la clave secreta.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
