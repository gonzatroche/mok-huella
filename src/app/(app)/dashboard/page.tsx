'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CHAPTERS, fmtT } from '@/lib/sig'
import { NAV_GROUP_BY_SLUG } from '@/lib/nav'
import { fetchAll } from '@/lib/utils'
import { Leaf, Factory, ClipboardCheck, Target, AlertTriangle, Flame } from 'lucide-react'

const CY = new Date().getFullYear()

export default function DashboardPage() {
  const supabase = createClient()
  const [org, setOrg] = useState<string>('')
  const [kpi, setKpi] = useState<Record<string, number | string>>({})

  useEffect(() => {
    (async () => {
      const { data: o } = await supabase.from('org_settings').select('org_name').eq('id', 1).single()
      if (o?.org_name) setOrg(o.org_name)

      const count = async (table: string, build?: (q: any) => any) => {
        let q = supabase.from(table).select('*', { count: 'exact', head: true })
        if (build) q = build(q)
        const { count: c } = await q
        return c ?? 0
      }
      const recs = await fetchAll<{ emissions_t: number | null }>((from, to) =>
        supabase.from('emission_records').select('emissions_t').eq('year', CY).range(from, to))
      const total = recs.reduce((a, r) => a + (Number(r.emissions_t) || 0), 0)

      const [sitios, pend, obj, nc, fuentes] = await Promise.all([
        count('sites', q => q.eq('status', 'activa')),
        count('emission_records', q => q.eq('verified', 'pendiente').eq('year', CY)),
        count('reduction_targets', q => q.eq('status', 'activo')),
        count('nonconformities', q => q.neq('status', 'cerrada')),
        count('emission_sources', q => q.eq('activo', true)),
      ])
      setKpi({ total: fmtT(total), sitios, pend, obj, nc, fuentes })
    })()
  }, [])

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{org || 'Huella de Carbono Corporativa'}</h1>
          <p className="text-sm text-gray-500">Inventario de GEI · ISO 14064-1:2018 · Panel {CY}</p>
        </div>
      </div>

      <div className="card mb-5 flex items-center gap-3 bg-teal-50/50 border-teal-100">
        <Leaf className="w-9 h-9 text-teal-600" />
        <div>
          <div className="text-3xl font-bold text-gray-900 leading-none">{kpi.total ?? '—'} <span className="text-base font-medium text-gray-500">t CO₂eq</span></div>
          <div className="text-xs text-gray-500 mt-1">Emisiones totales del año {CY}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <Kpi icon={Factory} color="text-sky-600" label="Sitios activos" value={kpi.sitios} href="/limites/sitios" />
        <Kpi icon={ClipboardCheck} color="text-amber-600" label="Registros sin verificar" value={kpi.pend} href="/cuantificacion/inventario" />
        <Kpi icon={Target} color="text-teal-600" label="Objetivos activos" value={kpi.obj} href="/mitigacion/objetivos" />
        <Kpi icon={AlertTriangle} color="text-red-600" label="NC abiertas" value={kpi.nc} href="/verificacion/no-conformidades" />
        <Kpi icon={Flame} color="text-orange-600" label="Fuentes en catálogo" value={kpi.fuentes} href="/cuantificacion/fuentes" />
      </div>

      <h2 className="font-semibold text-gray-900 mb-3">Módulos del sistema</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {CHAPTERS.map(c => {
          const g = NAV_GROUP_BY_SLUG[c.slug]
          const Icon = g.icon
          return (
            <Link key={c.slug} href={`/${c.slug}`} className="card hover:shadow-md hover:border-teal-100 transition-all flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-gray-900">{typeof c.n === 'number' ? `${c.n}. ` : ''}{c.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{c.desc}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}

function Kpi({ icon: Icon, color, label, value, href }: { icon: any; color: string; label: string; value: any; href: string }) {
  return (
    <Link href={href} className="card flex items-center gap-3 py-3 hover:shadow-md transition-all">
      <Icon className={`w-7 h-7 ${color}`} />
      <div>
        <div className="text-2xl font-bold text-gray-900 leading-none">{value ?? '—'}</div>
        <div className="text-xs text-gray-500 mt-1">{label}</div>
      </div>
    </Link>
  )
}
