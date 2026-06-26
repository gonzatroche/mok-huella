'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Building2, Check, X } from 'lucide-react'
import { CONSOLIDATION_APPROACH, label } from '@/lib/sig'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError } from '@/lib/utils'

type Row = { id: string; entidad: string; participacion: number | null; enfoque: string; incluida: boolean; justificacion: string | null; sort: number }

export default function OrganizacionalesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<Row> | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('org_boundaries').select('*').order('sort').order('entidad')
    setRows((data as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Row) {
    if (!confirm(`¿Eliminar "${r.entidad}"?`)) return
    await supabase.from('org_boundaries').delete().eq('id', r.id); load()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 5.1 · Límites</p>
          <h1 className="page-title">Límites organizacionales</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ incluida: true, enfoque: 'control_operacional' })}><Plus className="w-4 h-4" /> Nueva</button>
      </div>
      <p className="text-sm text-gray-500 mb-5 -mt-3">
        Entidades, unidades de negocio o centros que se consolidan en el inventario, con su enfoque de consolidación.
      </p>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : rows.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Definí las entidades incluidas en los límites organizacionales.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="card flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-3">
                  <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${r.incluida ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {r.incluida ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </span>
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900">{r.entidad}</span>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {label(CONSOLIDATION_APPROACH, r.enfoque)}{r.participacion != null ? ` · ${r.participacion}%` : ''}
                    </div>
                    {r.justificacion && <p className="text-xs text-gray-500 mt-1">{r.justificacion}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setEdit(r)} className="p-2 text-gray-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => del(r)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

      {edit && <Form row={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Form({ row, onClose, onSaved }: { row: Partial<Row>; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({
    entidad: row.entidad ?? '', participacion: row.participacion != null ? String(row.participacion) : '',
    enfoque: row.enfoque ?? 'control_operacional', incluida: row.incluida ?? true, justificacion: row.justificacion ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!f.entidad.trim()) { setError('La entidad es obligatoria.'); return }
    setSaving(true); setError('')
    const payload = {
      entidad: f.entidad.trim(), participacion: f.participacion ? Number(f.participacion) : null,
      enfoque: f.enfoque, incluida: f.incluida, justificacion: f.justificacion || null,
    }
    const res = isEdit ? await supabase.from('org_boundaries').update(payload).eq('id', row.id) : await supabase.from('org_boundaries').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Editar entidad' : 'Nueva entidad'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <Field label="Entidad / unidad / centro *"><input className="input" value={f.entidad} onChange={e => setF({ ...f, entidad: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Enfoque de consolidación"><select className="input" value={f.enfoque} onChange={e => setF({ ...f, enfoque: e.target.value })}>{Object.entries(CONSOLIDATION_APPROACH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Participación / control (%)"><input type="number" className="input" value={f.participacion} onChange={e => setF({ ...f, participacion: e.target.value })} /></Field>
      </div>
      <Field label="¿Incluida?"><select className="input" value={f.incluida ? '1' : '0'} onChange={e => setF({ ...f, incluida: e.target.value === '1' })}><option value="1">Incluida</option><option value="0">Excluida</option></select></Field>
      <Field label="Justificación"><textarea className="input" rows={2} value={f.justificacion} onChange={e => setF({ ...f, justificacion: e.target.value })} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
