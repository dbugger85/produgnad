-- Receipts: a paid friend order is shown as a receipt (kvittering) on /kvittering/<token> and in
-- the «paid» email. A friend may give a company name for the receipt when ordering.

alter table public.orders add column receipt_name text not null default '';

-- New parameter p_receipt_name (the company name on the receipt, optional)
drop function public.create_friend_order(text, text, jsonb, text, boolean, text, uuid);

create function public.create_friend_order(
  p_link_code text,
  p_first_name text,
  p_lines jsonb,
  p_email text default null,
  p_wants_email boolean default false,
  p_honeypot text default '',
  p_client_token uuid default null,
  p_receipt_name text default null
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
  receipt text := trim(public.strip_controls(coalesce(p_receipt_name, '')));
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
  if length(receipt) > 80 then
    raise exception 'INVALID_RECEIPT_NAME';
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
                               receipt_name, email, wants_email, client_token, created_by)
    values (cp.id, cp.campaign_id, '', 'friend', name, receipt, mail, wants, p_client_token, 'friend')
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


revoke all on function public.create_friend_order(text, text, jsonb, text, boolean, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_friend_order(text, text, jsonb, text, boolean, text, uuid, text) to anon, authenticated, service_role;

-- The status page also gets when it was paid and the receipt name
create or replace function public.order_status_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', o.code,
    'buyer_first_name', o.buyer_first_name,
    'receipt_name', o.receipt_name,
    'status', public.order_status(o),
    'created_at', o.created_at,
    'paid_at', case when o.deleted_at is null then o.paid_to_parent_at end,
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

-- Closing a dugnad also removes the company names
create or replace function public.anonymize_friends(p_campaign_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.campaigns;
  n integer;
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  select * into c from public.campaigns where id = p_campaign_id;
  if not found then
    raise exception 'UNKNOWN_CAMPAIGN';
  end if;
  if c.closed_at is null then
    raise exception 'CAMPAIGN_NOT_CLOSED';
  end if;

  update public.orders
     set buyer_first_name = case when type = 'friend' then 'Venn' else '' end,
         receipt_name = '',
         email = null,
         wants_email = false,
         note = ''
   where campaign_id = c.id;
  get diagnostics n = row_count;

  -- The emails sent to friends held their addresses
  delete from public.email_outbox
   where campaign_id = c.id and kind in ('friend_order', 'friend_paid');

  update public.campaigns set anonymized_at = now() where id = c.id;
  return n;
end;
$$;

