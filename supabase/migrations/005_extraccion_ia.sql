-- =====================================================================
-- Fase 1 — Extracción de facturas con IA
--   · extraction_jobs: registra cada extracción de la IA sobre una evidencia
--     (JSON crudo, modelo, tokens, estado). Trazabilidad ISO 14064-1: se ve
--     qué propuso la IA vs qué confirmó el humano.
--   · emission_records.extraction_job_id: liga el registro creado al job que
--     lo originó.
-- Idempotente.
-- =====================================================================

create table if not exists extraction_jobs (
  id             uuid primary key default gen_random_uuid(),
  evidence_id    uuid references evidences(id) on delete cascade,
  status         text not null default 'pendiente',   -- pendiente | confirmado | descartado | error
  model          text,                                 -- ej. 'claude-sonnet-4-6'
  prompt_version text,                                 -- versión del prompt de extracción
  raw_output     jsonb,                                -- JSON crudo devuelto por la IA
  supplier       text,                                 -- proveedor detectado (encabezado, denormalizado)
  doc_date       date,                                 -- fecha detectada del documento
  input_tokens   int,
  output_tokens  int,
  error          text,                                 -- mensaje si status='error'
  created_by     text,                                 -- email/nombre de quien disparó la extracción
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_extraction_jobs_evidence on extraction_jobs(evidence_id);

drop trigger if exists trg_extraction_jobs_touch on extraction_jobs;
create trigger trg_extraction_jobs_touch before update on extraction_jobs
  for each row execute function sig_touch_updated_at();

-- Liga el registro de emisión al job de extracción que lo originó (opcional).
alter table emission_records
  add column if not exists extraction_job_id uuid references extraction_jobs(id) on delete set null;

-- ---------------------------------------------------------------------
-- RLS + GRANTs
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['extraction_jobs']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists authenticated_all on %I;', t);
    execute format('create policy authenticated_all on %I for all to authenticated using (true) with check (true);', t);
    execute format('grant all on %I to anon, authenticated, service_role;', t);
  end loop;
end $$;
