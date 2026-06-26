-- =====================================================================
-- Huella de Carbono — Sistema de gestión del inventario de GEI
-- ISO 14064-1:2018 / ISO TR 14069:2013
--
-- Esquema completo (instalación desde cero). Template GENÉRICO: la
-- organización y todos los catálogos se configuran desde la app (no hay
-- datos de empresa hardcodeados). Idempotente: se puede correr varias veces.
--
-- Organizado por las cláusulas operativas de la norma:
--   5 Límites · 6 Cuantificación · 7 Mitigación · 8 Gestión de la información
--   9 Reporte · Verificación (ISO 14064-3).
--
-- Para cambios incrementales sobre una base ya instalada, usar
-- supabase/migrations/00X_*.sql (ver CLAUDE.md).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Helpers: numeración (REG-2026-0001, VER-2026-0001, ...) y updated_at
-- ---------------------------------------------------------------------
create table if not exists sig_counters (
  scope    text not null,
  year     int  not null,
  last_seq int  not null default 0,
  primary key (scope, year)
);

-- Próximo número formateado para un ámbito ('REG', 'VER', 'NC', ...).
create or replace function sig_next_number(p_scope text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from now())::int;
  v_seq  int;
begin
  insert into sig_counters (scope, year, last_seq)
  values (p_scope, v_year, 1)
  on conflict (scope, year)
  do update set last_seq = sig_counters.last_seq + 1
  returning last_seq into v_seq;
  return p_scope || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- Trigger genérico de numeración. Uso: execute function sig_set_number('REG')
create or replace function sig_set_number()
returns trigger language plpgsql as $$
begin
  if new.number is null or new.number = '' then
    new.number := sig_next_number(tg_argv[0]);
  end if;
  return new;
end;
$$;

-- updated_at automático
create or replace function sig_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Configuración de la organización (singleton id = 1)
--    Incluye los parámetros del inventario GEI (año base, enfoque de
--    consolidación, período de reporte, versión de GWP).
-- ---------------------------------------------------------------------
create table if not exists org_settings (
  id                     int primary key default 1,
  org_name               text not null default 'Mi organización',
  legal_name             text,
  logo_url               text,
  primary_color          text default '#0d9488',
  -- Parámetros del inventario (ISO 14064-1 cl. 5 y 6)
  inventory_boundary     text,            -- descripción de los límites del inventario / alcance organizacional
  consolidation_approach text default 'control_operacional',
                                          -- control_operacional | control_financiero | participacion_accionaria
  base_year              int,             -- año base del inventario (6.4)
  base_year_justification text,           -- justificación de la elección del año base
  recalc_policy          text,            -- política de recálculo del año base
  reporting_period_start date,
  reporting_period_end   date,
  gwp_version            text default 'IPCC AR5 (GWP100)',
  ghg_policy             text,            -- política / compromiso de la organización en materia de GEI
  mission                text,
  vision                 text,
  address                text,
  contact_email          text,
  contact_phone          text,
  updated_at             timestamptz not null default now(),
  constraint org_settings_singleton check (id = 1)
);
insert into org_settings (id, org_name) values (1, 'Mi organización')
  on conflict (id) do nothing;
drop trigger if exists trg_org_settings_touch on org_settings;
create trigger trg_org_settings_touch before update on org_settings
  for each row execute function sig_touch_updated_at();

-- ---------------------------------------------------------------------
-- 2. Usuarios, roles y directorio de personas
-- ---------------------------------------------------------------------
create table if not exists user_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'general',
  persona_id uuid,
  created_at timestamptz not null default now()
);

-- Roles administrables. `routes` = lista de prefijos permitidos ('*' = todo).
create table if not exists roles (
  key       text primary key,
  label     text not null,
  routes    text[] not null default '{}',
  is_system boolean not null default false,
  sort      int not null default 0
);

insert into roles (key, label, routes, is_system, sort) values
  ('admin',      'Administrador (acceso total)', array['*'], true, 1),
  ('responsable','Responsable de Huella / SGI',
     array['/dashboard','/limites','/cuantificacion','/mitigacion','/gestion-datos','/reporte','/verificacion'], true, 2),
  ('verificador','Verificador / Auditor',
     array['/dashboard','/cuantificacion/inventario','/gestion-datos','/reporte','/verificacion'], true, 3),
  ('carga',      'Responsable de carga de datos',
     array['/dashboard','/cuantificacion/inventario','/limites/sitios','/gestion-datos/evidencias'], true, 4),
  ('direccion',  'Dirección (solo lectura de reporte)',
     array['/dashboard','/reporte'], true, 5),
  ('solo_ver',   'Solo lectura',
     array['/dashboard','/limites','/cuantificacion','/mitigacion','/gestion-datos','/reporte','/verificacion'], true, 6)
on conflict (key) do nothing;

-- Directorio simple de personas (responsables de carga, verificadores, etc.)
create table if not exists personas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  email      text,
  puesto     text,
  area       text,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_personas_touch on personas;
create trigger trg_personas_touch before update on personas
  for each row execute function sig_touch_updated_at();

alter table user_profiles drop constraint if exists user_profiles_persona_fk;
alter table user_profiles add constraint user_profiles_persona_fk
  foreign key (persona_id) references personas(id) on delete set null;

-- =====================================================================
-- CLÁUSULA 5 — LÍMITES DEL INVENTARIO
-- =====================================================================

-- 5.1 Límites organizacionales: entidades/centros incluidos en el inventario
create table if not exists org_boundaries (
  id              uuid primary key default gen_random_uuid(),
  entidad         text not null,                 -- razón social / unidad / centro incluido
  participacion   numeric,                       -- % de participación o control (0-100)
  enfoque         text default 'control_operacional',
                                                 -- control_operacional | control_financiero | participacion_accionaria
  incluida        boolean not null default true,
  justificacion   text,                          -- justificación de inclusión/exclusión
  sort            int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists trg_orgb_touch on org_boundaries;
create trigger trg_orgb_touch before update on org_boundaries
  for each row execute function sig_touch_updated_at();

-- 5.2 Categorías de emisión (las 6 de ISO 14064-1:2018). Semilla estándar:
--     no son datos de empresa, son la estructura de la norma.
create table if not exists emission_categories (
  key            text primary key,              -- cat1 .. cat6
  label          text not null,
  scope_ghgp     text,                          -- mapeo informativo a GHG Protocol (Alcance 1/2/3)
  descripcion    text,
  incluida       boolean not null default true, -- incluida en el inventario
  justificacion  text,                          -- justificación si se excluye
  sort           int not null default 0
);
insert into emission_categories (key, label, scope_ghgp, descripcion, sort) values
  ('cat1','Categoría 1 — Emisiones y remociones directas de GEI','Alcance 1',
     'Combustión fija y móvil propia, emisiones de proceso, fugitivas y de uso del suelo.', 1),
  ('cat2','Categoría 2 — Emisiones indirectas por energía importada','Alcance 2',
     'Electricidad, calor, vapor o frío adquiridos a terceros.', 2),
  ('cat3','Categoría 3 — Emisiones indirectas por transporte','Alcance 3',
     'Transporte de insumos, productos, residuos, empleados y viajes de negocio.', 3),
  ('cat4','Categoría 4 — Emisiones indirectas por productos usados por la organización','Alcance 3',
     'Bienes y servicios adquiridos, bienes de capital, residuos generados, activos arrendados.', 4),
  ('cat5','Categoría 5 — Emisiones indirectas asociadas al uso de los productos','Alcance 3',
     'Uso y fin de vida de los productos y servicios vendidos.', 5),
  ('cat6','Categoría 6 — Emisiones indirectas de otras fuentes','Alcance 3',
     'Otras fuentes indirectas relevantes no cubiertas por las categorías anteriores.', 6)
on conflict (key) do nothing;

-- 5.1 Sitios / instalaciones / obras incluidas en el inventario
create table if not exists sites (
  id              uuid primary key default gen_random_uuid(),
  number          text unique,                   -- SIT-2026-0001
  code            text,                           -- código interno (ej. OB-2026-001)
  name            text not null,
  site_type_id    uuid,                           -- FK a site_types
  cliente         text,
  ubicacion       text,                           -- localidad / departamento / dirección
  responsable_id  uuid references personas(id) on delete set null,
  fecha_inicio    date,
  fecha_fin       date,
  year            int,                            -- año principal de ejecución
  status          text not null default 'activa', -- activa | terminada | en_espera
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists trg_sites_touch on sites;
create trigger trg_sites_touch before update on sites
  for each row execute function sig_touch_updated_at();
drop trigger if exists trg_sites_number on sites;
create trigger trg_sites_number before insert on sites
  for each row execute function sig_set_number('SIT');

-- =====================================================================
-- CATÁLOGOS (datos maestros usados por la cuantificación)
-- =====================================================================

-- Tipos de sitio / instalación (genérico, lo carga la organización)
create table if not exists site_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  descripcion text,
  activo      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_sitetypes_touch on site_types;
create trigger trg_sitetypes_touch before update on site_types
  for each row execute function sig_touch_updated_at();

alter table sites drop constraint if exists sites_type_fk;
alter table sites add constraint sites_type_fk
  foreign key (site_type_id) references site_types(id) on delete set null;

-- Factores de emisión (kg CO2eq / unidad). Catálogo de referencia (6.5).
create table if not exists emission_factors (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,                    -- ej. 'Gasoil (Diesel)'
  descripcion  text,
  unit         text not null,                    -- L, kWh, t, km, kg, m3, m2, unidad
  factor       numeric not null,                 -- kg CO2eq por unidad
  category_key text references emission_categories(key) on delete set null,
  source_ref   text,                             -- fuente bibliográfica del factor (IPCC, DEFRA, ...)
  valid_year   int,                              -- año de vigencia del factor
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists trg_factors_touch on emission_factors;
create trigger trg_factors_touch before update on emission_factors
  for each row execute function sig_touch_updated_at();

-- Catálogo de fuentes de emisión (matriz). Genérico: lo carga la organización.
create table if not exists emission_sources (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                   -- ej. 'Combustión móvil - Maquinaria pesada'
  category_key  text references emission_categories(key) on delete set null,
  site_type_id  uuid references site_types(id) on delete set null,  -- opcional: limita a un tipo de sitio
  default_unit  text,
  factor_id     uuid references emission_factors(id) on delete set null, -- factor sugerido
  descripcion   text,
  activo        boolean not null default true,
  sort          int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists trg_sources_touch on emission_sources;
create trigger trg_sources_touch before update on emission_sources
  for each row execute function sig_touch_updated_at();

-- =====================================================================
-- CLÁUSULA 6 — CUANTIFICACIÓN: inventario de emisiones (núcleo)
-- =====================================================================
create table if not exists emission_records (
  id              uuid primary key default gen_random_uuid(),
  number          text unique,                   -- REG-2026-0001
  year            int not null,
  quarter         text,                          -- T1 | T2 | T3 | T4
  period          text,                          -- 'Mar-2026' (mes/año)
  site_id         uuid references sites(id) on delete set null,
  category_key    text references emission_categories(key) on delete set null,
  source_id       uuid references emission_sources(id) on delete set null,
  source_text     text,                          -- fuente en texto libre (si no está en catálogo)
  activity_detail text,                          -- descripción de la actividad medida
  quantity        numeric,                       -- dato de actividad
  unit            text,
  emission_factor numeric,                       -- kg CO2eq / unidad usado en el cálculo
  -- Emisiones en t CO2eq: SIEMPRE calculadas (cantidad * factor / 1000). No editable.
  emissions_t     numeric generated always as (round(quantity * emission_factor / 1000.0, 6)) stored,
  evidence_ref    text,                          -- link / nombre de archivo de evidencia
  evidence_id     uuid,                          -- FK opcional a evidences
  responsable_id  uuid references personas(id) on delete set null,
  load_date       date not null default current_date,
  verified        text not null default 'pendiente', -- pendiente | si | no
  observaciones   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists trg_emrec_touch on emission_records;
create trigger trg_emrec_touch before update on emission_records
  for each row execute function sig_touch_updated_at();
drop trigger if exists trg_emrec_number on emission_records;
create trigger trg_emrec_number before insert on emission_records
  for each row execute function sig_set_number('REG');
create index if not exists idx_emrec_year on emission_records(year);
create index if not exists idx_emrec_site on emission_records(site_id);
create index if not exists idx_emrec_cat  on emission_records(category_key);

-- =====================================================================
-- CLÁUSULA 7 — MITIGACIÓN (objetivos y proyectos de reducción/remoción)
-- =====================================================================

-- 7.x Objetivos / metas de reducción
create table if not exists reduction_targets (
  id              uuid primary key default gen_random_uuid(),
  number          text unique,                   -- MET-2026-0001
  title           text not null,
  category_key    text references emission_categories(key) on delete set null,
  indicador       text,
  baseline_value  numeric,
  baseline_year   int,
  target_value    numeric,
  target_year     int,
  unit            text default 't CO2eq',
  responsable_id  uuid references personas(id) on delete set null,
  status          text not null default 'activo', -- activo | cumplido | no_cumplido | cerrado
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists trg_target_touch on reduction_targets;
create trigger trg_target_touch before update on reduction_targets
  for each row execute function sig_touch_updated_at();
drop trigger if exists trg_target_number on reduction_targets;
create trigger trg_target_number before insert on reduction_targets
  for each row execute function sig_set_number('MET');

-- 7.x Proyectos / iniciativas de reducción o remoción
create table if not exists reduction_projects (
  id                  uuid primary key default gen_random_uuid(),
  number              text unique,               -- PRY-2026-0001
  title               text not null,
  descripcion         text,
  category_key        text references emission_categories(key) on delete set null,
  tipo                text not null default 'reduccion', -- reduccion | remocion
  estimated_reduction numeric,                   -- t CO2eq estimadas/año
  responsable_id      uuid references personas(id) on delete set null,
  fecha_inicio        date,
  fecha_fin           date,
  status              text not null default 'propuesto', -- propuesto | en_curso | implementado | verificado
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
drop trigger if exists trg_proj_touch on reduction_projects;
create trigger trg_proj_touch before update on reduction_projects
  for each row execute function sig_touch_updated_at();
drop trigger if exists trg_proj_number on reduction_projects;
create trigger trg_proj_number before insert on reduction_projects
  for each row execute function sig_set_number('PRY');

-- =====================================================================
-- CLÁUSULA 8 — GESTIÓN DE LA INFORMACIÓN Y DE LA CALIDAD
-- =====================================================================

-- 8.x Evidencias (facturas, remitos, registros digitalizados). Bucket Storage.
create table if not exists evidences (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  site_id     uuid references sites(id) on delete set null,
  year        int,
  tipo        text,                              -- factura | remito | registro | otro
  file_url    text,
  file_path   text,
  file_name   text,
  uploaded_by text,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_evid_touch on evidences;
create trigger trg_evid_touch before update on evidences
  for each row execute function sig_touch_updated_at();

alter table emission_records drop constraint if exists emrec_evidence_fk;
alter table emission_records add constraint emrec_evidence_fk
  foreign key (evidence_id) references evidences(id) on delete set null;

-- 8.x Control de calidad de datos / incertidumbre (6.x y 8.x)
create table if not exists data_quality_checks (
  id            uuid primary key default gen_random_uuid(),
  year          int,
  alcance       text,                            -- categoría / ámbito revisado
  metodo        text,                            -- método de evaluación (cl. 6 / GHG Protocol)
  uncertainty   numeric,                         -- % de incertidumbre estimada
  resultado     text,                            -- conforme | con_observaciones | no_conforme
  responsable_id uuid references personas(id) on delete set null,
  fecha         date not null default current_date,
  notas         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists trg_dqc_touch on data_quality_checks;
create trigger trg_dqc_touch before update on data_quality_checks
  for each row execute function sig_touch_updated_at();

-- 8.x Documentación / procedimientos del sistema GEI (control de documentos)
create table if not exists documents (
  id              uuid primary key default gen_random_uuid(),
  code            text unique,
  title           text not null,
  doc_type        text not null default 'procedimiento',
    -- politica | manual | procedimiento | instructivo | formato | registro | externo
  owner_name      text,
  version         text not null default '1',
  status          text not null default 'vigente',  -- borrador | en_revision | vigente | obsoleto
  issue_date      date,
  next_review_date date,
  file_url        text,
  file_path       text,
  file_name       text,
  approved_by     text,
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists trg_documents_touch on documents;
create trigger trg_documents_touch before update on documents
  for each row execute function sig_touch_updated_at();

-- =====================================================================
-- CLÁUSULA 9 — REPORTE (informe de GEI)
-- =====================================================================

-- 9.x Indicadores de intensidad (emisiones por unidad de producto/servicio)
create table if not exists intensity_indicators (
  id            uuid primary key default gen_random_uuid(),
  rubro         text,                            -- rubro / tipo de obra o producto
  subtipo       text,
  indicador     text not null,                   -- nombre del indicador
  unit          text,                            -- ej. 'kg CO2e / m2'
  value         numeric,
  year          int,
  critical_component text,                       -- componente crítico en la huella
  notas         text,
  sort          int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists trg_intind_touch on intensity_indicators;
create trigger trg_intind_touch before update on intensity_indicators
  for each row execute function sig_touch_updated_at();

-- 9.x Informe anual de huella de carbono (declaración de GEI)
create table if not exists ghg_reports (
  id            uuid primary key default gen_random_uuid(),
  number        text unique,                     -- INF-2026-0001
  year          int not null,
  fecha_emision date not null default current_date,
  resumen       text,
  conclusiones  text,
  aprobado_por  text,
  status        text not null default 'borrador', -- borrador | emitido | verificado
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists trg_ghgrep_touch on ghg_reports;
create trigger trg_ghgrep_touch before update on ghg_reports
  for each row execute function sig_touch_updated_at();
drop trigger if exists trg_ghgrep_number on ghg_reports;
create trigger trg_ghgrep_number before insert on ghg_reports
  for each row execute function sig_set_number('INF');

-- =====================================================================
-- VERIFICACIÓN (ISO 14064-3) Y MEJORA
-- =====================================================================

-- Verificaciones / auditorías del inventario
create table if not exists verifications (
  id              uuid primary key default gen_random_uuid(),
  number          text unique,                   -- VER-2026-0001
  tipo            text not null default 'interna', -- interna | externa | certificacion
  year            int,
  alcance         text,
  nivel_aseguramiento text,                       -- razonable | limitado
  criterios       text,
  verificador     text,
  planned_date    date,
  executed_date   date,
  status          text not null default 'planificada', -- planificada | en_curso | realizada | cerrada
  conclusiones    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists trg_ver_touch on verifications;
create trigger trg_ver_touch before update on verifications
  for each row execute function sig_touch_updated_at();
drop trigger if exists trg_ver_number on verifications;
create trigger trg_ver_number before insert on verifications
  for each row execute function sig_set_number('VER');

create table if not exists verification_findings (
  id               uuid primary key default gen_random_uuid(),
  verification_id  uuid not null references verifications(id) on delete cascade,
  finding_type     text not null default 'observacion', -- error_material | no_conformidad | observacion | oportunidad
  descripcion      text not null,
  category_key     text references emission_categories(key) on delete set null,
  nonconformity_id uuid,                          -- liga a una NC (FK abajo)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
drop trigger if exists trg_vfind_touch on verification_findings;
create trigger trg_vfind_touch before update on verification_findings
  for each row execute function sig_touch_updated_at();

-- No conformidades y acciones
create table if not exists nonconformities (
  id              uuid primary key default gen_random_uuid(),
  number          text unique,                   -- NC-2026-0001
  title           text not null,
  description     text,
  source          text not null default 'otros', -- verificacion | control_calidad | revision | requisito_legal | otros
  severity        text not null default 'no_conformidad', -- no_conformidad | observacion | oportunidad_mejora
  detected_date   date default current_date,
  detected_by     text,
  root_cause      text,
  immediate_action text,
  status          text not null default 'abierta', -- abierta | para_cerrar | cerrada
  verification_id uuid references verifications(id) on delete set null,
  closed_at       date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists trg_nc_touch on nonconformities;
create trigger trg_nc_touch before update on nonconformities
  for each row execute function sig_touch_updated_at();
drop trigger if exists trg_nc_number on nonconformities;
create trigger trg_nc_number before insert on nonconformities
  for each row execute function sig_set_number('NC');

alter table verification_findings drop constraint if exists vfind_nc_fk;
alter table verification_findings add constraint vfind_nc_fk
  foreign key (nonconformity_id) references nonconformities(id) on delete set null;

create table if not exists actions (
  id               uuid primary key default gen_random_uuid(),
  number           text unique,                  -- AC-2026-0001
  nonconformity_id uuid references nonconformities(id) on delete cascade,
  description      text not null,
  action_type      text not null default 'correctiva', -- correctiva | preventiva | mejora
  responsible_id   uuid references personas(id) on delete set null,
  due_date         date,
  status           text not null default 'pendiente', -- pendiente | en_curso | cerrada | cancelada
  effectiveness    text,
  completed_at     date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
drop trigger if exists trg_actions_touch on actions;
create trigger trg_actions_touch before update on actions
  for each row execute function sig_touch_updated_at();
drop trigger if exists trg_actions_number on actions;
create trigger trg_actions_number before insert on actions
  for each row execute function sig_set_number('AC');

-- =====================================================================
-- RLS — una sola policy `authenticated_all` por tabla.
-- El gating fino por rol se hace en la app (src/lib/roles.ts).
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'org_settings','user_profiles','roles','personas',
    'org_boundaries','emission_categories','sites','site_types',
    'emission_factors','emission_sources','emission_records',
    'reduction_targets','reduction_projects',
    'evidences','data_quality_checks','documents',
    'intensity_indicators','ghg_reports',
    'verifications','verification_findings','nonconformities','actions'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists authenticated_all on %I;', t);
    execute format(
      'create policy authenticated_all on %I for all to authenticated using (true) with check (true);',
      t);
  end loop;
end $$;

-- =====================================================================
-- GRANTS — las versiones nuevas de Supabase/PostgREST NO exponen
-- automáticamente las tablas nuevas a los roles de la Data API. La RLS
-- controla las filas, pero igual hace falta el privilegio a nivel tabla.
-- La app usa siempre usuarios autenticados (login obligatorio).
-- =====================================================================
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- =====================================================================
-- Storage: bucket PRIVADO "evidencias" para facturas/remitos/registros (cl. 8)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('evidencias', 'evidencias', false)
on conflict (id) do update set public = false;

drop policy if exists "evidencias_insert" on storage.objects;
create policy "evidencias_insert" on storage.objects for insert to authenticated with check (bucket_id = 'evidencias');
drop policy if exists "evidencias_select" on storage.objects;
create policy "evidencias_select" on storage.objects for select to authenticated using (bucket_id = 'evidencias');
drop policy if exists "evidencias_update" on storage.objects;
create policy "evidencias_update" on storage.objects for update to authenticated using (bucket_id = 'evidencias');
drop policy if exists "evidencias_delete" on storage.objects;
create policy "evidencias_delete" on storage.objects for delete to authenticated using (bucket_id = 'evidencias');
