'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal, Field, FormActions } from '@/components/ui/Form'
import { friendlyError } from '@/lib/utils'
import { Plus, Trash2, Pencil, Building2, Users, ShieldCheck } from 'lucide-react'

type Org = {
  org_name: string; legal_name: string | null; logo_url: string | null; primary_color: string | null
  inventory_boundary: string | null; consolidation_approach: string | null; gwp_version: string | null
  ghg_policy: string | null; mission: string | null; vision: string | null
  address: string | null; contact_email: string | null; contact_phone: string | null
}
const CONSOL: Record<string, string> = {
  control_operacional: 'Control operacional', control_financiero: 'Control financiero', participacion_accionaria: 'Participación accionaria',
}
type User = { id: string; email: string; full_name: string; role: string }
type Role = { key: string; label: string; routes: string[] }

export default function ConfiguracionPage() {
  const supabase = createClient()
  const [org, setOrg] = useState<Org | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [usersErr, setUsersErr] = useState('')
  const [savingOrg, setSavingOrg] = useState(false)
  const [okMsg, setOkMsg] = useState('')
  const [editUser, setEditUser] = useState<Partial<User> | null>(null)

  async function loadOrg() {
    const { data } = await supabase.from('org_settings').select('*').eq('id', 1).single()
    setOrg(data as any)
  }
  async function loadRoles() {
    const { data } = await supabase.from('roles').select('key, label, routes').order('sort')
    setRoles((data as any) ?? [])
  }
  async function authHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }
  }
  async function loadUsers() {
    const r = await fetch('/api/users', { headers: await authHeaders() })
    if (!r.ok) { setUsersErr('No se pudieron cargar los usuarios (¿sos admin? ¿service_role configurada?).'); return }
    const j = await r.json(); setUsers(j.users ?? []); setUsersErr('')
  }
  useEffect(() => { loadOrg(); loadRoles(); loadUsers() }, [])

  async function saveOrg() {
    if (!org) return
    setSavingOrg(true); setOkMsg('')
    const { error } = await supabase.from('org_settings').update(org).eq('id', 1)
    setSavingOrg(false)
    setOkMsg(error ? 'Error: ' + error.message : 'Guardado ✓')
    setTimeout(() => setOkMsg(''), 2500)
  }

  async function delUser(u: User) {
    if (!confirm(`¿Eliminar el usuario ${u.email}?`)) return
    await fetch('/api/users', { method: 'DELETE', headers: await authHeaders(), body: JSON.stringify({ id: u.id }) })
    loadUsers()
  }

  if (!org) return <p className="text-gray-400 text-sm">Cargando…</p>

  const set = (k: keyof Org, v: string) => setOrg({ ...org, [k]: v })

  return (
    <>
      <div className="page-header"><h1 className="page-title">Configuración</h1></div>

      {/* ORGANIZACIÓN */}
      <section className="card mb-6">
        <div className="flex items-center gap-2 mb-4"><Building2 className="w-5 h-5 text-teal-600" /><h2 className="font-semibold text-gray-900">Organización</h2></div>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Nombre"><input className="input" value={org.org_name ?? ''} onChange={e => set('org_name', e.target.value)} /></Field>
          <Field label="Razón social"><input className="input" value={org.legal_name ?? ''} onChange={e => set('legal_name', e.target.value)} /></Field>
          <Field label="Logo (URL)"><input className="input" value={org.logo_url ?? ''} onChange={e => set('logo_url', e.target.value)} placeholder="https://…/logo.png" /></Field>
          <Field label="Color de marca"><input className="input" value={org.primary_color ?? ''} onChange={e => set('primary_color', e.target.value)} placeholder="#0d9488" /></Field>
          <Field label="Email de contacto"><input className="input" value={org.contact_email ?? ''} onChange={e => set('contact_email', e.target.value)} /></Field>
          <Field label="Teléfono"><input className="input" value={org.contact_phone ?? ''} onChange={e => set('contact_phone', e.target.value)} /></Field>
          <Field label="Enfoque de consolidación (cláusula 5.1)"><select className="input" value={org.consolidation_approach ?? 'control_operacional'} onChange={e => set('consolidation_approach', e.target.value)}>{Object.entries(CONSOL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Versión de GWP"><input className="input" value={org.gwp_version ?? ''} onChange={e => set('gwp_version', e.target.value)} placeholder="IPCC AR5 (GWP100)" /></Field>
        </div>
        <Field label="Dirección"><input className="input" value={org.address ?? ''} onChange={e => set('address', e.target.value)} /></Field>
        <Field label="Misión"><textarea className="input" rows={2} value={org.mission ?? ''} onChange={e => set('mission', e.target.value)} /></Field>
        <Field label="Visión"><textarea className="input" rows={2} value={org.vision ?? ''} onChange={e => set('vision', e.target.value)} /></Field>
        <Field label="Límites del inventario / alcance organizacional (cláusula 5)"><textarea className="input" rows={3} value={org.inventory_boundary ?? ''} onChange={e => set('inventory_boundary', e.target.value)} /></Field>
        <Field label="Política / compromiso de GEI"><textarea className="input" rows={4} value={org.ghg_policy ?? ''} onChange={e => set('ghg_policy', e.target.value)} /></Field>
        <div className="flex items-center gap-3 mt-2">
          <button className="btn-primary" onClick={saveOrg} disabled={savingOrg}>{savingOrg ? 'Guardando…' : 'Guardar organización'}</button>
          {okMsg && <span className="text-sm text-green-600">{okMsg}</span>}
        </div>
      </section>

      {/* USUARIOS */}
      <section className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><Users className="w-5 h-5 text-teal-600" /><h2 className="font-semibold text-gray-900">Usuarios</h2></div>
          <button className="btn-primary" onClick={() => setEditUser({ role: 'general' })}><Plus className="w-4 h-4" /> Nuevo</button>
        </div>
        {usersErr ? <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2">{usersErr}</p> : (
          <div className="space-y-2">
            {users.length === 0 && <p className="text-sm text-gray-400">Sin usuarios.</p>}
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">{u.full_name || u.email}</div>
                  <div className="text-xs text-gray-500 truncate">{u.email} · {roles.find(r => r.key === u.role)?.label ?? u.role}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setEditUser(u)} className="p-2 text-gray-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => delUser(u)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ROLES */}
      <section className="card">
        <div className="flex items-center gap-2 mb-4"><ShieldCheck className="w-5 h-5 text-teal-600" /><h2 className="font-semibold text-gray-900">Roles y acceso</h2></div>
        <div className="space-y-2">
          {roles.map(r => (
            <div key={r.key} className="border border-gray-100 rounded-xl px-3 py-2">
              <div className="font-medium text-gray-900">{r.label} <span className="text-xs text-gray-400">({r.key})</span></div>
              <div className="text-xs text-gray-500 mt-1">{r.routes.includes('*') ? 'Acceso total' : r.routes.join(' · ')}</div>
            </div>
          ))}
        </div>
      </section>

      {editUser && <UserForm user={editUser} roles={roles} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); loadUsers() }} />}
    </>
  )
}

function UserForm({ user, roles, onClose, onSaved }: { user: Partial<User>; roles: Role[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const isEdit = !!user.id
  const [f, setF] = useState({ email: user.email ?? '', full_name: user.full_name ?? '', role: user.role ?? 'general', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!f.email) { setError('El email es obligatorio.'); return }
    if (!isEdit && !f.password) { setError('La contraseña es obligatoria para un usuario nuevo.'); return }
    setSaving(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/users', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify(isEdit ? { id: user.id, ...f } : f),
    })
    const j = await r.json().catch(() => ({}))
    setSaving(false)
    if (!r.ok) { setError(j.error ?? 'Error al guardar.'); return }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Editar usuario' : 'Nuevo usuario'} onClose={onClose}>
      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-3">{error}</div>}
      <Field label="Email *"><input className="input" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} disabled={isEdit} /></Field>
      <Field label="Nombre completo"><input className="input" value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} /></Field>
      {!isEdit && <Field label="Contraseña *"><input type="password" className="input" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></Field>}
      <Field label="Rol"><select className="input" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>{roles.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select></Field>
      <FormActions saving={saving} onClose={onClose} onSave={save} />
    </Modal>
  )
}
