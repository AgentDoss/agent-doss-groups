
-- Idempotence des missions interactives : le client peut réessayer sans doubler la réservation.
alter table public.doss_missions add column if not exists idempotency_key text;
create unique index if not exists doss_missions_user_idempotency_idx on public.doss_missions(user_id, idempotency_key) where idempotency_key is not null;

drop function if exists public.doss_create_mission_with_quota(text,text,text[],text,uuid);
create or replace function public.doss_create_mission_with_quota(
  p_message text,
  p_primary_agent text,
  p_supporting_agents text[] default '{}',
  p_confidence text default 'medium',
  p_company_id uuid default null,
  p_idempotency_key text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); profile_plan text; monthly_limit integer; used_count integer; recent_count integer; mission_id uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'code', 'unauthenticated'); end if;
  if p_idempotency_key is not null and char_length(btrim(p_idempotency_key)) between 16 and 100 then
    select id into mission_id from public.doss_missions where user_id = uid and idempotency_key = btrim(p_idempotency_key) limit 1;
    if mission_id is not null then return jsonb_build_object('ok', true, 'existing', true, 'mission_id', mission_id); end if;
  end if;
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
  insert into public.doss_missions(user_id, company_id, message, primary_agent, supporting_agents, confidence, status, idempotency_key)
  values (uid, p_company_id, btrim(p_message), p_primary_agent, coalesce(p_supporting_agents, '{}'), p_confidence, 'pending', nullif(btrim(p_idempotency_key), ''))
  returning id into mission_id;
  return jsonb_build_object('ok', true, 'mission_id', mission_id, 'used', used_count + 1, 'limit', monthly_limit, 'plan', profile_plan);
exception when unique_violation then
  select id into mission_id from public.doss_missions where user_id = uid and idempotency_key = btrim(p_idempotency_key) limit 1;
  return jsonb_build_object('ok', true, 'existing', true, 'mission_id', mission_id);
end; $$;
grant execute on function public.doss_create_mission_with_quota(text,text,text[],text,uuid,text) to authenticated;
