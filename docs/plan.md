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
| What friends see | Setting per campaign under Oppsett → Hva som vises: Fremdrift, Bidrag per vare, Ansvarlige og kontakt; each Ikke vist / Bare foreldre og admin (default) / Alle. Friend emails reply to the contact admin only with Ansvarlige = Alle, else to the parent (owner, 7 Nov; deviates from the brief's transparency list) |
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
- **Next:** the owner's real test run on a phone with the live campaign (join, order as a friend, tick paid, register payment, lock, close). Owner: set Supabase Auth → Rate Limits → emails per hour to 10.

## Ideas (not built; may never be built)

- **Ledger CSV for the treasurer**: per parent, amount owed, payments with date and amount (brief §3.1).
- **Reading Vipps screenshots** (brief §3.6): upload screenshots of the Vipps list, OCR in the browser with Tesseract.js, suggested matches by code and amount, confirmed with a tap. Images never leave the phone.

- **Picture of the child with a campaign banner** (owner, 7 Nov 2026): the parent picks a photo of their child, and the app puts the campaign's banner on it (banner text/design set by the admin under Oppsett), ready to share on Facebook/Instagram/Messenger. The photo must never touch the server: it is combined in the browser (`<canvas>`) and only saved or shared from the phone (download / `navigator.share` with a file). Nothing is uploaded or stored.

## Security review (Fable, 7 Nov 2026)

Fixed the same day (migration `20261108000008_review_fixes.sql`, email functions, Pages Functions): email flooding through order links (per link per hour: 20 orders, 10 with email confirmation; 200 friend orders an hour in total; one confirmation per address per day), the email queue (parents' emails first, friends' at most 40 of 90 a day, quota errors go back in the queue, morning round at 06:00 UTC), new functions no longer callable by everyone by default (plus a pgTAP guard), extra stock returned when a given-away order is deleted or shrunk, digest covers orders since the last digest, same-moment double submits, locking in assign_extra, link previews only for preview apps, control characters stripped from names, quoted sender name, no Reply-To when admins are hidden, owner's email removed from this file.
Left on purpose: captcha ("not a robot") on login and ordering. The owner lowers Supabase's login email limit instead.
