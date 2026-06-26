'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Search, Factory } from 'lucide-react'
import { SITE_STATUS } from '@/lib/sig'
import { StatusBadge } from '@/components/ui/Badge'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError, formatDate } from '@/lib/utils'

type SiteType = { id: string; name: string }
type Persona = { id: string; nombre: string }
type Site = {
  id: string; number: string | null; code: string | null; name: string; site_type_id: string | null
  cliente: string | null; ubicacion: string | null; responsable_id: string | null
  fecha_inicio: string | null; fecha_fin: string | null; year: number | null; status: string; notas: string | null
}

export default function SitiosPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Site[]>([])
  const [types, setTypes] = useState<SiteType[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [fType, setFType] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [edit, setEdit] = useState<Partial<Site> | null>(null)

  async function load() {
    setLoading(true)
    const [{ data }, { data: t }, { data: p }] = await Promise.all([
      supabase.from('sites').select('*').order('created_at', { ascending: false }),
      supabase.from('site_types').select('id, name').eq('activo', true).order('name'),
      supabase.from('personas').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setRows((data as any) ?? []); setTypes((t as any) ?? []); setPersonas((p as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(s: Site) {
    if (!confirm(`¿Eliminar el sitio "${s.name}"?`)) return
    await supabase.from('sites').delete().eq('id', s.id); load()
  }

  const typeName = (id: string | null) => types.find(t => t.id === id)?.name ?? null
  const personaName = (id: string | null) => personas.find(p => p.id === id)?.nombre ?? null
  const filtered = rows.filter(s => {
    if (fType && s.site_type_id !== fType) return false
    if (fStatus && s.status !== fStatus) return false
    if (q && ![s.name, s.code, s.cliente, s.ubicacion].join(' ').toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 5.1 · Límites</p>
          <h1 className="page-title">Sitios e instalaciones</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ status: 'activa' })}><Plus className="w-4 h-4" /> Nuevo</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar sitio…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={fType} onChange={e => setFType(e.target.value)}>
          <option value="">Todos los tipos</option>
          {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="input w-auto" value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(SITE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : filtered.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <Factory className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay sitios {rows.length ? 'con esos filtros' : 'cargados'}.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(s => (
              <div key={s.id} className="card flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {s.code && <span className="text-xs font-mono text-gray-400">{s.code}</span>}
                    <span className="font-medium text-gray-900">{s.name}</span>
                    <StatusBadge map={SITE_STATUS} value={s.status} />
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[typeName(s.site_type_id), s.cliente, s.ubicacion, personaName(s.responsable_id), s.year].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setEdit(s)} className="p-2 text-gray-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => del(s)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

      {edit && <Form row={edit} types={types} personas={personas} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Form({ row, types, personas, onClose, onSaved }: { row: Partial<Site>; types: SiteType[]; personas: Persona[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({
    code: row.code ?? '', name: row.name ?? '', site_type_id: row.site_type_id ?? '', cliente: row.cliente ?? '',
    ubicacion: row.ubicacion ?? '', responsable_id: row.responsable_id ?? '', fecha_inicio: row.fecha_inicio ?? '',
    fecha_fin: row.fecha_fin ?? '', year: row.year != null ? String(row.year) : '', status: row.status ?? 'activa', notas: row.notas ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!f.name.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError('')
    const payload: any = {
      code: f.code || null, name: f.name.trim(), site_type_id: f.site_type_id || null, cliente: f.cliente || null,
      ubicacion: f.ubicacion || null, responsable_id: f.responsable_id || null, fecha_inicio: f.fecha_inicio || null,
      fecha_fin: f.fecha_fin || null, year: f.year ? Number(f.year) : null, status: f.status, notas: f.notas || null,
    }
    const res = isEdit ? await supabase.from('sites').update(payload).eq('id', row.id) : await supabase.from('sites').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? `Editar ${row.number ?? 'sitio'}` : 'Nuevo sitio'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Código"><input className="input" placeholder="OB-2026-001" value={f.code} onChange={e => setF({ ...f, code: e.target.value })} /></Field>
        <div className="col-span-2"><Field label="Nombre *"><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo de sitio"><select className="input" value={f.site_type_id} onChange={e => setF({ ...f, site_type_id: e.target.value })}><option value="">—</option>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="Estado"><select className="input" value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>{Object.entries(SITE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cliente / comitente"><input className="input" value={f.cliente} onChange={e => setF({ ...f, cliente: e.target.value })} /></Field>
        <Field label="Ubicación"><input className="input" value={f.ubicacion} onChange={e => setF({ ...f, ubicacion: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Inicio"><input type="date" className="input" value={f.fecha_inicio ?? ''} onChange={e => setF({ ...f, fecha_inicio: e.target.value })} /></Field>
        <Field label="Fin"><input type="date" className="input" value={f.fecha_fin ?? ''} onChange={e => setF({ ...f, fecha_fin: e.target.value })} /></Field>
        <Field label="Año"><input type="number" className="input" value={f.year} onChange={e => setF({ ...f, year: e.target.value })} /></Field>
      </div>
      <Field label="Responsable de datos"><select className="input" value={f.responsable_id} onChange={e => setF({ ...f, responsable_id: e.target.value })}><option value="">—</option>{personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
      <Field label="Notas"><textarea className="input" rows={2} value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
