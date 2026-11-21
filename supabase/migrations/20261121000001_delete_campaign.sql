-- Deleting a whole campaign: products, pictures, parents' links, orders, payments and queued
-- emails go with it (foreign keys cascade). Parents' logins (profiles) stay: they may be in
-- other campaigns. The admin must type the campaign's name, checked here as well as in the app.
-- Returns the storage paths of the product pictures, which the app then removes from the bucket.

create function public.delete_campaign(p_campaign_id uuid, p_name text)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.campaigns;
  paths text[];
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'UNKNOWN_CAMPAIGN';
  end if;
  if lower(trim(coalesce(p_name, ''))) <> lower(trim(c.name)) then
    raise exception 'NAME_MISMATCH';
  end if;

  select coalesce(array_agg(x.path), '{}') into paths
    from (select i.storage_path as path
            from public.product_images i join public.products p on p.id = i.product_id
           where p.campaign_id = c.id
          union
          select i.thumb_path
            from public.product_images i join public.products p on p.id = i.product_id
           where p.campaign_id = c.id) x;

  -- Order lines first: they point at products without cascade
  delete from public.order_lines l using public.orders o
   where l.order_id = o.id and o.campaign_id = c.id;
  delete from public.campaigns where id = c.id;
  return paths;
end;
$$;

revoke all on function public.delete_campaign(uuid, text) from public, anon, authenticated;
grant execute on function public.delete_campaign(uuid, text) to authenticated, service_role;
