'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Cog, LogOut, Menu, X, ChevronDown } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import Logo from '@/components/Logo'
import { canAccess, roleHome } from '@/lib/roles'
import { NAV_GROUPS } from '@/lib/nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [routes, setRoutes] = useState<string[] | null>(null)
  const [ready, setReady] = useState(false)
  const [openSlug, setOpenSlug] = useState<string | null>(null)   // dropdown abierto (desktop)
  const [mobileOpen, setMobileOpen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.href = '/auth/login'; return }
      const { data: prof } = await supabase
        .from('user_profiles').select('role').eq('id', session.user.id).single()
      const key = (prof as any)?.role ?? 'admin'
      const { data: roleRow } = await supabase.from('roles').select('routes').eq('key', key).single()
      setRoutes((roleRow as any)?.routes ?? ['*'])
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (!ready || !routes) return
    if (!canAccess(routes, pathname)) router.replace(roleHome(routes))
  }, [ready, routes, pathname, router])

  // Cerrar dropdown al navegar o al hacer click afuera.
  useEffect(() => { setOpenSlug(null); setMobileOpen(false) }, [pathname])
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenSlug(null)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const groups = NAV_GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => canAccess(routes, i.href)) }))
    .filter(g => canAccess(routes, g.href) || g.items.length > 0)
  const showConfig = canAccess(routes, '/configuracion')
  const showDash = canAccess(routes, '/dashboard')

  if (!ready || (routes && !canAccess(routes, pathname))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* TOP BAR */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100">
        <div ref={barRef} className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center gap-2">
          <Link href="/dashboard" className="flex items-center gap-2 mr-2 shrink-0">
            <Logo size={30} withName />
          </Link>

          {/* NAV desktop */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1">
            {showDash && (
              <Link href="/dashboard"
                className={cn('px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname === '/dashboard' ? 'text-teal-700 bg-teal-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50')}>
                Inicio
              </Link>
            )}
            {groups.map(g => {
              const active = pathname.startsWith(g.href)
              const open = openSlug === g.slug
              return (
                <div key={g.slug} className="relative">
                  <button onClick={() => setOpenSlug(open ? null : g.slug)}
                    className={cn('px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
                      active ? 'text-teal-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50')}>
                    <span className={cn('tabular-nums', active ? 'text-teal-700' : 'text-gray-400')}>{g.n}</span>
                    {g.label.replace(/^\d+\s·\s/, '')}
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open ? 'rotate-180' : '')} />
                  </button>
                  {open && (
                    <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl border border-gray-200 shadow-lg p-1.5 z-50">
                      <Link href={g.href} className="block px-3 py-2 rounded-lg text-xs font-semibold text-teal-700 hover:bg-teal-50">
                        Ver módulo →
                      </Link>
                      {g.items.map(i => (
                        <Link key={i.href} href={i.href}
                          className={cn('block px-3 py-2 rounded-lg text-sm transition-colors',
                            pathname.startsWith(i.href) ? 'bg-teal-50 text-teal-700 font-medium' : 'text-gray-600 hover:bg-gray-50')}>
                          <span className="text-gray-400 text-xs mr-1.5">{i.clause}</span>{i.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          <div className="flex-1 lg:hidden" />

          {/* acciones derecha */}
          <div className="flex items-center gap-1 shrink-0">
            {showConfig && (
              <Link href="/configuracion" title="Configuración"
                className={cn('p-2 rounded-lg transition-colors',
                  pathname.startsWith('/configuracion') ? 'text-teal-700 bg-teal-50' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50')}>
                <Cog className="w-5 h-5" />
              </Link>
            )}
            <button onClick={handleLogout} title="Salir" className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors hidden lg:inline-flex">
              <LogOut className="w-5 h-5" />
            </button>
            <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg text-gray-600 hover:bg-gray-50 lg:hidden">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* MENÚ MÓVIL */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[88%] bg-white flex flex-col">
            <div className="px-4 h-16 flex items-center justify-between border-b border-gray-100 shrink-0">
              <Logo size={28} withName />
              <button onClick={() => setMobileOpen(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {showDash && (
                <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <LayoutDashboard className="w-4 h-4" /> Inicio
                </Link>
              )}
              {groups.map(g => <MobileGroup key={g.slug} group={g} pathname={pathname} />)}
            </nav>
            <div className="p-3 border-t border-gray-100 shrink-0 space-y-1">
              {showConfig && (
                <Link href="/configuracion" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <Cog className="w-4 h-4" /> Configuración
                </Link>
              )}
              <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 w-full">
                <LogOut className="w-4 h-4" /> Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-6 py-8 md:py-10">
        {children}
      </main>
    </div>
  )
}

function MobileGroup({ group, pathname }: { group: typeof NAV_GROUPS[number]; pathname: string }) {
  const active = pathname.startsWith(group.href)
  const [open, setOpen] = useState(active)
  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium',
          active ? 'text-teal-700' : 'text-gray-700 hover:bg-gray-50')}>
        <span className="tabular-nums text-gray-400">{group.n}</span>
        <span className="flex-1 text-left">{group.label.replace(/^\d+\s·\s/, '')}</span>
        <ChevronDown className={cn('w-4 h-4 transition-transform', open ? 'rotate-180' : '')} />
      </button>
      {open && (
        <div className="ml-3 pl-3 border-l border-gray-100 space-y-0.5 mb-1">
          {group.items.map(i => (
            <Link key={i.href} href={i.href}
              className={cn('block px-3 py-2 rounded-lg text-sm',
                pathname.startsWith(i.href) ? 'bg-teal-50 text-teal-700 font-medium' : 'text-gray-500 hover:bg-gray-50')}>
              <span className="text-gray-400 text-xs mr-1.5">{i.clause}</span>{i.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
