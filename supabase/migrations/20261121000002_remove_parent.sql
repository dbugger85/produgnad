-- Admins can remove a parent from a campaign. Their orders, payments and queued emails go with
-- them (foreign keys cascade); their login (profiles) stays, so they can join again later.
-- Order lines of their orders cascade with the orders; extra stock only moves within one parent.

grant delete on public.campaign_parents to authenticated;
create policy campaign_parents_admin_delete on public.campaign_parents for delete to authenticated
  using ((select public.is_admin()));
