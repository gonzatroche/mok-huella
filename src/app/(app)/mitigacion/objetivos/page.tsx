'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Target } from 'lucide-react'
import { TARGET_STATUS, ISO_CATEGORIES, ISO_CATEGORY_KEYS } from '@/lib/sig'
import { StatusBadge } from '@/components/ui/Badge'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError } from '@/lib/utils'

type Persona = { id: string; nombre: string }
type Target = {
  id: string; number: string | null; title: string; category_key: string | null; indicador: string | null
  baseline_value: number | null; baseline_year: number | null; target_value: number | null; target_year: number | null
  unit: string | null; responsable_id: string | null; status: string; notas: string | null
}

export default function ObjetivosPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Target[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<Target> | null>(null)

  async function load() {
    setLoading(true)
    const [{ data }, { data: p }] = await Promise.all([
      supabase.from('reduction_targets').select('*').order('created_at', { ascending: false }),
      supabase.from('personas').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setRows((data as any) ?? []); setPersonas((p as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Target) {
    if (!confirm(`¿Eliminar el objetivo "${r.title}"?`)) return
    await supabase.from('reduction_targets').delete().eq('id', r.id); load()
  }

  function progress(r: Target): number | null {
    if (r.baseline_value == null || r.target_value == null || r.baseline_value === r.target_value) return null
    // Solo informativo: posición de la meta respecto a la línea base (reducción esperada)
    const red = ((r.baseline_value - r.target_value) / r.baseline_value) * 100
    return Math.round(red)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 7 · Mitigación</p>
          <h1 className="page-title">Objetivos de reducción</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ status: 'activo', unit: 't CO2eq' })}><Plus className="w-4 h-4" /> Nuevo</button>
      </div>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : rows.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay objetivos de reducción cargados.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(r => {
              const red = progress(r)
              return (
                <div key={r.id} className="card flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-gray-400">{r.number}</span>
                      <span className="font-medium text-gray-900">{r.title}</span>
                      <StatusBadge map={TARGET_STATUS} value={r.status} />
                      {r.category_key && <span className={`badge ${ISO_CATEGORIES[r.category_key]?.color ?? 'bg-gray-100'}`}>{ISO_CATEGORIES[r.category_key]?.short}</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {r.indicador ? `${r.indicador} · ` : ''}
                      {r.baseline_value != null ? `Base ${r.baseline_value}${r.baseline_year ? ` (${r.baseline_year})` : ''}` : ''}
                      {r.target_value != null ? ` → Meta ${r.target_value}${r.target_year ? ` (${r.target_year})` : ''} ${r.unit ?? ''}` : ''}
                      {red != null ? ` · −${red}%` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setEdit(r)} className="p-2 text-gray-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => del(r)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {edit && <Form row={edit} personas={personas} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Form({ row, personas, onClose, onSaved }: { row: Partial<Target>; personas: Persona[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({
    title: row.title ?? '', category_key: row.category_key ?? '', indicador: row.indicador ?? '',
    baseline_value: row.baseline_value != null ? String(row.baseline_value) : '', baseline_year: row.baseline_year != null ? String(row.baseline_year) : '',
    target_value: row.target_value != null ? String(row.target_value) : '', target_year: row.target_year != null ? String(row.target_year) : '',
    unit: row.unit ?? 't CO2eq', responsable_id: row.responsable_id ?? '', status: row.status ?? 'activo', notas: row.notas ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!f.title.trim()) { setError('El título es obligatorio.'); return }
    setSaving(true); setError('')
    const num = (v: string) => v ? Number(v) : null
    const payload: any = {
      title: f.title.trim(), category_key: f.category_key || null, indicador: f.indicador || null,
      baseline_value: num(f.baseline_value), baseline_year: num(f.baseline_year),
      target_value: num(f.target_value), target_year: num(f.target_year),
      unit: f.unit || null, responsable_id: f.responsable_id || null, status: f.status, notas: f.notas || null,
    }
    const res = isEdit ? await supabase.from('reduction_targets').update(payload).eq('id', row.id) : await supabase.from('reduction_targets').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? `Editar ${row.number ?? 'objetivo'}` : 'Nuevo objetivo'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <Field label="Título *"><input className="input" placeholder="Reducir emisiones de Categoría 1 un 5% anual" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoría ISO"><select className="input" value={f.category_key} onChange={e => setF({ ...f, category_key: e.target.value })}><option value="">—</option>{ISO_CATEGORY_KEYS.map(k => <option key={k} value={k}>{ISO_CATEGORIES[k].short}</option>)}</select></Field>
        <Field label="Estado"><select className="input" value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>{Object.entries(TARGET_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      </div>
      <Field label="Indicador"><input className="input" placeholder="t CO₂eq totales / intensidad por unidad…" value={f.indicador} onChange={e => setF({ ...f, indicador: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor base"><input type="number" step="any" className="input" value={f.baseline_value} onChange={e => setF({ ...f, baseline_value: e.target.value })} /></Field>
        <Field label="Año base"><input type="number" className="input" value={f.baseline_year} onChange={e => setF({ ...f, baseline_year: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Meta"><input type="number" step="any" className="input" value={f.target_value} onChange={e => setF({ ...f, target_value: e.target.value })} /></Field>
        <Field label="Año meta"><input type="number" className="input" value={f.target_year} onChange={e => setF({ ...f, target_year: e.target.value })} /></Field>
        <Field label="Unidad"><input className="input" value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} /></Field>
      </div>
      <Field label="Responsable"><select className="input" value={f.responsable_id} onChange={e => setF({ ...f, responsable_id: e.target.value })}><option value="">—</option>{personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
      <Field label="Notas"><textarea className="input" rows={2} value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
