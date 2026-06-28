'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Globe } from 'lucide-react'
import { CBAM_VERIF, cbamEmbedded, fmtT } from '@/lib/sig'
import { fetchAll } from '@/lib/utils'

type Good = { id: string; name: string; cn_code: string | null; default_unit: string | null }
type Inst = { id: string; name: string }
type Prec = { entry_id: string; quantity: number | null; see_direct: number | null; see_indirect: number | null }
type Entry = {
  id: string; number: string | null; installation_id: string | null; good_id: string | null; period_year: number
  period_label: string | null; activity_level: number | null; direct_emissions: number | null
  electricity_mwh: number | null; electricity_ef: number | null; verification_status: string
}

export default function ReporteCbamPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Entry[]>([])
  const [precs, setPrecs] = useState<Prec[]>([])
  const [goods, setGoods] = useState<Good[]>([])
  const [insts, setInsts] = useState<Inst[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState('')

  useEffect(() => {
    (async () => {
      setLoading(true)
      const [data, pr, { data: g }, { data: i }] = await Promise.all([
        fetchAll<Entry>((from, to) => supabase.from('cbam_entries').select('*').range(from, to)),
        fetchAll<Prec>((from, to) => supabase.from('cbam_precursors').select('entry_id, quantity, see_direct, see_indirect').range(from, to)),
        supabase.from('cbam_goods').select('id, name, cn_code, default_unit'),
        supabase.from('cbam_installations').select('id, name'),
      ])
      setRows(data ?? []); setPrecs(pr ?? []); setGoods((g as any) ?? []); setInsts((i as any) ?? [])
      const ys = Array.from(new Set((data ?? []).map(r => r.period_year))).sort((a, b) => b - a)
      setYear(String(ys[0] ?? new Date().getFullYear()))
      setLoading(false)
    })()
  }, [])

  const years = useMemo(() => Array.from(new Set(rows.map(r => r.period_year))).sort((a, b) => b - a), [rows])
  const inYear = rows.filter(r => String(r.period_year) === year)

  const lines = inYear.map(r => {
    const good = goods.find(g => g.id === r.good_id)
    const c = cbamEmbedded(r.activity_level, r.direct_emissions, r.electricity_mwh, r.electricity_ef, precs.filter(p => p.entry_id === r.id))
    return {
      id: r.id, number: r.number, cn: good?.cn_code ?? '—', good: good?.name ?? '—', unit: good?.default_unit ?? 't',
      inst: insts.find(i => i.id === r.installation_id)?.name ?? '—', period: r.period_label || String(r.period_year),
      activity: r.activity_level, seeDir: c.seeDirect, seeInd: c.seeIndirect, seeTot: c.seeTotal,
      totalEmb: c.totalDirect + c.totalIndirect, verified: r.verification_status,
    }
  })
  const totalEmb = lines.reduce((a, l) => a + (l.totalEmb || 0), 0)
  const verifiedCount = lines.filter(l => l.verified === 'verificado').length

  if (loading) return <p className="text-gray-400 text-sm">Cargando…</p>

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">CBAM · Reporte</p>
          <h1 className="page-title">Reporte CBAM</h1>
        </div>
        <select className="input w-auto" value={year} onChange={e => setYear(e.target.value)}>
          {(years.length ? years : [Number(year)]).map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
      </div>
      <p className="text-sm text-gray-500 mb-5 -mt-3">
        Emisiones incorporadas específicas por bien y código CN — base para el <i>communication template</i> de la UE.
      </p>

      <div className="card mb-5 flex items-center gap-3 bg-blue-50/50 border-blue-100">
        <Globe className="w-8 h-8 text-blue-600" />
        <div>
          <div className="text-2xl font-bold text-gray-900 leading-none">{fmtT(totalEmb)} <span className="text-base font-medium text-gray-500">t CO₂e</span></div>
          <div className="text-xs text-gray-500 mt-1">Emisiones incorporadas totales · {year} · {lines.length} bien(es) · {verifiedCount} verificado(s)</div>
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="card text-center text-gray-400 py-10">
          <Globe className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No hay declaraciones para {year}.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-2 font-medium">CN</th>
                <th className="py-2 px-2 font-medium">Bien</th>
                <th className="py-2 px-2 font-medium">Instalación</th>
                <th className="py-2 px-2 font-medium text-right">Producción</th>
                <th className="py-2 px-2 font-medium text-right">SEE dir.</th>
                <th className="py-2 px-2 font-medium text-right">SEE ind.</th>
                <th className="py-2 px-2 font-medium text-right">SEE total</th>
                <th className="py-2 px-2 font-medium text-right">Incorp. tot.</th>
                <th className="py-2 pl-2 font-medium">Verif.</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(l => (
                <tr key={l.id} className="border-b border-gray-50">
                  <td className="py-2 pr-2 font-mono text-xs text-gray-500">{l.cn}</td>
                  <td className="py-2 px-2 text-gray-800">{l.good}</td>
                  <td className="py-2 px-2 text-gray-500">{l.inst}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-gray-600">{l.activity != null ? `${fmtT(l.activity)} ${l.unit}` : '—'}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-gray-600">{l.seeDir != null ? fmtT(l.seeDir, 3) : '—'}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-gray-600">{l.seeInd != null ? fmtT(l.seeInd, 3) : '—'}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold text-blue-800">{l.seeTot != null ? fmtT(l.seeTot, 3) : '—'}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-gray-700">{fmtT(l.totalEmb)}</td>
                  <td className="py-2 pl-2 text-xs">{CBAM_VERIF[l.verified]?.label ?? l.verified}</td>
                </tr>
              ))}
              <tr className="font-semibold text-gray-900">
                <td className="py-2 pr-2" colSpan={7}>Total emisiones incorporadas</td>
                <td className="py-2 px-2 text-right tabular-nums text-blue-700">{fmtT(totalEmb)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-3">SEE = emisiones incorporadas específicas (t CO₂e por unidad de producto), incluyendo precursores. Valores para transcribir al communication template / CBAM Registry.</p>
        </div>
      )}
    </>
  )
}
