-- End of a campaign: the closing message by email to every parent (once), and deleting the
-- friends' personal data (first names, emails, notes) while keeping amounts, products and payments.

alter table public.campaigns add column anonymized_at timestamptz;

-- Queues one closing email per parent with an email address. Only for closed campaigns with a
-- closing message. Never twice per parent (dedupe key). Returns how many were queued now.
create function public.queue_closing_emails(p_campaign_id uuid)
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
  if trim(c.closing_message) = '' then
    raise exception 'NO_CLOSING_MESSAGE';
  end if;

  insert into public.email_outbox (kind, to_email, dedupe_key, campaign_id, campaign_parent_id)
  select 'closing', p.email, 'closing:' || cp.id, c.id, cp.id
    from public.campaign_parents cp
    join public.profiles p on p.user_id = cp.parent_user_id
   where cp.campaign_id = c.id and p.email <> ''
  on conflict (dedupe_key) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Deletes the friends' personal data in a closed campaign. Totals and the ledger don't change.
create function public.anonymize_friends(p_campaign_id uuid)
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

revoke all on function public.queue_closing_emails(uuid) from public, anon;
revoke all on function public.anonymize_friends(uuid) from public, anon;
grant execute on function public.queue_closing_emails(uuid) to authenticated, service_role;
grant execute on function public.anonymize_friends(uuid) to authenticated, service_role;
