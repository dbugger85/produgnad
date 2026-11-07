-- Helpers, code generators, triggers and totals views.

-- Random code from unambiguous characters (no O/0, I/1, L).
create function public.random_code(len integer)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  bytes bytea := extensions.gen_random_bytes(len);
  result text := '';
begin
  for i in 0 .. len - 1 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end;
$$;

create function public.oslo_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Europe/Oslo')::date $$;

-- Who is asking ------------------------------------------------------------

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.user_id = auth.uid()), false)
$$;

create function public.my_campaign_parent_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cp.id from public.campaign_parents cp where cp.parent_user_id = auth.uid()
$$;

create function public.my_campaign_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cp.campaign_id from public.campaign_parents cp where cp.parent_user_id = auth.uid()
$$;

-- Campaign state -------------------------------------------------------------

-- Parents may add, change or delete orders until the campaign is locked or closed.
create function public.campaign_open_for_parents(c public.campaigns)
returns boolean
language sql
stable
set search_path = ''
as $$ select c.locked_at is null and c.closed_at is null $$;

-- Friends may also order only until the deadline (end of that day, Oslo time).
create function public.campaign_open_for_friends(c public.campaigns)
returns boolean
language sql
stable
set search_path = ''
as $$
  select c.locked_at is null and c.closed_at is null
     and (c.deadline is null or c.deadline >= public.oslo_today())
$$;

-- Friend order status, as shown to friends: registrert -> betalt -> på vei -> levert.
create function public.order_status(o public.orders)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when o.deleted_at is not null then 'avbestilt'
    when o.delivered_at is not null then 'levert'
    when exists (
      select 1 from public.campaign_parents cp
      where cp.id = o.campaign_parent_id and cp.goods_sent_at is not null
    ) then 'på vei'
    when o.paid_to_parent_at is not null then 'betalt'
    else 'registrert'
  end
$$;

-- Triggers -------------------------------------------------------------------

-- Every new auth user gets a profile.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where user_id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function public.handle_user_email_change();

create function public.campaigns_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.join_code is null or new.join_code = '' then
    loop
      new.join_code := public.random_code(8);
      exit when not exists (select 1 from public.campaigns where join_code = new.join_code);
    end loop;
  end if;
  return new;
end;
$$;

create trigger campaigns_before_insert
before insert on public.campaigns
for each row execute function public.campaigns_before_insert();

-- Link code (random) and payment code ('D-' + counter per campaign).
create function public.campaign_parents_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  seq integer;
begin
  loop
    new.link_code := public.random_code(6);
    exit when not exists (select 1 from public.campaign_parents where link_code = new.link_code);
  end loop;
  update public.campaigns
     set next_parent_seq = next_parent_seq + 1
   where id = new.campaign_id
  returning next_parent_seq - 1 into seq;
  new.payment_code := 'D-' || seq;
  new.next_order_seq := 1;
  return new;
end;
$$;

create trigger campaign_parents_before_insert
before insert on public.campaign_parents
for each row execute function public.campaign_parents_before_insert();

-- Order code ('K' + counter per parent) and campaign id.
create function public.orders_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  seq integer;
  c_id uuid;
begin
  update public.campaign_parents
     set next_order_seq = next_order_seq + 1
   where id = new.campaign_parent_id
  returning next_order_seq - 1, campaign_id into seq, c_id;
  if seq is null then
    raise exception 'UNKNOWN_PARENT';
  end if;
  new.code := 'K' || seq;
  new.campaign_id := c_id;
  return new;
end;
$$;

create trigger orders_before_insert
before insert on public.orders
for each row execute function public.orders_before_insert();

-- Emails that follow from admin actions (rendered and sent by the send-emails function).
create function public.parent_payments_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.email_outbox (kind, to_email, dedupe_key, campaign_id, campaign_parent_id)
  select 'parent_payment', p.email, 'parent_payment:' || new.id, cp.campaign_id, cp.id
    from public.campaign_parents cp
    join public.profiles p on p.user_id = cp.parent_user_id
   where cp.id = new.campaign_parent_id and p.email <> ''
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

create trigger parent_payments_after_insert
after insert on public.parent_payments
for each row execute function public.parent_payments_after_insert();

create function public.campaign_parents_goods_sent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.email_outbox (kind, to_email, dedupe_key, campaign_id, campaign_parent_id)
  select 'goods_sent', p.email, 'goods_sent:' || new.id, new.campaign_id, new.id
    from public.profiles p
   where p.user_id = new.parent_user_id and p.email <> ''
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

create trigger campaign_parents_goods_sent
after update of goods_sent_at on public.campaign_parents
for each row when (old.goods_sent_at is null and new.goods_sent_at is not null)
execute function public.campaign_parents_goods_sent();

-- Totals views. security_invoker = true, so each user only sums rows they may see.

create view public.v_order_amounts with (security_invoker = true) as
select o.id as order_id,
       o.campaign_id,
       o.campaign_parent_id,
       o.type,
       coalesce(sum(l.qty * l.unit_price), 0)::numeric(10,2) as amount,
       coalesce(sum(l.qty * l.unit_to_team), 0)::numeric(10,2) as to_team,
       coalesce(sum(l.qty), 0)::integer as units
  from public.orders o
  left join public.order_lines l on l.order_id = o.id
 where o.deleted_at is null
 group by o.id;

create view public.v_parent_totals with (security_invoker = true) as
select cp.id as campaign_parent_id,
       cp.campaign_id,
       coalesce(o.owed, 0)::numeric(10,2) as owed,
       coalesce(pp.paid, 0)::numeric(10,2) as paid,
       (coalesce(o.owed, 0) - coalesce(pp.paid, 0))::numeric(10,2) as diff,
       coalesce(o.friend_unpaid, 0)::numeric(10,2) as friend_unpaid,
       coalesce(o.order_count, 0)::integer as order_count
  from public.campaign_parents cp
  left join (
    select a.campaign_parent_id,
           sum(a.amount) as owed,
           sum(a.amount) filter (where a.type = 'friend' and ord.paid_to_parent_at is null) as friend_unpaid,
           count(*) as order_count
      from public.v_order_amounts a
      join public.orders ord on ord.id = a.order_id
     group by a.campaign_parent_id
  ) o on o.campaign_parent_id = cp.id
  left join (
    select campaign_parent_id, sum(amount) as paid
      from public.parent_payments
     group by campaign_parent_id
  ) pp on pp.campaign_parent_id = cp.id;

create view public.v_campaign_progress with (security_invoker = true) as
select c.id as campaign_id,
       c.target_amount,
       coalesce(sum(a.to_team), 0)::numeric(10,2) as raised,
       coalesce(sum(a.amount), 0)::numeric(10,2) as sales
  from public.campaigns c
  left join public.v_order_amounts a on a.campaign_id = c.id
 group by c.id;

create view public.v_supplier_totals with (security_invoker = true) as
select o.campaign_id,
       l.product_id,
       sum(l.qty)::integer as units
  from public.orders o
  join public.order_lines l on l.order_id = o.id
 where o.deleted_at is null
 group by o.campaign_id, l.product_id;
