'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, FileBarChart, ChevronDown, ChevronRight } from 'lucide-react'
import { REPORT_STATUS, ISO_CATEGORIES, ISO_CATEGORY_KEYS, fmtT } from '@/lib/sig'
import { StatusBadge } from '@/components/ui/Badge'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError, formatDate } from '@/lib/utils'

type Report = {
  id: string; number: string | null; year: number; fecha_emision: string | null; resumen: string | null
  conclusiones: string | null; aprobado_por: string | null; status: string
  responsible_party: string | null; org_boundary_desc: string | null; methodologies: string | null
  ef_gwp_sources: string | null; uncertainty_summary: string | null; base_year_info: string | null
  recalculations: string | null; exclusions: string | null; biogenic_note: string | null
  conformity_statement: string | null; assurance_level: string | null; verifier: string | null
}

// Secciones del contenido requerido por la cláusula 9 de ISO 14064-1.
const CLAUSE9: { key: keyof Report; label: string }[] = [
  { key: 'responsible_party',    label: 'Organización y responsable del inventario' },
  { key: 'org_boundary_desc',    label: 'Límites de la organización' },
  { key: 'base_year_info',       label: 'Año base' },
  { key: 'methodologies',        label: 'Metodologías de cuantificación' },
  { key: 'ef_gwp_sources',       label: 'Factores de emisión y GWP utilizados' },
  { key: 'uncertainty_summary',  label: 'Evaluación de la incertidumbre' },
  { key: 'recalculations',       label: 'Cambios y recálculos' },
  { key: 'exclusions',           label: 'Exclusiones justificadas' },
  { key: 'biogenic_note',        label: 'Emisiones de CO₂ biogénico' },
  { key: 'conformity_statement', label: 'Declaración de conformidad con ISO 14064-1' },
]

export default function InformePage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Report[]>([])
  const [totals, setTotals] = useState<Record<number, { total: number; byCat: Record<string, number> }>>({})
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<Report> | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('ghg_reports').select('*').order('year', { ascending: false })
    const reports = (data as any as Report[]) ?? []
    setRows(reports)
    const out: Record<number, { total: number; byCat: Record<string, number> }> = {}
    for (const y of Array.from(new Set(reports.map(r => r.year)))) {
      const { data: recs } = await supabase.from('emission_records').select('category_key, emissions_t').eq('year', y)
      const byCat: Record<string, number> = {}
      let total = 0
      for (const r of (recs ?? []) as any[]) {
        const t = Number(r.emissions_t) || 0; total += t
        if (r.category_key) byCat[r.category_key] = (byCat[r.category_key] ?? 0) + t
      }
      out[y] = { total, byCat }
    }
    setTotals(out)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Report) {
    if (!confirm(`¿Eliminar el informe ${r.number ?? r.year}?`)) return
    await supabase.from('ghg_reports').delete().eq('id', r.id); load()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 9 · Reporte verificable</p>
          <h1 className="page-title">Informe de huella</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ year: new Date().getFullYear(), status: 'borrador' })}><Plus className="w-4 h-4" /> Nuevo</button>
      </div>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : rows.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <FileBarChart className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay informes de huella generados.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(r => <Row key={r.id} r={r} t={totals[r.year]} onEdit={() => setEdit(r)} onDelete={() => del(r)} />)}
          </div>
        )}

      {edit && <Form row={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Row({ r, t, onEdit, onDelete }: { r: Report; t?: { total: number; byCat: Record<string, number> }; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const filled = CLAUSE9.filter(s => (r[s.key] as string)?.trim()).length
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setOpen(o => !o)} className="min-w-0 text-left flex items-start gap-2 flex-1">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400 mt-0.5" /> : <ChevronRight className="w-4 h-4 text-gray-400 mt-0.5" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-gray-400">{r.number}</span>
              <span className="font-medium text-gray-900">Informe de huella {r.year}</span>
              <StatusBadge map={REPORT_STATUS} value={r.status} />
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {t ? `${fmtT(t.total)} t CO₂eq · ` : ''}{r.fecha_emision ? `Emitido ${formatDate(r.fecha_emision)}` : 'Sin emitir'} · {filled}/{CLAUSE9.length} secciones cl. 9
            </div>
          </div>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit} className="p-2 text-gray-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
          <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3 text-sm">
          {t && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ISO_CATEGORY_KEYS.filter(k => t.byCat[k]).map(k => (
                <div key={k} className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="text-xs text-gray-500">{ISO_CATEGORIES[k].short}</div>
                  <div className="font-semibold text-gray-900 tabular-nums">{fmtT(t.byCat[k])} t</div>
                </div>
              ))}
              <div className="bg-teal-50 rounded-lg px-3 py-2">
                <div className="text-xs text-teal-700">Total</div>
                <div className="font-bold text-teal-800 tabular-nums">{fmtT(t.total)} t</div>
              </div>
            </div>
          )}
          {r.resumen && <Section title="Resumen" value={r.resumen} />}
          {CLAUSE9.map(s => (r[s.key] as string)?.trim() ? <Section key={s.key} title={s.label} value={r[s.key] as string} /> : null)}
          {r.conclusiones && <Section title="Conclusiones" value={r.conclusiones} />}
          {(r.assurance_level || r.verifier) && <div className="text-xs text-gray-500">Aseguramiento: {r.assurance_level || '—'}{r.verifier ? ` · Verificador: ${r.verifier}` : ''}</div>}
        </div>
      )}
    </div>
  )
}

function Section({ title, value }: { title: string; value: string }) {
  return <div><div className="text-xs font-semibold text-gray-500 mb-0.5">{title}</div><p className="text-gray-700 whitespace-pre-wrap">{value}</p></div>
}

function Form({ row, onClose, onSaved }: { row: Partial<Report>; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState<any>({
    year: row.year ?? new Date().getFullYear(), fecha_emision: row.fecha_emision ?? '', resumen: row.resumen ?? '',
    conclusiones: row.conclusiones ?? '', aprobado_por: row.aprobado_por ?? '', status: row.status ?? 'borrador',
    responsible_party: row.responsible_party ?? '', org_boundary_desc: row.org_boundary_desc ?? '', base_year_info: row.base_year_info ?? '',
    methodologies: row.methodologies ?? '', ef_gwp_sources: row.ef_gwp_sources ?? '', uncertainty_summary: row.uncertainty_summary ?? '',
    recalculations: row.recalculations ?? '', exclusions: row.exclusions ?? '', biogenic_note: row.biogenic_note ?? '',
    conformity_statement: row.conformity_statement ?? '', assurance_level: row.assurance_level ?? '', verifier: row.verifier ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: string) => setF({ ...f, [k]: v })

  async function save() {
    if (!f.year) { setError('El año es obligatorio.'); return }
    setSaving(true); setError('')
    const s = (v: string) => v || null
    const payload: any = {
      year: Number(f.year), fecha_emision: f.fecha_emision || null, resumen: s(f.resumen), conclusiones: s(f.conclusiones),
      aprobado_por: s(f.aprobado_por), status: f.status,
      responsible_party: s(f.responsible_party), org_boundary_desc: s(f.org_boundary_desc), base_year_info: s(f.base_year_info),
      methodologies: s(f.methodologies), ef_gwp_sources: s(f.ef_gwp_sources), uncertainty_summary: s(f.uncertainty_summary),
      recalculations: s(f.recalculations), exclusions: s(f.exclusions), biogenic_note: s(f.biogenic_note),
      conformity_statement: s(f.conformity_statement), assurance_level: s(f.assurance_level), verifier: s(f.verifier),
    }
    const res = isEdit ? await supabase.from('ghg_reports').update(payload).eq('id', row.id) : await supabase.from('ghg_reports').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? `Editar ${row.number ?? 'informe'}` : 'Nuevo informe'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Año *"><input type="number" className="input" value={f.year} onChange={e => set('year', e.target.value)} /></Field>
        <Field label="Fecha de emisión"><input type="date" className="input" value={f.fecha_emision} onChange={e => set('fecha_emision', e.target.value)} /></Field>
        <Field label="Estado"><select className="input" value={f.status} onChange={e => set('status', e.target.value)}>{Object.entries(REPORT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      </div>
      <Field label="Resumen ejecutivo"><textarea className="input" rows={2} value={f.resumen} onChange={e => set('resumen', e.target.value)} /></Field>

      <div className="mt-1 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contenido requerido — cláusula 9</div>
      <Field label="Organización y responsable del inventario"><textarea className="input" rows={2} value={f.responsible_party} onChange={e => set('responsible_party', e.target.value)} /></Field>
      <Field label="Límites de la organización"><textarea className="input" rows={2} value={f.org_boundary_desc} onChange={e => set('org_boundary_desc', e.target.value)} /></Field>
      <Field label="Año base"><textarea className="input" rows={2} value={f.base_year_info} onChange={e => set('base_year_info', e.target.value)} /></Field>
      <Field label="Metodologías de cuantificación"><textarea className="input" rows={2} value={f.methodologies} onChange={e => set('methodologies', e.target.value)} /></Field>
      <Field label="Factores de emisión y GWP utilizados"><textarea className="input" rows={2} value={f.ef_gwp_sources} onChange={e => set('ef_gwp_sources', e.target.value)} /></Field>
      <Field label="Evaluación de la incertidumbre"><textarea className="input" rows={2} value={f.uncertainty_summary} onChange={e => set('uncertainty_summary', e.target.value)} /></Field>
      <Field label="Cambios y recálculos"><textarea className="input" rows={2} value={f.recalculations} onChange={e => set('recalculations', e.target.value)} /></Field>
      <Field label="Exclusiones justificadas"><textarea className="input" rows={2} value={f.exclusions} onChange={e => set('exclusions', e.target.value)} /></Field>
      <Field label="Emisiones de CO₂ biogénico"><textarea className="input" rows={2} value={f.biogenic_note} onChange={e => set('biogenic_note', e.target.value)} /></Field>
      <Field label="Declaración de conformidad con ISO 14064-1"><textarea className="input" rows={2} value={f.conformity_statement} onChange={e => set('conformity_statement', e.target.value)} /></Field>

      <div className="mt-1 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Verificación</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nivel de aseguramiento"><input className="input" placeholder="Razonable / Limitado" value={f.assurance_level} onChange={e => set('assurance_level', e.target.value)} /></Field>
        <Field label="Verificador / OVV"><input className="input" value={f.verifier} onChange={e => set('verifier', e.target.value)} /></Field>
      </div>
      <Field label="Conclusiones"><textarea className="input" rows={2} value={f.conclusiones} onChange={e => set('conclusiones', e.target.value)} /></Field>
      <Field label="Aprobado por"><input className="input" value={f.aprobado_por} onChange={e => set('aprobado_por', e.target.value)} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
