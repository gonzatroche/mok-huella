'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Users } from 'lucide-react'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError } from '@/lib/utils'

type Persona = { id: string; nombre: string; email: string | null; puesto: string | null; area: string | null; activo: boolean }

export default function ResponsablesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<Persona> | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('personas').select('*').order('nombre')
    setRows((data as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(p: Persona) {
    if (!confirm(`¿Eliminar a "${p.nombre}"?`)) return
    await supabase.from('personas').delete().eq('id', p.id); load()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 8 · Gestión de datos</p>
          <h1 className="page-title">Responsables</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ activo: true })}><Plus className="w-4 h-4" /> Nuevo</button>
      </div>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : rows.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay personas cargadas. Estas personas se asignan como responsables de carga y verificación.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(p => (
              <div key={p.id} className="card flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-medium text-gray-900">{p.nombre}</span>
                  {!p.activo && <span className="ml-2 badge bg-gray-100 text-gray-500">Inactivo</span>}
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[p.puesto, p.area, p.email].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setEdit(p)} className="p-2 text-gray-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => del(p)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

      {edit && <Form row={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Form({ row, onClose, onSaved }: { row: Partial<Persona>; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({ nombre: row.nombre ?? '', email: row.email ?? '', puesto: row.puesto ?? '', area: row.area ?? '', activo: row.activo ?? true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!f.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError('')
    const payload = { nombre: f.nombre.trim(), email: f.email || null, puesto: f.puesto || null, area: f.area || null, activo: f.activo }
    const res = isEdit ? await supabase.from('personas').update(payload).eq('id', row.id) : await supabase.from('personas').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Editar persona' : 'Nueva persona'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <Field label="Nombre *"><input className="input" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Puesto"><input className="input" value={f.puesto} onChange={e => setF({ ...f, puesto: e.target.value })} /></Field>
        <Field label="Área"><input className="input" value={f.area} onChange={e => setF({ ...f, area: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><input className="input" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Estado"><select className="input" value={f.activo ? '1' : '0'} onChange={e => setF({ ...f, activo: e.target.value === '1' })}><option value="1">Activo</option><option value="0">Inactivo</option></select></Field>
      </div>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
