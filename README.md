# Houz of Vybe — event ticketing platform

Event website and QR ticketing system for **Houz of Vybe**, Hyderabad. The site is built around
one flagship event — **OFF Campus, Freshers '26**, at Kingdome Klub & Kitchen in the Financial District on Saturday
12 September 2026, 12 PM to 5 PM. Customers pick a ticket, optionally apply a referral code, pay
through Razorpay, and receive a cryptographically signed QR pass by email within seconds. Door
staff scan it with a phone camera.

Built as a single Next.js application: marketing site, booking flow, checkout, ticket delivery
and the admin/door console all ship together.

---

## The intro

`/` opens with the event artwork drawing itself — the chain heart, the wordmark,
the cherries — before the landing page appears. It is in
`components/site/PosterIntro.tsx` and is deliberately cheap to escape:

- **once per browser session**, not per page view
- **any click, tap, key or scroll** skips it
- **`prefers-reduced-motion`** removes it before it ever paints
- **no JavaScript** removes it too, via the `<noscript>` rule in the layout

The overlay is server-rendered so there is no flash of the page behind it. A tiny
inline script in `app/layout.tsx` sets a flag on `<html>` before first paint, and
CSS hides the overlay in the same paint for anyone who has already seen it —
React cannot un-render markup it has not hydrated yet, which is why that check is
not component state.

It is on the landing page only. An intro in front of a checkout is sabotage.

---

## Payments

Payments run through **Razorpay** and are gated on `PAYMENTS_ENABLED`.

**With the flag on** (the intended production setting):

1. `POST /api/bookings` creates the booking as `pending`, reserving tier inventory and claiming
   any referral code inside the same transaction.
2. The browser is sent to **`/pay/<reference>`**, which shows the order and opens Razorpay
   Checkout.
3. `POST /api/payments/razorpay/order` creates the Razorpay order server-side from
   `bookings.amount_paise` — the price is never taken from the client.
4. On success the browser calls `POST /api/payments/razorpay/verify`, which recomputes the HMAC
   over `order_id|payment_id`. Only a matching signature promotes the booking to `confirmed`,
   mints the tickets and sends the email.
5. `POST /api/payments/razorpay/webhook` is the safety net for a customer who pays and then
   closes the tab. It hashes the **raw** request body and is idempotent, so a replayed
   `payment.captured` never issues a second set of passes.

**With the flag off**, `createBooking()` confirms and ticket-mints immediately and nothing is
charged. Both paths mint through the same function, so a pass issued in either mode is identical.

### Going live on Vercel

1. Set `PAYMENTS_ENABLED=true`.
2. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (Dashboard → Settings → API Keys).
3. Add a webhook at `https://<your-domain>/api/payments/razorpay/webhook` for `payment.captured`
   and set `RAZORPAY_WEBHOOK_SECRET` to the secret you chose there.
4. Redeploy. Nothing else changes — the CSP in `next.config.mjs` already allows
   `checkout.razorpay.com`.

No key is exposed to the browser beyond the publishable `key_id`, which the order endpoint
returns per request rather than baking into the bundle.

---

## Direct UPI (manual reconciliation)

An alternative rail for collecting money without a gateway, gated on
`UPI_ENABLED` and `UPI_VPA`. It can run alongside Razorpay or on its own.

1. `/pay/<reference>` renders a QR encoding
   `upi://pay?pa=…&pn=…&am=…&cu=INR&tr=<reference>&tn=…`.
2. The customer pays from their own UPI app and types the 12-digit UTR back in.
3. `POST /api/payments/upi/claim` records the claim. **It does not confirm the
   booking.**
4. An operator finds the payment in their bank or UPI app and approves it at
   `/admin/payments`, which mints the passes and emails them.

### Why step 4 exists

A UTR is a number the customer types. There is no signature to verify and no
callback to trust, so nothing in software can tell a real reference from twelve
invented digits. Issuing tickets on submission would hand a free pass to anyone
who typed a number, so a claim only ever parks the order in a queue.

The one control that does exist is a partial unique index: a given UTR backs at
most one live claim, so the same reference cannot be spent twice. Rejected
claims are excluded from it, so a genuine payer whose first attempt was refused
can resubmit.

Some deliberate details:

- **The QR is generated server-side** from `bookings.amount_paise`, using the
  `qrcode` package already in the tree. No QR library reaches the browser, and
  a tampered client cannot render a ₹1 code and then claim the real order.
- **`tr` carries the booking reference**, not `tn`. `tr` is the merchant
  transaction reference and is what appears in the payee's statement, which is
  the entire basis for matching a payment later.
- **The amount is formatted to exactly two decimals.** `500.5` has been seen to
  render as ₹500.50 in one PSP and ₹500.05 in another.
- **Approving reuses `confirmPendingBooking`**, the same transaction the gateway
  uses, so a UPI pass is identical to a Razorpay one.
- **Rejecting returns the booking to payable** so the customer can try again.

If nobody is going to watch `/admin/payments`, leave `UPI_ENABLED=false`.
Bookings on this rail hold inventory and have no passes until someone acts.

---

## Referral codes

A referral code takes a **flat amount off the whole order**, not a percentage and not per ticket.
`KAVYANSH100` is seeded first and gives ₹100 off.

- Codes live in the `referral_codes` table: `code`, `discount_paise`, `active`, optional
  `max_uses`, `starts_at`, `expires_at`.
- Matching is case-insensitive; codes are stored and compared upper-case.
- `POST /api/referrals/validate` powers the live preview in the booking form. It is rate limited,
  because "does this code exist?" is the question a code-guessing script asks.
- The **binding** discount is recomputed inside the booking transaction with
  `SELECT … FOR UPDATE`, so two people racing for the last use of a limited code cannot both win,
  and a stale preview can never set the price.
- A discount is clamped to the order value — a ₹100 code on an ₹80 order is ₹80 off, never a
  refund.
- A bad code costs the discount, never the booking: the order still goes through at full price and
  the response says the code was refused and why.

Add another code with:

```sql
INSERT INTO referral_codes (code, label, discount_paise, max_uses)
VALUES ('SOMECODE', 'Who it belongs to', 10000, 200);
```

---

## Architecture

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router), React 19 | One deployable for site + API + admin |
| Styling | Tailwind CSS 3.4 | Light-blue design tokens in `tailwind.config.ts` |
| Backdrop | CSS only (`components/site/Environment.tsx`) | Fixed aurora, dot lattice and grain behind every page |
| Motion | Framer Motion 11 | Scroll reveals, shared-layout nav, pointer-tracked 3D tilt |
| 3D | React Three Fiber + drei | Decorative hero only; skipped without WebGL |
| Payments | Razorpay Checkout | Server-created orders, HMAC-verified callbacks and webhook |
| Database | Postgres via `pg` | Works with Supabase, Neon, RDS — no vendor lock |
| Email | Nodemailer over Gmail SMTP | Ticket QR delivered as an inline CID attachment |
| QR generation | `qrcode` | Server-side PNG / data-URL / SVG |
| QR scanning | `BarcodeDetector` → `jsQR` fallback | Native decode where available, works everywhere |
| Admin auth | `jose` JWT + `bcryptjs` | Stateless session cookie, hashed passwords |
| Validation | Zod + DNS MX lookup | An undeliverable email fails at booking, not at send |

### How a ticket is secured

The QR encodes `HOV1.<TICKET-CODE>.<SIGNATURE>` and **contains no personal data at all** —
photographing someone's ticket reveals nothing about them.

- `TICKET-CODE` is generated from a CSPRNG using Crockford base32 (no `I`, `L`, `O` or `U`, so a
  code read aloud at a noisy door is not misheard).
- `SIGNATURE` is `HMAC-SHA256(TICKET_SIGNING_SECRET, "HOV1." + code)`, truncated to 24 chars.

The scanner verifies the signature **before touching the database**, so a spray of forged QRs
costs one HMAC each rather than one query each. Check-in is a single conditional statement:

```sql
UPDATE tickets SET status = 'used', checked_in_at = now()
WHERE id = $1 AND status = 'valid' RETURNING *
```

Exactly one `UPDATE` can match. Two scanners on two doors hitting the same QR in the same instant
cannot both get an "admitted" verdict — the loser gets `duplicate`. That is the property that
actually matters at a real door.

Ticket inventory uses `SELECT … FOR UPDATE` on the tier row inside a transaction, so concurrent
bookings cannot oversell the room.

---

## Quickstart

```bash
git clone <your-repo-url> houz-of-vybe
cd houz-of-vybe
npm install
cp .env.example .env.local     # then fill it in — see below
npm run db:push                # create the schema (idempotent)
npm run db:seed                # seed the OffCampus event + 4 ticket tiers
npm run admin:create           # create your first admin user
npm run dev                    # http://localhost:3000
```

### Generating the two secrets

`TICKET_SIGNING_SECRET` and `ADMIN_SESSION_SECRET` must each be a long random string. Generate
each one separately with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Rotating `TICKET_SIGNING_SECRET` invalidates every ticket already issued.** Every existing QR
> will fail signature verification at the door. Only ever rotate it between events, never during
> one.

---

## Database (Supabase)

Any Postgres works. For Supabase:

1. Create a project, then open **Project Settings → Database → Connection string**.
2. Copy the **Connection pooling** / **Transaction** string, not the direct one. Serverless
   functions open a connection per invocation and will exhaust a direct connection limit.
3. Put it in `DATABASE_URL` and keep `DATABASE_SSL=true`.

```
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"
DATABASE_SSL="true"
```

The schema lives in [`db/schema.sql`](db/schema.sql) and is applied with `npm run db:push`. It is
idempotent — safe to re-run after any edit. Tables:

`events` · `ticket_tiers` · `bookings` · `tickets` · `admin_users` · `scan_log` · `email_log` ·
`audit_log` · `rate_limits` · `contact_messages`

Row Level Security is **not** used: every query runs server-side through the service connection,
and the browser never talks to Postgres directly. If you later expose Supabase's REST API to
clients, you must add RLS policies first.

---

## Gmail SMTP setup

Gmail rejects your normal account password. You need an **App Password**:

1. Enable 2-Step Verification on the Google account.
2. Go to <https://myaccount.google.com/apppasswords>.
3. Create an app password. Google shows a 16-character value.
4. Use it as `SMTP_PASSWORD` (spaces removed).

```
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="tickets@yourdomain.com"
SMTP_PASSWORD="abcdefghijklmnop"
```

**Sending limits.** A free `@gmail.com` account allows roughly 500 recipients per day; Google
Workspace allows about 2,000. For a 600-capacity night that is comfortable. If a single drop ever
needs to exceed it, move to a transactional provider — `sendMail()` in `src/lib/mailer.ts` is the
only function that would change.

Every send is written to `email_log` whether it succeeds or fails, so "the customer says the
ticket never arrived" is answerable from the admin console rather than by guessing.

---

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project**, import the repo. The framework is detected automatically.
3. Add **every** variable from `.env.example` under **Settings → Environment Variables**. Set
   `NEXT_PUBLIC_SITE_URL` to your real domain (this is used in emails and QR links — a wrong
   value sends customers to the wrong host).
4. Deploy.
5. From your local shell, point at the production database and initialise it:

```bash
DATABASE_URL="<production-url>" npm run db:push
DATABASE_URL="<production-url>" npm run db:seed
DATABASE_URL="<production-url>" node scripts/create-admin.mjs you@domain.com "Your Name" "<password>" owner
```

`vercel.json` pins the deployment to `bom1` (Mumbai) — the closest region to the audience and the
venue — and raises `maxDuration` on the routes that talk to SMTP, because Gmail's TLS handshake is
slow enough to trip the default limit.

After deploying, check `https://<your-domain>/api/health`. It reports database reachability, SMTP
configuration and the payments flag.

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | yes | Public origin. Used in emails, QR links, canonical URLs |
| `DATABASE_URL` | yes | Postgres connection string (use the **pooled** one) |
| `DATABASE_SSL` | no | `true` by default; set `false` only for local Postgres without TLS |
| `TICKET_SIGNING_SECRET` | yes | HMAC key for QR payloads. 64 hex chars |
| `ADMIN_SESSION_SECRET` | yes | Signs the admin JWT session cookie. 64 hex chars |
| `ADMIN_SESSION_HOURS` | no | Session lifetime, default 12 |
| `ADMIN_BOOTSTRAP_EMAIL` | no | Used by `npm run admin:create` |
| `ADMIN_BOOTSTRAP_PASSWORD` | no | Used by `npm run admin:create`. Delete after first use |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | yes | `smtp.gmail.com` / `465` / `true` |
| `SMTP_USER` | yes | Gmail address that sends tickets |
| `SMTP_PASSWORD` | yes | Gmail **App Password**, not the account password |
| `MAIL_FROM_NAME` / `MAIL_FROM_ADDRESS` | no | Display name and From address |
| `MAIL_REPLY_TO` | no | Where customer replies land |
| `MAIL_BCC` | no | Blind-copies every ticket email to ops |
| `PAYMENTS_ENABLED` | no | `true` routes checkout through Razorpay. `false` issues passes free |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | only if paid | Razorpay API credentials |
| `RAZORPAY_WEBHOOK_SECRET` | only if paid | Verifies incoming webhooks |
| `MAX_TICKETS_PER_BOOKING` | no | Default 6 |
| `VERIFY_EMAIL_MX` | no | `true` — reject domains with no mail server |
| `APP_ENV` | no | Label shown in `/api/health` and the console footer |

---

## Admin console

Live at **`/admin`**. Sign in at `/admin/login` with a user created by `npm run admin:create`.

| Page | What it does |
| --- | --- |
| `/admin` | Live stats for the next event: bookings, tickets issued, check-in rate, capacity, revenue, 24h sparkline |
| `/admin/scan` | **The door scanner.** Camera QR validation |
| `/admin/bookings` | Searchable, filterable booking list. Contact details masked |
| `/admin/bookings/[id]` | Full booking detail, every pass, and the email delivery log |
| `/admin/checkins` | Live door feed, polling every 5s, colour-coded by verdict |

### Roles

| Role | Can do |
| --- | --- |
| `gate` | Scan tickets, view bookings and the door log |
| `manager` | Everything above, plus voiding bookings |
| `owner` | Everything |

### Scanner notes

- **The camera requires HTTPS.** It works on `https://` and on `localhost`, and it will **not**
  work over a plain-HTTP LAN address like `http://192.168.1.5:3000`. That is a browser security
  rule, not a bug in this app. The scanner detects this case and says so explicitly.
- Decoding prefers the native `BarcodeDetector` API (hardware-accelerated, far better in the low
  light of a real door) and falls back to `jsQR` where it is unavailable.
- Decode attempts are throttled to ~8/second and frames are downscaled to 640px, because decoding
  every frame at full resolution flattens a phone battery inside an hour.
- **Admit** mode consumes the ticket. **Check** mode previews it without consuming — use it when
  a guest just wants to confirm their pass is valid.
- A verdict produces a full-screen colour flash, a vibration and a beep, because the room is loud
  and dark. Sound can be muted per shift.
- The gate label is stored in `localStorage`, so staff set it once per shift and every scan is
  recorded against that door.

---

## Security

- QR payloads are HMAC-signed and carry **no personal data**.
- Check-in is race-safe by construction (conditional `UPDATE`, not read-then-write).
- Ticket inventory is protected by `SELECT … FOR UPDATE` inside a transaction.
- Booking submissions carry an `Idempotency-Key`, so a double-click cannot double-book.
- Rate limiting is **database-backed**, not in-memory — serverless instances do not share a heap,
  so an in-memory counter is trivially bypassed by spreading requests across cold starts.
- Admin passwords are bcrypt hashed (12 rounds); 8 failed logins locks the account for 15
  minutes; the "no such user" and "wrong password" paths are timing-equivalent.
- Both public forms carry honeypot fields.
- Strict CSP and full security headers are set in `next.config.mjs`.
- Every scan attempt — including rejections — is written to `scan_log` and never deleted. Admin
  mutations go to `audit_log`. Email outcomes go to `email_log`.

---

## Known limits and next steps

Being honest about what this does not do yet:

- **No automated tests.** The logic most worth covering is `parseQrPayload`, `createBooking`
  inventory races, and `checkInTicket` concurrency.
- **Email is sent synchronously inside the booking request.** Fine at this volume; beyond a few
  thousand tickets you would want a queue so a slow SMTP handshake never delays a response.
- **No Apple/Google Wallet passes.** The QR works fine, but a `.pkpass` would be nicer.
- **No seat maps.** Tiers are modelled; individual seat selection is not.
- **Gallery images are generated placeholders.** The layout is sized and cropped for real
  photography — drop images in and nothing else changes.
- **A pending booking holds inventory and a referral use until it is paid.** There is no sweeper
  yet that releases abandoned checkouts, so a busy on-sale can hold stock that is never bought.
  The release helper exists (`releaseReferral`); the scheduled job that calls it does not.
- **No SMS.** Phone numbers are collected but only used for contact, not delivery.

---

## Legal and IP

- **OFF Campus** is an independently produced event by Houz of Vybe with Kingdome Klub & Kitchen.
  It is not affiliated with or endorsed by any college or university.
- The pages under `/legal` (terms, privacy, refunds) are **templates**. They are specific and
  written for an Indian events business in Telangana, but they have not been reviewed by a
  lawyer. Have them reviewed before you take real money or real personal data.
- Items marked `TODO(operator)` in `src/content/site.ts` are placeholders — the support inboxes,
  the phone number, the social links and the exact door address. Replace them before you
  announce.
- Ticket prices in `scripts/db-seed.mjs` are a starting point, not a decision. Edit and re-run.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Apply `db/schema.sql` (idempotent) |
| `npm run db:seed` | Seed the OFF Campus event, its three tiers and the `KAVYANSH100` code |
| `npm run admin:create` | Create or update an admin user |

`db:seed` is an upsert: re-running it updates the event and prices without touching bookings, and
it will never lower a tier's quantity below what has already sold. The event date is the real one
(12 September 2026, doors 12:00 IST), so a freshly seeded database always has a bookable future
event rather than one the booking flow rejects as already past.
