'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Search, Paperclip, Download } from 'lucide-react'
import { EVIDENCE_TIPO, label } from '@/lib/sig'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError, formatDate } from '@/lib/utils'

type Site = { id: string; name: string }
type Evidence = {
  id: string; name: string; site_id: string | null; year: number | null; tipo: string | null
  file_url: string | null; file_path: string | null; file_name: string | null; uploaded_by: string | null
  notas: string | null; created_at: string
}

export default function EvidenciasPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Evidence[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [fSite, setFSite] = useState('')
  const [edit, setEdit] = useState<Partial<Evidence> | null>(null)

  async function load() {
    setLoading(true)
    const [{ data }, { data: s }] = await Promise.all([
      supabase.from('evidences').select('*').order('created_at', { ascending: false }),
      supabase.from('sites').select('id, name').order('name'),
    ])
    setRows((data as any) ?? []); setSites((s as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function del(r: Evidence) {
    if (!confirm(`¿Eliminar la evidencia "${r.name}"?`)) return
    if (r.file_path) await supabase.storage.from('evidencias').remove([r.file_path])
    await supabase.from('evidences').delete().eq('id', r.id); load()
  }

  async function download(r: Evidence) {
    if (r.file_url) { window.open(r.file_url, '_blank'); return }
    if (!r.file_path) return
    const { data } = await supabase.storage.from('evidencias').createSignedUrl(r.file_path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const siteName = (id: string | null) => sites.find(s => s.id === id)?.name ?? null
  const filtered = rows.filter(r => {
    if (fSite && r.site_id !== fSite) return false
    if (q && ![r.name, r.file_name, r.notas].join(' ').toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 8 · Gestión de datos</p>
          <h1 className="page-title">Evidencias</h1>
        </div>
        <button className="btn-primary" onClick={() => setEdit({ tipo: 'factura' })}><Plus className="w-4 h-4" /> Nueva</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar evidencia…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={fSite} onChange={e => setFSite(e.target.value)}>
          <option value="">Todos los sitios</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p>
        : filtered.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">
            <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No hay evidencias {rows.length ? 'con esos filtros' : 'cargadas'}.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => (
              <div key={r.id} className="card flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{r.name}</span>
                    {r.tipo && <span className="badge bg-gray-100 text-gray-600">{label(EVIDENCE_TIPO, r.tipo)}</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[siteName(r.site_id), r.year, r.file_name, r.uploaded_by, formatDate(r.created_at)].filter(Boolean).join(' · ')}
                  </div>
                  {r.notas && <p className="text-xs text-gray-500 mt-1">{r.notas}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {(r.file_path || r.file_url) && <button onClick={() => download(r)} className="p-2 text-gray-400 hover:text-teal-600" title="Ver / descargar"><Download className="w-4 h-4" /></button>}
                  <button onClick={() => setEdit(r)} className="p-2 text-gray-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => del(r)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

      {edit && <Form row={edit} sites={sites} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Form({ row, sites, onClose, onSaved }: { row: Partial<Evidence>; sites: Site[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!row.id
  const [f, setF] = useState({
    name: row.name ?? '', site_id: row.site_id ?? '', year: row.year != null ? String(row.year) : '',
    tipo: row.tipo ?? 'factura', uploaded_by: row.uploaded_by ?? '', notas: row.notas ?? '', file_url: row.file_url ?? '',
  })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!f.name.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true); setError('')
    let file_path = row.file_path ?? null, file_name = row.file_name ?? null
    if (file) {
      const safe = file.name.replace(/[^\w.\-]/g, '_')
      const path = `${f.year || 'sin-anio'}/${f.site_id || 'general'}/${Date.now()}-${safe}`
      const up = await supabase.storage.from('evidencias').upload(path, file)
      if (up.error) { setError('Error al subir: ' + up.error.message); setSaving(false); return }
      file_path = path; file_name = file.name
    }
    const payload: any = {
      name: f.name.trim(), site_id: f.site_id || null, year: f.year ? Number(f.year) : null, tipo: f.tipo || null,
      uploaded_by: f.uploaded_by || null, notas: f.notas || null, file_url: f.file_url || null, file_path, file_name,
    }
    const res = isEdit ? await supabase.from('evidences').update(payload).eq('id', row.id) : await supabase.from('evidences').insert(payload)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Editar evidencia' : 'Nueva evidencia'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <Field label="Nombre *"><input className="input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2"><Field label="Sitio"><select className="input" value={f.site_id} onChange={e => setF({ ...f, site_id: e.target.value })}><option value="">—</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field></div>
        <Field label="Año"><input type="number" className="input" value={f.year} onChange={e => setF({ ...f, year: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo"><select className="input" value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}>{Object.entries(EVIDENCE_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Cargada por"><input className="input" value={f.uploaded_by} onChange={e => setF({ ...f, uploaded_by: e.target.value })} /></Field>
      </div>
      <Field label="Archivo">
        <input type="file" className="input" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        {isEdit && row.file_name && !file && <p className="text-xs text-gray-500 mt-1">Actual: {row.file_name}</p>}
      </Field>
      <Field label="…o link externo (opcional)"><input className="input" placeholder="https://…" value={f.file_url} onChange={e => setF({ ...f, file_url: e.target.value })} /></Field>
      <Field label="Notas"><textarea className="input" rows={2} value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} /></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
