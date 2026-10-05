-- AGENT DOSS GROUPS — missions et messages (sécurisés par RLS)
create table if not exists public.doss_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 4000),
  primary_agent text not null,
  supporting_agents text[] not null default '{}',
  confidence text not null check (confidence in ('high','medium','low')),
  status text not null default 'done' check (status in ('pending','done','error')),
  created_at timestamptz not null default now()
);
create table if not exists public.doss_messages (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.doss_missions(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  agent_id text not null,
  role text not null check (role in ('user','agent')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists doss_missions_user_idx on public.doss_missions(user_id, created_at desc);
create index if not exists doss_messages_mission_idx on public.doss_messages(mission_id, created_at);

alter table public.doss_missions enable row level security;
alter table public.doss_messages enable row level security;

create policy "missions_select_own" on public.doss_missions for select using (user_id = auth.uid());
create policy "missions_insert_own" on public.doss_missions for insert with check (user_id = auth.uid());
create policy "missions_delete_own" on public.doss_missions for delete using (user_id = auth.uid());
create policy "messages_select_own" on public.doss_messages for select using (user_id = auth.uid());
create policy "messages_insert_own" on public.doss_messages for insert with check (user_id = auth.uid());
