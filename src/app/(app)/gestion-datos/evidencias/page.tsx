'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Pencil, Search, Paperclip, Download, Sparkles, Loader2 } from 'lucide-react'
import { EVIDENCE_TIPO, label } from '@/lib/sig'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError, formatDate } from '@/lib/utils'
import { TIPO_FUENTE_TO_FACTOR, type ExtractionResult } from '@/lib/extraction'

type Site = { id: string; name: string }
type Factor = { id: string; name: string; unit: string; factor: number; category_key: string | null }
type Evidence = {
  id: string; name: string; site_id: string | null; year: number | null; tipo: string | null
  file_url: string | null; file_path: string | null; file_name: string | null; uploaded_by: string | null
  notas: string | null; created_at: string
}
type Review = { evidence: Evidence; jobId: string; extraction: ExtractionResult }

export default function EvidenciasPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Evidence[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [factors, setFactors] = useState<Factor[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [fSite, setFSite] = useState('')
  const [edit, setEdit] = useState<Partial<Evidence> | null>(null)
  const [extracting, setExtracting] = useState<string | null>(null)
  const [review, setReview] = useState<Review | null>(null)

  async function load() {
    setLoading(true)
    const [{ data }, { data: s }, { data: fac }] = await Promise.all([
      supabase.from('evidences').select('*').order('created_at', { ascending: false }),
      supabase.from('sites').select('id, name').order('name'),
      supabase.from('emission_factors').select('id, name, unit, factor, category_key').eq('activo', true).order('name'),
    ])
    setRows((data as any) ?? []); setSites((s as any) ?? []); setFactors((fac as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function extract(r: Evidence) {
    setExtracting(r.id)
    try {
      const res = await fetch('/api/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidence_id: r.id }),
      })
      const json = await res.json()
      if (!res.ok) { alert('No se pudo extraer: ' + (json.error ?? res.statusText)); return }
      setReview({ evidence: r, jobId: json.job_id, extraction: json.extraction })
    } catch (e: any) {
      alert('Error al extraer: ' + (e?.message ?? e))
    } finally {
      setExtracting(null)
    }
  }

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
                  {(r.file_path || r.file_url) && (
                    <button onClick={() => extract(r)} disabled={extracting === r.id} className="p-2 text-gray-400 hover:text-teal-600 disabled:opacity-50" title="Extraer datos con IA">
                      {extracting === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    </button>
                  )}
                  {(r.file_path || r.file_url) && <button onClick={() => download(r)} className="p-2 text-gray-400 hover:text-teal-600" title="Ver / descargar"><Download className="w-4 h-4" /></button>}
                  <button onClick={() => setEdit(r)} className="p-2 text-gray-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => del(r)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

      {edit && <Form row={edit} sites={sites} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
      {review && <ExtractModal review={review} sites={sites} factors={factors} onClose={() => setReview(null)} onDone={() => { setReview(null); load() }} />}
    </>
  )
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// Modal de revisión/confirmación de la extracción con IA.
// Pre-llena cada item, auto-sugiere el factor (Fase 0) y, al confirmar, inserta
// un emission_record por item + marca el job confirmado. Nunca inserta sin revisión.
function ExtractModal({ review, sites, factors, onClose, onDone }: {
  review: Review; sites: Site[]; factors: Factor[]; onClose: () => void; onDone: () => void
}) {
  const supabase = createClient()
  const { evidence, jobId, extraction } = review

  // Factor sugerido a partir del tipo_fuente detectado.
  const suggestedFactorId = (() => {
    const name = TIPO_FUENTE_TO_FACTOR[extraction.tipo_fuente]
    return name ? (factors.find(f => f.name === name)?.id ?? '') : ''
  })()

  const y = extraction.fecha ? Number(extraction.fecha.slice(0, 4)) : new Date().getFullYear()
  const mo = extraction.fecha ? Number(extraction.fecha.slice(5, 7)) : 0

  const [proveedor, setProveedor] = useState(extraction.proveedor ?? '')
  const [siteId, setSiteId] = useState(evidence.site_id ?? '')
  const [year, setYear] = useState(String(y))
  const [items, setItems] = useState(
    (extraction.items ?? []).map(it => ({
      concepto: it.concepto ?? '',
      cantidad: it.cantidad != null ? String(it.cantidad) : '',
      unidad: it.unidad ?? (suggestedFactorId ? factors.find(f => f.id === suggestedFactorId)?.unit ?? '' : ''),
      factorId: suggestedFactorId,
      include: true,
    }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setItem = (i: number, patch: Partial<(typeof items)[number]>) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))

  async function confirm() {
    const chosen = items.filter(it => it.include && it.factorId && Number(it.cantidad) > 0)
    if (!chosen.length) { setError('Marcá al menos un item con cantidad y factor.'); return }
    setSaving(true); setError('')

    const quarter = mo ? 'T' + Math.ceil(mo / 3) : null
    const period = mo ? `${MESES[mo - 1]}-${year}` : null

    const payloads = chosen.map(it => {
      const f = factors.find(x => x.id === it.factorId)!
      return {
        year: Number(year), quarter, period,
        site_id: siteId || null,
        category_key: f.category_key,
        source_text: proveedor || null,
        activity_detail: it.concepto || null,
        quantity: Number(it.cantidad),
        unit: it.unidad || f.unit,
        emission_factor: f.factor,
        evidence_id: evidence.id,
        extraction_job_id: jobId,
      }
    })

    const ins = await supabase.from('emission_records').insert(payloads)
    if (ins.error) { setError(friendlyError(ins.error)); setSaving(false); return }
    await supabase.from('extraction_jobs').update({ status: 'confirmado' }).eq('id', jobId)
    onDone()
  }

  async function discard() {
    await supabase.from('extraction_jobs').update({ status: 'descartado' }).eq('id', jobId)
    onDone()
  }

  return (
    <Modal title="Revisar extracción" onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      {extraction.confianza != null && extraction.confianza < 0.6 && (
        <div className="bg-amber-50 text-amber-800 text-xs px-3 py-2 rounded-xl mb-3">
          Confianza baja ({Math.round((extraction.confianza ?? 0) * 100)}%). Revisá los datos con cuidado.
        </div>
      )}
      {extraction.notas && <p className="text-xs text-gray-500 mb-3">Nota de la IA: {extraction.notas}</p>}

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2"><Field label="Proveedor"><input className="input" value={proveedor} onChange={e => setProveedor(e.target.value)} /></Field></div>
        <Field label="Año"><input type="number" className="input" value={year} onChange={e => setYear(e.target.value)} /></Field>
      </div>
      <Field label="Sitio">
        <select className="input" value={siteId} onChange={e => setSiteId(e.target.value)}>
          <option value="">—</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>

      <p className="text-xs font-semibold text-gray-400 mt-3 mb-1">Consumos detectados</p>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <input type="checkbox" checked={it.include} onChange={e => setItem(i, { include: e.target.checked })} />
              <input className="input flex-1" placeholder="Concepto" value={it.concepto} onChange={e => setItem(i, { concepto: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Cantidad"><input type="number" className="input" value={it.cantidad} onChange={e => setItem(i, { cantidad: e.target.value })} /></Field>
              <Field label="Unidad"><input className="input" value={it.unidad} onChange={e => setItem(i, { unidad: e.target.value })} /></Field>
              <Field label="Factor de emisión">
                <select className="input" value={it.factorId} onChange={e => {
                  const f = factors.find(x => x.id === e.target.value)
                  setItem(i, { factorId: e.target.value, unidad: it.unidad || f?.unit || '' })
                }}>
                  <option value="">—</option>
                  {factors.map(f => <option key={f.id} value={f.id}>{f.name} ({f.factor} kg/{f.unit})</option>)}
                </select>
              </Field>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 mt-4">
        <button onClick={discard} disabled={saving} className="text-sm text-gray-500 hover:text-red-600">Descartar</button>
        <div className="flex gap-2">
          <button onClick={onClose} disabled={saving} className="btn-secondary">Cancelar</button>
          <button onClick={confirm} disabled={saving} className="btn-primary">{saving ? 'Guardando…' : 'Confirmar y crear registros'}</button>
        </div>
      </div>
    </Modal>
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
