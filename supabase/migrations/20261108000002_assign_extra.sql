-- Give units from an 'extra' order (stock to sell later) to a named buyer.
-- Creates a new friend order with the same price snapshots and takes the units off the extra order.
-- The total ordered through the parent doesn't change, so this is allowed after the lock
-- (that's when extra stock gets sold), but not after the campaign is closed (admins can).

create function public.assign_extra(
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
  name text := left(trim(coalesce(p_buyer_first_name, '')), 40);
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

  -- Check every line against what the extra order holds.
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

  -- Same price snapshots as the extra order.
  insert into public.order_lines (order_id, product_id, qty, unit_price, unit_to_team)
  select o.id, l.product_id, (e ->> 'qty')::integer, l.unit_price, l.unit_to_team
    from jsonb_array_elements(p_lines) e
    join public.order_lines l on l.order_id = extra.id and l.product_id = (e ->> 'product_id')::uuid
   where (e ->> 'qty')::integer > 0;

  -- Lines given away completely go first (qty may never be 0), then the rest shrink.
  delete from public.order_lines l
   using jsonb_array_elements(p_lines) e
   where l.order_id = extra.id and l.product_id = (e ->> 'product_id')::uuid
     and (e ->> 'qty')::integer = l.qty;

  update public.order_lines l
     set qty = l.qty - (e ->> 'qty')::integer
    from jsonb_array_elements(p_lines) e
   where l.order_id = extra.id and l.product_id = (e ->> 'product_id')::uuid
     and (e ->> 'qty')::integer > 0;

  -- Nothing left: the extra order is used up.
  if not exists (select 1 from public.order_lines where order_id = extra.id) then
    update public.orders set deleted_at = now() where id = extra.id;
  end if;

  return jsonb_build_object('id', o.id, 'code', o.code);
end;
$$;

revoke all on function public.assign_extra(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.assign_extra(uuid, text, jsonb, boolean) to authenticated, service_role;
