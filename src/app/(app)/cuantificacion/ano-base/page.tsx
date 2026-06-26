'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CalendarClock, Save, Leaf } from 'lucide-react'
import { fmtT } from '@/lib/sig'

type Org = {
  base_year: number | null; base_year_justification: string | null; recalc_policy: string | null
  reporting_period_start: string | null; reporting_period_end: string | null; gwp_version: string | null
}

export default function AnoBasePage() {
  const supabase = createClient()
  const [f, setF] = useState<Org>({ base_year: null, base_year_justification: '', recalc_policy: '', reporting_period_start: '', reporting_period_end: '', gwp_version: '' })
  const [baseTotal, setBaseTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('org_settings')
      .select('base_year, base_year_justification, recalc_policy, reporting_period_start, reporting_period_end, gwp_version')
      .eq('id', 1).single()
    if (data) setF({
      base_year: data.base_year, base_year_justification: data.base_year_justification ?? '',
      recalc_policy: data.recalc_policy ?? '', reporting_period_start: data.reporting_period_start ?? '',
      reporting_period_end: data.reporting_period_end ?? '', gwp_version: data.gwp_version ?? '',
    })
    if (data?.base_year) {
      const { data: recs } = await supabase.from('emission_records').select('emissions_t').eq('year', data.base_year)
      setBaseTotal((recs ?? []).reduce((a: number, r: any) => a + (Number(r.emissions_t) || 0), 0))
    } else setBaseTotal(null)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true); setMsg('')
    const { error } = await supabase.from('org_settings').update({
      base_year: f.base_year || null, base_year_justification: f.base_year_justification || null,
      recalc_policy: f.recalc_policy || null, reporting_period_start: f.reporting_period_start || null,
      reporting_period_end: f.reporting_period_end || null, gwp_version: f.gwp_version || null,
    }).eq('id', 1)
    setSaving(false)
    setMsg(error ? 'Error: ' + error.message : 'Guardado.')
    if (!error) load()
  }

  if (loading) return <p className="text-gray-400 text-sm">Cargando…</p>

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 6.4 · Año base</p>
          <h1 className="page-title">Año base del inventario</h1>
        </div>
        <button className="btn-primary" onClick={save} disabled={saving}><Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar'}</button>
      </div>

      {msg && <div className="bg-teal-50 text-teal-800 text-sm px-3 py-2 rounded-xl mb-4">{msg}</div>}

      {f.base_year && (
        <div className="card mb-4 flex items-center gap-3 bg-teal-50/50 border-teal-100">
          <Leaf className="w-8 h-8 text-teal-600" />
          <div>
            <div className="text-2xl font-bold text-gray-900 leading-none">{fmtT(baseTotal)} <span className="text-base font-medium text-gray-500">t CO₂eq</span></div>
            <div className="text-xs text-gray-500 mt-1">Emisiones totales del año base ({f.base_year})</div>
          </div>
        </div>
      )}

      <div className="card space-y-4 max-w-2xl">
        <div className="flex items-center gap-2 text-gray-700 font-medium"><CalendarClock className="w-5 h-5 text-teal-600" /> Parámetros del año base</div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Año base</label><input type="number" className="input" value={f.base_year ?? ''} onChange={e => setF({ ...f, base_year: e.target.value ? Number(e.target.value) : null })} /></div>
          <div><label className="label">Versión de GWP</label><input className="input" placeholder="IPCC AR5 (GWP100)" value={f.gwp_version ?? ''} onChange={e => setF({ ...f, gwp_version: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Período de reporte — inicio</label><input type="date" className="input" value={f.reporting_period_start ?? ''} onChange={e => setF({ ...f, reporting_period_start: e.target.value })} /></div>
          <div><label className="label">Período de reporte — fin</label><input type="date" className="input" value={f.reporting_period_end ?? ''} onChange={e => setF({ ...f, reporting_period_end: e.target.value })} /></div>
        </div>
        <div><label className="label">Justificación de la elección del año base</label><textarea className="input" rows={3} value={f.base_year_justification ?? ''} onChange={e => setF({ ...f, base_year_justification: e.target.value })} /></div>
        <div><label className="label">Política de recálculo del año base</label><textarea className="input" rows={3} placeholder="Criterios y umbral de significancia para recalcular el año base ante cambios estructurales…" value={f.recalc_policy ?? ''} onChange={e => setF({ ...f, recalc_policy: e.target.value })} /></div>
      </div>
    </>
  )
}
