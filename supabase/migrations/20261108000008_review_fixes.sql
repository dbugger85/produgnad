-- Fixes from the security review of 7 November 2026.

-- 1. New functions must not be callable by everyone. The earlier "in schema public" default revoke
--    had no effect (per-schema defaults can only add to the global default, which grants PUBLIC).
alter default privileges for role postgres revoke execute on functions from public;
revoke all on function public.visible_to_viewer(text, boolean) from public, anon, authenticated;

-- 2. Control characters (line breaks etc.) in names end up in email subjects and headers. Strip them.
create function public.strip_controls(t text)
returns text
language sql
immutable
set search_path = ''
as $$ select regexp_replace(t, '[\x00-\x1f\x7f]+', ' ', 'g') $$;
revoke all on function public.strip_controls(text) from public, anon, authenticated;

create function public.clean_text_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'orders' then
    new.buyer_first_name := public.strip_controls(new.buyer_first_name);
    new.note := public.strip_controls(new.note);
  elsif tg_table_name = 'profiles' then
    new.name := public.strip_controls(new.name);
    new.phone := public.strip_controls(new.phone);
    new.role_title := public.strip_controls(new.role_title);
  elsif tg_table_name = 'campaign_parents' then
    new.child_first_name := public.strip_controls(new.child_first_name);
  elsif tg_table_name = 'campaigns' then
    new.name := public.strip_controls(new.name);
    new.organizer_label := public.strip_controls(new.organizer_label);
    new.team_name := public.strip_controls(new.team_name);
    new.admin_vipps_name := public.strip_controls(new.admin_vipps_name);
  end if;
  return new;
end;
$$;
revoke all on function public.clean_text_columns() from public, anon, authenticated;

create trigger clean_text before insert or update on public.orders
  for each row execute function public.clean_text_columns();
create trigger clean_text before insert or update on public.profiles
  for each row execute function public.clean_text_columns();
create trigger clean_text before insert or update on public.campaign_parents
  for each row execute function public.clean_text_columns();
create trigger clean_text before insert or update on public.campaigns
  for each row execute function public.clean_text_columns();

-- 3. Friend orders: tighter limits, one confirmation per email address per day, and a repeated
--    submit at the same moment returns the same order instead of an error.
--    Per order link per hour: at most 20 orders, at most 10 of them with email confirmation
--    (owner's choice). Across all links: at most 200 friend orders per hour.
create or replace function public.create_friend_order(
  p_link_code text,
  p_first_name text,
  p_lines jsonb,
  p_email text default null,
  p_wants_email boolean default false,
  p_honeypot text default '',
  p_client_token uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cp public.campaign_parents;
  c public.campaigns;
  o public.orders;
  name text := trim(public.strip_controls(coalesce(p_first_name, '')));
  mail text := nullif(lower(trim(coalesce(p_email, ''))), '');
  wants boolean;
begin
  select * into cp from public.campaign_parents where link_code = upper(trim(p_link_code));
  if not found then
    raise exception 'UNKNOWN_LINK';
  end if;
  select * into c from public.campaigns where id = cp.campaign_id;

  -- A repeated submit returns the order that was already made.
  if p_client_token is not null then
    select * into o from public.orders where client_token = p_client_token;
    if found then
      if o.campaign_parent_id <> cp.id then
        raise exception 'INVALID_TOKEN';
      end if;
      return public.friend_order_result(o);
    end if;
  end if;

  if not public.campaign_open_for_friends(c) then
    raise exception 'CAMPAIGN_CLOSED';
  end if;
  if length(name) < 1 or length(name) > 40 then
    raise exception 'INVALID_NAME';
  end if;
  if mail is not null and (length(mail) > 200 or mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'INVALID_EMAIL';
  end if;
  wants := coalesce(p_wants_email, false) and mail is not null;

  -- Bots fill the hidden field. Pretend it worked and store nothing.
  if coalesce(p_honeypot, '') <> '' then
    return jsonb_build_object('code', 'K' || (cp.next_order_seq), 'status_token', gen_random_uuid(),
                              'amount', 0, 'parent', public.parent_public_json(cp.id));
  end if;

  if (select count(*) from public.orders
       where campaign_parent_id = cp.id and created_by = 'friend'
         and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'RATE_LIMIT';
  end if;
  if wants and (select count(*) from public.orders
                 where campaign_parent_id = cp.id and created_by = 'friend' and wants_email
                   and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'RATE_LIMIT';
  end if;
  if (select count(*) from public.orders
       where created_by = 'friend' and created_at > now() - interval '1 hour') >= 200 then
    raise exception 'RATE_LIMIT';
  end if;

  begin
    insert into public.orders (campaign_parent_id, campaign_id, code, type, buyer_first_name,
                               email, wants_email, client_token, created_by)
    values (cp.id, cp.campaign_id, '', 'friend', name, mail, wants, p_client_token, 'friend')
    returning * into o;
  exception when unique_violation then
    -- The same submit arrived twice at the same moment: return the first one.
    select * into o from public.orders where client_token = p_client_token;
    if not found or o.campaign_parent_id <> cp.id then
      raise exception 'INVALID_TOKEN';
    end if;
    return public.friend_order_result(o);
  end;

  perform public.write_order_lines(o.id, cp.campaign_id, p_lines, c.max_qty_per_line, false);

  -- At most one confirmation per email address per day, so nobody can flood a stranger's inbox.
  if o.wants_email then
    insert into public.email_outbox (kind, to_email, dedupe_key, campaign_id, order_id, campaign_parent_id)
    values ('friend_order', mail, 'friend_order:' || mail || ':' || public.oslo_today(), o.campaign_id, o.id, cp.id)
    on conflict (dedupe_key) do nothing;
  end if;

  return public.friend_order_result(o);
end;
$$;

-- 4. The email queue: parents' emails first; friends' confirmations at most 40 of the 90 a day.
create or replace function public.claim_outbox(p_limit integer default 20)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = ''
as $$
declare
  day_start timestamptz := public.oslo_today()::timestamp at time zone 'Europe/Oslo';
  sent_today integer;
  friend_today integer;
begin
  select count(*), count(*) filter (where kind in ('friend_order', 'friend_paid'))
    into sent_today, friend_today
    from public.email_outbox where sent_at >= day_start;
  if sent_today >= 90 then
    return;
  end if;
  return query
  update public.email_outbox e
     set claimed_at = now(), attempts = e.attempts + 1
   where e.id in (
     select id from public.email_outbox
      where sent_at is null and attempts < 5
        and (claimed_at is null or claimed_at < now() - interval '10 minutes')
        and (kind not in ('friend_order', 'friend_paid') or friend_today < 40)
      order by (kind in ('friend_order', 'friend_paid')), created_at
      limit least(p_limit, 90 - sent_today)
      for update skip locked)
  returning e.*;
end;
$$;

-- When Resend says the daily quota is used up, the email goes back in the queue without
-- counting as a failed attempt (called by the email functions).
create function public.release_outbox(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.email_outbox set claimed_at = null, attempts = greatest(attempts - 1, 0) where id = p_id
$$;
revoke all on function public.release_outbox(uuid) from public, anon, authenticated;
grant execute on function public.release_outbox(uuid) to service_role;

-- 5. Daily digest: orders since the parent's last digest (not just since midnight), so orders
--    placed after 20:00 come in the next day's digest.
create or replace function public.queue_daily_digests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
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
          and o.created_at > coalesce(
                (select max(e.created_at) from public.email_outbox e
                  where e.kind = 'digest' and e.campaign_parent_id = cp.id),
                now() - interval '24 hours'))
  on conflict (dedupe_key) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- 6. Orders made from extra stock: units go back to the extra order when such an order is
--    deleted or made smaller, and come from it when it's made bigger.
create function public.move_extra_units(p_extra_id uuid, p_product_id uuid, p_delta integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
-- p_delta > 0: put units back on the extra order; p_delta < 0: take units from it.
declare
  have integer;
  pr public.products;
begin
  if p_delta = 0 then
    return;
  end if;
  select qty into have from public.order_lines where order_id = p_extra_id and product_id = p_product_id for update;
  if p_delta < 0 then
    if coalesce(have, 0) < -p_delta then
      raise exception 'NOT_ENOUGH_EXTRA';
    end if;
    if have = -p_delta then
      delete from public.order_lines where order_id = p_extra_id and product_id = p_product_id;
    else
      update public.order_lines set qty = qty + p_delta where order_id = p_extra_id and product_id = p_product_id;
    end if;
    if not exists (select 1 from public.order_lines where order_id = p_extra_id) then
      update public.orders set deleted_at = now() where id = p_extra_id;
    end if;
  else
    if have is null then
      select * into pr from public.products where id = p_product_id;
      insert into public.order_lines (order_id, product_id, qty, unit_price, unit_to_team)
      values (p_extra_id, p_product_id, p_delta, pr.price, pr.to_team_amount);
    else
      update public.order_lines set qty = qty + p_delta where order_id = p_extra_id and product_id = p_product_id;
    end if;
    update public.orders set deleted_at = null where id = p_extra_id and deleted_at is not null;
  end if;
end;
$$;
revoke all on function public.move_extra_units(uuid, uuid, integer) from public, anon, authenticated;

create or replace function public.delete_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders := public.order_for_caller(p_order_id);
  c public.campaigns;
  l record;
begin
  select * into c from public.campaigns where id = o.campaign_id;
  if not public.is_admin() and not public.campaign_open_for_parents(c) then
    raise exception 'CAMPAIGN_LOCKED';
  end if;
  update public.orders set deleted_at = now() where id = o.id;
  -- Given away from extra stock: the units go back to the extra order.
  if o.assigned_from_order_id is not null then
    for l in select product_id, qty from public.order_lines where order_id = o.id loop
      perform public.move_extra_units(o.assigned_from_order_id, l.product_id, l.qty);
    end loop;
  end if;
end;
$$;

create or replace function public.save_order(
  p_campaign_parent_id uuid,
  p_type public.order_type,
  p_lines jsonb,
  p_buyer_first_name text default '',
  p_note text default '',
  p_paid boolean default false,
  p_order_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cp public.campaign_parents;
  c public.campaigns;
  o public.orders;
  admin boolean := public.is_admin();
  name text := left(trim(public.strip_controls(coalesce(p_buyer_first_name, ''))), 40);
  d record;
begin
  select * into cp from public.campaign_parents where id = p_campaign_parent_id;
  if not found or (not admin and cp.parent_user_id is distinct from auth.uid()) then
    raise exception 'NOT_ALLOWED';
  end if;
  select * into c from public.campaigns where id = cp.campaign_id;
  if not admin and not public.campaign_open_for_parents(c) then
    raise exception 'CAMPAIGN_LOCKED';
  end if;
  if p_type = 'friend' and name = '' then
    raise exception 'INVALID_NAME';
  end if;
  if p_type <> 'friend' then
    name := '';
  end if;

  if p_order_id is null then
    insert into public.orders (campaign_parent_id, campaign_id, code, type, buyer_first_name, note,
                               paid_to_parent_at, created_by)
    values (cp.id, cp.campaign_id, '', p_type, name, left(coalesce(p_note, ''), 500),
            case when p_type = 'friend' and p_paid then now() end, 'parent')
    returning * into o;
  else
    o := public.order_for_caller(p_order_id);
    if o.campaign_parent_id <> cp.id then
      raise exception 'NOT_ALLOWED';
    end if;
    -- Given away from extra stock: changes in quantity go back to or come from the extra order.
    if o.assigned_from_order_id is not null and jsonb_typeof(p_lines) = 'array' then
      for d in
        select coalesce(n.product_id, l.product_id) as product_id,
               (coalesce(l.qty, 0) - coalesce(n.qty, 0))::integer as back
          from (select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'qty')::integer) as qty
                  from jsonb_array_elements(p_lines) e group by 1) n
          full join (select product_id, qty from public.order_lines where order_id = o.id) l
            on l.product_id = n.product_id
      loop
        perform public.move_extra_units(o.assigned_from_order_id, d.product_id, d.back);
      end loop;
    end if;
    update public.orders
       set type = p_type,
           buyer_first_name = name,
           note = left(coalesce(p_note, ''), 500),
           paid_to_parent_at = case
             when p_type <> 'friend' or not p_paid then null
             else coalesce(paid_to_parent_at, now()) end
     where id = o.id
    returning * into o;
  end if;

  perform public.write_order_lines(o.id, cp.campaign_id, p_lines, c.max_qty_per_line, true);
  return jsonb_build_object('id', o.id, 'code', o.code);
end;
$$;

-- 7. Giving away extra stock: lock the extra order's lines, so two gifts at the same moment
--    can't both use the same units (the second gets a readable NOT_ENOUGH_EXTRA).
create or replace function public.assign_extra(
  p_order_id uuid,
  p_buyer_first_name text,
  p_lines jsonb,
  p_paid boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  extra public.orders := public.order_for_caller(p_order_id);
  c public.campaigns;
  o public.orders;
  name text := left(trim(public.strip_controls(coalesce(p_buyer_first_name, ''))), 40);
  line jsonb;
  pid uuid;
  q integer;
  have integer;
  total integer := 0;
  seen uuid[] := '{}';
begin
  if extra.type <> 'extra' then
    raise exception 'NOT_EXTRA_ORDER';
  end if;
  select * into c from public.campaigns where id = extra.campaign_id;
  if c.closed_at is not null and not public.is_admin() then
    raise exception 'CAMPAIGN_CLOSED';
  end if;
  if name = '' then
    raise exception 'INVALID_NAME';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'INVALID_LINES';
  end if;

  perform 1 from public.order_lines where order_id = extra.id for update;

  for line in select * from jsonb_array_elements(p_lines) loop
    begin
      pid := (line ->> 'product_id')::uuid;
      q := (line ->> 'qty')::integer;
    exception when others then
      raise exception 'INVALID_LINES';
    end;
    if pid is null or q is null or q < 0 or pid = any(seen) then
      raise exception 'INVALID_LINES';
    end if;
    seen := seen || pid;
    if q = 0 then
      continue;
    end if;
    select l.qty into have from public.order_lines l where l.order_id = extra.id and l.product_id = pid;
    if have is null or q > have then
      raise exception 'NOT_ENOUGH_EXTRA';
    end if;
    total := total + q;
  end loop;
  if total = 0 then
    raise exception 'EMPTY_ORDER';
  end if;

  insert into public.orders (campaign_parent_id, campaign_id, code, type, buyer_first_name,
                             assigned_from_order_id, paid_to_parent_at, created_by)
  values (extra.campaign_parent_id, extra.campaign_id, '', 'friend', name,
          extra.id, case when p_paid then now() end, 'parent')
  returning * into o;

  insert into public.order_lines (order_id, product_id, qty, unit_price, unit_to_team)
  select o.id, l.product_id, (e ->> 'qty')::integer, l.unit_price, l.unit_to_team
    from jsonb_array_elements(p_lines) e
    join public.order_lines l on l.order_id = extra.id and l.product_id = (e ->> 'product_id')::uuid
   where (e ->> 'qty')::integer > 0;

  delete from public.order_lines l
   using jsonb_array_elements(p_lines) e
   where l.order_id = extra.id and l.product_id = (e ->> 'product_id')::uuid
     and (e ->> 'qty')::integer = l.qty;

  update public.order_lines l
     set qty = l.qty - (e ->> 'qty')::integer
    from jsonb_array_elements(p_lines) e
   where l.order_id = extra.id and l.product_id = (e ->> 'product_id')::uuid
     and (e ->> 'qty')::integer > 0;

  if not exists (select 1 from public.order_lines where order_id = extra.id) then
    update public.orders set deleted_at = now() where id = extra.id;
  end if;

  return jsonb_build_object('id', o.id, 'code', o.code);
end;
$$;

-- Make sure nothing new slipped through to friends: only the four public functions are theirs.
revoke all on function public.move_extra_units(uuid, uuid, integer) from public, anon, authenticated;
