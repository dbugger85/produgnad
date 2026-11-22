-- The admins' note to parents above what they owe ("Oppgjør med de ansvarlige" on the parent page),
-- for example when the products are handed out and when to pay. Empty: no note.
alter table public.campaigns
  add column payment_note text not null default 'Du trenger ikke vippse de ansvarlige før varene deles ut'
    check (char_length(payment_note) <= 1000);
