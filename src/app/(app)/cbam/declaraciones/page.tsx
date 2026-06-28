'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Globe, ChevronDown, ChevronRight } from 'lucide-react'
import { CBAM_METHOD, CBAM_ELEC_SOURCE, CBAM_VERIF, CBAM_SECTORS, cbamEmbedded, fmtT, label } from '@/lib/sig'
import { StatusBadge } from '@/components/ui/Badge'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError } from '@/lib/utils'

type Inst = { id: string; name: string }
type Good = { id: string; name: string; cn_code: string | null; sector: string | null; default_unit: string | null }
type Prec = { id: string; entry_id: string; name: string; cn_code: string | null; quantity: number | null; see_direct: number | null; see_indirect: number | null; source: string | null }
type Entry = {
  id: string; number: string | null; installation_id: string | null; good_id: string | null; period_year: number
  period_label: string | null; period_start: string | null; period_end: string | null; determination_method: string
  activity_level: number | null; direct_emissions: number | null; electricity_mwh: number | null; electricity_ef: number | null
  electricity_source: string | null; verification_status: string; verifier: string | null; notes: string | null
}

const CY = new Date().getFullYear()

export default function DeclaracionesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Entry[]>([])
  const [precs, setPrecs] = useState<Prec[]>([])
  const [insts, setInsts] = useState<Inst[]>([])
  const [goods, setGoods] = useState<Good[]>([])
  const [loading, setLoading] = useState(true)
  const [fYear, setFYear] = useState('')
  const [edit, setEdit] = useState<Partial<Entry> | null>(null)

  async function load() {
    setLoading(true)
    const [{ data }, { data: pr }, { data: i }, { data: g }] = await Promise.all([
      supabase.from('cbam_entries').select('*').order('period_year', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('cbam_precursors').select('*').order('created_at'),
      supabase.from('cbam_installations').select('id, name').order('name'),
      supabase.from('cbam_goods').select('id, name, cn_code, sector, default_unit').order('name'),
    ])
    setRows((data as any) ?? []); setPrecs((pr as any) ?? []); setInsts((i as any) ?? []); setGoods((g as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Entry) {
    if (!confirm(`¿Eliminar la declaración ${r.number ?? ''}?`)) return
    await supabase.from('cbam_entries').delete().eq('id', r.id); load()
  }

  const years = useMemo(() => Array.from(new Set(rows.map(r => r.period_year))).sort((a, b) => b - a), [rows])
  const filtered = rows.filter(r => !fYear || String(r.period_year) === fYear)

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">CBAM · Emisiones incorporadas</p>
          <h1 className="page-title">Declaraciones</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ period_year: CY, determination_method: 'calculation', electricity_source: 'grid_default', verification_status: 'no_verificado' })}><Plus className="w-4 h-4" /> Nueva</button>
      </div>

      <div className="flex gap-2 mb-4">
        <select className="input w-auto" value={fYear} onChange={e => setFYear(e.target.value)}>
          <option value="">Todos los años</option>
          {(years.length ? years : [CY]).map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
      </div>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : filtered.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <Globe className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay declaraciones {rows.length ? 'para ese año' : 'cargadas'}.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => (
              <Row key={r.id} r={r} precs={precs.filter(p => p.entry_id === r.id)}
                inst={insts.find(i => i.id === r.installation_id)?.name ?? null}
                good={goods.find(g => g.id === r.good_id) ?? null}
                onEdit={() => setEdit(r)} onDelete={() => del(r)} reload={load} />
            ))}
          </div>
        )}

      {edit && <Form row={edit} insts={insts} goods={goods} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Row({ r, precs, inst, good, onEdit, onDelete, reload }: {
  r: Entry; precs: Prec[]; inst: string | null; good: Good | null; onEdit: () => void; onDelete: () => void; reload: () => void
}) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [pf, setPf] = useState<Partial<Prec> | null>(null)
  const calc = cbamEmbedded(r.activity_level, r.direct_emissions, r.electricity_mwh, r.electricity_ef, precs)

  async function delPrec(id: string) { await supabase.from('cbam_precursors').delete().eq('id', id); reload() }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setOpen(o => !o)} className="min-w-0 text-left flex items-start gap-2 flex-1">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400 mt-0.5" /> : <ChevronRight className="w-4 h-4 text-gray-400 mt-0.5" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-gray-400">{r.number}</span>
              <span className="font-medium text-gray-900">{good?.name ?? 'Bien'}</span>
              {good?.cn_code && <span className="text-xs font-mono text-gray-400">CN {good.cn_code}</span>}
              <StatusBadge map={CBAM_VERIF} value={r.verification_status} />
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {[inst, r.period_label || r.period_year, r.activity_level != null ? `${fmtT(r.activity_level)} ${good?.default_unit ?? 't'} producidas` : null].filter(Boolean).join(' · ')}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <div className="font-bold text-gray-900 tabular-nums leading-none">{calc.seeTotal != null ? fmtT(calc.seeTotal, 3) : '—'}</div>
            <div className="text-[10px] text-gray-400">t CO₂e / {good?.default_unit ?? 't'}</div>
          </div>
          <button onClick={onEdit} className="p-2 text-gray-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
          <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="SEE directas" value={calc.seeDirect != null ? fmtT(calc.seeDirect, 3) : '—'} unit={`/${good?.default_unit ?? 't'}`} />
            <Stat label="SEE indirectas" value={calc.seeIndirect != null ? fmtT(calc.seeIndirect, 3) : '—'} unit={`/${good?.default_unit ?? 't'}`} />
            <Stat label="SEE total" value={calc.seeTotal != null ? fmtT(calc.seeTotal, 3) : '—'} unit={`/${good?.default_unit ?? 't'}`} highlight />
            <Stat label="Incorporadas totales" value={fmtT(calc.totalDirect + calc.totalIndirect, 2)} unit="t CO₂e" />
          </div>
          <div className="text-xs text-gray-500 space-y-0.5">
            <div>Método: {label(CBAM_METHOD, r.determination_method)} · Electricidad: {fmtT(r.electricity_mwh, 2)} MWh × {r.electricity_ef ?? 0} ({label(CBAM_ELEC_SOURCE, r.electricity_source ?? '')})</div>
            {r.verifier && <div>Verificador: {r.verifier}</div>}
            {r.notes && <div className="whitespace-pre-wrap text-gray-600">{r.notes}</div>}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-gray-500">Precursores</div>
              <button onClick={() => setPf({})} className="text-xs text-teal-600 hover:text-teal-700 font-medium">+ Agregar</button>
            </div>
            {precs.length === 0 ? <p className="text-xs text-gray-400">Sin precursores.</p> : (
              <div className="space-y-1">
                {precs.map(p => (
                  <div key={p.id} className="flex items-start justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <span className="text-gray-700">{p.name}</span>{p.cn_code && <span className="text-xs font-mono text-gray-400 ml-1">CN {p.cn_code}</span>}
                      <div className="text-xs text-gray-400 mt-0.5">{fmtT(p.quantity, 2)} t · SEE dir {p.see_direct ?? 0} · SEE ind {p.see_indirect ?? 0}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setPf(p)} className="p-1 text-gray-400 hover:text-teal-600"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => delPrec(p.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {pf && <PrecForm entryId={r.id} prec={pf} onClose={() => setPf(null)} onSaved={() => { setPf(null); reload() }} />}
    </div>
  )
}

function Stat({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${highlight ? 'bg-blue-50' : 'bg-gray-50'}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`font-semibold tabular-nums ${highlight ? 'text-blue-800' : 'text-gray-900'}`}>{value} <span className="text-[10px] font-normal text-gray-400">{unit}</span></div>
    </div>
  )
}

function PrecForm({ entryId, prec, onClose, onSaved }: { entryId: string; prec: Partial<Prec>; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!prec.id
  const [f, setF] = useState({
    name: prec.name ?? '', cn_code: prec.cn_code ?? '', quantity: prec.quantity != null ? String(prec.quantity) : '',
    see_direct: prec.see_direct != null ? String(prec.see_direct) : '', see_indirect: prec.see_indirect != null ? String(prec.see_indirect) : '', source: prec.source ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!f.name.trim()) { setError('El nombre del precursor es obligatorio.'); return }
    setSaving(true); setError('')
    const num = (v: string) => v ? Number(v) : null
    const payload: any = {
      entry_id: entryId, name: f.name.trim(), cn_code: f.cn_code || null, quantity: num(f.quantity),
      see_direct: num(f.see_direct), see_indirect: num(f.see_indirect), source: f.source || null,
    }
    const res = isEdit ? await supabase.from('cbam_precursors').update(payload).eq('id', prec.id) : await supabase.from('cbam_precursors').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Editar precursor' : 'Nuevo precursor'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2"><Field label="Nombre del precursor *"><input className="input" placeholder="Clinker, arrabio…" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field></div>
        <Field label="Código CN"><input className="input" value={f.cn_code} onChange={e => setF({ ...f, cn_code: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Cantidad (t)"><input type="number" step="any" className="input" value={f.quantity} onChange={e => setF({ ...f, quantity: e.target.value })} /></Field>
        <Field label="SEE directas (t/t)"><input type="number" step="any" className="input" value={f.see_direct} onChange={e => setF({ ...f, see_direct: e.target.value })} /></Field>
        <Field label="SEE indirectas (t/t)"><input type="number" step="any" className="input" value={f.see_indirect} onChange={e => setF({ ...f, see_indirect: e.target.value })} /></Field>
      </div>
      <Field label="Origen del dato"><input className="input" placeholder="Proveedor / valores por defecto" value={f.source} onChange={e => setF({ ...f, source: e.target.value })} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}

function Form({ row, insts, goods, onClose, onSaved }: { row: Partial<Entry>; insts: Inst[]; goods: Good[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({
    installation_id: row.installation_id ?? '', good_id: row.good_id ?? '', period_year: row.period_year ?? CY, period_label: row.period_label ?? '',
    period_start: row.period_start ?? '', period_end: row.period_end ?? '', determination_method: row.determination_method ?? 'calculation',
    activity_level: row.activity_level != null ? String(row.activity_level) : '', direct_emissions: row.direct_emissions != null ? String(row.direct_emissions) : '',
    electricity_mwh: row.electricity_mwh != null ? String(row.electricity_mwh) : '', electricity_ef: row.electricity_ef != null ? String(row.electricity_ef) : '',
    electricity_source: row.electricity_source ?? 'grid_default', verification_status: row.verification_status ?? 'no_verificado', verifier: row.verifier ?? '', notes: row.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Vista previa (sin precursores, que se cargan tras crear la declaración)
  const preview = cbamEmbedded(Number(f.activity_level) || 0, Number(f.direct_emissions) || 0, Number(f.electricity_mwh) || 0, Number(f.electricity_ef) || 0, [])

  async function save() {
    if (!f.good_id) { setError('Elegí el bien CBAM.'); return }
    if (!f.period_year) { setError('El año es obligatorio.'); return }
    setSaving(true); setError('')
    const num = (v: string) => v ? Number(v) : null
    const payload: any = {
      installation_id: f.installation_id || null, good_id: f.good_id, period_year: Number(f.period_year), period_label: f.period_label || null,
      period_start: f.period_start || null, period_end: f.period_end || null, determination_method: f.determination_method,
      activity_level: num(f.activity_level), direct_emissions: num(f.direct_emissions), electricity_mwh: num(f.electricity_mwh), electricity_ef: num(f.electricity_ef),
      electricity_source: f.electricity_source, verification_status: f.verification_status, verifier: f.verifier || null, notes: f.notes || null,
    }
    const res = isEdit ? await supabase.from('cbam_entries').update(payload).eq('id', row.id) : await supabase.from('cbam_entries').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? `Editar ${row.number ?? 'declaración'}` : 'Nueva declaración CBAM'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bien CBAM *"><select className="input" value={f.good_id} onChange={e => setF({ ...f, good_id: e.target.value })}><option value="">—</option>{goods.map(g => <option key={g.id} value={g.id}>{g.name}{g.cn_code ? ` (CN ${g.cn_code})` : ''}</option>)}</select></Field>
        <Field label="Instalación"><select className="input" value={f.installation_id} onChange={e => setF({ ...f, installation_id: e.target.value })}><option value="">—</option>{insts.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Año *"><input type="number" className="input" value={f.period_year} onChange={e => setF({ ...f, period_year: Number(e.target.value) })} /></Field>
        <Field label="Período (etiqueta)"><input className="input" placeholder="Q1-2026 / Anual" value={f.period_label} onChange={e => setF({ ...f, period_label: e.target.value })} /></Field>
        <Field label="Método"><select className="input" value={f.determination_method} onChange={e => setF({ ...f, determination_method: e.target.value })}>{Object.entries(CBAM_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Producción del bien (t)"><input type="number" step="any" className="input" value={f.activity_level} onChange={e => setF({ ...f, activity_level: e.target.value })} /></Field>
        <Field label="Emisiones directas del proceso (t CO₂e)"><input type="number" step="any" className="input" value={f.direct_emissions} onChange={e => setF({ ...f, direct_emissions: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Electricidad (MWh)"><input type="number" step="any" className="input" value={f.electricity_mwh} onChange={e => setF({ ...f, electricity_mwh: e.target.value })} /></Field>
        <Field label="FE electricidad (t/MWh)"><input type="number" step="any" className="input" value={f.electricity_ef} onChange={e => setF({ ...f, electricity_ef: e.target.value })} /></Field>
        <Field label="Fuente elec."><select className="input" value={f.electricity_source} onChange={e => setF({ ...f, electricity_source: e.target.value })}>{Object.entries(CBAM_ELEC_SOURCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
      {Number(f.activity_level) > 0 && (
        <div className="bg-blue-50 text-blue-800 text-sm px-3 py-2 rounded-xl mb-3">
          SEE (sin precursores): <b>{fmtT(preview.seeTotal, 3)}</b> t CO₂e/t · directas {fmtT(preview.seeDirect, 3)} + indirectas {fmtT(preview.seeIndirect, 3)}
          <div className="text-xs text-blue-600 mt-0.5">Los precursores se agregan después de crear la declaración y suman a este valor.</div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Verificación"><select className="input" value={f.verification_status} onChange={e => setF({ ...f, verification_status: e.target.value })}>{Object.entries(CBAM_VERIF).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Verificador acreditado"><input className="input" value={f.verifier} onChange={e => setF({ ...f, verifier: e.target.value })} /></Field>
      </div>
      <Field label="Notas / metodología"><textarea className="input" rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
