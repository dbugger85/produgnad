# ProDugnad – notes for Claude

A small web app for a Norwegian youth-sports *dugnad*. Friends order through a parent's link with only a first name and pay the parent by Vipps; parents pay the admin; the app only keeps track. Live at https://dugnad.substitutor.no (Cloudflare Pages project `produgnad`, Supabase project `nnqpdzqzwzhogcbzriyn` in London, Resend domain `substitutor.no`). Public repo `dbugger85/produgnad`.

Read `docs/brief.md` (original spec), `docs/plan.md` (decisions, log, ideas, security review) and `docs/tekster.md` (every text with screenshots) before larger changes.

## Rules
- UI text in Norwegian bokmål; code, comments, commit messages in English. Friends are "venner" (never "kunder").
- Formats: amounts `1 440 kr` via `kr()`, phone `+47 912 34 567` via `phone()` (non-breaking spaces), dates `20. november 2026` via `longDate()`, all in `src/lib/format.ts`. Write "e‑post" with a non-breaking hyphen (U+2011) so it never wraps.
- Every public page and email shows the organizer label ("Foreldre og supportere av Ready G2018 … ikke av klubben direkte"), the parent and the purpose. Who sees the progress bar, the contribution per product and the admins is a per-campaign setting (`progress_visibility`, `contribution_visibility`, `admins_visibility`: none / parents / all, default parents), enforced in `campaign_public_json` / `campaign_products_json` via `visible_to_viewer()`, so hidden data never reaches the phone.
- Friends' pages (`/k/`, `/status/`) load through `publicClient` (no login), so parents and admins see exactly what friends see.
- No full stop after the last sentence of any text (labels, hints, notices, errors, paragraphs, emails); full stops only between sentences. Share templates (J) are the parents' own messages and keep theirs
- Never the browser's own `alert`/`confirm`/`prompt`: use `useConfirm()` from `components/Confirm.tsx`. The confirm button says what happens ("Slett", "Lås"), `danger: true` for deleting.
- Look: Substitutor-like but light: warm off-white page with a still colour glow, navy `brand` #002e5f from ready.no, PRO in the name faded navy (`text-brand/40`), white cards with a thin edge (no blur), `Logo`/`Brand`/`Title` in `components/ui.tsx` (Barlow Condensed titles, Inter text, fonts in `public/fonts`). Tokens in `src/index.css`. Logo = shopping bag with heart (`public/logo.svg`); email logo `public/email-logo.png`.
- Standard product pictures (kaffe, te, sokker) when a product has none: `src/lib/defaultPictures.ts`, `public/defaults/` (SVG + 1200×630 PNG for previews). Uploaded large pictures are JPEG (WhatsApp doesn't preview WebP), thumbnails WebP.
- No real personal data or Vipps screenshots in the repo. Dummy data only (`scripts/seed.mjs`).
- Ask the owner before creating accounts, deploying or pushing. The owner says "push" / "put it live"; small UI fixes during their live testing have been pushed directly.

## Security model
- Friends (anon) never touch tables; only `public_campaign_by_link`, `public_campaign_by_join`, `order_status_by_token`, `create_friend_order`. A pgTAP guard (`supabase/tests/rls_enabled.test.sql`) fails if anon can execute any other function, if a table has RLS off, or if anon has table rights.
- New SQL functions: `alter default privileges for role postgres` revokes PUBLIC execute (migration 8), but still add explicit `revoke … from public, anon, authenticated` and `grant` what's needed.
- Parents read their own rows through RLS; all parent writes go through functions (`join_campaign`, `save_order`, `set_order_paid`, `set_order_delivered`, `set_order_packed`, `delete_order`, `assign_extra`) that check ownership and the lock. Orders given away from extra stock move units back/forth (`move_extra_units`).
- Admins (`profiles.is_admin`) read and write everything; one team per install. `invite-admin` Edge Function adds admins (checks the caller's JWT itself).
- Friend order limits per link per hour: 20 orders, 10 with email; 200 friend orders/hour in total; one confirmation per email address per day. Names are stripped of control characters by a trigger.
- Errors from SQL are short codes (`CAMPAIGN_LOCKED` …) translated in `src/lib/errors.ts`.
- Emails: SQL inserts rows in `email_outbox` (unique `dedupe_key`); `_shared/outbox.ts` drains it via `claim_outbox` (max 90/day; parents' emails first, friend confirmations max 40/day; Resend quota errors go back to the queue via `release_outbox`). Without `RESEND_API_KEY` it only logs (dry run). Login emails are sent by Supabase directly (owner sets its rate limit).
- New table? Enable RLS, revoke from anon, add policies, and add cases to `tests/rls.test.mjs`.

## Commands
`npm run db:start` (Docker), `npm run db:reset`, `npm run seed`, `npm run dev`, `npm test`, `npm run test:db`, `npx supabase test db`, `npm run build`.
Live: `npx supabase db push --remote --yes`, `npx supabase functions deploy <name> --no-verify-jwt --use-api --yes` (send-emails, daily-digest, invite-admin), SQL `npx supabase db query --remote [--read-only|--yes] "…"`; the frontend deploys on `git push` (Cloudflare Pages). Link previews locally: `npx wrangler pages dev dist`.
Screenshots of every page for `docs/tekster.md`: Playwright from `~/Work/substitutor/node_modules/playwright-core` with `/usr/bin/chromium`, logging in with seed users by putting their session in localStorage (`sb-127-auth-token`).

## Where things are
- `supabase/migrations/`: schema → functions/views → RPCs → RLS/grants/storage, then digest, extra stock, visibility settings, per-parent totals, closing/anonymize, review fixes, packing ticks
- `supabase/functions/`: `send-emails`, `daily-digest` (20:00 Oslo + 07:00 morning round, `.github/workflows/daily.yml`, also keep-alive), `invite-admin`; `_shared/email.ts` (all email texts), `_shared/outbox.ts` (sending)
- `functions/` (Cloudflare Pages Functions) + `functions-lib/preview.ts`: link previews for `/k/<code>` and `/bli-med/<code>`, only for preview apps (`isPreviewBot`); texts built by `src/lib/linkPreview.ts`, shared with the preview card on the parent page
- `src/pages/FriendOrderPage.tsx` (the page most people see), `OrderStatusPage.tsx`, `PackingPage.tsx`, `src/pages/parent/`, `src/pages/admin/` (`AdminHome`, `CampaignPage` with tabs Oversikt/Foreldre/Bestillinger/Varer/Oppsett, `PeoplePage` = Innstillinger, `PersonsPage` = Personer)
- `src/lib/pageCache.ts`: pages remember their last data (instant back navigation); `App.tsx` preloads page code after start (not on friends' pages); `Loading` shows the page's top bar at once and grey placeholder blocks (fade in after 150 ms) instead of a "Laster" screen; pass `title`/`back` so the bar matches the page; `ErrorBoundary` reloads once after a deploy instead of a grey page
