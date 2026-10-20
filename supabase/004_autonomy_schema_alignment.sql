-- AGENT DOSS GROUPS — réalignement idempotent du schéma autonome
-- Cette migration rend explicites les colonnes utilisées par les routes actuelles.

alter table public.doss_jobs
  add column if not exists company_uuid uuid references public.doss_company(id) on delete set null,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists last_error_at timestamptz,
  add column if not exists lease_until timestamptz,
  add column if not exists lease_id uuid;

alter table public.doss_drafts
  add column if not exists company_uuid uuid references public.doss_company(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

-- Récupère les anciennes références textuelles lorsqu’elles sont de vrais UUID.
update public.doss_jobs
set company_uuid = company_id::uuid
where company_uuid is null
  and company_id is not null
  and company_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

update public.doss_drafts
set company_uuid = company_id::uuid
where company_uuid is null
  and company_id is not null
  and company_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

-- La validation humaine utilise quatre états explicites.
alter table public.doss_drafts drop constraint if exists doss_drafts_status_check;
alter table public.doss_drafts add constraint doss_drafts_status_check
  check (status in ('pending','approved','sent','rejected'));

create index if not exists doss_jobs_lease_idx on public.doss_jobs(lease_until);
create index if not exists doss_jobs_company_uuid_idx on public.doss_jobs(company_uuid);
create index if not exists doss_drafts_company_uuid_idx on public.doss_drafts(company_uuid);

-- Les anciennes politiques ont été conservées par certaines versions du prototype.
-- Elles sont supprimées pour éviter l’empilement silencieux des règles permissives.
drop policy if exists jobs_select_own on public.doss_jobs;
drop policy if exists jobs_insert_own on public.doss_jobs;
drop policy if exists jobs_update_own on public.doss_jobs;
drop policy if exists jobs_delete_own on public.doss_jobs;
drop policy if exists drafts_select_own on public.doss_drafts;
drop policy if exists drafts_update_own on public.doss_drafts;
drop policy if exists drafts_delete_own on public.doss_drafts;
drop policy if exists runs_select_own on public.doss_runs;
drop policy if exists runs_delete_own on public.doss_runs;

-- Verrouille explicitement les fonctions internes du worker.
revoke execute on function public.doss_claim_job() from public, anon, authenticated;
revoke execute on function public.doss_complete_job(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.doss_fail_job(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.doss_claim_job() to service_role;
grant execute on function public.doss_complete_job(uuid, uuid) to service_role;
grant execute on function public.doss_fail_job(uuid, uuid, text) to service_role;
