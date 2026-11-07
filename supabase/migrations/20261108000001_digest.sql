-- Daily digest for parents: one email per parent on days when friends ordered through their link.
-- Called by the daily-digest Edge Function (service role) at 20:00 Oslo time.

create function public.queue_daily_digests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  day_start timestamptz := public.oslo_today()::timestamp at time zone 'Europe/Oslo';
begin
  insert into public.email_outbox (kind, to_email, dedupe_key, campaign_id, campaign_parent_id)
  select 'digest', p.email, 'digest:' || cp.id || ':' || public.oslo_today(), cp.campaign_id, cp.id
    from public.campaign_parents cp
    join public.campaigns c on c.id = cp.campaign_id
    join public.profiles p on p.user_id = cp.parent_user_id
   where c.closed_at is null
     and p.email <> ''
     and exists (
       select 1 from public.orders o
        where o.campaign_parent_id = cp.id
          and o.created_by = 'friend'
          and o.deleted_at is null
          and o.created_at >= day_start)
  on conflict (dedupe_key) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.queue_daily_digests() from public, anon, authenticated;
grant execute on function public.queue_daily_digests() to service_role;
