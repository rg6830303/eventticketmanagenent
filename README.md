# Houz of Vybe — event ticketing platform

Clubbing-event website and QR ticketing system for **Houz of Vybe**, Hyderabad. Customers book
in three fields, receive a cryptographically signed QR pass by email within seconds, and get
scanned in at the door by staff using a phone camera.

Built as a single Next.js application: marketing site, booking flow, ticket delivery and the
admin/door console all ship together.

---

## Current mode: payments are OFF

**Razorpay is not connected, and booking is free of charge.** A customer gives their name, a
working email address and an Indian mobile number, and tickets are issued immediately — there is
no payment step anywhere in the flow.

The Razorpay integration is nonetheless written in full and sits behind a feature flag. To turn
paid ticketing on later:

1. Set `PAYMENTS_ENABLED=true` and `NEXT_PUBLIC_PAYMENTS_ENABLED=true`.
2. Fill in `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` and
   `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
3. Point a Razorpay webhook at `https://<your-domain>/api/payments/razorpay/webhook` for the
   `payment.captured` event.

No other code change is required. `createBooking()` already branches on the flag: with payments
off a booking is confirmed and ticketed instantly; with payments on it lands as `pending` and is
promoted to `confirmed` by the signature-verified callback. Both paths mint tickets through the
same function, so a ticket issued today is identical to one issued after the switch.

---

## Architecture

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router), React 19 | One deployable for site + API + admin |
| Styling | Tailwind CSS 3.4 | Dark/blue design tokens in `tailwind.config.ts` |
| Motion | Framer Motion 11 | Scroll reveals, shared-layout nav, 3D tilt |
| 3D | React Three Fiber + drei | Decorative hero only; degrades to flat gradients |
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
| `PAYMENTS_ENABLED` | no | `false` today. `true` activates Razorpay |
| `NEXT_PUBLIC_PAYMENTS_ENABLED` | no | Client-side mirror of the flag |
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
- **No SMS.** Phone numbers are collected but only used for contact, not delivery.

---

## Legal and IP

- The **OffCampus** night in this project is an independently produced themed event. It is not
  affiliated with, endorsed by, or licensed from the producers of the Prime Video series.
  **Using a television series' name, artwork or branding for a commercial event may require
  permission from the rights holder** — get that cleared before you promote it publicly.
- The pages under `/legal` (terms, privacy, refunds) are **templates**. They are specific and
  written for an Indian events business in Telangana, but they have not been reviewed by a
  lawyer. Have them reviewed before you take real money or real personal data.
- Artist names, venue details and testimonials in `src/content/site.ts` are placeholder content.
  Replace them with real ones before launch.

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
| `npm run db:seed` | Seed the OffCampus event and its four tiers |
| `npm run admin:create` | Create or update an admin user |

`db:seed` computes the event date as the **next upcoming Saturday at 21:00 IST**, so a freshly
seeded database always has a bookable future event rather than one the booking flow rejects as
already past.
