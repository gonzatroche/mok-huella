'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, ShieldCheck, ChevronDown, ChevronRight } from 'lucide-react'
import { VERIFICATION_TIPO, VERIFICATION_STATUS, ASSURANCE_LEVEL, FINDING_TYPES, label } from '@/lib/sig'
import { StatusBadge } from '@/components/ui/Badge'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError, formatDate } from '@/lib/utils'

type Ver = {
  id: string; number: string | null; tipo: string; year: number | null; alcance: string | null
  nivel_aseguramiento: string | null; criterios: string | null; verificador: string | null
  planned_date: string | null; executed_date: string | null; status: string; conclusiones: string | null
}
type Finding = { id: string; verification_id: string; finding_type: string; descripcion: string; category_key: string | null }

export default function VerificacionesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Ver[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<Ver> | null>(null)

  async function load() {
    setLoading(true)
    const [{ data }, { data: fi }] = await Promise.all([
      supabase.from('verifications').select('*').order('created_at', { ascending: false }),
      supabase.from('verification_findings').select('*').order('created_at'),
    ])
    setRows((data as any) ?? []); setFindings((fi as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Ver) {
    if (!confirm(`¿Eliminar la verificación ${r.number ?? ''}?`)) return
    await supabase.from('verifications').delete().eq('id', r.id); load()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">ISO 14064-3 · Verificación</p>
          <h1 className="page-title">Verificaciones</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ tipo: 'interna', status: 'planificada' })}><Plus className="w-4 h-4" /> Nueva</button>
      </div>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : rows.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay verificaciones cargadas.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <Row key={r.id} r={r} findings={findings.filter(f => f.verification_id === r.id)}
                onEdit={() => setEdit(r)} onDelete={() => del(r)} reload={load} />
            ))}
          </div>
        )}

      {edit && <Form row={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Row({ r, findings, onEdit, onDelete, reload }: { r: Ver; findings: Finding[]; onEdit: () => void; onDelete: () => void; reload: () => void }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [nf, setNf] = useState({ finding_type: 'observacion', descripcion: '' })

  async function addFinding() {
    if (!nf.descripcion.trim()) return
    await supabase.from('verification_findings').insert({ verification_id: r.id, finding_type: nf.finding_type, descripcion: nf.descripcion.trim() })
    setNf({ finding_type: 'observacion', descripcion: '' }); setAdding(false); reload()
  }
  async function delFinding(id: string) {
    await supabase.from('verification_findings').delete().eq('id', id); reload()
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setOpen(o => !o)} className="min-w-0 text-left flex items-start gap-2 flex-1">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400 mt-0.5" /> : <ChevronRight className="w-4 h-4 text-gray-400 mt-0.5" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-gray-400">{r.number}</span>
              <span className="font-medium text-gray-900">{r.alcance || label(VERIFICATION_TIPO, r.tipo)}</span>
              <span className="badge bg-gray-100 text-gray-600">{label(VERIFICATION_TIPO, r.tipo)}</span>
              <StatusBadge map={VERIFICATION_STATUS} value={r.status} />
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {[r.verificador, r.year, r.nivel_aseguramiento ? label(ASSURANCE_LEVEL, r.nivel_aseguramiento) : null,
                findings.length ? `${findings.length} hallazgo(s)` : null].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit} className="p-2 text-gray-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
          <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3 text-sm">
          {r.criterios && <div><div className="text-xs font-semibold text-gray-500">Criterios</div><p className="text-gray-700">{r.criterios}</p></div>}
          {(r.planned_date || r.executed_date) && <div className="text-xs text-gray-500">{r.planned_date ? `Planificada ${formatDate(r.planned_date)}` : ''}{r.executed_date ? ` · Ejecutada ${formatDate(r.executed_date)}` : ''}</div>}
          {r.conclusiones && <div><div className="text-xs font-semibold text-gray-500">Conclusiones</div><p className="text-gray-700 whitespace-pre-wrap">{r.conclusiones}</p></div>}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-gray-500">Hallazgos</div>
              <button onClick={() => setAdding(a => !a)} className="text-xs text-teal-600 hover:text-teal-700 font-medium">+ Agregar</button>
            </div>
            {findings.length === 0 && !adding && <p className="text-xs text-gray-400">Sin hallazgos.</p>}
            <div className="space-y-1">
              {findings.map(fd => (
                <div key={fd.id} className="flex items-start justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <div className="min-w-0"><StatusBadge map={FINDING_TYPES} value={fd.finding_type} /> <span className="text-gray-700">{fd.descripcion}</span></div>
                  <button onClick={() => delFinding(fd.id)} className="p-1 text-gray-400 hover:text-red-600 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            {adding && (
              <div className="flex gap-2 mt-2">
                <select className="input w-auto" value={nf.finding_type} onChange={e => setNf({ ...nf, finding_type: e.target.value })}>
                  {Object.entries(FINDING_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <input className="input flex-1" placeholder="Descripción del hallazgo" value={nf.descripcion} onChange={e => setNf({ ...nf, descripcion: e.target.value })} />
                <button className="btn-primary" onClick={addFinding}>Agregar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Form({ row, onClose, onSaved }: { row: Partial<Ver>; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({
    tipo: row.tipo ?? 'interna', year: row.year != null ? String(row.year) : String(new Date().getFullYear()),
    alcance: row.alcance ?? '', nivel_aseguramiento: row.nivel_aseguramiento ?? '', criterios: row.criterios ?? '',
    verificador: row.verificador ?? '', planned_date: row.planned_date ?? '', executed_date: row.executed_date ?? '',
    status: row.status ?? 'planificada', conclusiones: row.conclusiones ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true); setError('')
    const payload: any = {
      tipo: f.tipo, year: f.year ? Number(f.year) : null, alcance: f.alcance || null,
      nivel_aseguramiento: f.nivel_aseguramiento || null, criterios: f.criterios || null, verificador: f.verificador || null,
      planned_date: f.planned_date || null, executed_date: f.executed_date || null, status: f.status, conclusiones: f.conclusiones || null,
    }
    const res = isEdit ? await supabase.from('verifications').update(payload).eq('id', row.id) : await supabase.from('verifications').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? `Editar ${row.number ?? 'verificación'}` : 'Nueva verificación'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Tipo"><select className="input" value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}>{Object.entries(VERIFICATION_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Año"><input type="number" className="input" value={f.year} onChange={e => setF({ ...f, year: e.target.value })} /></Field>
        <Field label="Estado"><select className="input" value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>{Object.entries(VERIFICATION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      </div>
      <Field label="Alcance"><input className="input" placeholder="Inventario GEI año 2026" value={f.alcance} onChange={e => setF({ ...f, alcance: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nivel de aseguramiento"><select className="input" value={f.nivel_aseguramiento} onChange={e => setF({ ...f, nivel_aseguramiento: e.target.value })}><option value="">—</option>{Object.entries(ASSURANCE_LEVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Verificador"><input className="input" value={f.verificador} onChange={e => setF({ ...f, verificador: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha planificada"><input type="date" className="input" value={f.planned_date ?? ''} onChange={e => setF({ ...f, planned_date: e.target.value })} /></Field>
        <Field label="Fecha ejecutada"><input type="date" className="input" value={f.executed_date ?? ''} onChange={e => setF({ ...f, executed_date: e.target.value })} /></Field>
      </div>
      <Field label="Criterios"><textarea className="input" rows={2} value={f.criterios} onChange={e => setF({ ...f, criterios: e.target.value })} /></Field>
      <Field label="Conclusiones"><textarea className="input" rows={2} value={f.conclusiones} onChange={e => setF({ ...f, conclusiones: e.target.value })} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
