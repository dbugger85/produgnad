-- Functions the app calls. Friends (no login) only get the three public ones.
-- Errors are raised as short codes (e.g. 'CAMPAIGN_LOCKED') that the app translates.

-- Public campaign info shared by every public page: transparency + progress.
create function public.campaign_public_json(p_campaign_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'team_name', c.team_name,
    'organizer_label', c.organizer_label,
    'purpose_text', c.purpose_text,
    'target_amount', c.target_amount,
    'deadline', c.deadline,
    'locked', c.locked_at is not null,
    'closed', c.closed_at is not null,
    'closing_message', case when c.closed_at is not null then c.closing_message else '' end,
    'accepting_orders', public.campaign_open_for_friends(c),
    'max_qty_per_line', c.max_qty_per_line,
    'raised', (select coalesce(sum(l.qty * l.unit_to_team), 0)
                 from public.orders o join public.order_lines l on l.order_id = o.id
                where o.campaign_id = c.id and o.deleted_at is null),
    'admins', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', p.name,
               'role_title', p.role_title,
               'phone', case when p.show_phone_public then p.phone else null end
             ) order by p.created_at)
        from public.profiles p
       where p.is_admin and p.name <> ''
    ), '[]'::jsonb)
  )
  from public.campaigns c
  where c.id = p_campaign_id
$$;

create function public.campaign_products_json(p_campaign_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', pr.id,
           'name', pr.name,
           'description', pr.description,
           'price', pr.price,
           'to_team_amount', pr.to_team_amount,
           'images', coalesce((
             select jsonb_agg(jsonb_build_object('path', i.storage_path, 'thumb', i.thumb_path,
                                                 'width', i.width, 'height', i.height)
                              order by i.sort_order, i.created_at)
               from public.product_images i where i.product_id = pr.id
           ), '[]'::jsonb)
         ) order by pr.sort_order, pr.created_at), '[]'::jsonb)
    from public.products pr
   where pr.campaign_id = p_campaign_id and pr.active
$$;

create function public.parent_public_json(p_campaign_parent_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', p.name,
    'phone', p.phone,
    'child_first_name', cp.child_first_name,
    'link_code', cp.link_code
  )
  from public.campaign_parents cp
  join public.profiles p on p.user_id = cp.parent_user_id
  where cp.id = p_campaign_parent_id
$$;

-- /k/<link_code>: everything the friend order page needs.
create function public.public_campaign_by_link(p_link_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'campaign', public.campaign_public_json(cp.campaign_id),
    'parent', public.parent_public_json(cp.id),
    'products', public.campaign_products_json(cp.campaign_id)
  )
  from public.campaign_parents cp
  where cp.link_code = upper(trim(p_link_code))
$$;

-- /bli-med/<join_code>: campaign info for the parent registration page.
create function public.public_campaign_by_join(p_join_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.campaign_public_json(c.id)
  from public.campaigns c
  where c.join_code = upper(trim(p_join_code))
$$;

-- /status/<token>: one friend order, found only by its secret token.
create function public.order_status_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', o.code,
    'buyer_first_name', o.buyer_first_name,
    'status', public.order_status(o),
    'created_at', o.created_at,
    'amount', (select coalesce(sum(l.qty * l.unit_price), 0) from public.order_lines l where l.order_id = o.id),
    'lines', (select coalesce(jsonb_agg(jsonb_build_object('name', pr.name, 'qty', l.qty, 'unit_price', l.unit_price)
                                        order by pr.sort_order), '[]'::jsonb)
                from public.order_lines l join public.products pr on pr.id = l.product_id
               where l.order_id = o.id),
    'parent', public.parent_public_json(o.campaign_parent_id),
    'campaign', public.campaign_public_json(o.campaign_id)
  )
  from public.orders o
  where o.status_token = p_token and o.type = 'friend'
$$;

-- Writes order lines with price snapshots. Keeps the old snapshot for products already
-- on the order. Shared by friend and parent order functions.
create function public.write_order_lines(p_order_id uuid, p_campaign_id uuid, p_lines jsonb,
                                         p_max_qty integer, p_allow_inactive boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  line jsonb;
  pid uuid;
  q integer;
  seen uuid[] := '{}';
  pr public.products;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) > 20 then
    raise exception 'INVALID_LINES';
  end if;

  for line in select * from jsonb_array_elements(p_lines) loop
    begin
      pid := (line ->> 'product_id')::uuid;
      q := (line ->> 'qty')::integer;
    exception when others then
      raise exception 'INVALID_LINES';
    end;
    if pid is null or q is null or q < 0 or q > p_max_qty then
      raise exception 'INVALID_QTY';
    end if;
    if pid = any(seen) then
      raise exception 'INVALID_LINES';
    end if;
    seen := seen || pid;
    if q = 0 then
      continue;
    end if;
    select * into pr from public.products where id = pid and campaign_id = p_campaign_id;
    if not found then
      raise exception 'INVALID_PRODUCT';
    end if;
    if not pr.active and not (p_allow_inactive and exists (
      select 1 from public.order_lines where order_id = p_order_id and product_id = pid)) then
      raise exception 'INVALID_PRODUCT';
    end if;
  end loop;

  if not exists (select 1 from jsonb_array_elements(p_lines) e where (e ->> 'qty')::integer > 0) then
    raise exception 'EMPTY_ORDER';
  end if;

  with wanted as (
    select (e ->> 'product_id')::uuid as product_id, (e ->> 'qty')::integer as qty
      from jsonb_array_elements(p_lines) e
     where (e ->> 'qty')::integer > 0
  )
  delete from public.order_lines l
   where l.order_id = p_order_id
     and not exists (select 1 from wanted w where w.product_id = l.product_id);

  with wanted as (
    select (e ->> 'product_id')::uuid as product_id, (e ->> 'qty')::integer as qty
      from jsonb_array_elements(p_lines) e
     where (e ->> 'qty')::integer > 0
  )
  update public.order_lines l
     set qty = w.qty
    from wanted w
   where l.order_id = p_order_id and l.product_id = w.product_id;

  with wanted as (
    select (e ->> 'product_id')::uuid as product_id, (e ->> 'qty')::integer as qty
      from jsonb_array_elements(p_lines) e
     where (e ->> 'qty')::integer > 0
  )
  insert into public.order_lines (order_id, product_id, qty, unit_price, unit_to_team)
  select p_order_id, w.product_id, w.qty, pr2.price, pr2.to_team_amount
    from wanted w
    join public.products pr2 on pr2.id = w.product_id
   where not exists (select 1 from public.order_lines l
                      where l.order_id = p_order_id and l.product_id = w.product_id);
end;
$$;

-- Friend places an order through a parent's link. No login.
create function public.create_friend_order(
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
  name text := trim(coalesce(p_first_name, ''));
  mail text := nullif(lower(trim(coalesce(p_email, ''))), '');
  amount numeric;
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

  -- Bots fill the hidden field. Pretend it worked and store nothing.
  if coalesce(p_honeypot, '') <> '' then
    return jsonb_build_object('code', 'K' || (cp.next_order_seq), 'status_token', gen_random_uuid(),
                              'amount', 0, 'parent', public.parent_public_json(cp.id));
  end if;

  if (select count(*) from public.orders
       where campaign_parent_id = cp.id and created_by = 'friend'
         and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'RATE_LIMIT';
  end if;

  insert into public.orders (campaign_parent_id, campaign_id, code, type, buyer_first_name,
                             email, wants_email, client_token, created_by)
  values (cp.id, cp.campaign_id, '', 'friend', name, mail,
          coalesce(p_wants_email, false) and mail is not null, p_client_token, 'friend')
  returning * into o;

  perform public.write_order_lines(o.id, cp.campaign_id, p_lines, c.max_qty_per_line, false);

  if o.wants_email then
    insert into public.email_outbox (kind, to_email, dedupe_key, campaign_id, order_id, campaign_parent_id)
    values ('friend_order', mail, 'friend_order:' || o.id, o.campaign_id, o.id, cp.id);
  end if;

  return public.friend_order_result(o);
end;
$$;

create function public.friend_order_result(o public.orders)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', o.code,
    'status_token', o.status_token,
    'amount', (select coalesce(sum(l.qty * l.unit_price), 0) from public.order_lines l where l.order_id = o.id),
    'parent', public.parent_public_json(o.campaign_parent_id)
  )
$$;

-- Parent ------------------------------------------------------------------------

-- Parent signs up for a campaign with the join code. Also saves name and phone.
create function public.join_campaign(p_join_code text, p_name text, p_phone text, p_child_first_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.campaigns;
  cp_id uuid;
begin
  if auth.uid() is null then
    raise exception 'NOT_LOGGED_IN';
  end if;
  select * into c from public.campaigns where join_code = upper(trim(p_join_code));
  if not found then
    raise exception 'UNKNOWN_JOIN_CODE';
  end if;
  if c.closed_at is not null then
    raise exception 'CAMPAIGN_CLOSED';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_phone, ''))) < 8 then
    raise exception 'INVALID_PROFILE';
  end if;

  update public.profiles
     set name = left(trim(p_name), 80), phone = left(trim(p_phone), 30)
   where user_id = auth.uid();

  select id into cp_id from public.campaign_parents
   where campaign_id = c.id and parent_user_id = auth.uid();
  if found then
    update public.campaign_parents set child_first_name = left(trim(coalesce(p_child_first_name, '')), 40)
     where id = cp_id;
  else
    insert into public.campaign_parents (campaign_id, parent_user_id, child_first_name, link_code, payment_code)
    values (c.id, auth.uid(), left(trim(coalesce(p_child_first_name, '')), 40), '', '')
    returning id into cp_id;
  end if;
  return cp_id;
end;
$$;

-- Loads an order the caller may change: their own, or any if admin.
create function public.order_for_caller(p_order_id uuid)
returns public.orders
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id and deleted_at is null;
  if not found then
    raise exception 'UNKNOWN_ORDER';
  end if;
  if not public.is_admin() and o.campaign_parent_id not in (select public.my_campaign_parent_ids()) then
    raise exception 'NOT_ALLOWED';
  end if;
  return o;
end;
$$;

-- Parent (or admin) adds or edits an order. p_order_id null = new order.
create function public.save_order(
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
  name text := left(trim(coalesce(p_buyer_first_name, '')), 40);
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

-- Tick or untick "betalt" on a friend order. Allowed also after the lock.
create function public.set_order_paid(p_order_id uuid, p_paid boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders := public.order_for_caller(p_order_id);
begin
  if o.type <> 'friend' then
    raise exception 'NOT_FRIEND_ORDER';
  end if;
  update public.orders
     set paid_to_parent_at = case when p_paid then coalesce(paid_to_parent_at, now()) end
   where id = o.id;
  if p_paid and o.wants_email and o.email is not null then
    insert into public.email_outbox (kind, to_email, dedupe_key, campaign_id, order_id, campaign_parent_id)
    values ('friend_paid', o.email, 'friend_paid:' || o.id, o.campaign_id, o.id, o.campaign_parent_id)
    on conflict (dedupe_key) do nothing;
  end if;
end;
$$;

-- Mark an order delivered to the buyer. Allowed also after the lock.
create function public.set_order_delivered(p_order_id uuid, p_delivered boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders := public.order_for_caller(p_order_id);
begin
  update public.orders
     set delivered_at = case when p_delivered then coalesce(delivered_at, now()) end
   where id = o.id;
end;
$$;

-- Soft delete. Parents only until the lock; admins always.
create function public.delete_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders := public.order_for_caller(p_order_id);
  c public.campaigns;
begin
  select * into c from public.campaigns where id = o.campaign_id;
  if not public.is_admin() and not public.campaign_open_for_parents(c) then
    raise exception 'CAMPAIGN_LOCKED';
  end if;
  update public.orders set deleted_at = now() where id = o.id;
end;
$$;

-- Admin ---------------------------------------------------------------------------

-- Make a logged-in-once user an admin, or remove admin rights. Keeps at least one admin.
create function public.set_admin(p_email text, p_is_admin boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  select user_id into target from public.profiles where email = lower(trim(p_email));
  if not found then
    raise exception 'UNKNOWN_USER';
  end if;
  if not p_is_admin and (select count(*) from public.profiles where is_admin) <= 1 then
    raise exception 'LAST_ADMIN';
  end if;
  update public.profiles set is_admin = p_is_admin where user_id = target;
end;
$$;

-- Email worker ----------------------------------------------------------------------

-- Hands out up to p_limit unsent emails, so two workers never send the same one.
-- Stops when 90 emails were sent today (Resend free tier: 100 per day).
create function public.claim_outbox(p_limit integer default 20)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = ''
as $$
declare
  sent_today integer;
begin
  select count(*) into sent_today from public.email_outbox
   where sent_at >= (public.oslo_today()::timestamp at time zone 'Europe/Oslo');
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
      order by created_at
      limit least(p_limit, 90 - sent_today)
      for update skip locked)
  returning e.*;
end;
$$;
