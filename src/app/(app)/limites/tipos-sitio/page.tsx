'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Layers } from 'lucide-react'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError } from '@/lib/utils'

type Row = { id: string; name: string; descripcion: string | null; activo: boolean; sort: number }

export default function TiposSitioPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<Row> | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('site_types').select('*').order('sort').order('name')
    setRows((data as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Row) {
    if (!confirm(`¿Eliminar el tipo "${r.name}"?`)) return
    await supabase.from('site_types').delete().eq('id', r.id); load()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 5.1 · Catálogo</p>
          <h1 className="page-title">Tipos de sitio</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ activo: true })}><Plus className="w-4 h-4" /> Nuevo</button>
      </div>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : rows.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay tipos cargados. Definí los tipos de instalación / obra de tu inventario.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="card flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-medium text-gray-900">{r.name}</span>
                  {!r.activo && <span className="ml-2 badge bg-gray-100 text-gray-500">Inactivo</span>}
                  {r.descripcion && <p className="text-xs text-gray-500 mt-0.5">{r.descripcion}</p>}
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
  const [f, setF] = useState({ name: row.name ?? '', descripcion: row.descripcion ?? '', activo: row.activo ?? true, sort: row.sort ?? 0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!f.name.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError('')
    const payload = { name: f.name.trim(), descripcion: f.descripcion || null, activo: f.activo, sort: Number(f.sort) || 0 }
    const res = isEdit ? await supabase.from('site_types').update(payload).eq('id', row.id) : await supabase.from('site_types').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Editar tipo de sitio' : 'Nuevo tipo de sitio'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <Field label="Nombre *"><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Descripción"><textarea className="input" rows={2} value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Orden"><input type="number" className="input" value={f.sort} onChange={e => setF({ ...f, sort: Number(e.target.value) })} /></Field>
        <Field label="Estado"><select className="input" value={f.activo ? '1' : '0'} onChange={e => setF({ ...f, activo: e.target.value === '1' })}><option value="1">Activo</option><option value="0">Inactivo</option></select></Field>
      </div>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
