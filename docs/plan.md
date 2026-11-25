# ProDugnad: plan and decisions

The spec is [brief.md](brief.md). This file records the approved plan and every decision since.

## Decisions (approved 7 November 2026)

| Topic | Decision |
|---|---|
| Name | ProDugnad, repo `dbugger85/produgnad` (public). App address stays `dugnad.substitutor.no` |
| Stack | Vite + React + TypeScript + Tailwind, `react-router`, `@supabase/supabase-js`, `qrcode`. Pictures resized with `<canvas>`, no library |
| Hosting | Cloudflare Pages (not Workers): subdomain via CNAME while DNS stays at Domeneshop |
| Email | Resend, also as Supabase's SMTP for login emails (Supabase's own sender only reaches project team members) |
| Login | Email with a 6-digit code **and** a link, because links from Messenger often open in another browser |
| Parent sign-up | Through `/bli-med/<join_code>`, a link admins share. Anyone with the link can sign up |
| Admins | Global (`profiles.is_admin`), one team per install. First admin set by SQL; others invited by email from Innstillinger or made admin on Personer (`invite-admin`, 7 Nov) |
| Admin public info | Name, role title and phone (only if opted in) stored on `profiles`; who sees them is the Ansvarlige og kontakt setting |
| What friends see | Setting per campaign under Oppsett → Hva som vises: Fremdrift, Bidrag per vare, Ansvarlige og kontakt; each Ikke vist / Foreldre og admin (default) / Alle. Friend emails reply to the contact admin only with Ansvarlige = Alle, else to the parent (owner, 7 Nov; deviates from the brief's transparency list) |
| Progress bar | Counts all orders, including `own` and `extra`; money to the team (profit), not sales; no bar without a target, just the amount (7 Nov) |
| Login link | No visible "Logg inn" on the friend page |
| Standard pictures | Products without a picture get a drawn standard picture from the name: kaffe, te, sokker (`src/lib/defaultPictures.ts`; toilet paper removed, owner 7 Nov, `public/defaults`), also in link previews (owner, 7 Nov) |
| Picture formats | Large product pictures are JPEG (not WebP), thumbnails WebP: WhatsApp and others don't show WebP link previews (7 Nov) |
| Order codes | `K` + counter per parent; payment codes `D-` + counter per campaign; link codes 6 random characters without O/0/I/1/L |
| Emails | `email_outbox` table (queue + log, unique dedupe key) instead of `email_log` |
| Parent writes | Through database functions, not direct table writes, so price snapshots and the lock can't be bypassed |
| Deadline | Friends can't order after the deadline day (Oslo time); parents can add orders until the campaign is locked |
| "Pappa til Emma" | Shown as "forelder til Emma" (no mamma/pappa field) |

## Phase 0: setup

| # | Step | Who | Status |
|---|---|---|---|
| 0.1 | GitHub repo | Claude | done |
| 0.2 | Code skeleton, migrations, seed, tests, CI | Claude | done |
| 0.3 | Supabase project `nnqpdzqzwzhogcbzriyn` (created in London, eu-west-2; owner chose to keep it: UK has EU adequacy) | Martin | done |
| 0.4 | Resend account + domain `substitutor.no` (Ireland, verified) | Martin | done 7 Nov |
| 0.5 | DNS at Domeneshop for Resend: TXT `resend._domainkey`, CNAME `rsend`, CNAME `send`, TXT `_dmarc` | Martin, rows from Claude | done 7 Nov |
| 0.6 | Supabase auth: custom SMTP, site URL, redirect URLs, email template, rate limit | Martin, values from Claude | done 7 Nov: SMTP via Resend, site URL dugnad.substitutor.no, Norwegian template with logo and code (OTP length is 8) |
| 0.7 | Secrets (Resend key for the email function) | Martin | set by owner 7 Nov, not yet confirmed by a real friend email |
| 0.8 | Cloudflare Pages project `produgnad` (https://produgnad.pages.dev) + custom domain | Martin | done 7 Nov (dugnad.substitutor.no) |
| 0.9 | DNS CNAME `dugnad` → `produgnad.pages.dev` | Martin | done 7 Nov |
| 0.10 | Push database, deploy function, first admin, test on phone | Claude | database, function, first admin (the owner) done 7 Nov |

## Phase 1 (MVP): built 7 November 2026, tested with dummy data on the laptop; the owner's real test run with the live campaign is under way

- Campaign and product setup, product pictures with in-browser resize (1 200 px + 400 px thumbnail, WebP/JPEG, < 200 kB)
- Parent sign-up, personal link, payment code
- Friend order page: first name only, payment instructions with copy buttons, status link, remembered on the device
- Parent page: orders (three types), tick paid/delivered, edit/delete until lock, amount owed with Vipps instructions
- Admin: all orders with filters, per-parent totals, register parent payments
- Transparency on every public page; progress bar
- Share texts (short/long) with share menu and copy
- Opt-in friend confirmation email

Also built early (phase 2 items that were cheap): lock/unlock and close, supplier totals, "goods sent" per parent, QR code, deadline reminder and payment reminder texts, emails for friend paid / parent payment / goods sent.

**Done when:** a dummy campaign runs end to end on a phone. A friend orders with first name only, the parent ticks paid, the admin registers the parent payment, and all totals match.

## Still to do

- Phase 2: done 7 Nov (digest + keep-alive: `daily-digest` + `.github/workflows/daily.yml`; packing lists `/pakkeliste/<cp>` and `/admin/d/<id>/pakkelister`; extra stock `assign_extra`, allowed after the lock)
- Phase 3: done 7 Nov: link previews (Cloudflare Pages Functions in `functions/`, default picture `public/og-default.png`), closing message by email (`queue_closing_emails`, once per parent) and deleting friends' data (`anonymize_friends`, keeps totals), both on Oversikt after closing. Ledger CSV and screenshot matching moved to the idea list (owner, 7 Nov)

## Log

- 7 Nov 2026: look borrowed from Substitutor but light; then switched to ready.no navy (#002e5f) to tell it apart. Logo: shopping bag with heart. Name shown as PRODUGNAD with PRO in faded navy. Phone numbers +47 912 34 567, amounts with kr. "ikke av klubben direkte". Admin page = "Administrasjon"; settings = "Innstillinger"; campaign settings tab = "Oppsett". Admins skip the front page.
- Next (old): owner's end-to-end test on a phone, then keep-alive cron (Supabase pauses after 7 idle days), link preview, packing list, extra stock, then phase 3.

- 7 Nov 2026, later: what friends see is a setting (Hva som vises); simpler page after ordering and status page (one Vipps block: amount + name, number with Kopier, message code), same block on the parent page and in emails; "Venn" instead of "Kunde"; money to the team per parent (parent page + admin list sortable); standard pictures for coffee, tea, socks; closing message by email and deleting friends' data; security review by Fable and fixes; invite admins by email; Personer page; link preview card on the parent page; bar on the parent's own order link; friends' pages always load as a friend; own confirm dialog; admin start page with "Dugnader jeg er med på" / "Dugnader jeg administrerer" / Annet; smoother page changes (preloaded code, remembered data, delayed "Laster", fade-in).
- 7 Nov 2026, evening: packing lists are ticked on the phone instead of printed. Admins tick one bag per parent (`campaign_parents.packed_at`, with "Igjen å pakke" totals); parents tick one row per friend (`orders.packed_at` via `set_order_packed`). Packing is separate from "levert", so friends' status pages don't change.
- 7 Nov 2026, late: parent page "Pakkeliste" button moved from the order-link row to the "Bestillinger" heading (shown when there are orders); no full stop after the last sentence of any text, app and emails (owner's rule for all apps; share templates untouched); "Logg ut" lines up with the page text; loading shows the page's top bar at once and grey placeholder blocks (fade in after 150 ms) instead of a "Laster" screen; "Ny" on the admin start page is a small pill without "+".
- 21 Nov 2026: admins can delete a whole dugnad (Oppsett, bottom: «Slett dugnaden»). The confirm dialog asks them to type the dugnad's name (`typeToConfirm` in `Confirm.tsx`), checked again in SQL (`delete_campaign`, migration `20261121000001`). Products, pictures (also removed from storage), parents' links, orders, payments and queued emails go; parents' logins stay
- 21 Nov 2026: products can be copied (Varer: «Kopier» next to «Endre»): «… (kopi)», hidden, opens for editing, with its own copies of the pictures. «Kort beskrivelse» is rich text: a what-you-see editor (contenteditable) whose Fet, Kursiv, Punktliste buttons switch on and off, pasted text comes in plain; stored as a small markdown subset (`**fet**`, `*kursiv*`, `- ` lines) and drawn by `components/RichText.tsx` as React elements, never HTML. Visibility choice renamed «Foreldre og admin». Product form: Lagre/Avbryt/Slett below the pictures
- 21 Nov 2026, later: admins can remove a parent from a dugnad (Foreldre → open the parent → «Fjern fra dugnaden»; admin delete policy on `campaign_parents`, migration `20261121000002`). Their orders, payments and queued emails go, the login stays so they can join again; typing the name is required when they have orders or payments
- 21 Nov 2026, evening: product names keep their capitals in «… av hver *Pals Julekaffe Filtermalt 250g* på 125 kr går til laget» (friend pages and link previews). Footer on every page, also when product information is hidden: «ProDugnad er helt gratis. Hele overskuddet går til laget». The CI run for that push failed once on GitHub's side (port 54322 already in use on the runner, before any test ran); a rerun passed
- 22 Nov 2026: `docs/tekster.md` brought up to date (I14, I15, I29, I30, M20, M21, new screenshots); README test count 45
- 22 Nov 2026: emails: amounts never wrap («250 kr» split over two lines in the digest on a phone): non-breaking space in `kr()` in `_shared/email.ts`, and the amount cells don't wrap and have a small gap on the left
- 22 Nov 2026: installable app with a proper icon (the home-screen shortcut was a small logo on a white circle because there was no manifest): manifest, glass-style icons like the owner's other apps, Apple tags. Chrome's installability check passes on `/` and `/k/…`
- 22 Nov 2026: Foreldre tab has a **Barn** view, now the default (the owner: «we don't really know all the parents»): one card per child, grouped by first name with case and spaces ignored (a capitalised spelling wins), the family's orders, to-team and paid/owed, the parents listed under it, each tappable for the usual details. Two different children with the same first name would share a card
- 22 Nov 2026: admins can give a child their own name for the overview («Emil H.» when two children share a first name): «Endre navn» on a child's card (all its parents) or «Endre» in a parent's details (to split two children). Stored in the admin-only table `child_labels` (migration `20261122000001`, RLS admin only, never sent to parents' phones); parents and friends keep seeing `child_first_name` everywhere. Used on the Foreldre tab and the admins' packing list. Saving the parent's own spelling or nothing removes the label
- 22 Nov 2026: nightly backup of the live database and pictures to the owner's laptop (`scripts/backup.sh`, systemd user timer 23:30, 30 days kept, then the laptop's restic backup to the home server). Only `auth.users`/`auth.identities` from the login schema. Restore tested into the local database: same rows, same totals. See `docs/backup.md`
- 22 Nov 2026: a parent on a Samsung phone got a black screen from the join link. The app needs a 2023 browser (Chrome 111 / Samsung Internet 22, because of Tailwind 4 and Vite 8); in an older one the code doesn't run and dark mode shows the empty page as black. Now `index.html` shows a plain message instead (update the browser, or open the link in Chrome; with the browser's name and version, so we learn what the phone runs) when the page is still empty 3 seconds after loading, on a script error before the first page, or in browsers without modules; `main.tsx` removes it once the app starts. Also: the loading page can no longer get stuck if the login check fails
- 22 Nov 2026: parent page, «Oppgjør med de ansvarlige»: «Du trenger ikke vippse de ansvarlige før varene deles ut» under the title (the owner's wish); the old hint «Betal gjerne samlet når fristen er ute» became «Du kan betale samlet eller i flere deler; skriv D-1 i meldingen hver gang»
- 22 Nov 2026: login email has only the code, no «Logg inn» link. A parent with a work address (Microsoft 365) got «Koden stemmer ikke»: Microsoft's filter opens every link in an email to check it, and Supabase's link and code are the same one-time key, so the filter used the code up. Template `supabase/templates/magic_link.html`; the live one is set in the Supabase dashboard (Authentication → Emails: «Magic link» and «Confirm signup»)
- 22 Nov 2026: the target is labelled as the goal (the owner: make it clear 12 000 is the dugnad's goal): under every progress bar «**2 280 kr** til laget» left and «Mål: **12 000 kr**» right; on the parent page a «Hele dugnaden» heading above the bar (instead of the small «For hele dugnaden» below it), so it's clear which numbers are the parent's own
- 22 Nov 2026: sellers without login (the owner: «some parents don't want to sign up with their email addresses but still just want to buy a certain amount of products»). Planned with Fable. Admins add a child on the Foreldre tab («+ Legg til barn»: child's first name, parent's name and phone optional); it is a `campaign_parents` row with `parent_user_id` null and `offline_name`/`offline_phone` (migration `20261122000002`, RPC `admin_save_seller`, admins only). It gets a D-code; admins enter its orders (new ones start as Egen, the owner's choice) and payments with the normal tools; it counts in all totals, packing lists and the supplier order. Its order link takes no orders (the owner's choice: the parent would never see them): the page shows closed and a trigger refuses friend orders. No emails (all email SQL joins profiles). Admins may now also add/change orders on any parent's page after the lock (the database already allowed it). Not built: letting such a parent take over the row by logging in later (see Ideas)
- 22 Nov 2026: «Beskjed om oppgjør» in Oppsett → Betaling fra foreldre (`campaigns.payment_note`, migration `20261122000003`): the admins' own note above what parents owe, e.g. when and where the products are handed out; replaces the fixed sentence, which is the default; empty = no note
- 22 Nov 2026: the admins' packing list (Pakkeliste for alle foreldre) has Barn / Foreldre like the Foreldre tab, Barn first: each bag shows the child's name (admins' label, capitalised) then the parent, sorted by child so siblings' bags sit together. Still one bag per parent. Each product on its own line in a bag (the owner's wish)
- 25 Nov 2026: receipts (the owner: the confirmation email should look like a receipt). The «paid» email (K3) is now a receipt: KVITTERING, order code and date paid, seller (parent's name, phone, «Dugnad til inntekt for {team}»), buyer, lines with unit price, total, «Betalt med Vipps {date}», «Ikke MVA-pliktig (privatsalg / dugnad)». No signature (an email can't carry one) and no payment method stored (always Vipps). The same receipt is on `/kvittering/<status token>` with a print / save as PDF button, linked from the status page once paid, so friends without email get one too. Friends may give a company name for the receipt when ordering (`orders.receipt_name`, max 80, the owner's choice; cleared by «Slett vennenes navn»). Migration `20261125000001_receipts`. Plain-text emails now separate table cells. Live the same evening (db push, send-emails + daily-digest deployed, git push). Orders marked paid before this got the old «paid» email; their receipt is on the status page
- **Next:** the owner's real test run on a phone with the live campaign (join, order as a friend, tick paid, register payment, lock, close). Owner: set Supabase Auth → Rate Limits → emails per hour to 10.

## Ideas (not built; may never be built)
- A seller without login (added by an admin) who later wants to log in: an admin action «Koble til bruker» that moves the row to their account

- **Ledger CSV for the treasurer**: per parent, amount owed, payments with date and amount (brief §3.1).
- **Reading Vipps screenshots** (brief §3.6): upload screenshots of the Vipps list, OCR in the browser with Tesseract.js, suggested matches by code and amount, confirmed with a tap. Images never leave the phone.

- **Picture of the child with a campaign banner** (owner, 7 Nov 2026): the parent picks a photo of their child, and the app puts the campaign's banner on it (banner text/design set by the admin under Oppsett), ready to share on Facebook/Instagram/Messenger. The photo must never touch the server: it is combined in the browser (`<canvas>`) and only saved or shared from the phone (download / `navigator.share` with a file). Nothing is uploaded or stored.

## Security review (Fable, 7 Nov 2026)

Fixed the same day (migration `20261108000008_review_fixes.sql`, email functions, Pages Functions): email flooding through order links (per link per hour: 20 orders, 10 with email confirmation; 200 friend orders an hour in total; one confirmation per address per day), the email queue (parents' emails first, friends' at most 40 of 90 a day, quota errors go back in the queue, morning round at 06:00 UTC), new functions no longer callable by everyone by default (plus a pgTAP guard), extra stock returned when a given-away order is deleted or shrunk, digest covers orders since the last digest, same-moment double submits, locking in assign_extra, link previews only for preview apps, control characters stripped from names, quoted sender name, no Reply-To when admins are hidden, owner's email removed from this file.
Left on purpose: captcha ("not a robot") on login and ordering. The owner lowers Supabase's login email limit instead.
