'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Search, Gauge, FileDown } from 'lucide-react'
import { ISO_CATEGORIES, ISO_CATEGORY_KEYS, GHG_UNITS, GAS_OPTIONS, GAS_GWP, factorFromGases } from '@/lib/sig'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError, exportToXlsx, localDateStr } from '@/lib/utils'

type Factor = {
  id: string; name: string; descripcion: string | null; unit: string; factor: number
  category_key: string | null; source_ref: string | null; valid_year: number | null; activo: boolean
  error_margin: number | null; by_gas: boolean
}
type Gas = { id?: string; gas: string; amount: string; gwp: string }

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

  function exportXlsx() {
    const data = filtered.map(r => ({
      'Nombre': r.name,
      'Descripción': r.descripcion ?? '',
      'Unidad': r.unit,
      'Factor (kg CO2eq/unidad)': r.factor,
      'Margen de error (± %)': r.error_margin ?? '',
      'Por gas': r.by_gas ? 'Sí' : 'No',
      'Categoría ISO': r.category_key ? (ISO_CATEGORIES[r.category_key]?.label ?? r.category_key) : '',
      'Fuente del factor': r.source_ref ?? '',
      'Año vigencia': r.valid_year ?? '',
      'Estado': r.activo ? 'Activo' : 'Inactivo',
    }))
    exportToXlsx(data, 'Factores', `factores_emision_${localDateStr()}.xlsx`)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 6.5 · Catálogo</p>
          <h1 className="page-title">Factores de emisión</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportXlsx} disabled={filtered.length === 0} title="Exportar a Excel">
            <FileDown className="w-4 h-4" /> Excel
          </button>
          <button className="btn-primary" onClick={() => setEdit({ activo: true, unit: 'L', by_gas: false })}><Plus className="w-4 h-4" /> Nuevo</button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-5 -mt-3">
        Factores de conversión (kg CO₂eq por unidad de actividad). Documentá la fuente, la vigencia y el margen de error.
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
                    {r.by_gas && <span className="badge bg-blue-100 text-blue-800">por gas</span>}
                    {!r.activo && <span className="badge bg-gray-100 text-gray-500">Inactivo</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[r.source_ref, r.valid_year ? `Vigencia ${r.valid_year}` : null, r.error_margin != null ? `± ${r.error_margin}%` : null, r.descripcion].filter(Boolean).join(' · ') || '—'}
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
    error_margin: row.error_margin != null ? String(row.error_margin) : '', by_gas: row.by_gas ?? false,
  })
  const [gases, setGases] = useState<Gas[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isEdit && row.by_gas) {
      supabase.from('factor_gases').select('id, gas, amount, gwp').eq('factor_id', row.id).then(({ data }) => {
        setGases((data ?? []).map((g: any) => ({ id: g.id, gas: g.gas, amount: g.amount != null ? String(g.amount) : '', gwp: g.gwp != null ? String(g.gwp) : '' })))
      })
    }
  }, [])

  const computedFactor = factorFromGases(gases.map(g => ({ amount: Number(g.amount), gwp: Number(g.gwp) })))
  const effectiveFactor = f.by_gas ? computedFactor : Number(f.factor)

  function addGas() { setGases([...gases, { gas: 'CO2', amount: '', gwp: String(GAS_GWP.CO2) }]) }
  function setGas(i: number, patch: Partial<Gas>) {
    setGases(gases.map((g, idx) => idx === i ? { ...g, ...patch } : g))
  }
  function pickGasType(i: number, gas: string) { setGas(i, { gas, gwp: String(GAS_GWP[gas] ?? gases[i].gwp) }) }

  async function save() {
    if (!f.name.trim()) { setError('El nombre es obligatorio.'); return }
    if (f.by_gas && gases.length === 0) { setError('Agregá al menos un gas o desactivá "por gas".'); return }
    if (!f.by_gas && (!f.factor || isNaN(Number(f.factor)))) { setError('El factor debe ser numérico.'); return }
    setSaving(true); setError('')
    const payload: any = {
      name: f.name.trim(), descripcion: f.descripcion || null, unit: f.unit, factor: effectiveFactor,
      category_key: f.category_key || null, source_ref: f.source_ref || null,
      valid_year: f.valid_year ? Number(f.valid_year) : null, activo: f.activo,
      error_margin: f.error_margin ? Number(f.error_margin) : null, by_gas: f.by_gas,
    }
    let factorId = row.id as string | undefined
    if (isEdit) {
      const res = await supabase.from('emission_factors').update(payload).eq('id', row.id)
      if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    } else {
      const res = await supabase.from('emission_factors').insert(payload).select('id').single()
      if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
      factorId = (res.data as any)?.id
    }
    // Sincronizar el desglose por gas
    if (factorId) {
      await supabase.from('factor_gases').delete().eq('factor_id', factorId)
      if (f.by_gas && gases.length) {
        await supabase.from('factor_gases').insert(gases.map(g => ({
          factor_id: factorId, gas: g.gas, amount: g.amount ? Number(g.amount) : null, gwp: g.gwp ? Number(g.gwp) : null,
        })))
      }
    }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Editar factor' : 'Nuevo factor'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <Field label="Nombre *"><input className="input" placeholder="Gasoil (Diesel)" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>

      <div className="flex items-center gap-2 mb-3">
        <input id="bygas" type="checkbox" checked={f.by_gas} onChange={e => setF({ ...f, by_gas: e.target.checked })} />
        <label htmlFor="bygas" className="text-sm text-gray-700">Componer el factor por gas (CO₂ / CH₄ / N₂O × GWP)</label>
      </div>

      {f.by_gas ? (
        <div className="bg-gray-50 rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">Gases (kg de gas por {f.unit || 'unidad'})</span>
            <button type="button" onClick={addGas} className="text-xs text-teal-600 hover:text-teal-700 font-medium">+ Agregar gas</button>
          </div>
          {gases.length === 0 && <p className="text-xs text-gray-400">Agregá los gases que componen el factor.</p>}
          <div className="space-y-2">
            {gases.map((g, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                <select className="input" value={g.gas} onChange={e => pickGasType(i, e.target.value)}>{GAS_OPTIONS.map(x => <option key={x} value={x}>{x}</option>)}</select>
                <input className="input" type="number" step="any" placeholder="cantidad" value={g.amount} onChange={e => setGas(i, { amount: e.target.value })} />
                <input className="input" type="number" step="any" placeholder="GWP" value={g.gwp} onChange={e => setGas(i, { gwp: e.target.value })} />
                <button type="button" onClick={() => setGases(gases.filter((_, idx) => idx !== i))} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <div className="text-sm text-gray-700 mt-2">Factor resultante: <b className="tabular-nums">{computedFactor.toLocaleString('es', { maximumFractionDigits: 6 })}</b> kg CO₂eq/{f.unit || 'u'}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Factor *"><input type="number" step="any" className="input" value={f.factor} onChange={e => setF({ ...f, factor: e.target.value })} /></Field>
          <Field label="Unidad"><select className="input" value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })}>{GHG_UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></Field>
        </div>
      )}
      {f.by_gas && <Field label="Unidad"><select className="input" value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })}>{GHG_UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></Field>}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Margen de error (± %)"><input type="number" step="any" className="input" placeholder="Opcional" value={f.error_margin} onChange={e => setF({ ...f, error_margin: e.target.value })} /></Field>
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
