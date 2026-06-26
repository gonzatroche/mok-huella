'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Search, Gauge } from 'lucide-react'
import { ISO_CATEGORIES, ISO_CATEGORY_KEYS, GHG_UNITS } from '@/lib/sig'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError } from '@/lib/utils'

type Factor = {
  id: string; name: string; descripcion: string | null; unit: string; factor: number
  category_key: string | null; source_ref: string | null; valid_year: number | null; activo: boolean
}

export default function FactoresPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Factor[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [fCat, setFCat] = useState('')
  const [edit, setEdit] = useState<Partial<Factor> | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('emission_factors').select('*').order('name')
    setRows((data as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Factor) {
    if (!confirm(`¿Eliminar el factor "${r.name}"?`)) return
    await supabase.from('emission_factors').delete().eq('id', r.id); load()
  }

  const filtered = rows.filter(r => {
    if (fCat && r.category_key !== fCat) return false
    if (q && ![r.name, r.descripcion, r.source_ref].join(' ').toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 6.5 · Catálogo</p>
          <h1 className="page-title">Factores de emisión</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ activo: true, unit: 'L' })}><Plus className="w-4 h-4" /> Nuevo</button>
      </div>
      <p className="text-sm text-gray-500 mb-5 -mt-3">
        Factores de conversión (kg CO₂eq por unidad de actividad). Documentá siempre la fuente bibliográfica.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar factor…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={fCat} onChange={e => setFCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {ISO_CATEGORY_KEYS.map(k => <option key={k} value={k}>{ISO_CATEGORIES[k].short}</option>)}
        </select>
      </div>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : filtered.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <Gauge className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay factores {rows.length ? 'con esos filtros' : 'cargados'}.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => (
              <div key={r.id} className="card flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{r.name}</span>
                    {r.category_key && <span className={`badge ${ISO_CATEGORIES[r.category_key]?.color ?? 'bg-gray-100'}`}>{ISO_CATEGORIES[r.category_key]?.short}</span>}
                    {!r.activo && <span className="badge bg-gray-100 text-gray-500">Inactivo</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[r.source_ref, r.valid_year ? `Vigencia ${r.valid_year}` : null, r.descripcion].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <div className="font-bold text-gray-900 tabular-nums leading-none">{r.factor}</div>
                    <div className="text-[10px] text-gray-400">kg CO₂eq/{r.unit}</div>
                  </div>
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

function Form({ row, onClose, onSaved }: { row: Partial<Factor>; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({
    name: row.name ?? '', descripcion: row.descripcion ?? '', unit: row.unit ?? 'L',
    factor: row.factor != null ? String(row.factor) : '', category_key: row.category_key ?? '',
    source_ref: row.source_ref ?? '', valid_year: row.valid_year != null ? String(row.valid_year) : '', activo: row.activo ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!f.name.trim()) { setError('El nombre es obligatorio.'); return }
    if (!f.factor || isNaN(Number(f.factor))) { setError('El factor debe ser numérico.'); return }
    setSaving(true); setError('')
    const payload: any = {
      name: f.name.trim(), descripcion: f.descripcion || null, unit: f.unit, factor: Number(f.factor),
      category_key: f.category_key || null, source_ref: f.source_ref || null,
      valid_year: f.valid_year ? Number(f.valid_year) : null, activo: f.activo,
    }
    const res = isEdit ? await supabase.from('emission_factors').update(payload).eq('id', row.id) : await supabase.from('emission_factors').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Editar factor' : 'Nuevo factor'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <Field label="Nombre *"><input className="input" placeholder="Gasoil (Diesel)" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Factor *"><input type="number" step="any" className="input" value={f.factor} onChange={e => setF({ ...f, factor: e.target.value })} /></Field>
        <Field label="Unidad"><select className="input" value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })}>{GHG_UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></Field>
        <Field label="Año vigencia"><input type="number" className="input" value={f.valid_year} onChange={e => setF({ ...f, valid_year: e.target.value })} /></Field>
      </div>
      <Field label="Categoría ISO"><select className="input" value={f.category_key} onChange={e => setF({ ...f, category_key: e.target.value })}><option value="">—</option>{ISO_CATEGORY_KEYS.map(k => <option key={k} value={k}>{ISO_CATEGORIES[k].short}</option>)}</select></Field>
      <Field label="Fuente del factor"><input className="input" placeholder="IPCC 2006 / DEFRA 2023 / MVOTMA…" value={f.source_ref} onChange={e => setF({ ...f, source_ref: e.target.value })} /></Field>
      <Field label="Descripción"><textarea className="input" rows={2} value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} /></Field>
      <Field label="Estado"><select className="input" value={f.activo ? '1' : '0'} onChange={e => setF({ ...f, activo: e.target.value === '1' })}><option value="1">Activo</option><option value="0">Inactivo</option></select></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
