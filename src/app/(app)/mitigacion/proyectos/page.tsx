'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Sprout, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { PROJECT_STATUS, PROJECT_TIPO, ISO_CATEGORIES, ISO_CATEGORY_KEYS, fmtT } from '@/lib/sig'
import { StatusBadge } from '@/components/ui/Badge'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError, formatDate } from '@/lib/utils'

type Persona = { id: string; nombre: string }
type Target = { id: string; number: string | null; title: string }
type Meas = { id: string; project_id: string | null; period: string | null; baseline: number | null; actual: number | null; note: string | null }
type Project = {
  id: string; number: string | null; title: string; descripcion: string | null; category_key: string | null
  tipo: string; estimated_reduction: number | null; responsable_id: string | null
  fecha_inicio: string | null; fecha_fin: string | null; status: string
  target_id: string | null; baseline_scenario: string | null; baseline_emissions: number | null
  actual_emissions: number | null; real_reduction: number | null; reflected_in_inventory: boolean; double_count_note: string | null
}

export default function ProyectosPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Project[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [targets, setTargets] = useState<Target[]>([])
  const [meas, setMeas] = useState<Meas[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<Project> | null>(null)

  async function load() {
    setLoading(true)
    const [{ data }, { data: p }, { data: t }, { data: m }] = await Promise.all([
      supabase.from('reduction_projects').select('*').order('created_at', { ascending: false }),
      supabase.from('personas').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('reduction_targets').select('id, number, title').order('created_at', { ascending: false }),
      supabase.from('reduction_measurements').select('id, project_id, period, baseline, actual, note').not('project_id', 'is', null).order('period'),
    ])
    setRows((data as any) ?? []); setPersonas((p as any) ?? []); setTargets((t as any) ?? []); setMeas((m as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Project) {
    if (!confirm(`¿Eliminar el proyecto "${r.title}"?`)) return
    await supabase.from('reduction_projects').delete().eq('id', r.id); load()
  }

  const personaName = (id: string | null) => personas.find(p => p.id === id)?.nombre ?? null
  // Reducción real total (excluyendo lo ya reflejado en el inventario, para no doble contar)
  const totalReal = rows.filter(r => ['implementado', 'verificado'].includes(r.status) && !r.reflected_in_inventory)
    .reduce((a, r) => a + (Number(r.real_reduction) || 0), 0)

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 7 · Mitigación</p>
          <h1 className="page-title">Proyectos de reducción</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ status: 'propuesto', tipo: 'reduccion' })}><Plus className="w-4 h-4" /> Nuevo</button>
      </div>

      {rows.length > 0 && (
        <div className="card mb-4 flex items-center gap-3 bg-emerald-50/50 border-emerald-100">
          <Sprout className="w-8 h-8 text-emerald-600" />
          <div>
            <div className="text-2xl font-bold text-gray-900 leading-none">{fmtT(totalReal)} <span className="text-base font-medium text-gray-500">t CO₂e</span></div>
            <div className="text-xs text-gray-500 mt-1">Reducción real de proyectos implementados/verificados <b>no</b> contabilizada ya en el inventario</div>
          </div>
        </div>
      )}

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : rows.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <Sprout className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay proyectos de reducción / remoción cargados.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <Row key={r.id} r={r} personaName={personaName} target={targets.find(t => t.id === r.target_id) ?? null}
                meas={meas.filter(m => m.project_id === r.id)} onEdit={() => setEdit(r)} onDelete={() => del(r)} reload={load} />
            ))}
          </div>
        )}

      {edit && <Form row={edit} personas={personas} targets={targets} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Row({ r, personaName, target, meas, onEdit, onDelete, reload }: {
  r: Project; personaName: (id: string | null) => string | null; target: Target | null; meas: Meas[]
  onEdit: () => void; onDelete: () => void; reload: () => void
}) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [mf, setMf] = useState<Partial<Meas> | null>(null)
  async function delMeas(id: string) { await supabase.from('reduction_measurements').delete().eq('id', id); reload() }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setOpen(o => !o)} className="min-w-0 text-left flex items-start gap-2 flex-1">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400 mt-0.5" /> : <ChevronRight className="w-4 h-4 text-gray-400 mt-0.5" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-gray-400">{r.number}</span>
              <span className="font-medium text-gray-900">{r.title}</span>
              <StatusBadge map={PROJECT_TIPO} value={r.tipo} />
              <StatusBadge map={PROJECT_STATUS} value={r.status} />
              {r.reflected_in_inventory && <span className="badge bg-gray-100 text-gray-600" title="La reducción ya está en el inventario general">Ya en inventario</span>}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {[target ? `Objetivo: ${target.title}` : null, personaName(r.responsable_id),
                r.fecha_inicio ? `desde ${formatDate(r.fecha_inicio)}` : null].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <div className="font-bold text-gray-900 tabular-nums leading-none">{r.real_reduction != null ? fmtT(r.real_reduction) : (r.estimated_reduction != null ? fmtT(r.estimated_reduction) : '—')}</div>
            <div className="text-[10px] text-gray-400">{r.real_reduction != null ? 'reducción real' : 'estimada'} t CO₂e</div>
          </div>
          <button onClick={onEdit} className="p-2 text-gray-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
          <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3 text-sm">
          {r.descripcion && <p className="text-gray-700 whitespace-pre-wrap">{r.descripcion}</p>}
          {(r.baseline_emissions != null || r.actual_emissions != null || r.baseline_scenario) && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <div className="text-xs font-semibold text-gray-500">Línea base (punto 7)</div>
              {r.baseline_scenario && <p className="text-gray-700 text-xs">{r.baseline_scenario}</p>}
              <div className="grid grid-cols-3 gap-2 mt-1">
                <Mini label="Escenario base" value={r.baseline_emissions != null ? `${fmtT(r.baseline_emissions)} t` : '—'} />
                <Mini label="Emisión real" value={r.actual_emissions != null ? `${fmtT(r.actual_emissions)} t` : '—'} />
                <Mini label="Reducción real" value={r.real_reduction != null ? `${fmtT(r.real_reduction)} t` : '—'} highlight />
              </div>
            </div>
          )}
          {r.reflected_in_inventory && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Esta reducción ya se refleja en el inventario general (no se contabiliza dos veces).{r.double_count_note ? ` ${r.double_count_note}` : ''}</span>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-gray-500">Seguimiento trimestral</div>
              <button onClick={() => setMf({})} className="text-xs text-teal-600 hover:text-teal-700 font-medium">+ Agregar</button>
            </div>
            {meas.length === 0 ? <p className="text-xs text-gray-400">Sin mediciones.</p> : (
              <div className="space-y-1">
                {meas.map(m => (
                  <div key={m.id} className="flex items-start justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <span className="font-medium text-gray-700">{m.period}</span>
                      <span className="text-xs text-gray-500 ml-2">base {fmtT(m.baseline)} · real {fmtT(m.actual)} · reduc {fmtT((Number(m.baseline) || 0) - (Number(m.actual) || 0))}</span>
                      {m.note && <div className="text-xs text-gray-400 mt-0.5">{m.note}</div>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setMf(m)} className="p-1 text-gray-400 hover:text-teal-600"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => delMeas(m.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {mf && <MeasForm projectId={r.id} meas={mf} onClose={() => setMf(null)} onSaved={() => { setMf(null); reload() }} />}
    </div>
  )
}

function Mini({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return <div className={`rounded px-2 py-1 ${highlight ? 'bg-emerald-100' : 'bg-white'}`}><div className="text-[10px] text-gray-500">{label}</div><div className={`font-semibold tabular-nums text-sm ${highlight ? 'text-emerald-800' : 'text-gray-800'}`}>{value}</div></div>
}

function MeasForm({ projectId, meas, onClose, onSaved }: { projectId: string; meas: Partial<Meas>; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!meas.id
  const [f, setF] = useState({ period: meas.period ?? '', baseline: meas.baseline != null ? String(meas.baseline) : '', actual: meas.actual != null ? String(meas.actual) : '', note: meas.note ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    if (!f.period.trim()) { setError('Indicá el período.'); return }
    setSaving(true); setError('')
    const num = (v: string) => v ? Number(v) : null
    const payload: any = { project_id: projectId, period: f.period.trim(), baseline: num(f.baseline), actual: num(f.actual), note: f.note || null }
    const res = isEdit ? await supabase.from('reduction_measurements').update(payload).eq('id', meas.id) : await supabase.from('reduction_measurements').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }
  return (
    <Modal title={isEdit ? 'Editar medición' : 'Nueva medición trimestral'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Período *"><input className="input" placeholder="T1-2026" value={f.period} onChange={e => setF({ ...f, period: e.target.value })} /></Field>
        <Field label="Base (t CO₂e)"><input type="number" step="any" className="input" value={f.baseline} onChange={e => setF({ ...f, baseline: e.target.value })} /></Field>
        <Field label="Real (t CO₂e)"><input type="number" step="any" className="input" value={f.actual} onChange={e => setF({ ...f, actual: e.target.value })} /></Field>
      </div>
      <Field label="Nota"><input className="input" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}

function Form({ row, personas, targets, onClose, onSaved }: { row: Partial<Project>; personas: Persona[]; targets: Target[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({
    title: row.title ?? '', descripcion: row.descripcion ?? '', category_key: row.category_key ?? '', tipo: row.tipo ?? 'reduccion',
    estimated_reduction: row.estimated_reduction != null ? String(row.estimated_reduction) : '',
    responsable_id: row.responsable_id ?? '', fecha_inicio: row.fecha_inicio ?? '', fecha_fin: row.fecha_fin ?? '', status: row.status ?? 'propuesto',
    target_id: row.target_id ?? '', baseline_scenario: row.baseline_scenario ?? '',
    baseline_emissions: row.baseline_emissions != null ? String(row.baseline_emissions) : '',
    actual_emissions: row.actual_emissions != null ? String(row.actual_emissions) : '',
    reflected_in_inventory: row.reflected_in_inventory ?? false, double_count_note: row.double_count_note ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const realRed = (f.baseline_emissions && f.actual_emissions) ? (Number(f.baseline_emissions) - Number(f.actual_emissions)) : null

  async function save() {
    if (!f.title.trim()) { setError('El título es obligatorio.'); return }
    setSaving(true); setError('')
    const num = (v: string) => v ? Number(v) : null
    const payload: any = {
      title: f.title.trim(), descripcion: f.descripcion || null, category_key: f.category_key || null, tipo: f.tipo,
      estimated_reduction: num(f.estimated_reduction), responsable_id: f.responsable_id || null,
      fecha_inicio: f.fecha_inicio || null, fecha_fin: f.fecha_fin || null, status: f.status,
      target_id: f.target_id || null, baseline_scenario: f.baseline_scenario || null,
      baseline_emissions: num(f.baseline_emissions), actual_emissions: num(f.actual_emissions),
      reflected_in_inventory: f.reflected_in_inventory, double_count_note: f.double_count_note || null,
    }
    const res = isEdit ? await supabase.from('reduction_projects').update(payload).eq('id', row.id) : await supabase.from('reduction_projects').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? `Editar ${row.number ?? 'proyecto'}` : 'Nuevo proyecto'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <Field label="Título *"><input className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Objetivo asociado"><select className="input" value={f.target_id} onChange={e => setF({ ...f, target_id: e.target.value })}><option value="">—</option>{targets.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></Field>
        <Field label="Estado"><select className="input" value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>{Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Tipo"><select className="input" value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}>{Object.entries(PROJECT_TIPO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Categoría"><select className="input" value={f.category_key} onChange={e => setF({ ...f, category_key: e.target.value })}><option value="">—</option>{ISO_CATEGORY_KEYS.map(k => <option key={k} value={k}>{ISO_CATEGORIES[k].short}</option>)}</select></Field>
        <Field label="Reducción estimada (t/año)"><input type="number" step="any" className="input" value={f.estimated_reduction} onChange={e => setF({ ...f, estimated_reduction: e.target.value })} /></Field>
      </div>

      <div className="mt-1 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Línea base (punto 7)</div>
      <Field label="Escenario base (qué habría emitido lo reemplazado)"><textarea className="input" rows={2} placeholder="Ej: maquinaria convencional, mismas horas/obra/período…" value={f.baseline_scenario} onChange={e => setF({ ...f, baseline_scenario: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Emisión base (t CO₂e)"><input type="number" step="any" className="input" value={f.baseline_emissions} onChange={e => setF({ ...f, baseline_emissions: e.target.value })} /></Field>
        <Field label="Emisión real (t CO₂e)"><input type="number" step="any" className="input" value={f.actual_emissions} onChange={e => setF({ ...f, actual_emissions: e.target.value })} /></Field>
        <div><label className="label">Reducción real</label><div className="input bg-gray-50 tabular-nums">{realRed != null ? fmtT(realRed) : '—'}</div></div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <input id="refl" type="checkbox" checked={f.reflected_in_inventory} onChange={e => setF({ ...f, reflected_in_inventory: e.target.checked })} />
        <label htmlFor="refl" className="text-sm text-gray-700">Esta reducción ya está reflejada en el inventario general (evitar doble conteo)</label>
      </div>
      {f.reflected_in_inventory && <Field label="Aclaración de doble conteo"><input className="input" value={f.double_count_note} onChange={e => setF({ ...f, double_count_note: e.target.value })} /></Field>}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Inicio"><input type="date" className="input" value={f.fecha_inicio ?? ''} onChange={e => setF({ ...f, fecha_inicio: e.target.value })} /></Field>
        <Field label="Fin"><input type="date" className="input" value={f.fecha_fin ?? ''} onChange={e => setF({ ...f, fecha_fin: e.target.value })} /></Field>
      </div>
      <Field label="Responsable"><select className="input" value={f.responsable_id} onChange={e => setF({ ...f, responsable_id: e.target.value })}><option value="">—</option>{personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
      <Field label="Descripción"><textarea className="input" rows={2} value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
