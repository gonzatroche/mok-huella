'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Search, FileText, Download } from 'lucide-react'
import { DOC_TYPES, DOC_STATUS, label } from '@/lib/sig'
import { StatusBadge } from '@/components/ui/Badge'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError, formatDate } from '@/lib/utils'

type Doc = {
  id: string; code: string | null; title: string; doc_type: string; owner_name: string | null; version: string
  status: string; issue_date: string | null; next_review_date: string | null; file_url: string | null
  file_path: string | null; file_name: string | null; approved_by: string | null; description: string | null
}

export default function DocumentosPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [fType, setFType] = useState('')
  const [edit, setEdit] = useState<Partial<Doc> | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('documents').select('*').order('code')
    setRows((data as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Doc) {
    if (!confirm(`¿Eliminar "${r.title}"?`)) return
    if (r.file_path) await supabase.storage.from('evidencias').remove([r.file_path])
    await supabase.from('documents').delete().eq('id', r.id); load()
  }
  async function download(r: Doc) {
    if (r.file_url) { window.open(r.file_url, '_blank'); return }
    if (!r.file_path) return
    const { data } = await supabase.storage.from('evidencias').createSignedUrl(r.file_path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const filtered = rows.filter(r => {
    if (fType && r.doc_type !== fType) return false
    if (q && ![r.code, r.title, r.owner_name].join(' ').toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 8 · Gestión de datos</p>
          <h1 className="page-title">Documentación</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ doc_type: 'procedimiento', status: 'vigente', version: '1' })}><Plus className="w-4 h-4" /> Nuevo</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar documento…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={fType} onChange={e => setFType(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : filtered.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay documentos {rows.length ? 'con esos filtros' : 'cargados'}.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => (
              <div key={r.id} className="card flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.code && <span className="text-xs font-mono text-gray-400">{r.code}</span>}
                    <span className="font-medium text-gray-900">{r.title}</span>
                    <span className="badge bg-gray-100 text-gray-600">{label(DOC_TYPES, r.doc_type)}</span>
                    <StatusBadge map={DOC_STATUS} value={r.status} />
                    <span className="text-xs text-gray-400">v{r.version}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[r.owner_name, r.issue_date ? `Emitido ${formatDate(r.issue_date)}` : null,
                      r.next_review_date ? `Revisión ${formatDate(r.next_review_date)}` : null].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {(r.file_path || r.file_url) && <button onClick={() => download(r)} className="p-2 text-gray-400 hover:text-teal-600" title="Ver"><Download className="w-4 h-4" /></button>}
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

function Form({ row, onClose, onSaved }: { row: Partial<Doc>; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({
    code: row.code ?? '', title: row.title ?? '', doc_type: row.doc_type ?? 'procedimiento', owner_name: row.owner_name ?? '',
    version: row.version ?? '1', status: row.status ?? 'vigente', issue_date: row.issue_date ?? '', next_review_date: row.next_review_date ?? '',
    approved_by: row.approved_by ?? '', description: row.description ?? '', file_url: row.file_url ?? '',
  })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!f.title.trim()) { setError('El título es obligatorio.'); return }
    setSaving(true); setError('')
    let file_path = row.file_path ?? null, file_name = row.file_name ?? null
    if (file) {
      const safe = file.name.replace(/[^\w.\-]/g, '_')
      const path = `documentos/${Date.now()}-${safe}`
      const up = await supabase.storage.from('evidencias').upload(path, file)
      if (up.error) { setError('Error al subir: ' + up.error.message); setSaving(false); return }
      file_path = path; file_name = file.name
    }
    const payload: any = {
      code: f.code || null, title: f.title.trim(), doc_type: f.doc_type, owner_name: f.owner_name || null,
      version: f.version || '1', status: f.status, issue_date: f.issue_date || null, next_review_date: f.next_review_date || null,
      approved_by: f.approved_by || null, description: f.description || null, file_url: f.file_url || null, file_path, file_name,
    }
    const res = isEdit ? await supabase.from('documents').update(payload).eq('id', row.id) : await supabase.from('documents').insert(payload)
    if (res.error) { setError(friendlyError(res.error, [[/code/, 'Ya existe un documento con ese código.']])); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Editar documento' : 'Nuevo documento'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Código"><input className="input" placeholder="P-GEI-01" value={f.code} onChange={e => setF({ ...f, code: e.target.value })} /></Field>
        <div className="col-span-2"><Field label="Título *"><input className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Tipo"><select className="input" value={f.doc_type} onChange={e => setF({ ...f, doc_type: e.target.value })}>{Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Versión"><input className="input" value={f.version} onChange={e => setF({ ...f, version: e.target.value })} /></Field>
        <Field label="Estado"><select className="input" value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>{Object.entries(DOC_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Responsable"><input className="input" value={f.owner_name} onChange={e => setF({ ...f, owner_name: e.target.value })} /></Field>
        <Field label="Aprobado por"><input className="input" value={f.approved_by} onChange={e => setF({ ...f, approved_by: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha de emisión"><input type="date" className="input" value={f.issue_date ?? ''} onChange={e => setF({ ...f, issue_date: e.target.value })} /></Field>
        <Field label="Próxima revisión"><input type="date" className="input" value={f.next_review_date ?? ''} onChange={e => setF({ ...f, next_review_date: e.target.value })} /></Field>
      </div>
      <Field label="Archivo">
        <input type="file" className="input" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        {isEdit && row.file_name && !file && <p className="text-xs text-gray-500 mt-1">Actual: {row.file_name}</p>}
      </Field>
      <Field label="…o link externo"><input className="input" placeholder="https://…" value={f.file_url} onChange={e => setF({ ...f, file_url: e.target.value })} /></Field>
      <Field label="Descripción"><textarea className="input" rows={2} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
