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
| Admins | Global (`profiles.is_admin`), one team per install. First admin set by SQL; others added from the admin page after they have logged in once |
| Admin public info | Name, role title and phone (only if opted in) stored on `profiles`, shown on all campaigns |
| Progress bar | Counts all orders, including `own` and `extra` |
| Login link | No visible "Logg inn" on the friend page |
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
| 0.4 | Resend account + domain `substitutor.no` | Martin | |
| 0.5 | DNS at Domeneshop for Resend (+ DMARC) | Martin, rows from Claude | |
| 0.6 | Supabase auth: custom SMTP, site URL, redirect URLs, email template, rate limit | Martin, values from Claude | URLs done; email template needs custom SMTP first |
| 0.7 | Secrets (Resend key for the email function) | Martin | |
| 0.8 | Cloudflare Pages project `produgnad` (https://produgnad.pages.dev) + custom domain | Martin | done 7 Nov (dugnad.substitutor.no) |
| 0.9 | DNS CNAME `dugnad` → `produgnad.pages.dev` | Martin | done 7 Nov |
| 0.10 | Push database, deploy function, first admin, test on phone | Claude | database, function, first admin (martin.prokosch@gmail.com) done 7 Nov |

## Phase 1 (MVP): built 7 November 2026, not yet tested end to end

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

- Phase 2: daily parent digest + keep-alive cron (GitHub Actions), packing list per parent (print), assign extra stock to named buyers
- Phase 3: screenshot matching (Tesseract.js), closing message by email, ledger CSV, data deletion, link previews
