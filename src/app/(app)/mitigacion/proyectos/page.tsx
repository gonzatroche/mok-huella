'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Sprout } from 'lucide-react'
import { PROJECT_STATUS, PROJECT_TIPO, ISO_CATEGORIES, ISO_CATEGORY_KEYS, fmtT } from '@/lib/sig'
import { StatusBadge } from '@/components/ui/Badge'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError, formatDate } from '@/lib/utils'

type Persona = { id: string; nombre: string }
type Project = {
  id: string; number: string | null; title: string; descripcion: string | null; category_key: string | null
  tipo: string; estimated_reduction: number | null; responsable_id: string | null
  fecha_inicio: string | null; fecha_fin: string | null; status: string
}

export default function ProyectosPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Project[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Partial<Project> | null>(null)

  async function load() {
    setLoading(true)
    const [{ data }, { data: p }] = await Promise.all([
      supabase.from('reduction_projects').select('*').order('created_at', { ascending: false }),
      supabase.from('personas').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setRows((data as any) ?? []); setPersonas((p as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Project) {
    if (!confirm(`¿Eliminar el proyecto "${r.title}"?`)) return
    await supabase.from('reduction_projects').delete().eq('id', r.id); load()
  }

  const personaName = (id: string | null) => personas.find(p => p.id === id)?.nombre ?? null
  const totalRed = rows.filter(r => ['implementado', 'verificado'].includes(r.status)).reduce((a, r) => a + (Number(r.estimated_reduction) || 0), 0)

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 7 · Mitigación</p>
          <h1 className="page-title">Proyectos de reducción</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ status: 'propuesto', tipo: 'reduccion' })}><Plus className="w-4 h-4" /> Nuevo</button>
      </div>

      {rows.length > 0 && (
        <div className="card mb-4 flex items-center gap-3 bg-emerald-50/50 border-emerald-100">
          <Sprout className="w-8 h-8 text-emerald-600" />
          <div>
            <div className="text-2xl font-bold text-gray-900 leading-none">{fmtT(totalRed)} <span className="text-base font-medium text-gray-500">t CO₂eq/año</span></div>
            <div className="text-xs text-gray-500 mt-1">Reducción estimada de proyectos implementados/verificados</div>
          </div>
        </div>
      )}

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : rows.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <Sprout className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay proyectos de reducción / remoción cargados.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="card flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-gray-400">{r.number}</span>
                    <span className="font-medium text-gray-900">{r.title}</span>
                    <StatusBadge map={PROJECT_TIPO} value={r.tipo} />
                    <StatusBadge map={PROJECT_STATUS} value={r.status} />
                    {r.category_key && <span className={`badge ${ISO_CATEGORIES[r.category_key]?.color ?? 'bg-gray-100'}`}>{ISO_CATEGORIES[r.category_key]?.short}</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[r.estimated_reduction != null ? `${fmtT(r.estimated_reduction)} t CO₂eq/año` : null, personaName(r.responsable_id),
                      r.fecha_inicio ? `desde ${formatDate(r.fecha_inicio)}` : null].filter(Boolean).join(' · ') || '—'}
                  </div>
                  {r.descripcion && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.descripcion}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setEdit(r)} className="p-2 text-gray-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => del(r)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

      {edit && <Form row={edit} personas={personas} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Form({ row, personas, onClose, onSaved }: { row: Partial<Project>; personas: Persona[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({
    title: row.title ?? '', descripcion: row.descripcion ?? '', category_key: row.category_key ?? '', tipo: row.tipo ?? 'reduccion',
    estimated_reduction: row.estimated_reduction != null ? String(row.estimated_reduction) : '',
    responsable_id: row.responsable_id ?? '', fecha_inicio: row.fecha_inicio ?? '', fecha_fin: row.fecha_fin ?? '', status: row.status ?? 'propuesto',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!f.title.trim()) { setError('El título es obligatorio.'); return }
    setSaving(true); setError('')
    const payload: any = {
      title: f.title.trim(), descripcion: f.descripcion || null, category_key: f.category_key || null, tipo: f.tipo,
      estimated_reduction: f.estimated_reduction ? Number(f.estimated_reduction) : null,
      responsable_id: f.responsable_id || null, fecha_inicio: f.fecha_inicio || null, fecha_fin: f.fecha_fin || null, status: f.status,
    }
    const res = isEdit ? await supabase.from('reduction_projects').update(payload).eq('id', row.id) : await supabase.from('reduction_projects').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? `Editar ${row.number ?? 'proyecto'}` : 'Nuevo proyecto'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <Field label="Título *"><input className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Tipo"><select className="input" value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}>{Object.entries(PROJECT_TIPO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Categoría"><select className="input" value={f.category_key} onChange={e => setF({ ...f, category_key: e.target.value })}><option value="">—</option>{ISO_CATEGORY_KEYS.map(k => <option key={k} value={k}>{ISO_CATEGORIES[k].short}</option>)}</select></Field>
        <Field label="Estado"><select className="input" value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>{Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      </div>
      <Field label="Reducción estimada (t CO₂eq/año)"><input type="number" step="any" className="input" value={f.estimated_reduction} onChange={e => setF({ ...f, estimated_reduction: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Inicio"><input type="date" className="input" value={f.fecha_inicio ?? ''} onChange={e => setF({ ...f, fecha_inicio: e.target.value })} /></Field>
        <Field label="Fin"><input type="date" className="input" value={f.fecha_fin ?? ''} onChange={e => setF({ ...f, fecha_fin: e.target.value })} /></Field>
      </div>
      <Field label="Responsable"><select className="input" value={f.responsable_id} onChange={e => setF({ ...f, responsable_id: e.target.value })}><option value="">—</option>{personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
      <Field label="Descripción"><textarea className="input" rows={3} value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
