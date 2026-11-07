# Dugnad app: build brief

Build brief for a small web app that runs a Norwegian *dugnad*: a group of supporters of a youth sports team sells coffee and other goods through parents to their friends and family, to raise money for cups, travel and similar.

This file is the full specification. Start by reading it, then propose a short plan (file structure, schema, phase 1 scope) before writing code.

---

## 1. Context and constraints

- **Scale:** a few tens of orders per day, 20–40 parents per campaign, a handful of admins. This is not a professional shop. Keep it simple.
- **Cost:** must run at NOK 0 on free tiers. No paid services.
- **No payment integration.** All money moves through private Vipps transfers between people. The app only tracks who has paid.
- **Organizers:** a group of parents and supporters, not the sports club itself. All texts must say exactly that ("supporters of G2012"). Do not use the club's name or logo in a way that suggests the club runs the sale.
- **Dugnad norms:** transparency is a requirement. Every page and message shows who organizes the sale, who the buyer orders through, and what the money goes to.
- **Language:** UI in Norwegian bokmål. Code, comments and commit messages in English.
- **Formats in the UI:** amounts as `1 440 kr` (space as thousands separator, comma as decimal separator), dates as `20. november 2026`.
- **Mobile first.** Most friends will open the link from Messenger, WhatsApp or SMS on a phone.

---

## 2. Users and money flow

| Role | Login | Pays / receives |
|---|---|---|
| **Admin** | Email magic link | Receives one Vipps payment per parent, to the admin's private Vipps |
| **Parent** | Email magic link | Receives Vipps from friends, pays the admin once for everything ordered under their link |
| **Friend** | None | Pays the parent by Vipps, using an order code in the message |

```
Friend --(Vipps, message "K7")--> Parent --(one Vipps, message "D-14")--> Admin
Admin --(goods)--> Parent --(goods, by packing list)--> Friend
```

---

## 3. Features

### 3.1 Admin

- Create and edit a **campaign**: name, organizer label ("Foreldre og supportere av G2012"), purpose text, target amount, order deadline, Vipps number for parent payments, share text templates, closing message.
- Manage **products** per campaign: name, short description, price, amount per unit that goes to the team, active flag, sort order, and **one or more pictures** (section 3.8).
- Manage **admin profiles**: name, role title (for example "kasserer", "koordinator"), optional public phone number (admin chooses whether it is shown).
- See **all orders** across parents, with filters by parent, status and type.
- See **per-parent totals**: amount owed, amount paid, difference.
- Mark parent payments manually, or via **screenshot matching** (section 3.6).
- **Lock** the campaign once goods are ordered from the supplier. After the lock, parents cannot add or change orders.
- **Supplier total:** sum per product across all parents.
- Mark goods as **sent to a parent**.
- Print-friendly **packing list per parent**.
- Send the **closing message** (amount raised, what it pays for).
- **Export** a ledger per campaign as CSV: parent, amount owed, payments with date and amount.

### 3.2 Parent

- Register for a campaign: name (as it appears in Vipps), phone (shown to friends as the Vipps recipient), email, child's first name.
- Gets a **personal order link** (`/k/<parent-code>`) and a **payment code** for paying the admin (for example `D-14`).
- **Order list:** all orders under their link, with status, code and amount.
- **Add order**, with three types:

| Type | Use | Payment status | Packing list |
|---|---|---|---|
| `friend` | Orders taken by text, phone or at the door | Unpaid, or "paid on entry" | Under the friend's name |
| `own` | The parent's own household | None (not tracked) | "Egen" |
| `extra` | Stock to sell later | None until sold | "Ekstra" |

- **Assign extra stock:** take units from an `extra` order and create a `friend` order with a name. The extra quantity goes down accordingly.
- Edit or delete orders until the campaign is locked.
- Tick **"betalt"** per friend order, or use screenshot matching on their own Vipps history.
- See **amount owed to admin**, with payment instructions: "Vipps 1 440 kr til <admin> <phone>, melding D-14".
- Mark a friend order as **delivered**.
- **Share texts** (section 3.5).

### 3.3 Friend (no login)

The order page behind the parent's link is one screen:

1. Header with the organizer, the purpose, the parent ("Du bestiller via Ola Hansen, pappa til Emma") and a progress bar.
2. Products as cards with picture, name, short description, price and + / – buttons, and a running total. Tapping a picture opens it larger (and shows further pictures, if any).
3. **First name** (the only required field).
4. "Bestill" button.
5. Collapsed below the button: "Vil du ha bekreftelse på e-post?" with an email field.

After ordering, the friend sees:

- Payment instructions: "Vipps **240 kr** til **Ola Hansen, 912 34 567**, melding **K7**", with copy buttons for amount, number and code.
- A status link. Also save the order in the browser (localStorage), so that reopening the parent's link on the same device shows "Din bestilling K7: ikke betalt / betalt / på vei / levert".

**Friend order status:** `registrert` → `betalt` (parent ticks) → `på vei` (admin marks goods sent to parent) → `levert` (parent marks delivered).

### 3.4 Transparency (every page and message)

- Organizer label and admin names, with phone numbers only where the admin has opted in.
- The parent the friend orders through.
- Purpose: "Alt overskudd går til cupavgifter og reiser for laget i 2027."
- Amount to the team per unit: "50 kr av hver pose på 120 kr går til laget."
- Progress: "18 400 kr samlet inn av 30 000 kr", calculated from all orders in the campaign (sum of qty × to-team amount).
- After the campaign: the closing message on all status pages.

### 3.5 Share texts (parent)

- Generated from **admin-written templates**, not AI. Placeholders: `{barn}`, `{lag}`, `{produkter}`, `{frist}`, `{lenke}`, `{forelder}`, `{beløp}`, `{kode}`, `{vipps}`.
- Two lengths: short (SMS, chat) and long (Facebook post).
- The parent can edit the text before sharing.
- **"Del"** opens the phone's share menu via `navigator.share`. Fall back to a "Kopier" button.
- **QR code** of the parent's link, generated in the browser, printable.
- **Deadline reminder** text, shown from three days before the deadline.
- **Payment reminder per unpaid friend order:** "Hei Kari! Bestillingen din K7 er 240 kr. Vipps til 912 34 567 med melding K7. Takk!"

Example short template (output):

> Hei! Emma i G2012 selger kaffe for å samle inn penger til cuper. 500 g kaffe koster 120 kr. Bestill innen fredag 20. november her: [lenke]. Tusen takk for støtten!

### 3.6 Screenshot matching (admin and parent)

Private Vipps has no export file. The user uploads one or more screenshots of their Vipps transaction list. The Vipps list shows the message (order code) next to the sender's name.

- Run OCR **in the browser** with Tesseract.js (Norwegian language data). **Images must never be uploaded or stored.** Store only confirmed results: code, amount, date, matched order or parent.
- Parse each line into name, message and amount.
- Match rules, in order:
  1. Code and amount both match → suggested match, high confidence.
  2. Code matches, amount differs → flag as partial payment or overpayment.
  3. Name and amount match, no code → suggested match, low confidence.
  4. Nothing matches → list as unmatched.
- The user **confirms each match with a tap**. Nothing is marked paid automatically.
- A parent can pay the admin in several transfers. Sum payments against the amount owed.
- Calibrate the parser on screenshots made with dummy transfers between the team's own phones. Do not commit real screenshots to the repo.

### 3.7 Emails

| Trigger | Recipient | Rule |
|---|---|---|
| Friend places order | Friend | Only if the friend opted in |
| Parent marks friend order paid | Friend | Only if the friend opted in |
| New orders that day | Parent | Daily digest at 20:00 Oslo time, only on days with activity: new orders, total, unpaid friends, link |
| Admin confirms parent payment | Parent | Always |
| Goods sent to parent | Parent | Always, with link to packing list |
| Closing message | Parents | Once per campaign |
| Magic link login | Admin, parent | On request |

All emails include the organizer label and the purpose line. Keep total volume well under 100 per day (Resend free tier).

### 3.8 Product pictures

- Admins upload pictures per product from the admin page, from phone camera or file. First picture is the main picture; admin can reorder and delete.
- **Resize and compress in the browser before upload:** longest side 1 200 px, WebP (JPEG fallback), target under 200 kB. Also generate a thumbnail (400 px) for the order page.
- Store in a **public Supabase Storage bucket** (`product-images`). Only admins can upload, replace or delete (storage policies).
- Show the main picture on the order page, in share previews (Open Graph, phase 3, fall back to the first product's main picture if the campaign has no image) and optionally in the friend confirmation email.
- Use own photos or pictures the supplier allows us to use.

---

## 4. Stack (all free tiers)

| Part | Service | Notes |
|---|---|---|
| Frontend hosting | Cloudflare Pages | Static SPA. Pages Functions only if needed for link previews (phase 3) |
| Database, auth, server logic, file storage | Supabase, EU region | Postgres, Row Level Security, magic link auth, Edge Functions, Storage for product pictures (free tier: 1 GB, checked 7 November 2026) |
| Email | Resend | Free tier: 100 per day, 3 000 per month (checked 7 November 2026). Sends from the `substitutor.no` domain (section 4.1) |
| Scheduled jobs | GitHub Actions cron | Calls an Edge Function at 20:00 Oslo time for digests. Doubles as keep-alive, since Supabase pauses free projects after 7 days of low activity |
| Frontend | Vite + React + TypeScript + Tailwind | Suggestion. Propose an alternative if simpler |
| OCR | Tesseract.js | Runs in the browser |
| QR | Any small client-side QR library | |

**Verify at build time:** current free-tier limits; whether Supabase's built-in email sender still only sends to project team members (if so, configure Resend as custom SMTP for auth emails); Cloudflare Pages Functions free limits.

### 4.1 Domain: substitutor.no (registered at Domeneshop)

DNS stays at Domeneshop. Use subdomains so nothing else on the domain is affected:

| Use | Address | DNS record at Domeneshop |
|---|---|---|
| App | `dugnad.substitutor.no` | CNAME to the Cloudflare Pages project (`<project>.pages.dev`), then add it as a custom domain in Cloudflare Pages |
| Email sending | From `dugnad@substitutor.no`, sending via a Resend subdomain (for example `send.substitutor.no`) | The SPF, DKIM and MX/TXT records Resend shows when the domain is added. Add a DMARC TXT record if none exists |

- Using a subdomain for the app means the nameservers do not have to move to Cloudflare. Only the apex domain (`substitutor.no` itself) would require that.
- `substitutor.no` has no mailbox and no existing email setup (confirmed by Martin, 7 November 2026), so there are no email records to preserve. Still check the current DNS records at Domeneshop before adding new ones.
- Since no one can receive mail at `dugnad@substitutor.no`, set **Reply-To** on every email to the campaign's contact admin (an admin email chosen in the campaign setup). The email footer also names the contact admin.
- Sender name in emails: "<organizer label> via Dugnad", for example "Supportere av G2012 via Dugnad".
- Walk Martin through the exact records to add at Domeneshop. Do not ask for his Domeneshop login.

---

## 5. Data model (proposal)

```
campaigns        id, name, organizer_label, purpose_text, target_amount, deadline,
                 admin_vipps_name, admin_vipps_phone, contact_admin_id (Reply-To),
                 locked_at, closed_at,
                 share_template_short, share_template_long, reminder_template,
                 payment_reminder_template, closing_message, og_image_url

products         id, campaign_id, name, description, price, to_team_amount,
                 active, sort_order

product_images   id, product_id, storage_path, thumb_path, width, height,
                 sort_order (0 = main picture), created_at

profiles         user_id (auth), role ('admin' | 'parent'), name, phone, email,
                 role_title, show_phone_public

campaign_parents id, campaign_id, parent_id, child_first_name,
                 link_code (for /k/<code>), payment_code (e.g. 'D-14'),
                 goods_sent_at

orders           id, campaign_id, campaign_parent_id, code (unique per parent, e.g. 'K7'),
                 type ('friend' | 'own' | 'extra'), buyer_first_name, note,
                 email (nullable), wants_email, status_token (random, unguessable),
                 paid_to_parent_at, delivered_at, created_by ('friend' | 'parent'),
                 created_at, deleted_at

order_lines      id, order_id, product_id, qty, unit_price, unit_to_team
                 (snapshot prices at order time)

parent_payments  id, campaign_parent_id, amount, paid_on, source ('manual' | 'screenshot'),
                 ocr_line_text, confirmed_by, confirmed_at

email_log        id, kind, recipient, campaign_id, sent_at
```

Codes: short, unambiguous characters only (no O/0, I/1).

---

## 6. Security and privacy

- **Row Level Security** on all tables. Admins see everything in their campaigns. Parents see only their own `campaign_parents` row and its orders.
- **Storage:** `product-images` bucket is public read. Insert, update and delete only for admins. Accept image types only, max 5 MB before compression.
- **Friends have no account.** Create orders through an Edge Function or a `security definer` RPC that validates the parent link and that the campaign is open and not locked.
- Read friend order status only by `status_token`. Never expose a list of orders on the public page.
- Basic abuse protection: honeypot field, maximum quantity per order line, block double submit.
- **Data minimization:** most friends give only a first name. Email is optional and used only for that order's emails.
- **Privacy notice** (short, on the order page): who collects the data, what for, that it is deleted after the campaign.
- **Deletion:** admin action to delete friend emails and anonymize names after the campaign closes. Keep only totals and the ledger.
- Admin names and phone numbers are public on the pages. Show them only with each admin's consent (`show_phone_public`).
- Secrets in environment variables only. No real personal data or Vipps screenshots in the repo. Use dummy data for development and tests.

---

## 7. Phases

### Phase 0: setup
Accounts (Supabase EU, Cloudflare, Resend, GitHub), DNS records at Domeneshop for `dugnad.substitutor.no` and Resend (section 4.1), repo, environments, seed script with dummy campaign, products with placeholder pictures, parents and orders.

### Phase 1: run a dugnad (MVP)
- Campaign and product setup (admin), including product picture upload with in-browser compression
- Parent registration, personal link, payment code
- Friend order page with first-name-only ordering, payment instructions, status link and localStorage
- Parent page: order list, add order (three types), tick paid, edit/delete, amount owed
- Admin overview: all orders, per-parent totals, manual "parent paid"
- Transparency elements and progress bar
- Short and long share texts with share menu and copy
- Opt-in friend confirmation email

**Done when:** a dummy campaign runs end to end on a phone. A friend orders with first name only, the parent ticks paid, the admin registers the parent payment, and all totals match.

### Phase 2: operations
- Daily parent digest and keep-alive cron
- Emails: payment confirmed, goods sent, friend "paid" (opt-in)
- Campaign lock, supplier total, packing lists (print-friendly)
- Assign extra stock to named buyers
- Deadline reminder and payment reminder texts, QR code

### Phase 3: reconciliation and wrap-up
- Screenshot matching for admin and parents
- Closing message on status pages and by email
- Ledger CSV export
- Data deletion after campaign
- Link preview (Open Graph image and title) for shared links

### Out of scope
Payment integration, SMS, native apps, multiple clubs or teams in one install, inventory beyond the `extra` order type.

---

## 8. Working instructions for Claude Code

- Read this whole file first. Propose a plan and file structure, and wait for approval before building phase 1.
- Ask before creating external accounts, buying anything or deploying.
- Keep dependencies few. Prefer platform features over libraries.
- Write SQL migrations for the schema and RLS policies, and test the policies with all three roles.
- After each phase, give a short list of what was built, how to test it on a phone, and anything that deviates from this brief.
