-- AGENT DOSS GROUPS — observabilité IA sans contenu sensible
create table if not exists public.doss_ai_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  mission_id uuid references public.doss_missions(id) on delete set null,
  run_id uuid references public.doss_runs(id) on delete set null,
  operation text not null check (operation in ('interactive_mission','autonomous_job')),
  provider text,
  input_chars integer not null default 0 check (input_chars >= 0),
  output_chars integer not null default 0 check (output_chars >= 0),
  estimated_input_tokens integer not null default 0 check (estimated_input_tokens >= 0),
  estimated_output_tokens integer not null default 0 check (estimated_output_tokens >= 0),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  estimated_cost_usd numeric(12,8),
  status text not null check (status in ('success','error','interrupted')),
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists doss_ai_metrics_created_idx on public.doss_ai_metrics(created_at desc);
create index if not exists doss_ai_metrics_user_idx on public.doss_ai_metrics(user_id, created_at desc);
create index if not exists doss_ai_metrics_operation_idx on public.doss_ai_metrics(operation, status, created_at desc);

alter table public.doss_ai_metrics enable row level security;
drop policy if exists doss_ai_metrics_select_own on public.doss_ai_metrics;
create policy doss_ai_metrics_select_own on public.doss_ai_metrics for select using (user_id = auth.uid());
revoke all on public.doss_ai_metrics from anon, authenticated;
grant select on public.doss_ai_metrics to authenticated;
