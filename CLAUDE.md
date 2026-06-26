# Huella de Carbono ISO 14064 (mok-huella) — Guía del proyecto

Template **genérico** para gestionar el **inventario de huella de carbono corporativa** según
**ISO 14064-1:2018**, organizado por las **cláusulas operativas de la norma** (5 a 9 + Verificación).
No está atado a ninguna empresa: la organización y los catálogos se configuran desde la app.

> Mismo molde técnico que `~/Documents/sig-generico` (ISO 9001), adaptado al dominio GEI.
> Mantené este archivo actualizado al hacer cambios grandes.

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** (Postgres + Auth + Storage) vía `@supabase/ssr`
- **lucide-react** (íconos), **recharts** (gráficos en Reporte)
- `next.config.js`: `typescript.ignoreBuildErrors` y `eslint.ignoreDuringBuilds` activados.
- Acento de marca: **teal**. Setup local: ver `README.md`.

## Flujo de cambios

1. Editar código en `src/`.
2. Si cambia el modelo de datos: crear **una migración nueva** en
   `supabase/migrations/00X_*.sql` (idempotente: `if not exists`, `do $$ … $$`) **y**
   actualizar `supabase/schema.sql` (instalación desde cero). Las dos cosas, siempre.
3. Correr la migración a mano en Supabase → SQL Editor (no hay CI de migraciones).
4. Verificar: `npx tsc --noEmit` y/o `npm run build`.

## Modelo de datos

Convención: `id uuid pk`, `created_at`, `updated_at` (+ trigger `sig_touch_updated_at`),
RLS única `authenticated_all` (`for all to authenticated using(true)`). El gating fino por
rol se hace en la app (`src/lib/roles.ts`).

**Numeración automática:** tabla `sig_counters` + función `sig_next_number(scope)` +
trigger genérico `sig_set_number()` por tabla con su scope. Formato `SCOPE-AAAA-0001`, reinicia
por año. Scopes en uso: `SIT` (sitios), `REG` (registros de emisión), `MET` (objetivos),
`PRY` (proyectos), `INF` (informes), `VER` (verificaciones), `NC`, `AC`.
**En los `insert` NO se envía `number`** (lo pone el trigger); se muestra `row.number`.

**Cálculo de emisiones:** `emission_records.emissions_t` es una **columna calculada de Postgres**
(`generated always as (round(quantity * emission_factor / 1000, 6)) stored`). Nunca se escribe
desde la app: se ingresan `quantity` y `emission_factor` y la base calcula t CO₂eq.

Tablas (por cláusula): ver `supabase/schema.sql`, comentado cláusula por cláusula.
- Transversal: `org_settings` (singleton id=1, incluye año base/enfoque/GWP), `user_profiles`, `roles`, `personas`.
- Cl. 5: `org_boundaries`, `emission_categories` (6 categorías ISO **sembradas**), `sites`, `site_types`.
- Cl. 6: `emission_records` (núcleo), `emission_sources`, `emission_factors`.
- Cl. 7: `reduction_targets`, `reduction_projects`.
- Cl. 8: `evidences` (Storage), `data_quality_checks`, `documents`.
- Cl. 9: `intensity_indicators`, `ghg_reports`.
- Verificación: `verifications` (+ `verification_findings`), `nonconformities` (+ `actions`).

Seeds: las 6 `emission_categories` (estructura de la norma) y los `roles`. El resto de catálogos
(tipos de sitio, fuentes, factores) arranca **vacío** — los carga la organización (genérico puro).

Bucket Storage privado: **`evidencias`** (lo usan Evidencias y Documentación).

## Estructura de la app

- `src/app/(app)/` — route group autenticado; su `layout.tsx` envuelve en `AppLayout`
  (nav superior con módulos desplegables + gating de rol). Dentro:
  - `dashboard/` — KPIs (total t CO₂eq del año, sitios, registros sin verificar, etc.) + accesos a módulos.
  - `limites/`, `cuantificacion/`, `mitigacion/`, `gestion-datos/`, `reporte/`, `verificacion/` —
    cada uno tiene `page.tsx` (landing con tarjetas vía `ChapterLanding`) + una carpeta por submódulo.
  - `configuracion/` — organización (`org_settings`), usuarios (vía `/api/users`) y roles.
- `src/app/api/users/route.ts` — alta/edición/baja de usuarios con `service_role` (solo admin).
- `src/lib/nav.ts` — **árbol de navegación** (módulos → submódulos). Lo usan el nav y las landings.
- `src/lib/sig.ts` — **fuente única** de etiquetas/estados/colores + `CHAPTERS` (módulos) +
  `ISO_CATEGORIES`, `GHG_UNITS`, helper `fmtT()`. Tocar acá, no hardcodear estados en las páginas.
- `src/lib/roles.ts` — `canAccess` / `roleHome` (gating por prefijo de módulo) + `MODULES`.
- `src/components/` — `AppLayout`, `Logo` (lee `org_settings`), `ChapterLanding`,
  `ui/Form` (Modal/Field/FormActions), `ui/Badge` (Badge/StatusBadge).

## Patrón de una página de módulo

Plantilla canónica: `src/app/(app)/cuantificacion/inventario/page.tsx` (la más completa) o
cualquier CRUD simple como `limites/tipos-sitio/page.tsx`.
`'use client'` + `createClient()` (browser), listado en `card`s, alta/edición en `<Modal>`,
estados con `<StatusBadge map={...}>`, selects de `personas`/`sites`/catálogos, borrado con `confirm()`.

## Para sumar un submódulo nuevo

Toca 4 lugares: (1) tabla en `schema.sql` + migración, (2) diccionario en `sig.ts`,
(3) carpeta `src/app/(app)/<modulo>/<slug>/page.tsx`, (4) item en `NAV_GROUPS` de `nav.ts`.

## Documentos de referencia

`docs/` contiene las guías de implementación de huella ISO 14064 (sistema GEI, factores e
indicadores) que sirven para poblar los catálogos de fuentes y factores.

## Pendientes conocidos

- RLS sin distinción por rol (todo `authenticated`). Afinar cuando haya roles reales en uso.
- Catálogos arrancan vacíos (genérico puro). Para Cujó/construcción se pueden importar desde `docs/`.
- Despliegue cloud (Supabase + Vercel) pendiente de decidir, igual que el hermano sig-generico.
