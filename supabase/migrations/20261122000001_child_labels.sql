-- Admins' own name for a child, e.g. "Emil H." when two children share a first name.
-- Only admins can read or write it: parents and friends keep seeing child_first_name everywhere
-- (their pages, links, emails), and the label never reaches their phones.

create table public.child_labels (
  campaign_parent_id uuid primary key references public.campaign_parents (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 40),
  updated_at timestamptz not null default now()
);

alter table public.child_labels enable row level security;
revoke all on public.child_labels from anon, public;
grant select, insert, update, delete on public.child_labels to authenticated;

create policy child_labels_admin_select on public.child_labels for select to authenticated
  using ((select public.is_admin()));
create policy child_labels_admin_insert on public.child_labels for insert to authenticated
  with check ((select public.is_admin()));
create policy child_labels_admin_update on public.child_labels for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy child_labels_admin_delete on public.child_labels for delete to authenticated
  using ((select public.is_admin()));
