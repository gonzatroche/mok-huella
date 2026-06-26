'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Search, Leaf, ChevronDown, ChevronRight } from 'lucide-react'
import { ISO_CATEGORIES, ISO_CATEGORY_KEYS, GHG_UNITS, QUARTERS, VERIFIED_STATUS, fmtT } from '@/lib/sig'
import { StatusBadge } from '@/components/ui/Badge'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError, formatDate } from '@/lib/utils'

type Persona = { id: string; nombre: string }
type Site = { id: string; name: string; code: string | null }
type Source = { id: string; name: string; category_key: string | null; default_unit: string | null; factor_id: string | null }
type Factor = { id: string; name: string; unit: string; factor: number; category_key: string | null }
type Rec = {
  id: string; number: string | null; year: number; quarter: string | null; period: string | null
  site_id: string | null; category_key: string | null; source_id: string | null; source_text: string | null
  activity_detail: string | null; quantity: number | null; unit: string | null; emission_factor: number | null
  emissions_t: number | null; evidence_ref: string | null; responsable_id: string | null
  load_date: string | null; verified: string; observaciones: string | null
}

const CY = new Date().getFullYear()

export default function InventarioPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Rec[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [factors, setFactors] = useState<Factor[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [fYear, setFYear] = useState<string>(String(CY))
  const [fCat, setFCat] = useState('')
  const [fSite, setFSite] = useState('')
  const [fVer, setFVer] = useState('')
  const [edit, setEdit] = useState<Partial<Rec> | null>(null)

  async function load() {
    setLoading(true)
    const [{ data }, { data: si }, { data: so }, { data: fa }, { data: pe }] = await Promise.all([
      supabase.from('emission_records').select('*').order('year', { ascending: false }).order('quarter').order('created_at', { ascending: false }),
      supabase.from('sites').select('id, name, code').order('name'),
      supabase.from('emission_sources').select('id, name, category_key, default_unit, factor_id').eq('activo', true).order('sort').order('name'),
      supabase.from('emission_factors').select('id, name, unit, factor, category_key').eq('activo', true).order('name'),
      supabase.from('personas').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setRows((data as any) ?? []); setSites((si as any) ?? []); setSources((so as any) ?? [])
    setFactors((fa as any) ?? []); setPersonas((pe as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Rec) {
    if (!confirm(`¿Eliminar el registro ${r.number ?? ''}?`)) return
    await supabase.from('emission_records').delete().eq('id', r.id)
    load()
  }

  const siteName = (id: string | null) => sites.find(s => s.id === id)?.name ?? null
  const years = useMemo(() => Array.from(new Set(rows.map(r => r.year))).sort((a, b) => b - a), [rows])

  const filtered = rows.filter(r => {
    if (fYear && String(r.year) !== fYear) return false
    if (fCat && r.category_key !== fCat) return false
    if (fSite && r.site_id !== fSite) return false
    if (fVer && r.verified !== fVer) return false
    if (q) {
      const hay = [r.number, r.activity_detail, r.source_text, r.period, siteName(r.site_id)].join(' ').toLowerCase()
      if (!hay.includes(q.toLowerCase())) return false
    }
    return true
  })

  const total = filtered.reduce((a, r) => a + (Number(r.emissions_t) || 0), 0)
  const grouped: { cat: string; items: Rec[]; sub: number }[] = []
  for (const k of ISO_CATEGORY_KEYS) {
    const items = filtered.filter(r => r.category_key === k)
    if (items.length) grouped.push({ cat: k, items, sub: items.reduce((a, r) => a + (Number(r.emissions_t) || 0), 0) })
  }
  const sinCat = filtered.filter(r => !r.category_key || !ISO_CATEGORY_KEYS.includes(r.category_key))
  if (sinCat.length) grouped.push({ cat: '', items: sinCat, sub: sinCat.reduce((a, r) => a + (Number(r.emissions_t) || 0), 0) })

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 6.1 · Cuantificación</p>
          <h1 className="page-title">Inventario de emisiones</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ year: CY, verified: 'pendiente' })}><Plus className="w-4 h-4" /> Nuevo</button>
      </div>

      <div className="card mb-4 flex items-center gap-3 bg-teal-50/50 border-teal-100">
        <Leaf className="w-8 h-8 text-teal-600" />
        <div>
          <div className="text-2xl font-bold text-gray-900 leading-none">{fmtT(total)} <span className="text-base font-medium text-gray-500">t CO₂eq</span></div>
          <div className="text-xs text-gray-500 mt-1">{filtered.length} registro(s){fYear ? ` · año ${fYear}` : ''}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={fYear} onChange={e => setFYear(e.target.value)}>
          <option value="">Todos los años</option>
          {(years.length ? years : [CY]).map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
        <select className="input w-auto" value={fCat} onChange={e => setFCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {ISO_CATEGORY_KEYS.map(k => <option key={k} value={k}>{ISO_CATEGORIES[k].short}</option>)}
        </select>
        <select className="input w-auto" value={fSite} onChange={e => setFSite(e.target.value)}>
          <option value="">Todos los sitios</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input w-auto" value={fVer} onChange={e => setFVer(e.target.value)}>
          <option value="">Toda verificación</option>
          {Object.entries(VERIFIED_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : filtered.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <Leaf className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay registros {rows.length ? 'con esos filtros' : 'cargados'}.
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(g => (
              <div key={g.cat || 'sin'}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ISO_CATEGORIES[g.cat]?.color ?? 'bg-gray-100 text-gray-700'}`}>
                    {ISO_CATEGORIES[g.cat]?.short ?? 'Sin categoría'}
                  </span>
                  <span className="text-xs font-semibold text-gray-500">{fmtT(g.sub)} t CO₂eq</span>
                </div>
                <div className="space-y-2">
                  {g.items.map(r => <Row key={r.id} r={r} site={siteName(r.site_id)} onEdit={() => setEdit(r)} onDelete={() => del(r)} />)}
                </div>
              </div>
            ))}
          </div>
        )}

      {edit && <RecForm rec={edit} sites={sites} sources={sources} factors={factors} personas={personas}
        onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Row({ r, site, onEdit, onDelete }: { r: Rec; site: string | null; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const src = r.source_text || '—'
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setOpen(o => !o)} className="min-w-0 text-left flex items-start gap-2 flex-1">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-gray-400">{r.number}</span>
              <span className="font-medium text-gray-900 truncate">{r.activity_detail || src}</span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {site ? `${site} · ` : ''}{r.period || `${r.year}${r.quarter ? ' ' + r.quarter : ''}`}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <div className="font-bold text-gray-900 tabular-nums leading-none">{fmtT(r.emissions_t)}</div>
            <div className="text-[10px] text-gray-400">t CO₂eq</div>
          </div>
          <StatusBadge map={VERIFIED_STATUS} value={r.verified} />
          <button onClick={onEdit} className="p-2 text-gray-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
          <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100 grid md:grid-cols-2 gap-3 text-sm">
          <Cell title="Fuente de emisión" value={src} />
          <Cell title="Dato de actividad" value={r.quantity != null ? `${r.quantity} ${r.unit ?? ''}` : null} />
          <Cell title="Factor de emisión" value={r.emission_factor != null ? `${r.emission_factor} kg CO₂eq/${r.unit ?? 'u'}` : null} />
          <Cell title="Cálculo" value={r.quantity != null && r.emission_factor != null ? `${r.quantity} × ${r.emission_factor} ÷ 1000 = ${fmtT(r.emissions_t)} t CO₂eq` : null} />
          <Cell title="Evidencia" value={r.evidence_ref} />
          <Cell title="Fecha de carga" value={formatDate(r.load_date)} />
          <Cell title="Observaciones" value={r.observaciones} full />
        </div>
      )}
    </div>
  )
}

function Cell({ title, value, full }: { title: string; value: string | null; full?: boolean }) {
  if (!value || value === '—') return null
  return <div className={full ? 'md:col-span-2' : ''}><div className="text-xs font-semibold text-gray-500 mb-0.5">{title}</div><p className="text-gray-700 whitespace-pre-wrap">{value}</p></div>
}

function RecForm({ rec, sites, sources, factors, personas, onClose, onSaved }: {
  rec: Partial<Rec>; sites: Site[]; sources: Source[]; factors: Factor[]; personas: Persona[]
  onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const isEdit = !!rec.id
  const [f, setF] = useState({
    year: rec.year ?? CY, quarter: rec.quarter ?? 'T1', period: rec.period ?? '',
    site_id: rec.site_id ?? '', category_key: rec.category_key ?? '', source_id: rec.source_id ?? '',
    source_text: rec.source_text ?? '', activity_detail: rec.activity_detail ?? '',
    quantity: rec.quantity != null ? String(rec.quantity) : '', unit: rec.unit ?? '',
    emission_factor: rec.emission_factor != null ? String(rec.emission_factor) : '',
    factor_id: '', evidence_ref: rec.evidence_ref ?? '', responsable_id: rec.responsable_id ?? '',
    verified: rec.verified ?? 'pendiente', observaciones: rec.observaciones ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const preview = (() => {
    const qn = parseFloat(f.quantity), fe = parseFloat(f.emission_factor)
    if (isNaN(qn) || isNaN(fe)) return null
    return (qn * fe) / 1000
  })()

  function pickSource(id: string) {
    const s = sources.find(x => x.id === id)
    setF(prev => {
      const next = { ...prev, source_id: id }
      if (s) {
        next.source_text = s.name
        if (s.category_key) next.category_key = s.category_key
        if (s.default_unit && !prev.unit) next.unit = s.default_unit
        if (s.factor_id) {
          const fac = factors.find(x => x.id === s.factor_id)
          if (fac) { next.emission_factor = String(fac.factor); next.unit = fac.unit }
        }
      }
      return next
    })
  }
  function pickFactor(id: string) {
    const fac = factors.find(x => x.id === id)
    setF(prev => ({ ...prev, factor_id: id, ...(fac ? { emission_factor: String(fac.factor), unit: fac.unit, category_key: prev.category_key || fac.category_key || '' } : {}) }))
  }

  async function save() {
    if (!f.year) { setError('El año es obligatorio.'); return }
    if (!f.source_id && !f.source_text.trim()) { setError('Indicá la fuente de emisión.'); return }
    setSaving(true); setError('')
    const payload: any = {
      year: Number(f.year), quarter: f.quarter || null, period: f.period || null,
      site_id: f.site_id || null, category_key: f.category_key || null,
      source_id: f.source_id || null, source_text: f.source_text.trim() || null,
      activity_detail: f.activity_detail || null,
      quantity: f.quantity ? Number(f.quantity) : null, unit: f.unit || null,
      emission_factor: f.emission_factor ? Number(f.emission_factor) : null,
      evidence_ref: f.evidence_ref || null, responsable_id: f.responsable_id || null,
      verified: f.verified, observaciones: f.observaciones || null,
    }
    const res = isEdit
      ? await supabase.from('emission_records').update(payload).eq('id', rec.id)
      : await supabase.from('emission_records').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? `Editar ${rec.number ?? 'registro'}` : 'Nuevo registro de emisión'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Año *"><input type="number" className="input" value={f.year} onChange={e => setF({ ...f, year: Number(e.target.value) })} /></Field>
        <Field label="Trimestre"><select className="input" value={f.quarter} onChange={e => setF({ ...f, quarter: e.target.value })}>{Object.entries(QUARTERS).map(([k, v]) => <option key={k} value={k}>{k}</option>)}</select></Field>
        <Field label="Período"><input className="input" placeholder="Mar-2026" value={f.period} onChange={e => setF({ ...f, period: e.target.value })} /></Field>
      </div>
      <Field label="Sitio / instalación"><select className="input" value={f.site_id} onChange={e => setF({ ...f, site_id: e.target.value })}><option value="">—</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fuente (catálogo)"><select className="input" value={f.source_id} onChange={e => pickSource(e.target.value)}><option value="">— libre —</option>{sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Categoría ISO"><select className="input" value={f.category_key} onChange={e => setF({ ...f, category_key: e.target.value })}><option value="">—</option>{ISO_CATEGORY_KEYS.map(k => <option key={k} value={k}>{ISO_CATEGORIES[k].short}</option>)}</select></Field>
      </div>
      {!f.source_id && <Field label="Fuente de emisión (texto libre)"><input className="input" value={f.source_text} onChange={e => setF({ ...f, source_text: e.target.value })} /></Field>}
      <Field label="Actividad / detalle"><input className="input" placeholder="Ej: Excavadora — consumo de marzo" value={f.activity_detail} onChange={e => setF({ ...f, activity_detail: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Cantidad"><input type="number" className="input" value={f.quantity} onChange={e => setF({ ...f, quantity: e.target.value })} /></Field>
        <Field label="Unidad"><select className="input" value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })}><option value="">—</option>{GHG_UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></Field>
        <Field label="Factor (kg CO₂eq/u)"><input type="number" className="input" value={f.emission_factor} onChange={e => setF({ ...f, emission_factor: e.target.value })} /></Field>
      </div>
      {factors.length > 0 && (
        <Field label="Tomar factor del catálogo"><select className="input" value={f.factor_id} onChange={e => pickFactor(e.target.value)}><option value="">—</option>{factors.map(fa => <option key={fa.id} value={fa.id}>{fa.name} ({fa.factor} / {fa.unit})</option>)}</select></Field>
      )}
      {preview != null && (
        <div className="bg-teal-50 text-teal-800 text-sm px-3 py-2 rounded-xl mb-3 font-medium">
          = {fmtT(preview)} t CO₂eq <span className="text-xs font-normal text-teal-600">(cantidad × factor ÷ 1000)</span>
        </div>
      )}
      <Field label="Referencia de evidencia"><input className="input" placeholder="Nombre de archivo o link" value={f.evidence_ref} onChange={e => setF({ ...f, evidence_ref: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Responsable de carga"><select className="input" value={f.responsable_id} onChange={e => setF({ ...f, responsable_id: e.target.value })}><option value="">—</option>{personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
        <Field label="Verificación"><select className="input" value={f.verified} onChange={e => setF({ ...f, verified: e.target.value })}>{Object.entries(VERIFIED_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      </div>
      <Field label="Observaciones"><textarea className="input" rows={2} value={f.observaciones} onChange={e => setF({ ...f, observaciones: e.target.value })} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
