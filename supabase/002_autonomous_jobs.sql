-- AGENT DOSS GROUPS — automatisation autonome, brouillons uniquement
create extension if not exists pgcrypto;

create table if not exists public.doss_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id text,
  template text not null default 'custom' check (template in ('prospection','rapport','contenu','relances','custom')),
  title text not null check (char_length(title) between 1 and 120),
  instruction text not null check (char_length(instruction) between 1 and 2000),
  enabled boolean not null default true,
  every_hours integer not null default 24 check (every_hours between 6 and 720),
  next_run_at timestamptz not null default now(),
  last_run_at timestamptz,
  once boolean not null default false,
  web boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.doss_jobs add column if not exists company_id text;
alter table public.doss_jobs add column if not exists template text not null default 'custom';
alter table public.doss_jobs add column if not exists title text not null default 'Job autonome';
alter table public.doss_jobs add column if not exists instruction text not null default 'Prépare un rapport professionnel.';
alter table public.doss_jobs add column if not exists enabled boolean not null default true;
alter table public.doss_jobs add column if not exists every_hours integer not null default 24;
alter table public.doss_jobs add column if not exists next_run_at timestamptz not null default now();
alter table public.doss_jobs add column if not exists last_run_at timestamptz;
alter table public.doss_jobs add column if not exists once boolean not null default false;
alter table public.doss_jobs add column if not exists web boolean not null default false;
alter table public.doss_jobs add column if not exists created_at timestamptz not null default now();

create table if not exists public.doss_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.doss_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  template text not null,
  status text not null default 'running' check (status in ('running','done','error')),
  summary text,
  result text,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.doss_runs add column if not exists summary text;
alter table public.doss_runs add column if not exists result text;
alter table public.doss_runs add column if not exists error text;
alter table public.doss_runs add column if not exists finished_at timestamptz;
alter table public.doss_runs add column if not exists created_at timestamptz not null default now();

create table if not exists public.doss_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.doss_runs(id) on delete cascade,
  company_id text,
  prospect_id text,
  agent_id text not null,
  channel text not null check (channel in ('whatsapp','email','post')),
  recipient text,
  content text not null check (char_length(content) between 1 and 4000),
  status text not null default 'pending' check (status in ('pending','sent','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists doss_jobs_due_idx on public.doss_jobs(enabled, next_run_at);
create index if not exists doss_jobs_user_idx on public.doss_jobs(user_id, created_at desc);
create index if not exists doss_runs_job_idx on public.doss_runs(job_id, created_at desc);
create index if not exists doss_runs_user_idx on public.doss_runs(user_id, created_at desc);
create index if not exists doss_drafts_user_status_idx on public.doss_drafts(user_id, status, created_at desc);

alter table public.doss_jobs enable row level security;
alter table public.doss_runs enable row level security;
alter table public.doss_drafts enable row level security;

drop policy if exists doss_jobs_select_own on public.doss_jobs;
create policy doss_jobs_select_own on public.doss_jobs for select using (user_id = auth.uid());
drop policy if exists doss_jobs_insert_own on public.doss_jobs;
create policy doss_jobs_insert_own on public.doss_jobs for insert with check (user_id = auth.uid());
drop policy if exists doss_jobs_update_own on public.doss_jobs;
create policy doss_jobs_update_own on public.doss_jobs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists doss_jobs_delete_own on public.doss_jobs;
create policy doss_jobs_delete_own on public.doss_jobs for delete using (user_id = auth.uid());

drop policy if exists doss_runs_select_own on public.doss_runs;
create policy doss_runs_select_own on public.doss_runs for select using (user_id = auth.uid());
drop policy if exists doss_drafts_select_own on public.doss_drafts;
create policy doss_drafts_select_own on public.doss_drafts for select using (user_id = auth.uid());
drop policy if exists doss_drafts_update_own on public.doss_drafts;
create policy doss_drafts_update_own on public.doss_drafts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists doss_drafts_delete_own on public.doss_drafts;
create policy doss_drafts_delete_own on public.doss_drafts for delete using (user_id = auth.uid());

create or replace function public.doss_claim_job()
returns setof public.doss_jobs
language plpgsql security definer set search_path = public
as $$
declare j public.doss_jobs;
begin
  update public.doss_runs
     set status = 'error', error = 'Interrompue (délai dépassé)', finished_at = now()
   where status = 'running' and created_at < now() - interval '10 minutes';

  select * into j
    from public.doss_jobs
   where enabled and next_run_at <= now()
   order by next_run_at
   for update skip locked
   limit 1;
  if not found then return; end if;

  update public.doss_jobs
     set last_run_at = now(),
         next_run_at = now() + make_interval(hours => every_hours),
         enabled = case when once then false else enabled end
   where id = j.id
   returning * into j;
  return next j;
end;
$$;

revoke execute on function public.doss_claim_job() from public, anon, authenticated;
grant execute on function public.doss_claim_job() to service_role;
