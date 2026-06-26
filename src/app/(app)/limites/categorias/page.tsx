'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Pencil, ListChecks, Check, X } from 'lucide-react'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError } from '@/lib/utils'

type Cat = { key: string; label: string; scope_ghgp: string | null; descripcion: string | null; incluida: boolean; justificacion: string | null; sort: number }

export default function CategoriasPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Cat | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('emission_categories').select('*').order('sort')
    setRows((data as any) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  return (
    <>
      <div className="page-header">
        <div>
          <p className="text-xs font-semibold text-gray-400">Cláusula 5.2 · Límites de reporte</p>
          <h1 className="page-title">Categorías de emisión</h1>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-5 -mt-3">
        Las 6 categorías de ISO 14064-1:2018. Indicá cuáles se incluyen en el inventario y justificá las exclusiones.
      </p>

      {loading ? <p className="text-gray-400 text-sm">Cargando…</p> : (
        <div className="space-y-2">
          {rows.map(c => (
            <div key={c.key} className="card flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-start gap-3">
                <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${c.incluida ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                  {c.incluida ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </span>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">{c.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{c.scope_ghgp} · {c.descripcion}</div>
                  {!c.incluida && c.justificacion && <div className="text-xs text-amber-700 mt-1">Exclusión: {c.justificacion}</div>}
                </div>
              </div>
              <button onClick={() => setEdit(c)} className="p-2 text-gray-400 hover:text-teal-600 flex-shrink-0"><Pencil className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {edit && <Form cat={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Form({ cat, onClose, onSaved }: { cat: Cat; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [f, setF] = useState({ incluida: cat.incluida, justificacion: cat.justificacion ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true); setError('')
    const res = await supabase.from('emission_categories').update({ incluida: f.incluida, justificacion: f.justificacion || null }).eq('key', cat.key)
    if (res.error) { setError(friendlyError(res.error)); setSaving(false); return }
    onSaved()
  }

  return (
    <Modal title={cat.label} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <p className="text-xs text-gray-500 mb-3">{cat.descripcion}</p>
      <Field label="¿Se incluye en el inventario?">
        <select className="input" value={f.incluida ? '1' : '0'} onChange={e => setF({ ...f, incluida: e.target.value === '1' })}>
          <option value="1">Incluida</option>
          <option value="0">Excluida</option>
        </select>
      </Field>
      <Field label={f.incluida ? 'Notas (opcional)' : 'Justificación de la exclusión *'}>
        <textarea className="input" rows={3} value={f.justificacion} onChange={e => setF({ ...f, justificacion: e.target.value })} />
      </Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
