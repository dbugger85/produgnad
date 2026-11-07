# ProDugnad

A small web app for a Norwegian *dugnad*: parents of a youth sports team sell coffee (and other goods) to friends and family. Friends order through a parent's personal link with only a first name and pay the parent by Vipps. Parents pay the admin once. The app only keeps track; no money goes through it.

- Live (when deployed): https://dugnad.substitutor.no
- UI in Norwegian bokmål; code, comments and commits in English
- Full specification: [docs/brief.md](docs/brief.md); build plan: [docs/plan.md](docs/plan.md)

## Stack

Vite + React + TypeScript + Tailwind (frontend, hosted on Cloudflare Pages), Supabase in the EU (database, login, picture storage, one email function), Resend (email). Everything runs on free tiers.

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
npm run test:db   # security tests against the local database: friend, parent and admin
npx supabase test db   # guard: every table has row level security
```

GitHub Actions runs all of them on every push.

## Pages

| Address | Who | What |
|---|---|---|
| `/k/<code>` | Friends | Order through a parent's link |
| `/status/<token>` | Friends | Status of one order |
| `/bli-med/<code>` | Parents | Sign up as a seller in a campaign |
| `/logg-inn` | Parents, admins | Login with a 6-digit code (or the link in the email) |
| `/forelder/<id>` | Parents | Link, share texts, QR code, orders, amount owed |
| `/admin` | Admins | Campaigns, products with pictures, parents, payments, lock |
