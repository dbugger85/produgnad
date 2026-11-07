# ProDugnad – notes for Claude

Read `docs/brief.md` (the spec) and `docs/plan.md` (approved plan, decisions log) before larger changes.

## Rules
- UI text in Norwegian bokmål; code, comments, commit messages in English.
- Formats: amounts `1 440 kr` via `kr()` in `src/lib/format.ts`; dates `20. november 2026` via `longDate()`.
- Every public page and email shows the organizer label ("…supportere av Ready G2018", never the club as organizer), the parent, and the purpose. Who sees the progress bar, the per-product contribution and the admins (names, roles, phone only if `show_phone_public`) is a per-campaign setting (`progress_visibility`, `contribution_visibility`, `admins_visibility`: none / parents / all, default parents), enforced in `campaign_public_json` and `campaign_products_json` via `visible_to_viewer()`, so hidden data never reaches the phone (owner, 7 Nov 2026).
- Short labels, hints and button side-texts end without a full stop.
- Never the browser's own `alert`/`confirm`/`prompt`: use `useConfirm()` from `components/Confirm.tsx` (owner, 7 Nov 2026). The confirm button says what happens ("Slett", "Lås"), `danger: true` for deleting.
- Look: borrowed from Substitutor but kept light (owner, 7 Nov 2026): warm off-white page with a still colour glow, navy `brand` from ready.no (#002e5f, owner 7 Nov 2026: to tell it apart from Substitutor), PRO in the name is faded navy (`text-brand/40`, owner's choice), gold glow, white cards with a thin edge (no blur), `Logo`/`Brand`/`Title` in `components/ui.tsx` (Barlow Condensed uppercase titles, Inter text, fonts in `public/fonts`). Colours are Tailwind tokens in `src/index.css` (`brand`, `brand-bright`, `gold`, `cream`, `line`, `ink`, `muted`); logo = shopping bag with heart (`public/logo.svg`).
- No real personal data or Vipps screenshots in the repo. Dummy data only (`scripts/seed.mjs`).
- Ask the owner before creating accounts, deploying or pushing.

## Security model
- Friends (anon) never touch tables. They use three `security definer` functions: `public_campaign_by_link`, `create_friend_order`, `order_status_by_token` (plus `public_campaign_by_join`).
- Parents read their own rows through RLS; all parent writes go through functions (`join_campaign`, `save_order`, `set_order_paid`, `set_order_delivered`, `delete_order`) that check ownership and the lock.
- Admins (`profiles.is_admin`) read and write everything. One team per install, so admins see all campaigns.
- Errors from SQL are short codes (`CAMPAIGN_LOCKED` …) translated in `src/lib/errors.ts`.
- Emails: SQL inserts rows in `email_outbox` (unique `dedupe_key`); the Edge Function `send-emails` renders and sends them via Resend, max 90 per day. Without `RESEND_API_KEY` it only logs (dry run).
- New table? Enable RLS, revoke from anon, add policies, and add cases to `tests/rls.test.mjs`. `supabase/tests/rls_enabled.test.sql` fails if RLS is off anywhere.

## Commands
`npm run db:start`, `npm run db:reset`, `npm run seed`, `npm run dev`, `npm test`, `npm run test:db`, `npx supabase test db`, `npm run build`.

## Where things are
- `supabase/migrations/` schema → functions/views → RPCs → RLS/grants/storage
- `supabase/functions/send-emails` + `_shared/email.ts` email texts
- `src/pages/FriendOrderPage.tsx` the page most people see
- `src/pages/parent/`, `src/pages/admin/`
- `functions/` (Cloudflare Pages Functions) + `functions-lib/preview.ts`: link previews (Open Graph) for `/k/<code>` and `/bli-med/<code>`, filled in before the app loads; default tags and `og-default.png` in `index.html`. Test locally with `npx wrangler pages dev dist`
- `supabase/functions/invite-admin`: admins add an admin by email (creates the user if needed, sets is_admin, queues an `admin_invite` email); checks the caller's JWT itself (deployed with --no-verify-jwt)
- `supabase/functions/daily-digest` + `.github/workflows/daily.yml`: parent digest at 20:00 Oslo time and keep-alive; `_shared/outbox.ts` sends the email queue
