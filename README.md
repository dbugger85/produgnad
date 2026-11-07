# ProDugnad

A small web app for a Norwegian *dugnad*: parents of a youth sports team sell coffee (and other goods) to friends and family. Friends order through a parent's personal link with only a first name and pay the parent by Vipps. Parents pay the admin once. The app only keeps track; no money goes through it.

- Live: https://dugnad.substitutor.no
- UI in Norwegian bokmål; code, comments and commits in English
- Full specification: [docs/brief.md](docs/brief.md); decisions and log: [docs/plan.md](docs/plan.md); every text with screenshots: [docs/tekster.md](docs/tekster.md)

## Stack

Vite + React + TypeScript + Tailwind (frontend, hosted on Cloudflare Pages, with small Pages Functions for link previews), Supabase (database, login, picture storage, Edge Functions for email and admin invitations), Resend (email). A GitHub Actions job sends the daily parent digest and keeps the free Supabase project awake. Everything runs on free tiers.

## Run it on this computer

Needs Docker (for the local database) and Node.

```bash
npm install
npm run db:start          # starts a local Supabase in Docker (first time takes a few minutes)
npm run db:status         # shows the local URL and keys
cp .env.example .env.local   # paste API URL and anon key from db:status
npm run db:reset          # builds the database from supabase/migrations
npm run seed              # dummy campaign, parents and orders
npm run dev               # http://localhost:5173
```

Login emails don't leave your computer locally: open the mail viewer at http://127.0.0.1:54324 to see the code. The seed script prints the links to try.

To test on a phone on the same wifi, use the laptop's IP address instead of `localhost` (the dev server listens on the network), and put that IP in `VITE_SUPABASE_URL` too.

## Tests

```bash
npm test          # formatting and share-text tests
npm run test:db   # security tests against the local database: friend, parent and admin (41)
npx supabase test db   # guard: every table has row level security, friends can only call the public functions
```

GitHub Actions runs all of them on every push.

## Pages

| Address | Who | What |
|---|---|---|
| `/k/<code>` | Friends | Order through a parent's link; Vipps instructions afterwards |
| `/status/<token>` | Friends | Status of one order |
| `/bli-med/<code>` | Parents | Sign up as a seller in a campaign |
| `/logg-inn` | Parents, admins | Login with a code from email (or the link in the email) |
| `/forelder/<id>` | Parents | Money to the team via them, their link with share texts, link preview and QR, amount owed with Vipps, orders |
| `/forelder/<id>/ny`, `/ordre/<id>`, `/fra-ekstra/<id>` | Parents | New or edit order (Venn / Egen / Ekstra), give extra stock to a friend |
| `/pakkeliste/<id>` | Parents, admins | Packing list per friend, ticked on the phone |
| `/admin` | Admins | Campaigns I sell in, campaigns I administer, Personer |
| `/admin/d/<id>` | Admins | One campaign: Oversikt (progress, sign-up link, supplier totals, lock, close, closing email, delete friends' data), Foreldre (payments, goods sent, packing lists), Bestillinger, Varer (with pictures), Oppsett (texts, what friends see) |
| `/admin/personer` | Admins | Everyone in the app; make or remove admins |
| `/admin/folk` | Admins | Innstillinger: own profile, admins, invite an admin by email |

## Emails

All in Norwegian, from `dugnad@substitutor.no` via Resend: login code (Supabase template), friend's order confirmation and "paid" (opt-in), payment registered, goods sent, daily digest at 20:00 (only on days with new orders), closing message, admin invitation. They go through a queue (`email_outbox`): max 90 a day, parents' emails first.
