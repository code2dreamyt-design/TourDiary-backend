# TourDiary Backend

The backend API for **TourDiary**, a mobile app for forest-department field staff (Van Mitras, Forest Guards, Forest Workers) to log their tours and manage their professional profile. This service owns authentication, user profiles, profile-picture storage, and paid subscriptions.

It started as a stripped-down fork of [`auth-service`](https://github.com/code2dreamyt-design/auth-service), trimmed to exactly what this app needs, with subscription/payment and user-profile features layered on top of that base.

## Features

### Authentication
- **Local email/password auth** — signup and login with `bcrypt` password hashing (cost factor 12)
- **Account lockout** — 5 failed login attempts locks the account for 15 minutes
- **JWT access tokens + rotating refresh tokens** — short-lived stateless access tokens (default 15m); long-lived refresh tokens (default 30d) stored server-side as SHA-256 hashes, never in plaintext
- **Refresh token rotation with theft detection** — every refresh call issues a new token and revokes the old one. Replaying an already-rotated token is treated as a stolen-token signal: the entire token *family* (session chain) is immediately revoked, forcing re-login. A short 30-second grace window tolerates legitimate double-fires (e.g. a retried request) without treating them as theft. Rotation, revocation, and the theft check run as a single atomic MongoDB operation to close a race condition.
- **Multi-device sessions** — each login starts its own independent refresh-token family; logging out (or a theft event) on one device never affects sessions on others
- **Email verification** — signup fires a verification email (best-effort, non-blocking); a dedicated resend endpoint is capped at 5 sends per rolling 24h window, enforced atomically at the database level
- **Password reset & change** — "forgot password" flow that never reveals whether an email is registered, rate-limited the same atomic way as verification resends; an authenticated "change password" flow for logged-in users. Both flows revoke **every** existing session for that user on success.
- **Password-change-aware tokens** — access tokens are rejected if the password was changed after the token was issued, even if the token hasn't expired yet

### User profiles
- **Profile picture upload** — images are streamed straight to Cloudinary (never touch disk), auto-cropped to a 500×500 face-centered square, format/quality optimized on the fly. The previous picture is deleted from Cloudinary after a successful replace.
- **Profile field updates** — name changes, date of birth (settable once — further changes require contacting support), and forestry-specific professional details (designation, usual tour start point, beat name, forest block, forest range)
- **Per-field rate limits** — each profile field has its own abuse-resistant limit (e.g. name changes: 2 per 20 days; profile picture: 3 per week), keyed by user ID rather than IP

### Subscriptions & payments (Razorpay)
- **Checkout order creation** — creates a Razorpay order for a monthly or yearly plan
- **Webhook-driven activation** — subscriptions are only ever activated by a **verified Razorpay webhook** (`payment.captured`), never trusted from the client, closing off client-side payment spoofing
- **Signature verification** — every webhook is validated against `RAZORPAY_WEBHOOK_SECRET` using Razorpay's own signature check before the raw body is parsed
- **Idempotent payment recording** — a unique index on `(provider, providerPaymentId)` means a webhook retry/redelivery can never double-charge a subscription; duplicates are detected and reported back as already-applied
- **Additive renewal** — renewing before expiry adds the new plan's days on top of the remaining balance rather than overwriting it, so early renewals never lose paid time
- **Atomic activation** — payment record + subscription upsert happen inside a single MongoDB transaction

### Platform / hardening
- **Rate limiting** — a global baseline limiter plus tighter, purpose-specific limiters on every sensitive route (auth, password flows, profile fields, subscription endpoints)
- **Input validation** — Zod schemas on every mutating route, returning clean, field-specific error messages
- **NoSQL-injection sanitization** — a custom body sanitizer (see note below) strips any key starting with `$` or containing `.` at any nesting depth
- **Security headers & hardening** — `helmet`, `cors` (credentialed, restricted to `CLIENT_URL`), HTTP parameter pollution protection (`hpp`)
- **Fail-fast configuration** — environment variables are validated against a Zod schema at boot; the process exits immediately with a clear error if anything required is missing or malformed, rather than running in a half-configured state
- **Structured error responses** — 4xx errors return their real message; unexpected 5xx errors are logged server-side and never leak internals to the client

## Explicitly not included (by design)

This is a deliberately reduced version of `auth-service`, scoped to a single mobile app:

- **No 2FA (TOTP)** — not needed for this app's audience
- **No Google/OAuth login** — email/password only, for now

Both exist as proven, working patterns in the original `auth-service` repo and can be reintroduced later if ever needed — they were removed cleanly, not just disabled.

## A note on `express-mongo-sanitize`

The original `auth-service` was designed to use the `express-mongo-sanitize` package, but that package is Express-4-only — it crashes on **every single request** under Express 5 (`TypeError: Cannot set property query of #<IncomingMessage> which has only a getter`), because Express 5 made `req.query` a read-only getter and the package tries to overwrite it directly.

This project replaces it with a small custom middleware (`src/middlewares/sanitize.js`) that sanitizes `req.body` directly — which covers this API's entire actual attack surface, since no route here reads from `req.query`. It strips any key starting with `$` or containing a `.`, at any nesting depth, before the request reaches validation or the database.

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (ESM, `"type": "module"`) |
| Framework | Express 5 |
| Database | MongoDB + Mongoose |
| Auth tokens | `jsonwebtoken` (access), random bytes + SHA-256 hash (refresh) |
| Password hashing | `bcrypt` |
| Validation | `zod` |
| Email | `nodemailer` (SMTP) |
| File storage | `cloudinary` (profile pictures) |
| File uploads | `multer` (in-memory buffer, no disk writes) |
| Payments | `razorpay` |
| Rate limiting | `express-rate-limit` |
| Security | `helmet`, `cors`, custom body sanitizer, `hpp` |
| Dev tooling | `nodemon` |

## Project structure

```
TourDiary-backend/
├── server.js                          # entry point — connects DB, starts HTTP server
├── src/
│   ├── app.js                         # Express app: middleware stack + route mounting
│   ├── config/
│   │   ├── env.js                     # Zod-validated environment variables (single source of truth)
│   │   ├── db.js                      # MongoDB connection (fail-fast on error)
│   │   ├── cloudinary.js              # Cloudinary SDK config
│   │   ├── razorpay.js                # Razorpay SDK config
│   │   └── plan.js                    # Subscription plan definitions (amount, currency, label)
│   ├── controllers/
│   │   ├── auth.controller.js         # signup, login, refresh, logout, email verify, password flows
│   │   ├── user.controller.js         # profile picture, name, DOB, designation updates
│   │   ├── subscription.controller.js # checkout order creation, subscription status
│   │   └── webhook.controller.js      # Razorpay webhook handler
│   ├── middlewares/
│   │   ├── auth.middleware.js         # verifies access token, attaches req.userId
│   │   ├── validate.js                # generic Zod-schema request validator
│   │   ├── rateLimiter.js             # all route-specific rate limiters
│   │   ├── sanitize.js                # custom NoSQL-injection body sanitizer
│   │   ├── upload.middleware.js       # multer config + error mapping for image uploads
│   │   └── errorHandler.js            # centralized error-response formatter
│   ├── models/
│   │   ├── User.js                    # user profile, credentials, security fields
│   │   ├── RefreshToken.js            # hashed refresh tokens, session families, TTL expiry
│   │   ├── Subscription.js            # one active subscription record per user
│   │   └── Payment.js                 # payment ledger, idempotency-keyed
│   ├── routes/
│   │   ├── auth.routes.js             # /api/auth/*
│   │   ├── user.routes.js             # /api/users/*
│   │   ├── subscription.routes.js     # /api/subscription/*
│   │   └── webhooks.route.js          # /webhooks/razorpay
│   ├── services/
│   │   ├── token.service.js           # access/refresh token issuance, rotation, theft detection
│   │   ├── email.service.js           # nodemailer transport + verification/reset email templates
│   │   ├── cloudinary.service.js      # stream-upload and delete for profile pictures
│   │   └── subscription.service.js    # subscription status check, renewal math, payment application
│   ├── validations/
│   │   └── auth.validation.js         # Zod schemas for auth + user routes
│   └── utils/                         # reserved for shared helpers — currently empty stubs
├── .env.example                       # required environment variables (no values)
├── package.json
└── README.md
```

## API reference

Base path for most routes is `/api`. The Razorpay webhook is mounted separately at the root (`/webhooks/razorpay`) because it needs the **raw**, unparsed request body for signature verification.

### Auth — `/api/auth`

| Method | Path | Auth | Rate limit | Description |
|---|---|---|---|---|
| POST | `/signup` | — | 5 / hour | Create an account, auto-login (returns tokens), fires a verification email |
| POST | `/login` | — | 10 / 15 min | Email + password login, returns access + refresh tokens |
| POST | `/refresh` | — | — | Rotates a refresh token for a new access + refresh token pair |
| POST | `/logout` | — | — | Revokes the entire session family tied to the given refresh token |
| GET | `/getme` | ✅ | — | Returns the current authenticated user |
| POST | `/resend` | ✅ | 5 / 24h | Resends the email verification link |
| POST | `/verify-email/:token` | — | — | Verifies the account's email from a token sent by email |
| POST | `/forget-password` | — | 5 / hour | Sends a password-reset email (always 200, never leaks whether the email exists) |
| POST | `/reset-password/:rawPassResetToken` | — | — | Sets a new password from a reset token; revokes all sessions |
| POST | `/change-password` | ✅ | — | Changes password for a logged-in user; revokes all sessions |

### Users — `/api/users`

| Method | Path | Auth | Rate limit | Description |
|---|---|---|---|---|
| PATCH | `/me/profile` | ✅ | 3 / week | Uploads/replaces the profile picture (`multipart/form-data`, field name `profilePic`) |
| DELETE | `/remove/profile` | ✅ | 10 / week | Removes the current profile picture |
| PATCH | `/update/name` | ✅ | 2 / 20 days | Updates display name |
| POST | `/designation` | ✅ | 3 / 20 days | Sets/updates forestry role + posting details |
| PATCH | `/dob` | ✅ | 5 / day | Sets date of birth (once only — further changes need support) |

### Subscription — `/api/subscription`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/status` | ✅ | Returns whether the user has an active (non-expired) subscription |
| POST | `/checkout` | ✅ | Creates a Razorpay order for `{ plan: "monthly" \| "yearly" }` |

### Webhooks

| Method | Path | Description |
|---|---|---|
| POST | `/webhooks/razorpay` | Razorpay `payment.captured` webhook; verifies signature, then atomically records the payment and extends the subscription |

All authenticated routes expect `Authorization: Bearer <accessToken>`. All mutating routes (except the webhook) are body-validated with Zod and return `400` with a field-level `errors` object on failure.

## Data models

- **User** — credentials, verification/reset token hashes (never raw tokens), lockout counters, profile fields, forestry designation fields. `toJSON` strips `password`, `passwordChangedAt`, and both token-hash fields before any response leaves the API.
- **RefreshToken** — one document per issued refresh token, stored as a SHA-256 hash with a `family` ID grouping all tokens from the same login session. A MongoDB TTL index (`expiresAt`) automatically purges expired tokens.
- **Subscription** — one document per user (`unique: true` on `user`), tracking the current plan and `paidUntil` date.
- **Payment** — an append-only ledger of successful payments, with a unique `(provider, providerPaymentId)` index that makes webhook processing idempotent.

## Getting started

### Prerequisites
- Node.js (ESM-compatible)
- A MongoDB instance (local or Atlas)
- SMTP credentials (for verification/reset emails)
- A Razorpay account (test-mode keys are fine for development)
- A Cloudinary account

### Setup

```bash
git clone https://github.com/code2dreamyt-design/TourDiary-backend.git
cd TourDiary-backend
npm install
cp .env.example .env   # then fill in the values below
npm run dev              # nodemon, auto-restarts on change
# or
npm start                 # plain node
```

The server validates `.env` at boot via `src/config/env.js` and exits immediately with a descriptive error if any required variable is missing or invalid — so a misconfigured deploy fails loudly instead of serving broken requests.

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | no (default `development`) | `development` \| `production` \| `test` |
| `PORT` | no (default `5000`) | HTTP port |
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_ACCESS_SECRET` | ✅ | Min. 32 characters |
| `JWT_ACCESS_EXPIRY` | no (default `15m`) | e.g. `15m`, `1h` |
| `JWT_REFRESH_EXPIRY` | no (default `30d`) | e.g. `30d` |
| `CLIENT_URL` | ✅ | Used for CORS origin and email links |
| `SMTP_HOST` | ✅ | |
| `SMTP_PORT` | no (default `587`) | `465` enables implicit TLS |
| `SMTP_USER` | ✅ | |
| `SMTP_PASS` | ✅ | |
| `EMAIL_FROM` | ✅ | Sender address for outgoing emails |
| `EMAIL_VERIFICATION_EXPIRY` | no (default `24h`) | |
| `PASSWORD_RESET_EXPIRY` | ✅ | e.g. `10m` |
| `RAZORPAY_KEY_ID` | ✅ | |
| `RAZORPAY_KEY_SECRET` | ✅ | |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ | Used to verify webhook signatures |
| `CLOUDINARY_CLOUD_NAME` | ✅ | |
| `CLOUDINARY_API_KEY` | ✅ | |
| `CLOUDINARY_API_SECRET` | ✅ | |

See `.env.example` for the full list of keys to copy.

## Known gaps / things to be aware of

- `src/middlewares/errorHandler.js` exists but is not currently wired into `app.js` — routes handle their own try/catch and error responses inline instead.
- `src/utils/ApiError.js`, `generateUsername.js`, and `logger.js` are present as empty stub files, not yet implemented.
- `src/services/otp.service.js` is an empty stub — no OTP flow currently exists (email link-based verification/reset is used instead).