-- The progress bar (money to the team and the target) is only for parents in the campaign and admins
-- (owner's choice, 7 Nov 2026). Friends' pages get null for both, so it isn't sent to them at all.

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
    'target_amount', case when insider then c.target_amount end,
    'deadline', c.deadline,
    'locked', c.locked_at is not null,
    'closed', c.closed_at is not null,
    'closing_message', case when c.closed_at is not null then c.closing_message else '' end,
    'accepting_orders', public.campaign_open_for_friends(c),
    'max_qty_per_line', c.max_qty_per_line,
    'raised', case when insider then (
                select coalesce(sum(l.qty * l.unit_to_team), 0)
                  from public.orders o join public.order_lines l on l.order_id = o.id
                 where o.campaign_id = c.id and o.deleted_at is null) end,
    'admins', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', p.name,
               'role_title', p.role_title,
               'phone', case when p.show_phone_public then p.phone else null end
             ) order by p.created_at)
        from public.profiles p
       where p.is_admin and p.name <> ''
    ), '[]'::jsonb)
  )
  from public.campaigns c,
       lateral (select public.is_admin() or c.id in (select public.my_campaign_ids()) as insider) i
  where c.id = p_campaign_id
$$;
