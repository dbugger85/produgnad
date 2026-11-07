-- ProDugnad: tables, enums, indexes.
-- Money is stored in kroner as numeric(10,2). Codes avoid ambiguous characters.

create extension if not exists pgcrypto with schema extensions;

-- New functions in public must not be callable by everyone by default.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

create type public.order_type as enum ('friend', 'own', 'extra');
create type public.order_creator as enum ('friend', 'parent');
create type public.payment_source as enum ('manual', 'screenshot');

-- One row per logged-in person (admin or parent). Created by a trigger on auth.users.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '',
  phone text not null default '',
  is_admin boolean not null default false,
  role_title text not null default '',          -- e.g. 'kasserer', shown publicly for admins
  show_phone_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_name text not null default '',            -- {lag}, e.g. 'G2012'
  organizer_label text not null,                 -- 'Foreldre og supportere av G2012'
  purpose_text text not null default '',
  target_amount numeric(10,2) not null default 0 check (target_amount >= 0),
  deadline date,
  admin_vipps_name text not null default '',
  admin_vipps_phone text not null default '',
  contact_admin_user_id uuid references public.profiles (user_id) on delete set null,
  join_code text not null unique,
  locked_at timestamptz,
  closed_at timestamptz,
  share_template_short text not null default '',
  share_template_long text not null default '',
  reminder_template text not null default '',
  payment_reminder_template text not null default '',
  closing_message text not null default '',
  og_image_path text,
  next_parent_seq integer not null default 1,
  max_qty_per_line integer not null default 20 check (max_qty_per_line between 1 and 999),
  created_by uuid references public.profiles (user_id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(10,2) not null check (price >= 0),
  to_team_amount numeric(10,2) not null default 0 check (to_team_amount >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (to_team_amount <= price)
);
create index on public.products (campaign_id, sort_order);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  thumb_path text not null,
  width integer,
  height integer,
  sort_order integer not null default 0,         -- 0 = main picture
  created_at timestamptz not null default now()
);
create index on public.product_images (product_id, sort_order);

-- A parent taking part in one campaign. Name and phone live on profiles.
create table public.campaign_parents (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  parent_user_id uuid not null references public.profiles (user_id) on delete cascade,
  child_first_name text not null default '',
  link_code text not null unique,                -- /k/<link_code>
  payment_code text not null,                    -- 'D-14', message when paying the admin
  next_order_seq integer not null default 1,
  goods_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, parent_user_id),
  unique (campaign_id, payment_code)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  campaign_parent_id uuid not null references public.campaign_parents (id) on delete cascade,
  code text not null,                            -- 'K7', unique per parent
  type public.order_type not null,
  buyer_first_name text not null default '',
  note text not null default '',
  email text,
  wants_email boolean not null default false,
  status_token uuid not null unique default gen_random_uuid(),
  client_token uuid unique,                      -- blocks double submit
  assigned_from_order_id uuid references public.orders (id) on delete set null,
  paid_to_parent_at timestamptz,
  delivered_at timestamptz,
  created_by public.order_creator not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (campaign_parent_id, code)
);
create index on public.orders (campaign_id);
create index on public.orders (campaign_parent_id);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  qty integer not null check (qty > 0),
  unit_price numeric(10,2) not null,             -- snapshot at order time
  unit_to_team numeric(10,2) not null,           -- snapshot at order time
  unique (order_id, product_id)
);
create index on public.order_lines (product_id);

create table public.parent_payments (
  id uuid primary key default gen_random_uuid(),
  campaign_parent_id uuid not null references public.campaign_parents (id) on delete cascade,
  amount numeric(10,2) not null check (amount <> 0),
  paid_on date not null default (now() at time zone 'Europe/Oslo')::date,
  source public.payment_source not null default 'manual',
  ocr_line_text text,
  confirmed_by uuid references public.profiles (user_id) on delete set null default auth.uid(),
  confirmed_at timestamptz not null default now()
);
create index on public.parent_payments (campaign_parent_id);

-- Queue and log of outgoing emails. The Edge Function send-emails drains it.
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                            -- 'friend_order', 'friend_paid', ...
  to_email text not null,
  dedupe_key text not null unique,
  campaign_id uuid references public.campaigns (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  campaign_parent_id uuid references public.campaign_parents (id) on delete cascade,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  attempts integer not null default 0,
  error text
);
create index on public.email_outbox (sent_at) where sent_at is null;
