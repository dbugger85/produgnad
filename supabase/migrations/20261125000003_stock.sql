-- Stock per product (products.stock, null = no limit). The stock is the total available, so units
-- already sold count against it: total sold (all orders not deleted, friend, own and extra) never
-- goes above the stock. Admins can't set it lower than what is already sold.

alter table public.products add column stock integer check (stock >= 0);

-- Units sold of a product: every order that isn't deleted. Units given away from extra stock move
-- from one order to another, so they're counted once.
create function public.product_sold(p_product_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(l.qty), 0)::integer
    from public.order_lines l
    join public.orders o on o.id = l.order_id
   where l.product_id = p_product_id and o.deleted_at is null
$$;
revoke all on function public.product_sold(uuid) from public, anon, authenticated;

create function public.products_stock_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sold integer;
begin
  if new.stock is not null then
    sold := case when tg_op = 'INSERT' then 0 else public.product_sold(new.id) end;
    if new.stock < sold then
      raise exception 'STOCK_BELOW_SOLD|%', sold;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.products_stock_guard() from public, anon, authenticated;

create trigger products_stock_guard
  before insert or update of stock on public.products
  for each row execute function public.products_stock_guard();

create or replace function public.write_order_lines(p_order_id uuid, p_campaign_id uuid, p_lines jsonb,
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
  before_qty jsonb;
  short record;
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

  -- Products with a stock limit: lock them (in a fixed order, so two orders can't deadlock) and
  -- remember this order's quantities, so only lines that grow are checked against the stock.
  perform 1 from public.products
   where id in (select (e ->> 'product_id')::uuid from jsonb_array_elements(p_lines) e)
     and stock is not null
   order by id
     for update;
  select coalesce(jsonb_object_agg(product_id, qty), '{}'::jsonb) into before_qty
    from public.order_lines where order_id = p_order_id;

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

  -- Never more sold than the stock. Lines that shrink or stay the same are always allowed.
  -- left_before: how many more this order could have taken
  select pr2.name,
         pr2.stock - (public.product_sold(pr2.id) - l.qty)
           - coalesce((before_qty ->> l.product_id::text)::integer, 0) as left_before
    into short
    from public.order_lines l
    join public.products pr2 on pr2.id = l.product_id
   where l.order_id = p_order_id
     and pr2.stock is not null
     and l.qty > coalesce((before_qty ->> l.product_id::text)::integer, 0)
     and public.product_sold(pr2.id) > pr2.stock
   order by pr2.sort_order
   limit 1;
  if found then
    -- The page shows: «Det er bare 3 igjen av Kaffe» / «Kaffe er utsolgt»
    raise exception 'OUT_OF_STOCK|%|%', greatest(short.left_before, 0), short.name;
  end if;
end;
$$;

-- Order pages get how many are left (null = no limit)
create or replace function public.campaign_products_json(p_campaign_id uuid)
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
           'to_team_amount', case when v.show then pr.to_team_amount end,
           'remaining', case when pr.stock is not null then greatest(pr.stock - public.product_sold(pr.id), 0) end,
           'images', coalesce((
             select jsonb_agg(jsonb_build_object('path', i.storage_path, 'thumb', i.thumb_path,
                                                 'width', i.width, 'height', i.height)
                              order by i.sort_order, i.created_at)
               from public.product_images i where i.product_id = pr.id
           ), '[]'::jsonb)
         ) order by pr.sort_order, pr.created_at), '[]'::jsonb)
    from public.products pr
    join public.campaigns c on c.id = pr.campaign_id,
         lateral (select public.visible_to_viewer(
                    c.contribution_visibility,
                    public.is_admin() or c.id in (select public.my_campaign_ids())) as show) v
   where pr.campaign_id = p_campaign_id and pr.active
$$;

-- Parents and admins: stock and units sold per product with a limit, as {product_id: {stock, sold}}
-- (parents can't see other parents' orders, so they can't count it themselves)
create function public.campaign_stock(p_campaign_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(pr.id, jsonb_build_object('stock', pr.stock, 'sold', public.product_sold(pr.id))), '{}'::jsonb)
    from public.products pr
   where pr.campaign_id = p_campaign_id
     and pr.stock is not null
     and (public.is_admin() or p_campaign_id in (select public.my_campaign_ids()))
$$;
revoke all on function public.campaign_stock(uuid) from public, anon, authenticated;
grant execute on function public.campaign_stock(uuid) to authenticated, service_role;
