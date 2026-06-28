'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Search, Building } from 'lucide-react'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError } from '@/lib/utils'

type Inst = {
  id: string; name: string; operator_name: string | null; country: string | null; city: string | null
  address: string | null; unlocode: string | null; lat: number | null; lon: number | null
  economic_activity: string | null; contact_email: string | null; notes: string | null
}

export default function InstalacionesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Inst[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Partial<Inst> | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('cbam_installations').select('*').order('name')
    setRows((data as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Inst) {
    if (!confirm(`¿Eliminar la instalación "${r.name}"?`)) return
    await supabase.from('cbam_installations').delete().eq('id', r.id); load()
  }

  const filtered = rows.filter(r => !q || [r.name, r.operator_name, r.country, r.city].join(' ').toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">CBAM · Reg. (UE) 2023/956</p>
          <h1 className="page-title">Instalaciones</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({})}><Plus className="w-4 h-4" /> Nueva</button>
      </div>
      <p className="text-sm text-gray-500 mb-5 -mt-3">
        Instalaciones productoras de los bienes CBAM (datos del operador, requeridos por el communication template).
      </p>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar instalación…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : filtered.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <Building className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay instalaciones {rows.length ? 'con ese filtro' : 'cargadas'}.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => (
              <div key={r.id} className="card flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-medium text-gray-900">{r.name}</span>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[r.operator_name, [r.city, r.country].filter(Boolean).join(', '), r.unlocode, r.economic_activity].filter(Boolean).join(' · ') || '—'}
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

function Form({ row, onClose, onSaved }: { row: Partial<Inst>; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({
    name: row.name ?? '', operator_name: row.operator_name ?? '', country: row.country ?? '', city: row.city ?? '',
    address: row.address ?? '', unlocode: row.unlocode ?? '', lat: row.lat != null ? String(row.lat) : '',
    lon: row.lon != null ? String(row.lon) : '', economic_activity: row.economic_activity ?? '',
    contact_email: row.contact_email ?? '', notes: row.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!f.name.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError('')
    const payload: any = {
      name: f.name.trim(), operator_name: f.operator_name || null, country: f.country || null, city: f.city || null,
      address: f.address || null, unlocode: f.unlocode || null, lat: f.lat ? Number(f.lat) : null, lon: f.lon ? Number(f.lon) : null,
      economic_activity: f.economic_activity || null, contact_email: f.contact_email || null, notes: f.notes || null,
    }
    const res = isEdit ? await supabase.from('cbam_installations').update(payload).eq('id', row.id) : await supabase.from('cbam_installations').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Editar instalación' : 'Nueva instalación'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <Field label="Nombre de la instalación *"><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Operador (razón social)"><input className="input" value={f.operator_name} onChange={e => setF({ ...f, operator_name: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="País"><input className="input" value={f.country} onChange={e => setF({ ...f, country: e.target.value })} /></Field>
        <Field label="Ciudad"><input className="input" value={f.city} onChange={e => setF({ ...f, city: e.target.value })} /></Field>
        <Field label="UN/LOCODE"><input className="input" value={f.unlocode} onChange={e => setF({ ...f, unlocode: e.target.value })} /></Field>
      </div>
      <Field label="Dirección"><input className="input" value={f.address} onChange={e => setF({ ...f, address: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitud"><input type="number" step="any" className="input" value={f.lat} onChange={e => setF({ ...f, lat: e.target.value })} /></Field>
        <Field label="Longitud"><input type="number" step="any" className="input" value={f.lon} onChange={e => setF({ ...f, lon: e.target.value })} /></Field>
      </div>
      <Field label="Actividad económica"><input className="input" value={f.economic_activity} onChange={e => setF({ ...f, economic_activity: e.target.value })} /></Field>
      <Field label="Email de contacto"><input className="input" value={f.contact_email} onChange={e => setF({ ...f, contact_email: e.target.value })} /></Field>
      <Field label="Notas"><textarea className="input" rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
