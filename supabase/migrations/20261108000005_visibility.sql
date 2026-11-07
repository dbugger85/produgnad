-- Per-campaign settings for who sees the progress bar, the per-product contribution
-- ("50 kr av hver ... går til laget") and the admins ("Ansvarlige og kontakt"):
-- 'none', 'parents' (parents in the campaign and admins) or 'all'.
-- Default 'parents': friends see none of it (owner's choice, 7 Nov 2026).

alter table public.campaigns
  add column progress_visibility text not null default 'parents'
    check (progress_visibility in ('none', 'parents', 'all')),
  add column contribution_visibility text not null default 'parents'
    check (contribution_visibility in ('none', 'parents', 'all')),
  add column admins_visibility text not null default 'parents'
    check (admins_visibility in ('none', 'parents', 'all'));

create function public.visible_to_viewer(p_visibility text, p_insider boolean)
returns boolean
language sql
immutable
set search_path = ''
as $$ select p_visibility = 'all' or (p_visibility = 'parents' and p_insider) $$;

create or replace function public.campaign_public_json(p_campaign_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'team_name', c.team_name,
    'organizer_label', c.organizer_label,
    'purpose_text', c.purpose_text,
    'target_amount', case when show_progress then c.target_amount end,
    'deadline', c.deadline,
    'locked', c.locked_at is not null,
    'closed', c.closed_at is not null,
    'closing_message', case when c.closed_at is not null then c.closing_message else '' end,
    'accepting_orders', public.campaign_open_for_friends(c),
    'max_qty_per_line', c.max_qty_per_line,
    'raised', case when show_progress then (
                select coalesce(sum(l.qty * l.unit_to_team), 0)
                  from public.orders o join public.order_lines l on l.order_id = o.id
                 where o.campaign_id = c.id and o.deleted_at is null) end,
    'admins', case when show_admins then coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', p.name,
               'role_title', p.role_title,
               'phone', case when p.show_phone_public then p.phone else null end
             ) order by p.created_at)
        from public.profiles p
       where p.is_admin and p.name <> ''
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from public.campaigns c,
       lateral (select public.is_admin() or c.id in (select public.my_campaign_ids()) as insider) i,
       lateral (select public.visible_to_viewer(c.progress_visibility, i.insider) as show_progress,
                       public.visible_to_viewer(c.admins_visibility, i.insider) as show_admins) v
  where c.id = p_campaign_id
$$;

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
