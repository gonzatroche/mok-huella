'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Search, Package } from 'lucide-react'
import { CBAM_SECTORS, CBAM_AGG_CATEGORIES, label } from '@/lib/sig'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError } from '@/lib/utils'

type Good = {
  id: string; cn_code: string | null; name: string; sector: string | null; aggregated_category: string | null
  production_route: string | null; default_unit: string | null; notes: string | null; activo: boolean; sort: number
}

export default function BienesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Good[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [fSector, setFSector] = useState('')
  const [edit, setEdit] = useState<Partial<Good> | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('cbam_goods').select('*').order('sector').order('sort').order('name')
    setRows((data as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Good) {
    if (!confirm(`¿Eliminar el bien "${r.name}"?`)) return
    await supabase.from('cbam_goods').delete().eq('id', r.id); load()
  }

  const filtered = rows.filter(r => {
    if (fSector && r.sector !== fSector) return false
    if (q && ![r.name, r.cn_code, r.aggregated_category].join(' ').toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">CBAM · Catálogo</p>
          <h1 className="page-title">Bienes CBAM</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ activo: true, default_unit: 't' })}><Plus className="w-4 h-4" /> Nuevo</button>
      </div>
      <p className="text-sm text-gray-500 mb-5 -mt-3">
        Bienes alcanzados por CBAM, identificados por código CN y categoría de bienes agregada.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar bien o CN…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={fSector} onChange={e => setFSector(e.target.value)}>
          <option value="">Todos los sectores</option>
          {Object.entries(CBAM_SECTORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : filtered.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay bienes {rows.length ? 'con esos filtros' : 'cargados'}.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => (
              <div key={r.id} className="card flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.cn_code && <span className="text-xs font-mono text-gray-400">CN {r.cn_code}</span>}
                    <span className="font-medium text-gray-900">{r.name}</span>
                    {r.sector && <span className={`badge ${CBAM_SECTORS[r.sector]?.color ?? 'bg-gray-100'}`}>{CBAM_SECTORS[r.sector]?.label}</span>}
                    {!r.activo && <span className="badge bg-gray-100 text-gray-500">Inactivo</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[r.aggregated_category, r.production_route, r.default_unit ? `Unidad ${r.default_unit}` : null].filter(Boolean).join(' · ') || '—'}
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

function Form({ row, onClose, onSaved }: { row: Partial<Good>; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({
    cn_code: row.cn_code ?? '', name: row.name ?? '', sector: row.sector ?? '', aggregated_category: row.aggregated_category ?? '',
    production_route: row.production_route ?? '', default_unit: row.default_unit ?? 't', notes: row.notes ?? '', activo: row.activo ?? true, sort: row.sort ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const cats = f.sector ? (CBAM_AGG_CATEGORIES[f.sector] ?? []) : []

  async function save() {
    if (!f.name.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError('')
    const payload: any = {
      cn_code: f.cn_code || null, name: f.name.trim(), sector: f.sector || null, aggregated_category: f.aggregated_category || null,
      production_route: f.production_route || null, default_unit: f.default_unit || 't', notes: f.notes || null, activo: f.activo, sort: Number(f.sort) || 0,
    }
    const res = isEdit ? await supabase.from('cbam_goods').update(payload).eq('id', row.id) : await supabase.from('cbam_goods').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Editar bien' : 'Nuevo bien CBAM'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Código CN"><input className="input" placeholder="25232900" value={f.cn_code} onChange={e => setF({ ...f, cn_code: e.target.value })} /></Field>
        <div className="col-span-2"><Field label="Nombre del bien *"><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sector"><select className="input" value={f.sector} onChange={e => setF({ ...f, sector: e.target.value, aggregated_category: '' })}><option value="">—</option>{Object.entries(CBAM_SECTORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Categoría agregada">
          {cats.length ? (
            <select className="input" value={f.aggregated_category} onChange={e => setF({ ...f, aggregated_category: e.target.value })}><option value="">—</option>{cats.map(c => <option key={c} value={c}>{c}</option>)}</select>
          ) : (
            <input className="input" value={f.aggregated_category} onChange={e => setF({ ...f, aggregated_category: e.target.value })} />
          )}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ruta de producción"><input className="input" value={f.production_route} onChange={e => setF({ ...f, production_route: e.target.value })} /></Field>
        <Field label="Unidad de salida"><input className="input" value={f.default_unit} onChange={e => setF({ ...f, default_unit: e.target.value })} /></Field>
      </div>
      <Field label="Notas"><textarea className="input" rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
      <Field label="Estado"><select className="input" value={f.activo ? '1' : '0'} onChange={e => setF({ ...f, activo: e.target.value === '1' })}><option value="1">Activo</option><option value="0">Inactivo</option></select></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
