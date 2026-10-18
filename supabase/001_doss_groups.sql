-- AGENT DOSS GROUPS — schéma complet idempotent
create extension if not exists pgcrypto;

create table if not exists public.doss_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'gratuit' check (plan in ('gratuit','pro','entreprise')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.doss_company (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, activity text, offer text, target text, location text, goals text, notes text,
  website text, email text, phone text, address text, city text, country text,
  monthly_revenue numeric not null default 0 check (monthly_revenue >= 0), lead_count integer not null default 0 check (lead_count >= 0),
  customer_count integer not null default 0 check (customer_count >= 0), ai_score integer not null default 50 check (ai_score between 0 and 100),
  is_active boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint doss_company_name_not_blank check (length(btrim(name)) between 1 and 200)
);
create table if not exists public.doss_prospects (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.doss_company(id) on delete cascade, name text not null, company text, email text, phone text, source text,
  status text not null default 'Nouveau' check (status in ('Nouveau','À contacter','Contacté','En négociation','Client gagné','Perdu')),
  score integer not null default 50 check (score between 0 and 100), created_at timestamptz not null default now(), next_follow_up date,
  constraint doss_prospect_name_not_blank check (length(btrim(name)) between 1 and 200)
);
create table if not exists public.doss_clients (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.doss_company(id) on delete cascade, prospect_id uuid references public.doss_prospects(id) on delete set null,
  name text not null, company text, email text, phone text,
  status text not null default 'Actif' check (status in ('Actif','VIP','À réactiver','Inactif')),
  total_amount numeric not null default 0 check (total_amount >= 0), last_purchase_date date, next_follow_up date, source text, notes text, product text,
  created_at timestamptz not null default now(), constraint doss_client_name_not_blank check (length(btrim(name)) between 1 and 200)
);
create table if not exists public.doss_missions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid references public.doss_company(id) on delete set null, message text not null check (char_length(message) between 1 and 4000),
  primary_agent text not null, supporting_agents text[] not null default '{}', confidence text not null check (confidence in ('high','medium','low')),
  status text not null default 'pending' check (status in ('pending','done','error')), created_at timestamptz not null default now()
);
create table if not exists public.doss_messages (
  id uuid primary key default gen_random_uuid(), mission_id uuid not null references public.doss_missions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, agent_id text not null,
  role text not null check (role in ('user','agent')), content text not null, created_at timestamptz not null default now()
);

-- Compatibilité avec l’ancien schéma déjà installé.
alter table public.doss_missions add column if not exists company_id uuid references public.doss_company(id) on delete set null;
alter table public.doss_missions alter column status set default 'pending';
alter table public.doss_company add column if not exists updated_at timestamptz not null default now();
alter table public.doss_profiles add column if not exists updated_at timestamptz not null default now();

create unique index if not exists doss_company_one_active_per_user_idx on public.doss_company(user_id) where is_active;
create index if not exists doss_company_user_idx on public.doss_company(user_id, created_at asc);
create index if not exists doss_prospects_owner_company_idx on public.doss_prospects(user_id, company_id, created_at desc);
create index if not exists doss_prospects_followup_idx on public.doss_prospects(company_id, next_follow_up);
create index if not exists doss_clients_owner_company_idx on public.doss_clients(user_id, company_id, created_at desc);
create index if not exists doss_clients_followup_idx on public.doss_clients(company_id, next_follow_up);
create unique index if not exists doss_clients_prospect_unique_idx on public.doss_clients(user_id, prospect_id) where prospect_id is not null;
create index if not exists doss_missions_user_idx on public.doss_missions(user_id, created_at desc);
create index if not exists doss_missions_user_company_idx on public.doss_missions(user_id, company_id, created_at desc);
create index if not exists doss_messages_mission_idx on public.doss_messages(mission_id, created_at);

create or replace function public.doss_create_profile_for_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.doss_profiles(user_id) values (new.id) on conflict (user_id) do nothing; return new; end; $$;
drop trigger if exists doss_on_auth_user_created on auth.users;
create trigger doss_on_auth_user_created after insert on auth.users for each row execute function public.doss_create_profile_for_user();
insert into public.doss_profiles(user_id) select id from auth.users on conflict (user_id) do nothing;

create or replace function public.doss_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists doss_company_touch_updated_at on public.doss_company;
create trigger doss_company_touch_updated_at before update on public.doss_company for each row execute function public.doss_touch_updated_at();
drop trigger if exists doss_profile_touch_updated_at on public.doss_profiles;
create trigger doss_profile_touch_updated_at before update on public.doss_profiles for each row execute function public.doss_touch_updated_at();

alter table public.doss_profiles enable row level security;
alter table public.doss_company enable row level security;
alter table public.doss_prospects enable row level security;
alter table public.doss_clients enable row level security;
alter table public.doss_missions enable row level security;
alter table public.doss_messages enable row level security;

-- Suppression/recréation rend la migration réexécutable.
drop policy if exists doss_profiles_select_own on public.doss_profiles;
create policy doss_profiles_select_own on public.doss_profiles for select using (user_id = auth.uid());
drop policy if exists doss_company_select_own on public.doss_company;
create policy doss_company_select_own on public.doss_company for select using (user_id = auth.uid());
drop policy if exists doss_company_insert_own on public.doss_company;
create policy doss_company_insert_own on public.doss_company for insert with check (user_id = auth.uid());
drop policy if exists doss_company_update_own on public.doss_company;
create policy doss_company_update_own on public.doss_company for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists doss_company_delete_own on public.doss_company;
create policy doss_company_delete_own on public.doss_company for delete using (user_id = auth.uid());

drop policy if exists doss_prospects_select_own on public.doss_prospects;
create policy doss_prospects_select_own on public.doss_prospects for select using (user_id = auth.uid());
drop policy if exists doss_prospects_insert_own on public.doss_prospects;
create policy doss_prospects_insert_own on public.doss_prospects for insert with check (user_id = auth.uid() and exists (select 1 from public.doss_company c where c.id = company_id and c.user_id = auth.uid()));
drop policy if exists doss_prospects_update_own on public.doss_prospects;
create policy doss_prospects_update_own on public.doss_prospects for update using (user_id = auth.uid()) with check (user_id = auth.uid() and exists (select 1 from public.doss_company c where c.id = company_id and c.user_id = auth.uid()));
drop policy if exists doss_prospects_delete_own on public.doss_prospects;
create policy doss_prospects_delete_own on public.doss_prospects for delete using (user_id = auth.uid());

drop policy if exists doss_clients_select_own on public.doss_clients;
create policy doss_clients_select_own on public.doss_clients for select using (user_id = auth.uid());
drop policy if exists doss_clients_insert_own on public.doss_clients;
create policy doss_clients_insert_own on public.doss_clients for insert with check (user_id = auth.uid() and exists (select 1 from public.doss_company c where c.id = company_id and c.user_id = auth.uid()));
drop policy if exists doss_clients_update_own on public.doss_clients;
create policy doss_clients_update_own on public.doss_clients for update using (user_id = auth.uid()) with check (user_id = auth.uid() and exists (select 1 from public.doss_company c where c.id = company_id and c.user_id = auth.uid()));
drop policy if exists doss_clients_delete_own on public.doss_clients;
create policy doss_clients_delete_own on public.doss_clients for delete using (user_id = auth.uid());

drop policy if exists missions_select_own on public.doss_missions;
drop policy if exists doss_missions_select_own on public.doss_missions;
create policy doss_missions_select_own on public.doss_missions for select using (user_id = auth.uid());
drop policy if exists missions_insert_own on public.doss_missions;
drop policy if exists doss_missions_insert_own on public.doss_missions;
create policy doss_missions_insert_own on public.doss_missions for insert with check (user_id = auth.uid() and (company_id is null or exists (select 1 from public.doss_company c where c.id = company_id and c.user_id = auth.uid())));
drop policy if exists missions_update_own on public.doss_missions;
drop policy if exists doss_missions_update_own on public.doss_missions;
create policy doss_missions_update_own on public.doss_missions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists missions_delete_own on public.doss_missions;
drop policy if exists doss_missions_delete_own on public.doss_missions;
create policy doss_missions_delete_own on public.doss_missions for delete using (user_id = auth.uid());

drop policy if exists messages_select_own on public.doss_messages;
drop policy if exists doss_messages_select_own on public.doss_messages;
create policy doss_messages_select_own on public.doss_messages for select using (user_id = auth.uid() and exists (select 1 from public.doss_missions m where m.id = mission_id and m.user_id = auth.uid()));
drop policy if exists messages_insert_own on public.doss_messages;
drop policy if exists doss_messages_insert_own on public.doss_messages;
create policy doss_messages_insert_own on public.doss_messages for insert with check (user_id = auth.uid() and exists (select 1 from public.doss_missions m where m.id = mission_id and m.user_id = auth.uid()));

create or replace function public.doss_create_mission_with_quota(p_message text, p_primary_agent text, p_supporting_agents text[] default '{}', p_confidence text default 'medium', p_company_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); profile_plan text; monthly_limit integer; used_count integer; recent_count integer; mission_id uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'code', 'unauthenticated'); end if;
  if p_message is null or char_length(btrim(p_message)) not between 1 and 4000 then return jsonb_build_object('ok', false, 'code', 'invalid_message'); end if;
  if p_primary_agent is null or p_primary_agent = '' or p_confidence not in ('high','medium','low') then return jsonb_build_object('ok', false, 'code', 'invalid_input'); end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  if p_company_id is not null and not exists (select 1 from public.doss_company where id = p_company_id and user_id = uid) then return jsonb_build_object('ok', false, 'code', 'company_forbidden'); end if;
  select plan into profile_plan from public.doss_profiles where user_id = uid for update;
  if profile_plan is null then return jsonb_build_object('ok', false, 'code', 'profile_missing'); end if;
  monthly_limit := case profile_plan when 'gratuit' then 10 when 'pro' then 300 when 'entreprise' then 3000 else 0 end;
  if monthly_limit = 0 then return jsonb_build_object('ok', false, 'code', 'invalid_plan'); end if;
  select count(*)::integer into recent_count from public.doss_missions where user_id = uid and created_at >= now() - interval '60 seconds';
  if recent_count >= 6 then return jsonb_build_object('ok', false, 'code', 'rate'); end if;
  select count(*)::integer into used_count from public.doss_missions where user_id = uid and created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc') and status in ('pending','done');
  if used_count >= monthly_limit then return jsonb_build_object('ok', false, 'code', 'quota', 'used', used_count, 'limit', monthly_limit, 'plan', profile_plan); end if;
  insert into public.doss_missions(user_id, company_id, message, primary_agent, supporting_agents, confidence, status) values (uid, p_company_id, btrim(p_message), p_primary_agent, coalesce(p_supporting_agents, '{}'), p_confidence, 'pending') returning id into mission_id;
  return jsonb_build_object('ok', true, 'mission_id', mission_id, 'used', used_count + 1, 'limit', monthly_limit, 'plan', profile_plan);
end; $$;
grant execute on function public.doss_create_mission_with_quota(text,text,text[],text,uuid) to authenticated;
