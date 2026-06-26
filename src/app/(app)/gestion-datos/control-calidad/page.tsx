'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, ClipboardCheck } from 'lucide-react'
import { DQC_RESULT } from '@/lib/sig'
import { StatusBadge } from '@/components/ui/Badge'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError, formatDate } from '@/lib/utils'

type Persona = { id: string; nombre: string }
type Check = {
  id: string; year: number | null; alcance: string | null; metodo: string | null; uncertainty: number | null
  resultado: string | null; responsable_id: string | null; fecha: string | null; notas: string | null
}

export default function ControlCalidadPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Check[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<Check> | null>(null)

  async function load() {
    setLoading(true)
    const [{ data }, { data: p }] = await Promise.all([
      supabase.from('data_quality_checks').select('*').order('fecha', { ascending: false }),
      supabase.from('personas').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setRows((data as any) ?? []); setPersonas((p as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Check) {
    if (!confirm('¿Eliminar este control de calidad?')) return
    await supabase.from('data_quality_checks').delete().eq('id', r.id); load()
  }

  const personaName = (id: string | null) => personas.find(p => p.id === id)?.nombre ?? null

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 8 · Gestión de la calidad</p>
          <h1 className="page-title">Control de calidad</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ resultado: 'conforme' })}><Plus className="w-4 h-4" /> Nuevo</button>
      </div>
      <p className="text-sm text-gray-500 mb-5 -mt-3">
        Registro de verificaciones internas de datos y estimación de incertidumbre del inventario.
      </p>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : rows.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay controles de calidad cargados.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="card flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{r.alcance || 'Control de datos'}</span>
                    <StatusBadge map={DQC_RESULT} value={r.resultado} />
                    {r.year && <span className="badge bg-gray-100 text-gray-600">{r.year}</span>}
                    {r.uncertainty != null && <span className="badge bg-sky-100 text-sky-800">±{r.uncertainty}%</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[r.metodo, personaName(r.responsable_id), formatDate(r.fecha)].filter(Boolean).join(' · ') || '—'}
                  </div>
                  {r.notas && <p className="text-xs text-gray-500 mt-1">{r.notas}</p>}
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

function Form({ row, personas, onClose, onSaved }: { row: Partial<Check>; personas: Persona[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({
    year: row.year != null ? String(row.year) : String(new Date().getFullYear()), alcance: row.alcance ?? '', metodo: row.metodo ?? '',
    uncertainty: row.uncertainty != null ? String(row.uncertainty) : '', resultado: row.resultado ?? 'conforme',
    responsable_id: row.responsable_id ?? '', fecha: row.fecha ?? '', notas: row.notas ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true); setError('')
    const payload: any = {
      year: f.year ? Number(f.year) : null, alcance: f.alcance || null, metodo: f.metodo || null,
      uncertainty: f.uncertainty ? Number(f.uncertainty) : null, resultado: f.resultado || null,
      responsable_id: f.responsable_id || null, fecha: f.fecha || null, notas: f.notas || null,
    }
    const res = isEdit ? await supabase.from('data_quality_checks').update(payload).eq('id', row.id) : await supabase.from('data_quality_checks').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Editar control' : 'Nuevo control de calidad'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Año"><input type="number" className="input" value={f.year} onChange={e => setF({ ...f, year: e.target.value })} /></Field>
        <Field label="Incertidumbre (%)"><input type="number" step="any" className="input" value={f.uncertainty} onChange={e => setF({ ...f, uncertainty: e.target.value })} /></Field>
        <Field label="Resultado"><select className="input" value={f.resultado} onChange={e => setF({ ...f, resultado: e.target.value })}>{Object.entries(DQC_RESULT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      </div>
      <Field label="Alcance / ámbito revisado"><input className="input" placeholder="Ej: Categoría 1 — combustibles" value={f.alcance} onChange={e => setF({ ...f, alcance: e.target.value })} /></Field>
      <Field label="Método de evaluación"><input className="input" placeholder="Revisión documental, recálculo, comparación…" value={f.metodo} onChange={e => setF({ ...f, metodo: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Responsable"><select className="input" value={f.responsable_id} onChange={e => setF({ ...f, responsable_id: e.target.value })}><option value="">—</option>{personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
        <Field label="Fecha"><input type="date" className="input" value={f.fecha ?? ''} onChange={e => setF({ ...f, fecha: e.target.value })} /></Field>
      </div>
      <Field label="Notas / hallazgos"><textarea className="input" rows={3} value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
