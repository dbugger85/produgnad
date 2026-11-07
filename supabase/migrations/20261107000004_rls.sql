-- Row Level Security, grants and storage.
-- Rule of thumb: friends (anon) touch no table directly, only the public functions.
-- Parents read their own rows; all parent writes go through functions.
-- Admins read and write everything.

-- Start from zero rights, then grant exactly what is needed.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.campaign_parents enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.parent_payments enable row level security;
alter table public.email_outbox enable row level security;

-- profiles
grant select on public.profiles to authenticated;
grant update (name, phone, role_title, show_phone_public) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

-- campaigns
grant select, insert, update on public.campaigns to authenticated;
create policy campaigns_select on public.campaigns for select to authenticated
  using ((select public.is_admin()) or id in (select public.my_campaign_ids()));
create policy campaigns_insert on public.campaigns for insert to authenticated
  with check ((select public.is_admin()));
create policy campaigns_update on public.campaigns for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- products
grant select, insert, update, delete on public.products to authenticated;
create policy products_select on public.products for select to authenticated
  using ((select public.is_admin()) or campaign_id in (select public.my_campaign_ids()));
create policy products_admin_insert on public.products for insert to authenticated
  with check ((select public.is_admin()));
create policy products_admin_update on public.products for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy products_admin_delete on public.products for delete to authenticated
  using ((select public.is_admin()));

-- product_images
grant select, insert, update, delete on public.product_images to authenticated;
create policy product_images_select on public.product_images for select to authenticated
  using ((select public.is_admin()) or product_id in (
    select id from public.products where campaign_id in (select public.my_campaign_ids())));
create policy product_images_admin_insert on public.product_images for insert to authenticated
  with check ((select public.is_admin()));
create policy product_images_admin_update on public.product_images for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy product_images_admin_delete on public.product_images for delete to authenticated
  using ((select public.is_admin()));

-- campaign_parents (parents join through join_campaign())
grant select on public.campaign_parents to authenticated;
grant update (child_first_name, goods_sent_at) on public.campaign_parents to authenticated;
create policy campaign_parents_select on public.campaign_parents for select to authenticated
  using (parent_user_id = (select auth.uid()) or (select public.is_admin()));
create policy campaign_parents_admin_update on public.campaign_parents for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- orders and order_lines (writes only through functions)
grant select on public.orders, public.order_lines to authenticated;
create policy orders_select on public.orders for select to authenticated
  using ((select public.is_admin()) or campaign_parent_id in (select public.my_campaign_parent_ids()));
create policy order_lines_select on public.order_lines for select to authenticated
  using ((select public.is_admin()) or order_id in (
    select id from public.orders where campaign_parent_id in (select public.my_campaign_parent_ids())));

-- parent_payments (admins record; parents see their own)
grant select, insert, update, delete on public.parent_payments to authenticated;
create policy parent_payments_select on public.parent_payments for select to authenticated
  using ((select public.is_admin()) or campaign_parent_id in (select public.my_campaign_parent_ids()));
create policy parent_payments_admin_insert on public.parent_payments for insert to authenticated
  with check ((select public.is_admin()));
create policy parent_payments_admin_update on public.parent_payments for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy parent_payments_admin_delete on public.parent_payments for delete to authenticated
  using ((select public.is_admin()));

-- email_outbox (admins can look; only functions and the service role write)
grant select on public.email_outbox to authenticated;
create policy email_outbox_admin_select on public.email_outbox for select to authenticated
  using ((select public.is_admin()));

-- Views follow the rights of the tables underneath (security_invoker).
grant select on public.v_order_amounts, public.v_parent_totals,
                public.v_campaign_progress, public.v_supplier_totals to authenticated;

-- Functions
grant execute on function
  public.public_campaign_by_link(text),
  public.public_campaign_by_join(text),
  public.order_status_by_token(uuid),
  public.create_friend_order(text, text, jsonb, text, boolean, text, uuid)
to anon, authenticated;

grant execute on function
  public.is_admin(),
  public.my_campaign_ids(),
  public.my_campaign_parent_ids(),
  public.join_campaign(text, text, text, text),
  public.save_order(uuid, public.order_type, jsonb, text, text, boolean, uuid),
  public.set_order_paid(uuid, boolean),
  public.set_order_delivered(uuid, boolean),
  public.delete_order(uuid),
  public.set_admin(text, boolean),
  public.order_status(public.orders),
  public.campaign_open_for_parents(public.campaigns),
  public.campaign_open_for_friends(public.campaigns)
to authenticated;

-- The service role (used by Edge Functions) keeps full rights.
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Storage: public bucket for product pictures; only admins write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
        array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy product_images_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy product_images_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()))
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy product_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
