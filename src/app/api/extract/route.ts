import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  EXTRACTION_MODEL, PROMPT_VERSION, SYSTEM_PROMPT, EXTRACTION_TOOL,
  type ExtractionResult,
} from '@/lib/extraction'

// Extracción de facturas con IA (Fase 1).
// Baja la evidencia de Storage, la pasa por Claude (visión + tool use), guarda el
// job en extraction_jobs y devuelve los datos para revisión humana. NUNCA inserta
// emission_records: eso lo hace la UI al confirmar. La API key es server-only.

export const runtime = 'nodejs'

// Extensión → media_type. PDF va como 'document'; el resto como 'image'.
function mediaFor(name: string | null): { kind: 'document' | 'image'; media: string } | null {
  const ext = (name ?? '').toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return { kind: 'document', media: 'application/pdf' }
  if (ext === 'jpg' || ext === 'jpeg') return { kind: 'image', media: 'image/jpeg' }
  if (ext === 'png') return { kind: 'image', media: 'image/png' }
  if (ext === 'webp') return { kind: 'image', media: 'image/webp' }
  if (ext === 'gif') return { kind: 'image', media: 'image/gif' }
  return null
}

export async function POST(req: Request) {
  // 1) Auth: sesión válida (cualquier usuario de carga).
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada en el servidor' }, { status: 503 })

  const { evidence_id } = await req.json().catch(() => ({}))
  if (!evidence_id) return NextResponse.json({ error: 'evidence_id requerido' }, { status: 400 })

  const admin = createAdminClient()

  // 2) Evidencia + archivo.
  const { data: ev } = await admin.from('evidences').select('*').eq('id', evidence_id).single()
  if (!ev) return NextResponse.json({ error: 'Evidencia no encontrada' }, { status: 404 })

  const m = mediaFor(ev.file_name || ev.file_path || ev.file_url)
  if (!m) return NextResponse.json({ error: 'Formato no soportado. Usá PDF, JPG, PNG, WEBP o GIF.' }, { status: 422 })

  // Registra el error en el job para trazabilidad y devuelve la respuesta.
  async function fail(msg: string, status: number) {
    await admin.from('extraction_jobs').insert({
      evidence_id, status: 'error', model: EXTRACTION_MODEL, prompt_version: PROMPT_VERSION,
      error: msg, created_by: user?.email ?? null,
    })
    return NextResponse.json({ error: msg }, { status })
  }

  // 3) Descarga del archivo → base64.
  let b64: string
  try {
    if (ev.file_path) {
      const { data: blob, error } = await admin.storage.from('evidencias').download(ev.file_path)
      if (error || !blob) throw new Error(error?.message || 'No se pudo bajar el archivo de Storage')
      b64 = Buffer.from(await blob.arrayBuffer()).toString('base64')
    } else if (ev.file_url) {
      const resp = await fetch(ev.file_url)
      if (!resp.ok) throw new Error(`No se pudo descargar el link externo (HTTP ${resp.status})`)
      b64 = Buffer.from(await resp.arrayBuffer()).toString('base64')
    } else {
      return await fail('La evidencia no tiene archivo ni link', 422)
    }
  } catch (e: any) {
    return await fail(e?.message || 'Error al obtener el archivo', 502)
  }

  // 4) Claude: visión + tool use forzado.
  const anthropic = new Anthropic({ apiKey })
  const fileBlock =
    m.kind === 'document'
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: m.media as any, data: b64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: m.media as any, data: b64 } }

  let extraction: ExtractionResult
  let inTok = 0, outTok = 0
  try {
    const msg = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 2000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }] as any,
      tools: [EXTRACTION_TOOL as any],
      tool_choice: { type: 'tool', name: EXTRACTION_TOOL.name } as any,
      messages: [{
        role: 'user',
        content: [
          fileBlock as any,
          { type: 'text', text: 'Extraé los datos de actividad de este documento con la herramienta.' },
        ],
      }],
    })
    inTok = msg.usage?.input_tokens ?? 0
    outTok = msg.usage?.output_tokens ?? 0
    const toolUse = msg.content.find((b: any) => b.type === 'tool_use') as any
    if (!toolUse) throw new Error('La IA no devolvió datos estructurados')
    extraction = toolUse.input as ExtractionResult
  } catch (e: any) {
    return await fail(e?.message || 'Error al llamar a la IA', 502)
  }

  // 5) Persistir el job (pendiente) con el JSON crudo.
  const { data: job, error: jobErr } = await admin.from('extraction_jobs').insert({
    evidence_id,
    status: 'pendiente',
    model: EXTRACTION_MODEL,
    prompt_version: PROMPT_VERSION,
    raw_output: extraction,
    supplier: extraction.proveedor ?? null,
    doc_date: extraction.fecha ?? null,
    input_tokens: inTok,
    output_tokens: outTok,
    created_by: user.email ?? null,
  }).select('id').single()

  if (jobErr) return NextResponse.json({ error: 'Extracción OK pero falló al guardar el job: ' + jobErr.message }, { status: 500 })

  return NextResponse.json({ job_id: job.id, extraction })
}
