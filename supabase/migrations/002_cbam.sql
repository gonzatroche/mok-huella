-- =====================================================================
-- Módulo CBAM — Mecanismo de Ajuste en Frontera por Carbono (UE)
-- Reg. (UE) 2023/956 + actos de ejecución. Régimen definitivo desde 2026.
--
-- A diferencia del inventario ISO 14064-1 (emisiones de la organización),
-- CBAM cuantifica las EMISIONES INCORPORADAS POR PRODUCTO (embedded
-- emissions) de bienes específicos por código CN, para reportar al
-- importador/declarante en la UE.
--
-- Bloque autocontenido e idempotente: incluye sus propias RLS y GRANTs.
-- =====================================================================

-- Instalación productora (operador) del bien CBAM
create table if not exists cbam_installations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  operator_name     text,                 -- razón social del operador
  country           text,                 -- país de la instalación
  city              text,
  address           text,
  unlocode          text,                 -- UN/LOCODE
  lat               numeric,
  lon               numeric,
  economic_activity text,                 -- actividad económica principal
  contact_email     text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
drop trigger if exists trg_cbam_inst_touch on cbam_installations;
create trigger trg_cbam_inst_touch before update on cbam_installations
  for each row execute function sig_touch_updated_at();

-- Catálogo de bienes CBAM (por código CN y categoría agregada)
create table if not exists cbam_goods (
  id                  uuid primary key default gen_random_uuid(),
  cn_code             text,               -- código CN (8 dígitos)
  name                text not null,
  sector              text,               -- cemento | hierro_acero | aluminio | fertilizantes | hidrogeno | electricidad
  aggregated_category text,               -- categoría de bienes agregada (Anexo CBAM)
  production_route    text,               -- ruta/proceso de producción
  default_unit        text default 't',   -- unidad de salida (toneladas)
  notes               text,
  activo              boolean not null default true,
  sort                int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
drop trigger if exists trg_cbam_goods_touch on cbam_goods;
create trigger trg_cbam_goods_touch before update on cbam_goods
  for each row execute function sig_touch_updated_at();

-- Declaración de emisiones incorporadas de un bien en un período (núcleo)
create table if not exists cbam_entries (
  id                  uuid primary key default gen_random_uuid(),
  number              text unique,        -- CBAM-2026-0001
  installation_id     uuid references cbam_installations(id) on delete set null,
  good_id             uuid references cbam_goods(id) on delete set null,
  period_year         int not null,
  period_label        text,               -- ej. 'Q1-2026' o 'Anual 2026'
  period_start        date,
  period_end          date,
  determination_method text not null default 'calculation', -- calculation | measurement | default_values
  activity_level      numeric,            -- producción del bien en el período (t)
  direct_emissions    numeric,            -- emisiones directas totales del proceso (t CO2e, sin precursores)
  electricity_mwh     numeric,            -- electricidad consumida (MWh)
  electricity_ef      numeric,            -- factor de emisión de la electricidad (t CO2e/MWh)
  electricity_source  text default 'grid_default', -- grid_default | actual | own_generation
  verification_status text not null default 'no_verificado', -- no_verificado | verificado
  verifier            text,               -- verificador acreditado
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
drop trigger if exists trg_cbam_entry_touch on cbam_entries;
create trigger trg_cbam_entry_touch before update on cbam_entries
  for each row execute function sig_touch_updated_at();
drop trigger if exists trg_cbam_entry_number on cbam_entries;
create trigger trg_cbam_entry_number before insert on cbam_entries
  for each row execute function sig_set_number('CBAM');
create index if not exists idx_cbam_entry_year on cbam_entries(period_year);
create index if not exists idx_cbam_entry_good on cbam_entries(good_id);

-- Precursores consumidos (insumos que a su vez son bienes CBAM)
-- Sus emisiones incorporadas se suman a las del bien.
create table if not exists cbam_precursors (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references cbam_entries(id) on delete cascade,
  name        text not null,             -- nombre del precursor
  cn_code     text,
  quantity    numeric,                   -- cantidad consumida (t)
  see_direct  numeric,                   -- emisiones incorporadas específicas directas del precursor (t CO2e/t)
  see_indirect numeric,                  -- emisiones incorporadas específicas indirectas del precursor (t CO2e/t)
  source      text,                      -- origen del dato (proveedor / valores por defecto)
  created_at  timestamptz not null default now()
);
create index if not exists idx_cbam_prec_entry on cbam_precursors(entry_id);

-- RLS + GRANTs para las tablas CBAM (mismo patrón que el resto del sistema)
do $$
declare t text;
begin
  foreach t in array array['cbam_installations','cbam_goods','cbam_entries','cbam_precursors']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists authenticated_all on %I;', t);
    execute format('create policy authenticated_all on %I for all to authenticated using (true) with check (true);', t);
    execute format('grant all on %I to anon, authenticated, service_role;', t);
  end loop;
end $$;

-- Dar acceso al módulo /cbam a los roles que ya gestionan el sistema
update roles set routes = array_append(routes, '/cbam')
  where key in ('responsable','verificador','solo_ver') and not ('/cbam' = any(routes));
