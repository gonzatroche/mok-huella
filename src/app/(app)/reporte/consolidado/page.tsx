'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ISO_CATEGORIES, ISO_CATEGORY_KEYS, fmtT } from '@/lib/sig'
import { fetchAll } from '@/lib/utils'
import { BarChart3 } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'

type Rec = { year: number; quarter: string | null; category_key: string | null; site_id: string | null; emissions_t: number | null }
type Site = { id: string; name: string }

const QS = ['T1', 'T2', 'T3', 'T4']
const PIE_COLORS = ['#dc2626', '#d97706', '#0284c7', '#4f46e5', '#7c3aed', '#6b7280']

export default function ConsolidadoPage() {
  const supabase = createClient()
  const [recs, setRecs] = useState<Rec[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState<string>('')

  useEffect(() => {
    (async () => {
      setLoading(true)
      const [data, { data: s }] = await Promise.all([
        fetchAll<Rec>((from, to) => supabase.from('emission_records').select('year, quarter, category_key, site_id, emissions_t').range(from, to)),
        supabase.from('sites').select('id, name').order('name'),
      ])
      setRecs(data ?? []); setSites((s as any) ?? [])
      const years = Array.from(new Set((data ?? []).map(r => r.year))).sort((a, b) => b - a)
      setYear(String(years[0] ?? new Date().getFullYear()))
      setLoading(false)
    })()
  }, [])

  const years = useMemo(() => Array.from(new Set(recs.map(r => r.year))).sort((a, b) => b - a), [recs])
  const inYear = recs.filter(r => String(r.year) === year)

  const byCat = ISO_CATEGORY_KEYS.map(k => {
    const items = inYear.filter(r => r.category_key === k)
    const byQ = QS.map(q => items.filter(r => r.quarter === q).reduce((a, r) => a + (Number(r.emissions_t) || 0), 0))
    const total = items.reduce((a, r) => a + (Number(r.emissions_t) || 0), 0)
    return { key: k, label: ISO_CATEGORIES[k].short, byQ, total }
  })
  const grandTotal = byCat.reduce((a, c) => a + c.total, 0)
  const qTotals = QS.map((_, i) => byCat.reduce((a, c) => a + c.byQ[i], 0))

  const pieData = byCat.filter(c => c.total > 0).map(c => ({ name: c.label, value: Number(c.total.toFixed(3)) }))
  const siteName = (id: string | null) => sites.find(s => s.id === id)?.name ?? 'Sin sitio'
  const bySite = Object.entries(inYear.reduce((acc: Record<string, number>, r) => {
    const k = siteName(r.site_id); acc[k] = (acc[k] ?? 0) + (Number(r.emissions_t) || 0); return acc
  }, {})).map(([name, total]) => ({ name, total: Number(total.toFixed(3)) })).sort((a, b) => b.total - a.total).slice(0, 10)

  if (loading) return <p className="text-gray-400 text-sm">Cargando…</p>

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 9 · Reporte</p>
          <h1 className="page-title">Consolidado de emisiones</h1>
        </div>
        <select className="input w-auto" value={year} onChange={e => setYear(e.target.value)}>
          {(years.length ? years : [Number(year)]).map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
      </div>

      <div className="card mb-5 flex items-center gap-3 bg-teal-50/50 border-teal-100">
        <BarChart3 className="w-8 h-8 text-teal-600" />
        <div>
          <div className="text-3xl font-bold text-gray-900 leading-none">{fmtT(grandTotal)} <span className="text-base font-medium text-gray-500">t CO₂eq</span></div>
          <div className="text-xs text-gray-500 mt-1">Emisiones totales de la organización · {year}</div>
        </div>
      </div>

      {grandTotal === 0 ? (
        <div className="card text-center text-gray-400 py-10">No hay emisiones registradas para {year}.</div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4 mb-5">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Distribución por categoría</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${(e.percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => `${fmtT(Number(v))} t`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Top sitios</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={bySite} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => `${fmtT(Number(v))} t`} />
                  <Bar dataKey="total" fill="#0d9488" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Resumen por categoría y trimestre (t CO₂eq)</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-2 font-medium">Categoría</th>
                  {QS.map(q => <th key={q} className="py-2 px-2 font-medium text-right">{q}</th>)}
                  <th className="py-2 pl-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {byCat.map(c => (
                  <tr key={c.key} className="border-b border-gray-50">
                    <td className="py-2 pr-2 text-gray-700">{c.label}</td>
                    {c.byQ.map((v, i) => <td key={i} className="py-2 px-2 text-right tabular-nums text-gray-600">{v ? fmtT(v) : '—'}</td>)}
                    <td className="py-2 pl-2 text-right tabular-nums font-semibold text-gray-900">{c.total ? fmtT(c.total) : '—'}</td>
                  </tr>
                ))}
                <tr className="font-semibold text-gray-900">
                  <td className="py-2 pr-2">Total organización</td>
                  {qTotals.map((v, i) => <td key={i} className="py-2 px-2 text-right tabular-nums">{fmtT(v)}</td>)}
                  <td className="py-2 pl-2 text-right tabular-nums text-teal-700">{fmtT(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
