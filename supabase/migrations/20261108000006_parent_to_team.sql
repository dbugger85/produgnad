-- Money to the team per parent ("870 kr til laget via deg"), for the parent page and the admin's parent list.
create or replace view public.v_parent_totals with (security_invoker = true) as
select cp.id as campaign_parent_id,
       cp.campaign_id,
       coalesce(o.owed, 0)::numeric(10,2) as owed,
       coalesce(pp.paid, 0)::numeric(10,2) as paid,
       (coalesce(o.owed, 0) - coalesce(pp.paid, 0))::numeric(10,2) as diff,
       coalesce(o.friend_unpaid, 0)::numeric(10,2) as friend_unpaid,
       coalesce(o.order_count, 0)::integer as order_count,
       coalesce(o.to_team, 0)::numeric(10,2) as to_team
  from public.campaign_parents cp
  left join (
    select a.campaign_parent_id,
           sum(a.amount) as owed,
           sum(a.amount) filter (where a.type = 'friend' and ord.paid_to_parent_at is null) as friend_unpaid,
           count(*) as order_count,
           sum(a.to_team) as to_team
      from public.v_order_amounts a
      join public.orders ord on ord.id = a.order_id
     group by a.campaign_parent_id
  ) o on o.campaign_parent_id = cp.id
  left join (
    select campaign_parent_id, sum(amount) as paid
      from public.parent_payments
     group by campaign_parent_id
  ) pp on pp.campaign_parent_id = cp.id;
