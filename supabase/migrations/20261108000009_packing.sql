-- Packing lists ticked on the phone instead of printed.
-- Admins tick each parent's bag as packed; parents tick each order (one per friend) as packed.
-- Packing is not delivery: friends' status pages still follow paid -> delivered.

alter table public.campaign_parents add column packed_at timestamptz;
alter table public.orders add column packed_at timestamptz;

-- Admins write campaign_parents directly (admin update policy); parents can't (policy).
grant update (packed_at) on public.campaign_parents to authenticated;

-- Parent (own orders) or admin ticks an order as packed. Allowed after the lock: packing happens then.
create function public.set_order_packed(p_order_id uuid, p_packed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders := public.order_for_caller(p_order_id);
begin
  update public.orders
     set packed_at = case when p_packed then coalesce(packed_at, now()) end
   where id = o.id;
end;
$$;

revoke all on function public.set_order_packed(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_order_packed(uuid, boolean) to authenticated, service_role;
