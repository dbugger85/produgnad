-- The «paid» email (the receipt) only goes to friends who ticked «Jeg trenger kvittering».
-- Friends who only asked for email get the order confirmation and nothing more (the owner, 25 Nov 2026).
create or replace function public.set_order_paid(p_order_id uuid, p_paid boolean)
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
  if p_paid and o.wants_receipt and o.email is not null then
    insert into public.email_outbox (kind, to_email, dedupe_key, campaign_id, order_id, campaign_parent_id)
    values ('friend_paid', o.email, 'friend_paid:' || o.id, o.campaign_id, o.id, o.campaign_parent_id)
    on conflict (dedupe_key) do nothing;
  end if;
end;
$$;

-- Already queued for friends who didn't ask for a receipt: don't send
update public.email_outbox e
   set sent_at = now(), error = 'no receipt asked for'
  from public.orders o
 where e.kind = 'friend_paid' and e.sent_at is null and o.id = e.order_id and not o.wants_receipt;
