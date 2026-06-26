'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Search, Activity } from 'lucide-react'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError } from '@/lib/utils'

type Ind = {
  id: string; rubro: string | null; subtipo: string | null; indicador: string; unit: string | null
  value: number | null; year: number | null; critical_component: string | null; notas: string | null; sort: number
}

export default function IndicadoresPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Ind[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Partial<Ind> | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('intensity_indicators').select('*').order('sort').order('rubro')
    setRows((data as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Ind) {
    if (!confirm(`¿Eliminar el indicador "${r.indicador}"?`)) return
    await supabase.from('intensity_indicators').delete().eq('id', r.id); load()
  }

  const filtered = rows.filter(r => !q || [r.rubro, r.subtipo, r.indicador, r.critical_component].join(' ').toLowerCase().includes(q.toLowerCase()))
  const groups: { rubro: string; items: Ind[] }[] = []
  for (const r of filtered) {
    const key = r.rubro || 'Sin rubro'
    let g = groups.find(x => x.rubro === key)
    if (!g) { g = { rubro: key, items: [] }; groups.push(g) }
    g.items.push(r)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 9 · Reporte</p>
          <h1 className="page-title">Indicadores de intensidad</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({})}><Plus className="w-4 h-4" /> Nuevo</button>
      </div>
      <p className="text-sm text-gray-500 mb-5 -mt-3">
        Emisiones por unidad funcional de producto o servicio (ej. kg CO₂eq / m² construido).
      </p>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar indicador…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : filtered.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay indicadores {rows.length ? 'con ese filtro' : 'cargados'}.
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(g => (
              <div key={g.rubro}>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{g.rubro}</div>
                <div className="space-y-2">
                  {g.items.map(r => (
                    <div key={r.id} className="card flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-medium text-gray-900">{r.subtipo || r.indicador}</span>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {[r.subtipo ? r.indicador : null, r.year].filter(Boolean).join(' · ')}
                        </div>
                        {r.critical_component && <p className="text-xs text-gray-500 mt-1">Crítico: {r.critical_component}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <div className="font-bold text-gray-900 tabular-nums leading-none">{r.value ?? '—'}</div>
                          <div className="text-[10px] text-gray-400">{r.unit}</div>
                        </div>
                        <button onClick={() => setEdit(r)} className="p-2 text-gray-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => del(r)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      {edit && <Form row={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Form({ row, onClose, onSaved }: { row: Partial<Ind>; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({
    rubro: row.rubro ?? '', subtipo: row.subtipo ?? '', indicador: row.indicador ?? '', unit: row.unit ?? '',
    value: row.value != null ? String(row.value) : '', year: row.year != null ? String(row.year) : '',
    critical_component: row.critical_component ?? '', notas: row.notas ?? '', sort: row.sort ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!f.indicador.trim()) { setError('El indicador es obligatorio.'); return }
    setSaving(true); setError('')
    const payload: any = {
      rubro: f.rubro || null, subtipo: f.subtipo || null, indicador: f.indicador.trim(), unit: f.unit || null,
      value: f.value ? Number(f.value) : null, year: f.year ? Number(f.year) : null,
      critical_component: f.critical_component || null, notas: f.notas || null, sort: Number(f.sort) || 0,
    }
    const res = isEdit ? await supabase.from('intensity_indicators').update(payload).eq('id', row.id) : await supabase.from('intensity_indicators').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Editar indicador' : 'Nuevo indicador'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rubro"><input className="input" placeholder="Arquitectura, Vialidad…" value={f.rubro} onChange={e => setF({ ...f, rubro: e.target.value })} /></Field>
        <Field label="Subtipo"><input className="input" value={f.subtipo} onChange={e => setF({ ...f, subtipo: e.target.value })} /></Field>
      </div>
      <Field label="Indicador *"><input className="input" placeholder="Intensidad por m² construido" value={f.indicador} onChange={e => setF({ ...f, indicador: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Valor"><input type="number" step="any" className="input" value={f.value} onChange={e => setF({ ...f, value: e.target.value })} /></Field>
        <Field label="Unidad"><input className="input" placeholder="kg CO₂e / m²" value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} /></Field>
        <Field label="Año"><input type="number" className="input" value={f.year} onChange={e => setF({ ...f, year: e.target.value })} /></Field>
      </div>
      <Field label="Componente crítico"><input className="input" value={f.critical_component} onChange={e => setF({ ...f, critical_component: e.target.value })} /></Field>
      <Field label="Notas"><textarea className="input" rows={2} value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
