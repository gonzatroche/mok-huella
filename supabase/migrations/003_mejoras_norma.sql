-- =====================================================================
-- Mejoras según feedback técnico (ISO 14064-1):
--  1) Objetivos/Proyectos (punto 7): línea base, reducción real, doble conteo,
--     vínculo proyecto→objetivo y seguimiento trimestral.
--  2) Incertidumbre: margen de error por FE + evaluación cuali/cuantitativa.
--  3) Informe (punto 9): campos estructurados verificables.
--  4) Factores de emisión desglosados por gas (CO2/CH4/N2O) con su GWP.
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) MITIGACIÓN — Punto 7
-- ---------------------------------------------------------------------
alter table reduction_projects
  add column if not exists target_id uuid references reduction_targets(id) on delete set null,
  add column if not exists baseline_scenario text,        -- descripción del escenario convencional
  add column if not exists baseline_emissions numeric,    -- t CO2e que habría emitido lo reemplazado
  add column if not exists actual_emissions numeric,      -- t CO2e que emitió el proyecto
  add column if not exists reflected_in_inventory boolean not null default false, -- ya está en el inventario general
  add column if not exists double_count_note text;        -- aclaración anti-doble conteo

-- Reducción real = línea base − emisiones reales (columna calculada)
alter table reduction_projects
  add column if not exists real_reduction numeric
  generated always as (baseline_emissions - actual_emissions) stored;

-- Seguimiento trimestral (aplica a objetivos y/o proyectos)
create table if not exists reduction_measurements (
  id          uuid primary key default gen_random_uuid(),
  target_id   uuid references reduction_targets(id) on delete cascade,
  project_id  uuid references reduction_projects(id) on delete cascade,
  period      text,               -- 'T1-2026', 'T2-2026', ...
  value       numeric,            -- valor del indicador del objetivo en el período
  baseline    numeric,            -- emisiones línea base del proyecto en el período
  actual      numeric,            -- emisiones reales del proyecto en el período
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_redmeas_target on reduction_measurements(target_id);
create index if not exists idx_redmeas_project on reduction_measurements(project_id);

-- ---------------------------------------------------------------------
-- 2) INCERTIDUMBRE
-- ---------------------------------------------------------------------
alter table emission_factors
  add column if not exists error_margin numeric,          -- ± % de incertidumbre del FE
  add column if not exists by_gas boolean not null default false; -- ¿el FE se compone por gas?

create table if not exists uncertainty_assessments (
  id                  uuid primary key default gen_random_uuid(),
  year                int,
  scope               text,          -- categoría / ámbito evaluado
  approach            text not null default 'cualitativa', -- cualitativa | cuantitativa
  -- Cualitativa: 1 = incertidumbre Baja, 2 = Media, 3 = Alta (por dimensión)
  dim_representatividad int,
  dim_temporal          int,
  dim_geografica        int,
  dim_tecnologica       int,
  dim_completitud       int,
  overall_level       text,          -- baja | media | alta (derivado)
  -- Cuantitativa:
  uncertainty_pct     numeric,       -- ± % combinado
  responsable_id      uuid references personas(id) on delete set null,
  fecha               date default current_date,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
drop trigger if exists trg_uncert_touch on uncertainty_assessments;
create trigger trg_uncert_touch before update on uncertainty_assessments
  for each row execute function sig_touch_updated_at();

-- ---------------------------------------------------------------------
-- 3) INFORME — Punto 9 (contenido verificable)
-- ---------------------------------------------------------------------
alter table ghg_reports
  add column if not exists responsible_party    text,   -- 9.3.1 a) responsable
  add column if not exists org_boundary_desc     text,  -- c) límites de la organización
  add column if not exists methodologies         text,  -- j) metodologías de cuantificación
  add column if not exists ef_gwp_sources        text,  -- l) FE y GWP utilizados
  add column if not exists uncertainty_summary   text,  -- m) incertidumbre
  add column if not exists base_year_info        text,  -- g) año base
  add column if not exists recalculations        text,  -- h) cambios / recálculos
  add column if not exists exclusions            text,  -- o) exclusiones justificadas
  add column if not exists biogenic_note         text,  -- e) CO2 biogénico
  add column if not exists conformity_statement  text,  -- n) declaración de conformidad
  add column if not exists assurance_level        text, -- p) nivel de aseguramiento
  add column if not exists verifier               text;

-- ---------------------------------------------------------------------
-- 4) FACTORES POR GAS
-- ---------------------------------------------------------------------
create table if not exists factor_gases (
  id          uuid primary key default gen_random_uuid(),
  factor_id   uuid not null references emission_factors(id) on delete cascade,
  gas         text not null,     -- CO2 | CH4 | N2O | otro
  amount      numeric,           -- kg de gas por unidad de actividad
  gwp         numeric,           -- potencial de calentamiento global del gas
  created_at  timestamptz not null default now()
);
create index if not exists idx_factorgases_factor on factor_gases(factor_id);

-- ---------------------------------------------------------------------
-- RLS + GRANTs para las tablas nuevas
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['reduction_measurements','uncertainty_assessments','factor_gases']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists authenticated_all on %I;', t);
    execute format('create policy authenticated_all on %I for all to authenticated using (true) with check (true);', t);
    execute format('grant all on %I to anon, authenticated, service_role;', t);
  end loop;
end $$;
