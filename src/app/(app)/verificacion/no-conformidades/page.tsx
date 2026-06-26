'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { NC_SOURCES, NC_SEVERITY, NC_STATUS, ACTION_TYPES, ACTION_STATUS, label } from '@/lib/sig'
import { StatusBadge } from '@/components/ui/Badge'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError, formatDate } from '@/lib/utils'

type Persona = { id: string; nombre: string }
type NC = {
  id: string; number: string | null; title: string; description: string | null; source: string; severity: string
  detected_date: string | null; detected_by: string | null; root_cause: string | null; immediate_action: string | null
  status: string; closed_at: string | null
}
type Action = {
  id: string; nonconformity_id: string; number: string | null; description: string; action_type: string
  responsible_id: string | null; due_date: string | null; status: string; effectiveness: string | null
}

export default function NoConformidadesPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<NC[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [fStatus, setFStatus] = useState('')
  const [edit, setEdit] = useState<Partial<NC> | null>(null)

  async function load() {
    setLoading(true)
    const [{ data }, { data: ac }, { data: p }] = await Promise.all([
      supabase.from('nonconformities').select('*').order('created_at', { ascending: false }),
      supabase.from('actions').select('*').order('created_at'),
      supabase.from('personas').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setRows((data as any) ?? []); setActions((ac as any) ?? []); setPersonas((p as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: NC) {
    if (!confirm(`¿Eliminar ${r.number ?? 'la NC'}?`)) return
    await supabase.from('nonconformities').delete().eq('id', r.id); load()
  }

  const filtered = rows.filter(r => !fStatus || r.status === fStatus)

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Mejora · No conformidades</p>
          <h1 className="page-title">No conformidades</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ severity: 'no_conformidad', source: 'verificacion', status: 'abierta' })}><Plus className="w-4 h-4" /> Nueva</button>
      </div>

      <div className="flex gap-2 mb-4">
        <select className="input w-auto" value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(NC_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : filtered.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay no conformidades {rows.length ? 'con ese filtro' : 'cargadas'}.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => (
              <Row key={r.id} r={r} actions={actions.filter(a => a.nonconformity_id === r.id)} personas={personas}
                onEdit={() => setEdit(r)} onDelete={() => del(r)} reload={load} />
            ))}
          </div>
        )}

      {edit && <Form row={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Row({ r, actions, personas, onEdit, onDelete, reload }: {
  r: NC; actions: Action[]; personas: Persona[]; onEdit: () => void; onDelete: () => void; reload: () => void
}) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [na, setNa] = useState({ description: '', action_type: 'correctiva', responsible_id: '', due_date: '' })
  const personaName = (id: string | null) => personas.find(p => p.id === id)?.nombre ?? null

  async function addAction() {
    if (!na.description.trim()) return
    await supabase.from('actions').insert({
      nonconformity_id: r.id, description: na.description.trim(), action_type: na.action_type,
      responsible_id: na.responsible_id || null, due_date: na.due_date || null,
    })
    setNa({ description: '', action_type: 'correctiva', responsible_id: '', due_date: '' }); setAdding(false); reload()
  }
  async function toggleAction(a: Action) {
    const next = a.status === 'cerrada' ? 'pendiente' : 'cerrada'
    await supabase.from('actions').update({ status: next, completed_at: next === 'cerrada' ? new Date().toISOString().slice(0, 10) : null }).eq('id', a.id); reload()
  }
  async function delAction(id: string) { await supabase.from('actions').delete().eq('id', id); reload() }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setOpen(o => !o)} className="min-w-0 text-left flex items-start gap-2 flex-1">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400 mt-0.5" /> : <ChevronRight className="w-4 h-4 text-gray-400 mt-0.5" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-gray-400">{r.number}</span>
              <span className="font-medium text-gray-900">{r.title}</span>
              <StatusBadge map={NC_SEVERITY} value={r.severity} />
              <StatusBadge map={NC_STATUS} value={r.status} />
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {[label(NC_SOURCES, r.source), r.detected_date ? formatDate(r.detected_date) : null,
                actions.length ? `${actions.length} acción(es)` : null].filter(Boolean).join(' · ')}
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
          {r.description && <p className="text-gray-700 whitespace-pre-wrap">{r.description}</p>}
          {r.root_cause && <div><div className="text-xs font-semibold text-gray-500">Causa raíz</div><p className="text-gray-700">{r.root_cause}</p></div>}
          {r.immediate_action && <div><div className="text-xs font-semibold text-gray-500">Acción inmediata</div><p className="text-gray-700">{r.immediate_action}</p></div>}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-gray-500">Acciones</div>
              <button onClick={() => setAdding(a => !a)} className="text-xs text-teal-600 hover:text-teal-700 font-medium">+ Agregar</button>
            </div>
            {actions.length === 0 && !adding && <p className="text-xs text-gray-400">Sin acciones.</p>}
            <div className="space-y-1">
              {actions.map(a => (
                <div key={a.id} className="flex items-start justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <span className="badge bg-gray-100 text-gray-600 mr-1">{label(ACTION_TYPES, a.action_type)}</span>
                    <span className="text-gray-700">{a.description}</span>
                    <div className="text-xs text-gray-400 mt-0.5">{[personaName(a.responsible_id), a.due_date ? `Vence ${formatDate(a.due_date)}` : null].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => toggleAction(a)} title="Cerrar/abrir"><StatusBadge map={ACTION_STATUS} value={a.status} /></button>
                    <button onClick={() => delAction(a.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
            {adding && (
              <div className="space-y-2 mt-2">
                <input className="input" placeholder="Descripción de la acción" value={na.description} onChange={e => setNa({ ...na, description: e.target.value })} />
                <div className="grid grid-cols-3 gap-2">
                  <select className="input" value={na.action_type} onChange={e => setNa({ ...na, action_type: e.target.value })}>{Object.entries(ACTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <select className="input" value={na.responsible_id} onChange={e => setNa({ ...na, responsible_id: e.target.value })}><option value="">Responsable…</option>{personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
                  <input type="date" className="input" value={na.due_date} onChange={e => setNa({ ...na, due_date: e.target.value })} />
                </div>
                <button className="btn-primary" onClick={addAction}>Agregar acción</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Form({ row, onClose, onSaved }: { row: Partial<NC>; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({
    title: row.title ?? '', description: row.description ?? '', source: row.source ?? 'verificacion', severity: row.severity ?? 'no_conformidad',
    detected_date: row.detected_date ?? '', detected_by: row.detected_by ?? '', root_cause: row.root_cause ?? '',
    immediate_action: row.immediate_action ?? '', status: row.status ?? 'abierta',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!f.title.trim()) { setError('El título es obligatorio.'); return }
    setSaving(true); setError('')
    const payload: any = {
      title: f.title.trim(), description: f.description || null, source: f.source, severity: f.severity,
      detected_date: f.detected_date || null, detected_by: f.detected_by || null, root_cause: f.root_cause || null,
      immediate_action: f.immediate_action || null, status: f.status,
      closed_at: f.status === 'cerrada' ? (row.closed_at ?? new Date().toISOString().slice(0, 10)) : null,
    }
    const res = isEdit ? await supabase.from('nonconformities').update(payload).eq('id', row.id) : await supabase.from('nonconformities').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? `Editar ${row.number ?? 'NC'}` : 'Nueva no conformidad'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <Field label="Título *"><input className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Severidad"><select className="input" value={f.severity} onChange={e => setF({ ...f, severity: e.target.value })}>{Object.entries(NC_SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Origen"><select className="input" value={f.source} onChange={e => setF({ ...f, source: e.target.value })}>{Object.entries(NC_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Estado"><select className="input" value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>{Object.entries(NC_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha de detección"><input type="date" className="input" value={f.detected_date ?? ''} onChange={e => setF({ ...f, detected_date: e.target.value })} /></Field>
        <Field label="Detectada por"><input className="input" value={f.detected_by} onChange={e => setF({ ...f, detected_by: e.target.value })} /></Field>
      </div>
      <Field label="Descripción"><textarea className="input" rows={2} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
      <Field label="Causa raíz"><textarea className="input" rows={2} value={f.root_cause} onChange={e => setF({ ...f, root_cause: e.target.value })} /></Field>
      <Field label="Acción inmediata"><textarea className="input" rows={2} value={f.immediate_action} onChange={e => setF({ ...f, immediate_action: e.target.value })} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
