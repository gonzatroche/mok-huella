// Roles administrables (tabla `roles`). El gating de rutas se calcula con la
// lista de prefijos permitidos de cada rol ('*' = todas).

// Módulos del sistema (para configurar el acceso por rol).
export const MODULES: { href: string; label: string }[] = [
  { href: '/dashboard',      label: 'Dashboard' },
  { href: '/limites',        label: '5 · Límites' },
  { href: '/cuantificacion', label: '6 · Cuantificación' },
  { href: '/mitigacion',     label: '7 · Mitigación' },
  { href: '/gestion-datos',  label: '8 · Gestión de datos' },
  { href: '/reporte',        label: '9 · Reporte' },
  { href: '/verificacion',   label: 'Verificación' },
  { href: '/cbam',           label: 'CBAM' },
  { href: '/configuracion',  label: 'Configuración' },
]

// ¿La lista de rutas permite este href? '*' = todas.
export function canAccess(routes: string[] | null | undefined, href: string): boolean {
  if (!routes) return false
  if (routes.includes('*')) return true
  return routes.some(r => href === r || href.startsWith(r + '/'))
}

// Ruta de inicio según las rutas permitidas.
export function roleHome(routes: string[] | null | undefined): string {
  if (!routes || routes.includes('*')) return '/dashboard'
  return routes.find(r => r === '/dashboard') ?? routes[0] ?? '/dashboard'
}

// Etiquetas de respaldo (si la tabla roles aún no está disponible).
export const ROLE_LABELS_FALLBACK: Record<string, string> = {
  admin: 'Administrador (acceso total)', responsable: 'Responsable de Huella / SGI',
  verificador: 'Verificador / Auditor', carga: 'Responsable de carga de datos',
  direccion: 'Dirección (solo lectura de reporte)', solo_ver: 'Solo lectura',
}
