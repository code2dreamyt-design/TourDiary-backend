# TourDiary Backend

A local, email/password authentication backend for the TourDiary mobile app — built by stripping down [`auth-service`](https://github.com/code2dreamyt-design/auth-service) to just what this app needs. Subscription/payment logic is being added on top of this base.

## Features

- **Local authentication** — signup/login with bcrypt password hashing, account lockout after repeated failed attempts
- **JWT access tokens + rotating refresh tokens** — short-lived stateless access tokens, long-lived refresh tokens stored server-side with automatic rotation and **theft detection** (a replayed, already-rotated token triggers revocation of the entire session chain, done as one atomic database operation to close a race condition present in the original service)
- **Multi-device sessions** — each login starts an independent session; logging out or revoking one device never affects others
- **Email verification** — signup triggers a verification email; resend endpoint is rate-limited with an atomic daily cap
- **Password reset & change** — "forgot password" flow with no email-enumeration leak, plus an authenticated "change password" flow; both revoke all existing sessions on success
- **Rate limiting** — per-route limits on login, signup, password reset, and resend, plus a global baseline
- **Input validation** — Zod schemas on every route, returning clean, field-specific error messages
- **Security hardening** — `helmet`, `cors` with credentialed cookies, a custom NoSQL-injection body sanitizer (see note below), HTTP parameter pollution protection

## Explicitly Not Included (by design)

This is a deliberately reduced version of `auth-service` for a single-purpose mobile app:

- **No 2FA (TOTP)** — not needed for this app's audience
- **No Google/OAuth login** — email/password only, for now
- Both are proven, working patterns in the original `auth-service` repo and can be reintroduced later if ever needed — they were removed cleanly, not just disabled.

## A note on `express-mongo-sanitize`

The original `auth-service` was designed to use the `express-mongo-sanitize` package, but that package is Express 4-only — it crashes on **every single request** under Express 5 (`TypeError: Cannot set property query of #<IncomingMessage> which has only a getter`), because Express 5 made `req.query` read-only and the package tries to overwrite it directly. This appears to be why it was silently absent from the actual deployed `auth-service` code despite being planned for it.

This project replaces it with a small custom middleware (`src/middlewares/sanitize.js`) that sanitizes `req.body` directly — which covers this API's entire actual attack surface, since no route here reads from `req.query`. It strips any key starting with `$` or containing a `.`, at any nesting depth, before the request reaches validation or the database.

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (ESM) |
| Framework | Express 5 |
| Database | MongoDB + Mongoose |
| Auth tokens | `jsonwebtoken` (access), random bytes + SHA-256 hash (refresh) |
| Password hashing | `bcrypt` |
| Validation | `zod` |
| Email | `nodemailer` (SMTP) |
| Rate limiting | `express-rate-limit` |
| Security | `helmet`, `cors`, custom body sanitizer, `hpp` |

## Project Structure

```
tourdiary-backend/
├── src/
│   ├── config/
│   │   ├── db.js            # MongoDB connection
│   │   └── env.js           # Zod-validated environment variables
│   ├── controllers/
│   │   └── auth.controller.js
│   ├── middlewares/
│   │   ├── auth.middleware.js   # verifies access tokens, attaches req.userId
│   │   ├── rateLimiter.js
│   │   ├── sanitize.js          # custom body sanitizer (see note above)
│   │   └── validate.js          # Zod request-body validation
│   ├── models/
│   │   ├── User.js
│   │   └── RefreshToken.js
│   ├── routes/
│   │   └── auth.routes.js
│   ├── services/
│   │   ├── token.service.js     # access/refresh token issuing & rotation
│   │   └── email.service.js     # nodemailer wrapper
│   ├── validations/
│   │   └── auth.validation.js
│   └── app.js
├── server.js
├── .env.example
└── package.json
```

## Setup

```bash
npm install
cp .env.example .env   # then fill in real values, see table below
npm run dev
```

Server refuses to boot if any required environment variable is missing or malformed — this is deliberate, fail-fast validation via Zod in `config/env.js`.

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Port the backend runs on |
| `CLIENT_URL` | Base URL used for CORS and email links |
| `MONGO_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` | Signing secret for access tokens (32+ chars) |
| `JWT_ACCESS_EXPIRY` | e.g. `15m` |
| `JWT_REFRESH_EXPIRY` | e.g. `30d` |
| `NODE_ENV` | `development` / `production` — controls cookie `secure` flag and `trust proxy` automatically |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | SMTP credentials |
| `EMAIL_VERIFICATION_EXPIRY` | e.g. `24h` |
| `PASSWORD_RESET_EXPIRY` | e.g. `15m` |

## API Reference

All routes are prefixed with `/api/auth`.

**Mobile-specific note:** unlike the original web-oriented `auth-service`, refresh tokens here are still delivered via an httpOnly cookie in the current code — but React Native has no cookie jar, so this needs adapting before the mobile app can actually use it (returning the refresh token in the JSON body instead, for the app to store in `expo-secure-store`). This is the next piece of work, not yet done.

| Method & Path | Auth required | Body | Notes |
|---|---|---|---|
| `POST /signup` | No | `name, email, password, dob?` | Creates account, sends verification email, returns tokens immediately |
| `POST /login` | No | `email, password` | Returns tokens directly |
| `POST /refresh` | Refresh cookie | — | Rotates the refresh token, returns a new access token |
| `POST /logout` | Refresh cookie | — | Revokes the current session only |
| `GET /getme` | Bearer access token | — | Returns the current user's profile |
| `POST /verify-email/:token` | No | — | Token comes from the emailed link |
| `POST /resend` | Bearer access token | — | Rate-limited (IP) + atomic daily cap of 5/account |
| `POST /forget-password` | No | `email` | Always returns the same generic message, regardless of whether the email exists |
| `POST /reset-password/:rawPassResetToken` | No | `newPassword` | Revokes all existing sessions on success |
| `POST /change-password` | Bearer access token | `currentPassword, newPassword` | Revokes all existing sessions on success |

## Known Unfinished Files

`ApiError.js`, `logger.js`, `errorHandler.js` are scaffolded but unused/unwired — every controller currently handles its own errors inline with `try/catch`. Left as-is intentionally, for now.

## License

MIT
