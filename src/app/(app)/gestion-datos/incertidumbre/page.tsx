'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Sigma } from 'lucide-react'
import { UNCERTAINTY_APPROACH, UNCERTAINTY_DIMS, UNCERTAINTY_DIM_LEVEL, UNCERTAINTY_LEVEL, uncertaintyOverall } from '@/lib/sig'
import { StatusBadge } from '@/components/ui/Badge'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError, formatDate } from '@/lib/utils'

type Persona = { id: string; nombre: string }
type Assess = {
  id: string; year: number | null; scope: string | null; approach: string
  dim_representatividad: number | null; dim_temporal: number | null; dim_geografica: number | null
  dim_tecnologica: number | null; dim_completitud: number | null; overall_level: string | null
  uncertainty_pct: number | null; responsable_id: string | null; fecha: string | null; notes: string | null
}

export default function IncertidumbrePage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Assess[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<Assess> | null>(null)

  async function load() {
    setLoading(true)
    const [{ data }, { data: p }] = await Promise.all([
      supabase.from('uncertainty_assessments').select('*').order('year', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('personas').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setRows((data as any) ?? []); setPersonas((p as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Assess) {
    if (!confirm('¿Eliminar esta evaluación de incertidumbre?')) return
    await supabase.from('uncertainty_assessments').delete().eq('id', r.id); load()
  }
  const personaName = (id: string | null) => personas.find(p => p.id === id)?.nombre ?? null

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 6 / 8 · ISO 14064-1</p>
          <h1 className="page-title">Incertidumbre</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ approach: 'cualitativa' })}><Plus className="w-4 h-4" /> Nueva</button>
      </div>
      <p className="text-sm text-gray-500 mb-5 -mt-3">
        Evaluación de la incertidumbre del inventario. <b>Cualitativa</b> (matriz de dimensiones) cuando los factores no traen margen de error; <b>cuantitativa</b> (± %) cuando sí.
      </p>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : rows.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <Sigma className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay evaluaciones de incertidumbre cargadas.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="card flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{r.scope || 'Inventario'}</span>
                    <span className="badge bg-gray-100 text-gray-600">{UNCERTAINTY_APPROACH[r.approach] ?? r.approach}</span>
                    {r.approach === 'cualitativa' && r.overall_level && <StatusBadge map={UNCERTAINTY_LEVEL} value={r.overall_level} />}
                    {r.approach === 'cuantitativa' && r.uncertainty_pct != null && <span className="badge bg-sky-100 text-sky-800">± {r.uncertainty_pct}%</span>}
                    {r.year && <span className="badge bg-gray-100 text-gray-600">{r.year}</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[personaName(r.responsable_id), formatDate(r.fecha)].filter(Boolean).join(' · ')}
                  </div>
                  {r.notes && <p className="text-xs text-gray-500 mt-1">{r.notes}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setEdit(r)} className="p-2 text-gray-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => del(r)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

      {edit && <Form row={edit} personas={personas} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Form({ row, personas, onClose, onSaved }: { row: Partial<Assess>; personas: Persona[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({
    year: row.year != null ? String(row.year) : String(new Date().getFullYear()), scope: row.scope ?? '', approach: row.approach ?? 'cualitativa',
    dim_representatividad: row.dim_representatividad ?? 2, dim_temporal: row.dim_temporal ?? 2, dim_geografica: row.dim_geografica ?? 2,
    dim_tecnologica: row.dim_tecnologica ?? 2, dim_completitud: row.dim_completitud ?? 2,
    uncertainty_pct: row.uncertainty_pct != null ? String(row.uncertainty_pct) : '',
    responsable_id: row.responsable_id ?? '', fecha: row.fecha ?? '', notes: row.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dims = [f.dim_representatividad, f.dim_temporal, f.dim_geografica, f.dim_tecnologica, f.dim_completitud]
  const overall = uncertaintyOverall(dims)

  async function save() {
    setSaving(true); setError('')
    const payload: any = {
      year: f.year ? Number(f.year) : null, scope: f.scope || null, approach: f.approach,
      responsable_id: f.responsable_id || null, fecha: f.fecha || null, notes: f.notes || null,
    }
    if (f.approach === 'cualitativa') {
      payload.dim_representatividad = f.dim_representatividad; payload.dim_temporal = f.dim_temporal
      payload.dim_geografica = f.dim_geografica; payload.dim_tecnologica = f.dim_tecnologica; payload.dim_completitud = f.dim_completitud
      payload.overall_level = overall; payload.uncertainty_pct = null
    } else {
      payload.uncertainty_pct = f.uncertainty_pct ? Number(f.uncertainty_pct) : null; payload.overall_level = null
    }
    const res = isEdit ? await supabase.from('uncertainty_assessments').update(payload).eq('id', row.id) : await supabase.from('uncertainty_assessments').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  const setDim = (k: string, v: number) => setF({ ...f, [k]: v } as any)

  return (
    <Modal title={isEdit ? 'Editar evaluación' : 'Nueva evaluación de incertidumbre'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Año"><input type="number" className="input" value={f.year} onChange={e => setF({ ...f, year: e.target.value })} /></Field>
        <div className="col-span-2"><Field label="Alcance / ámbito"><input className="input" placeholder="Inventario completo / Categoría 1 / …" value={f.scope} onChange={e => setF({ ...f, scope: e.target.value })} /></Field></div>
      </div>
      <Field label="Enfoque"><select className="input" value={f.approach} onChange={e => setF({ ...f, approach: e.target.value })}>{Object.entries(UNCERTAINTY_APPROACH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>

      {f.approach === 'cualitativa' ? (
        <>
          <div className="text-xs text-gray-500 mb-2">Calificá cada dimensión (1 = baja incertidumbre, 3 = alta):</div>
          {UNCERTAINTY_DIMS.map(d => (
            <div key={d.key} className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm text-gray-700">{d.label}</span>
              <div className="flex gap-1">
                {[1, 2, 3].map(v => (
                  <button key={v} type="button" onClick={() => setDim(d.key, v)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium ${(f as any)[d.key] === v ? (v === 1 ? 'bg-green-600 text-white' : v === 2 ? 'bg-amber-500 text-white' : 'bg-red-600 text-white') : 'bg-gray-100 text-gray-600'}`}>
                    {UNCERTAINTY_DIM_LEVEL[v]}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {overall && (
            <div className="bg-gray-50 rounded-xl px-3 py-2 my-3 flex items-center justify-between text-sm">
              <span className="text-gray-600">Nivel global de incertidumbre</span>
              <StatusBadge map={UNCERTAINTY_LEVEL} value={overall} />
            </div>
          )}
        </>
      ) : (
        <Field label="Incertidumbre combinada (± %)"><input type="number" step="any" className="input" value={f.uncertainty_pct} onChange={e => setF({ ...f, uncertainty_pct: e.target.value })} /></Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Responsable"><select className="input" value={f.responsable_id} onChange={e => setF({ ...f, responsable_id: e.target.value })}><option value="">—</option>{personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
        <Field label="Fecha"><input type="date" className="input" value={f.fecha ?? ''} onChange={e => setF({ ...f, fecha: e.target.value })} /></Field>
      </div>
      <Field label="Notas / justificación del enfoque"><textarea className="input" rows={3} placeholder="Ej: se opta por cualitativa porque no todos los FE traen margen de error…" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
