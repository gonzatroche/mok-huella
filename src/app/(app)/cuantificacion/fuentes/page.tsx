'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Search, Flame } from 'lucide-react'
import { ISO_CATEGORIES, ISO_CATEGORY_KEYS, GHG_UNITS } from '@/lib/sig'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError } from '@/lib/utils'

type SiteType = { id: string; name: string }
type Factor = { id: string; name: string; unit: string; factor: number }
type Source = {
  id: string; name: string; category_key: string | null; site_type_id: string | null
  default_unit: string | null; factor_id: string | null; descripcion: string | null; activo: boolean; sort: number
}

export default function FuentesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Source[]>([])
  const [types, setTypes] = useState<SiteType[]>([])
  const [factors, setFactors] = useState<Factor[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [fCat, setFCat] = useState('')
  const [fType, setFType] = useState('')
  const [edit, setEdit] = useState<Partial<Source> | null>(null)

  async function load() {
    setLoading(true)
    const [{ data }, { data: t }, { data: fa }] = await Promise.all([
      supabase.from('emission_sources').select('*').order('sort').order('name'),
      supabase.from('site_types').select('id, name').eq('activo', true).order('name'),
      supabase.from('emission_factors').select('id, name, unit, factor').eq('activo', true).order('name'),
    ])
    setRows((data as any) ?? []); setTypes((t as any) ?? []); setFactors((fa as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Source) {
    if (!confirm(`¿Eliminar la fuente "${r.name}"?`)) return
    await supabase.from('emission_sources').delete().eq('id', r.id); load()
  }

  const typeName = (id: string | null) => types.find(t => t.id === id)?.name ?? null
  const factorName = (id: string | null) => factors.find(fa => fa.id === id)?.name ?? null
  const filtered = rows.filter(r => {
    if (fCat && r.category_key !== fCat) return false
    if (fType && r.site_type_id !== fType) return false
    if (q && ![r.name, r.descripcion].join(' ').toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 6.3 · Catálogo</p>
          <h1 className="page-title">Fuentes de emisión</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ activo: true })}><Plus className="w-4 h-4" /> Nueva</button>
      </div>
      <p className="text-sm text-gray-500 mb-5 -mt-3">
        Matriz de fuentes de emisión, clasificadas por categoría ISO y (opcionalmente) por tipo de sitio.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar fuente…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={fCat} onChange={e => setFCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {ISO_CATEGORY_KEYS.map(k => <option key={k} value={k}>{ISO_CATEGORIES[k].short}</option>)}
        </select>
        <select className="input w-auto" value={fType} onChange={e => setFType(e.target.value)}>
          <option value="">Todos los tipos</option>
          {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : filtered.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <Flame className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay fuentes {rows.length ? 'con esos filtros' : 'cargadas'}.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => (
              <div key={r.id} className="card flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{r.name}</span>
                    {r.category_key && <span className={`badge ${ISO_CATEGORIES[r.category_key]?.color ?? 'bg-gray-100'}`}>{ISO_CATEGORIES[r.category_key]?.short}</span>}
                    {!r.activo && <span className="badge bg-gray-100 text-gray-500">Inactiva</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[typeName(r.site_type_id), r.default_unit ? `Unidad ${r.default_unit}` : null, factorName(r.factor_id)].filter(Boolean).join(' · ') || '—'}
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

      {edit && <Form row={edit} types={types} factors={factors} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Form({ row, types, factors, onClose, onSaved }: { row: Partial<Source>; types: SiteType[]; factors: Factor[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({
    name: row.name ?? '', category_key: row.category_key ?? '', site_type_id: row.site_type_id ?? '',
    default_unit: row.default_unit ?? '', factor_id: row.factor_id ?? '', descripcion: row.descripcion ?? '',
    activo: row.activo ?? true, sort: row.sort ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function pickFactor(id: string) {
    const fac = factors.find(x => x.id === id)
    setF(prev => ({ ...prev, factor_id: id, ...(fac && !prev.default_unit ? { default_unit: fac.unit } : {}) }))
  }

  async function save() {
    if (!f.name.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError('')
    const payload: any = {
      name: f.name.trim(), category_key: f.category_key || null, site_type_id: f.site_type_id || null,
      default_unit: f.default_unit || null, factor_id: f.factor_id || null, descripcion: f.descripcion || null,
      activo: f.activo, sort: Number(f.sort) || 0,
    }
    const res = isEdit ? await supabase.from('emission_sources').update(payload).eq('id', row.id) : await supabase.from('emission_sources').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Editar fuente' : 'Nueva fuente'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <Field label="Nombre *"><input className="input" placeholder="Combustión móvil - Maquinaria pesada" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoría ISO"><select className="input" value={f.category_key} onChange={e => setF({ ...f, category_key: e.target.value })}><option value="">—</option>{ISO_CATEGORY_KEYS.map(k => <option key={k} value={k}>{ISO_CATEGORIES[k].short}</option>)}</select></Field>
        <Field label="Tipo de sitio (opcional)"><select className="input" value={f.site_type_id} onChange={e => setF({ ...f, site_type_id: e.target.value })}><option value="">Todos</option>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unidad por defecto"><select className="input" value={f.default_unit} onChange={e => setF({ ...f, default_unit: e.target.value })}><option value="">—</option>{GHG_UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></Field>
        <Field label="Factor sugerido"><select className="input" value={f.factor_id} onChange={e => pickFactor(e.target.value)}><option value="">—</option>{factors.map(fa => <option key={fa.id} value={fa.id}>{fa.name} ({fa.factor}/{fa.unit})</option>)}</select></Field>
      </div>
      <Field label="Descripción"><textarea className="input" rows={2} value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Orden"><input type="number" className="input" value={f.sort} onChange={e => setF({ ...f, sort: Number(e.target.value) })} /></Field>
        <Field label="Estado"><select className="input" value={f.activo ? '1' : '0'} onChange={e => setF({ ...f, activo: e.target.value === '1' })}><option value="1">Activa</option><option value="0">Inactiva</option></select></Field>
      </div>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
