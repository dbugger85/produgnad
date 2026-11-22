-- Sellers without login: admins add a child (and, if they like, the parent's name and phone) for
-- parents who don't want to sign up with their email. The admins enter their orders and payments
-- with the normal tools; such a seller gets no emails and their order link takes no orders.
-- A seller without login is a campaign_parents row with parent_user_id null.

alter table public.campaign_parents alter column parent_user_id drop not null;
alter table public.campaign_parents
  add column offline_name text not null default '',
  add column offline_phone text not null default '',
  add constraint campaign_parents_offline_child
    check (parent_user_id is not null or char_length(trim(child_first_name)) between 1 and 40);

-- Control characters stripped from the new names too
create or replace function public.clean_text_columns()
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
    new.offline_name := public.strip_controls(new.offline_name);
    new.offline_phone := public.strip_controls(new.offline_phone);
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

-- The parent shown on public pages: from the profile, or the admin-entered name for a seller
-- without login (left join, so the page still loads)
create or replace function public.parent_public_json(p_campaign_parent_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', coalesce(p.name, cp.offline_name),
    'phone', coalesce(p.phone, cp.offline_phone),
    'child_first_name', cp.child_first_name,
    'link_code', cp.link_code
  )
  from public.campaign_parents cp
  left join public.profiles p on p.user_id = cp.parent_user_id
  where cp.id = p_campaign_parent_id
$$;

-- /k/<link_code>: a seller without login never sees link orders, so their link shows as closed
create or replace function public.public_campaign_by_link(p_link_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'campaign', public.campaign_public_json(cp.campaign_id)
                || case when cp.parent_user_id is null then jsonb_build_object('accepting_orders', false) else '{}'::jsonb end,
    'parent', public.parent_public_json(cp.id),
    'products', public.campaign_products_json(cp.campaign_id)
  )
  from public.campaign_parents cp
  where cp.link_code = upper(trim(p_link_code))
$$;

-- ... and the database refuses friends' orders through it (whatever the page shows)
create function public.orders_offline_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by = 'friend'
     and exists (select 1 from public.campaign_parents where id = new.campaign_parent_id and parent_user_id is null) then
    raise exception 'CAMPAIGN_CLOSED';
  end if;
  return new;
end;
$$;
revoke all on function public.orders_offline_guard() from public, anon, authenticated;

create trigger offline_guard before insert on public.orders
  for each row execute function public.orders_offline_guard();

-- Admins add or change a seller without login. Returns the campaign_parents id.
create function public.admin_save_seller(
  p_campaign_id uuid,
  p_child_first_name text,
  p_name text default '',
  p_phone text default '',
  p_campaign_parent_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.campaigns;
  cp_id uuid;
  v_child text := left(trim(coalesce(p_child_first_name, '')), 40);
  v_name text := left(trim(coalesce(p_name, '')), 80);
  v_phone text := left(trim(coalesce(p_phone, '')), 30);
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  select * into c from public.campaigns where id = p_campaign_id;
  if not found then
    raise exception 'UNKNOWN_CAMPAIGN';
  end if;
  if v_child = '' then
    raise exception 'INVALID_NAME';
  end if;

  if p_campaign_parent_id is null then
    if c.closed_at is not null then
      raise exception 'CAMPAIGN_CLOSED';
    end if;
    insert into public.campaign_parents
      (campaign_id, parent_user_id, child_first_name, offline_name, offline_phone, link_code, payment_code)
    values (c.id, null, v_child, v_name, v_phone, '', '')
    returning id into cp_id;
  else
    -- Only sellers without login: a real parent's name and phone are on their own profile
    update public.campaign_parents
       set child_first_name = v_child, offline_name = v_name, offline_phone = v_phone
     where id = p_campaign_parent_id and campaign_id = c.id and parent_user_id is null
    returning id into cp_id;
    if cp_id is null then
      raise exception 'NOT_ALLOWED';
    end if;
  end if;
  return cp_id;
end;
$$;
revoke all on function public.admin_save_seller(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_save_seller(uuid, text, text, text, uuid) to authenticated, service_role;
