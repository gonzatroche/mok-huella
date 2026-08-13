# Spec — Extracción de facturas con IA → registros de emisión (Fase 1)

> Estado: aprobado (borrador redlineado). Autor: Gonzalo + Claude. Fecha: 2026-08-13.
> Parte del roadmap de ingreso de datos (ver `CLAUDE.md` / memoria del proyecto).

## Context

La carga de `emission_records` hoy es 100% manual: el responsable de carga lee cada
factura y tipea cantidad, unidad y factor. Es el cuello de botella real del inventario.
Ya subimos las facturas a `evidences` (bucket `evidencias`) y ya sembramos el catálogo de
factores (Fase 0). Esta fase cierra el lazo: subir la factura → la IA (Claude con visión)
pre-llena los datos de actividad → un humano revisa y confirma → se crea el `emission_record`
ligado a la evidencia, con `emissions_t` calculado por la base. **Nunca se inserta sin
revisión humana** (requisito de trazabilidad ISO 14064-1, cláusula 8).

## Current State (verificado)

| Pieza | Estado hoy | Ref |
|---|---|---|
| `emission_records` | Tiene `evidence_id`, `source_id`, `category_key`, `quantity`, `unit`, `emission_factor`, `emissions_t` (calculada) | `supabase/schema.sql:290` |
| `evidences` | Guarda `file_path`/`file_url`/`tipo` en bucket `evidencias` | `supabase/schema.sql` (evidences) |
| Catálogo de factores + fuentes | Sembrado (Fase 0): 7 factores + 6 `emission_sources` con `default_unit` y `factor_id` | `migrations/004_seed_factores_uy.sql` |
| Endpoint server-side con API key | Patrón existente `requireAdmin` + `service_role` | `src/app/api/users/route.ts` |
| SDK de Anthropic | **No existe** — hay que agregar `@anthropic-ai/sdk` + env `ANTHROPIC_API_KEY` | `package.json` |
| Inserción de registros | UI cliente con browser client + RLS `authenticated_all` | `cuantificacion/inventario/page.tsx` (`RecForm`) |

## Proposed Change

```
Evidencias page                /api/extract (server)              Claude (Sonnet 4.6)
  [Extraer datos] ──POST {evidence_id}──►  baja file de Storage ──visión + tool schema──►  JSON estructurado
                                              │
                                              ├─ inserta extraction_jobs (status=pendiente, raw_output)
                                              └─ devuelve {job_id, extraction}
        │
        ▼
  Modal "Revisar y confirmar"  (pre-llenado, editable)
    · proveedor, fecha
    · N items → cada uno: cantidad, unidad, fuente (auto-sugerida), factor (auto), sitio, año/período
    [Confirmar] ──► inserta emission_record(s) (evidence_id + extraction_job_id) ; job.status=confirmado
    [Descartar] ──► job.status=descartado
```

### Decisiones de diseño (locked)

1. **Auth del endpoint:** requiere sesión autenticada (server client `getUser()`); no exige rol
   admin (cualquier usuario de carga puede extraer). La API key de Claude es server-only.
2. **Descarga del archivo:** el endpoint baja de Storage con `service_role` (o signed URL) usando
   `evidences.file_path`.
3. **Modelo:** `claude-sonnet-4-6`, salida estructurada vía **tool use** (JSON schema forzado), con
   **prompt caching** en el system prompt. Soporta PDF nativo e imagen (JPG/PNG).
4. **1:N:** la extracción devuelve `items[]`; cada item = un `emission_record` candidato. El humano
   confirma/edita cada uno (una boleta UTE = 1 item; un estado de cuenta de combustible = varios).
5. **Auto-sugerencia de factor:** la IA devuelve `tipo_fuente` normalizado (enum); la UI pre-selecciona
   el `emission_source` que matchea → arrastra `category_key`, `default_unit` y `factor_id.factor`. Editable.
6. **Sitio/período:** el registro hereda `evidences.site_id` por defecto; `fecha` → `year` + `period`. Editable.
7. **Estado del registro:** se crea con `verified='pendiente'` (la verificación de dato es un paso aparte).

### Data model (nueva migración `005_extraccion_ia.sql` + `schema.sql`)

```sql
create table if not exists extraction_jobs (
  id             uuid primary key default gen_random_uuid(),
  evidence_id    uuid references evidences(id) on delete cascade,
  status         text not null default 'pendiente',   -- pendiente | confirmado | descartado | error
  model          text,                                 -- 'claude-sonnet-4-6'
  prompt_version text,                                 -- versión del prompt de extracción
  raw_output     jsonb,                                -- JSON crudo devuelto por la IA
  supplier       text,                                 -- denormalizado (encabezado)
  doc_date       date,
  input_tokens   int,
  output_tokens  int,
  error          text,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- trigger sig_touch_updated_at + RLS authenticated_all + grants (patrón del proyecto)

alter table emission_records
  add column if not exists extraction_job_id uuid references extraction_jobs(id) on delete set null;
```

### Schema de extracción (input del tool de Claude)

```json
{
  "proveedor": "string|null",
  "fecha": "YYYY-MM-DD|null",
  "tipo_fuente": "electricidad|gasoil|nafta|glp|gas_natural|fueloil|lena|otro",
  "moneda": "string|null",
  "items": [{ "concepto": "string", "cantidad": "number", "unidad": "string", "periodo": "string|null" }],
  "confianza": "number 0-1",
  "notas": "string|null"
}
```

## Acceptance Criteria

1. Con una factura UTE (PDF) en `evidences`, `POST /api/extract {evidence_id}` devuelve
   `{job_id, extraction}` con `proveedor`, `fecha` y ≥1 item con `cantidad`+`unidad`, en <20s.
2. Se inserta una fila en `extraction_jobs` con `status='pendiente'`, `raw_output` (JSON completo),
   `model` y tokens.
3. El modal de revisión pre-llena cada item y **auto-selecciona** el `emission_source` correcto para
   electricidad y gasoil (los 2 casos más comunes), arrastrando su factor.
4. Al confirmar, se crean N `emission_record` con `evidence_id`, `extraction_job_id`, `source_id`,
   `category_key`, `quantity`, `unit`, `emission_factor`; `emissions_t` queda calculado por la base;
   `extraction_jobs.status='confirmado'`.
5. "Descartar" deja `status='descartado'` y no crea registros.
6. Un archivo ilegible / no-factura devuelve error manejado (no 500 crudo) y `extraction_jobs.status='error'`
   con `error`.
7. La API key nunca llega al bundle cliente (sólo server-side).
8. `npx tsc --noEmit` limpio; sin romper la carga manual existente del Inventario.

## Testing Plan

| Capa | Qué | Cuenta |
|---|---|---|
| Unit | mapeo `tipo_fuente`→`emission_source`; `fecha`→`year`/`period`; parseo del tool output | +3 |
| Integración | `/api/extract` con PDF mock → job creado + JSON; confirmar → N registros ligados | +2 |
| E2E | Subir factura → Extraer → revisar → Confirmar → ver registro con `emissions_t` | +1 |

## Rollback Plan

Revertir el PR. La migración `005` es aditiva (tabla nueva + columna nullable); dejarla no afecta nada.
Sin la env `ANTHROPIC_API_KEY`, el botón "Extraer datos" queda deshabilitado con aviso; la carga manual
sigue intacta.

## Effort Estimate

~2h migración + tabla · ~4h endpoint (SDK, descarga Storage, tool schema, prompt) · ~4h UI modal de
revisión/confirmación + botón en Evidencias · ~2h mapeo factor/fuente + fecha · ~2h tests. **~14h**.

## Files Reference

| Archivo | Cambio |
|---|---|
| `supabase/migrations/005_extraccion_ia.sql` | Nueva tabla `extraction_jobs` + columna `emission_records.extraction_job_id` |
| `supabase/schema.sql` | Reflejar el mismo cambio |
| `src/app/api/extract/route.ts` | **Nuevo** endpoint server-side (Claude visión + tool + persistencia) |
| `src/lib/extraction.ts` | **Nuevo** schema del tool, prompt, mapeo `tipo_fuente`→fuente |
| `src/app/(app)/gestion-datos/evidencias/page.tsx` | Botón "Extraer datos" + modal de revisión/confirmación |
| `src/lib/sig.ts` | Enum `TIPO_FUENTE` + labels (fuente única) |
| `package.json` | `@anthropic-ai/sdk` |
| `.env.local` / `README.md` | `ANTHROPIC_API_KEY` (server-only) |

## Out of Scope

- Importador Excel/CSV (Fase 3).
- Conectores/portales UTE/Ancap (Fase 3).
- Extracción en lote (varias facturas de una) y aprendizaje de correcciones por proveedor (Fase 3).
- Evidencias que no sean factura/remito.
