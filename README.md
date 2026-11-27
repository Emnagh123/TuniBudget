# TuniBudget

A personal finance and mini-banking web app. Hold several accounts in Tunisian dinar (TND), move money between them safely, and track your spending with categories, monthly budgets and charts.

Built for the **CS324** course (Professors Bochra Khiari and Aymen Hammami).

The app has a React front-end and a **Node.js (Express) + MongoDB** API. Transfers are real MongoDB multi-document transactions, and the API is hardened against the usual attacks (see [Security](#security)).

## Team

- Emna Ghozzi
- Layth Ridene
- Yassin Chalghaf
- Jad Kmayel

## Features

- **Authentication and accounts**: register, log in, log out, "forgot password" with an expiring email link. Create several accounts (checking, savings, cash), rename them, and close them only when the balance is exactly 0. Closed accounts stay visible so history is preserved.
- **Atomic transfers**: move money between your own accounts. Each transfer creates two linked ledger entries (a debit and a credit) sharing one `transferId`. The Transfer page shows the transaction journal (begin, lock, debit, credit, commit or rollback) sent back by the server, and a "simulate a crash" switch that really aborts the MongoDB transaction.
- **Transaction history**: an immutable ledger with filters (account, type, category, date range, min/max amount), pagination (10 rows per page, newest first) and the balance after each movement. Add expenses and income; an expense can never exceed the account balance.
- **Categories and budgets**: a monthly budget per expense category. Status is **ok** below 80 %, **near the limit** from 80 % to below 100 %, and **exceeded** from 100 %, always shown with an icon and text, never colour alone.
- **Dashboard and analytics**: total balance, a 30/90-day balance curve with hover details, a month summary (income, expenses, what is left), spending by category, budget alerts and the latest movements.
- **Dark and light themes**, responsive layout, keyboard accessible, no CDNs (system font stack, inline SVG icons).

## Getting started

You need [Node.js](https://nodejs.org/) 20.12 or newer and a MongoDB database **running as a replica set** (transactions need one):

- easiest: a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster;
- or locally: `mongod --replSet rs0`, then once in `mongosh`: `rs.initiate()`, and use `mongodb://localhost:27017/?replicaSet=rs0`.

```bash
npm install
cp .env.example .env      # then fill in MONGODB_URI and SESSION_SECRET
npm run check-env         # checks the .env without starting anything
npm run seed              # loads the demo data into MongoDB
npm run project           # starts the API (port 4000) and the app (http://localhost:5173)
```

Generate a `SESSION_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Open the app at exactly `http://localhost:5173` (the address in `APP_URL`): requests from another address, such as `127.0.0.1`, are blocked by the CSRF check.

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run build` | production build of the front-end into `dist/` |
| `npm start` | starts the API alone; it also serves `dist/` (production) |
| `npm run seed -- --reset` | wipes the app's collections and reloads the demo data (refused in production) |
| `npm run make-admin -- email` | gives the admin role to a registered user (`--remove` to take it back) |
| `npm test` | unit tests of the security building blocks |
| `npm run audit:deps` | checks the dependencies for known vulnerabilities |

### Demo accounts

Password for both: `demo1234`

| Email | Data |
| --- | --- |
| `amine@tunibudget.tn` | **Premium** (paid yearly), 3 accounts, 4 months of history |
| `salma@tunibudget.tn` | **Free** plan, 2 accounts |

**Admin login (development only):** `admin@tunibudget.tn` with password `admin1234`. Admins see an extra **Admin** tab with the security activity, the user list (log a user out everywhere, disable or enable an account) and the security log. To make your own account an admin, register it, then run `npm run make-admin -- you@example.com` and log in again.

In development, **Try the demo account** on the login screen signs in as Amine using the seeded demo data. Run `npm run seed` first; this loads the demo data into your development database. The app opens in light mode by default, and the theme toggle can switch to dark mode.

In development, "Forgot your password?" prints the reset link in the server console instead of sending an email.

### Plans: Free, Premium and Admin

| | Free (0 TND) | Premium (9.900 TND/month or 99.000 TND/year) | Admin |
| --- | --- | --- | --- |
| Open accounts | up to 3 | unlimited | unlimited |
| History | last 3 months | full + CSV export | full + CSV export |
| Budgets | current month | any month + copy last month | any month + copy last month |
| Balance chart | 30 / 90 days | 30 / 90 / 365 days | 30 / 90 / 365 days |
| Extra | | gold Premium badge | Admin page, every user's plan and payments |

The **Premium** tab has the plans and a **simulated checkout** (no real money). Test cards: `4242 4242 4242 4242` is accepted, `4000 0000 0000 0002` is declined, `4000 0000 0000 9995` has insufficient funds, `9788 0000 0000 0009` is an e-DINAR card (Tunisian card; e-DINAR numbers start with 9788 in this simulation); use any future expiry and any CVC. Each payment (paid or declined) is saved in the `payments` collection with only the card brand and last 4 digits. The price is decided by the server (`server/plans.js`) and every limit is checked by the server, not only hidden in the page.

**Discounts and offers (admin):** on the Admin page an admin creates offers: a percentage off (1 to 100 %), for monthly, yearly or both, with an optional promo code (without a code the discount applies automatically), end date, maximum number of uses and target user (by email). Offers can be paused and restarted. The seed adds the code `WELCOME20` (20 % off). The discount is recomputed on the server inside the payment transaction (`server/offers.js`). The Admin page also shows, for each user, how many payments they made, how much they paid, and the list of their payments.

## Security

| Protection | How |
| --- | --- |
| **Authentication** | Server-side sessions stored in MongoDB. A new random 256-bit token at every login (no session fixation). Sessions end after 8 h, after 30 min without activity, at logout, and on every device when the password is reset. |
| **Session cookie** | `HttpOnly` (JavaScript, and so XSS, cannot read it), `SameSite=Strict`, `Secure` and `__Host-` prefix in production. The database only stores an HMAC of the token. |
| **Passwords** | Hashed with **scrypt** (Node's built-in, memory-hard) with a random salt per user, compared in constant time. Policy: 8–128 characters, a letter and a digit, not a common password. Unknown emails take as long to check as wrong passwords, so emails cannot be discovered by timing. |
| **Brute force** | 5 failed logins lock the email for 15 minutes; 10 failed logins per IP per 15 minutes are refused. |
| **Rate limiting** | Per IP: all API calls, login, registration, password reset, and money movements each have their own limit. |
| **Password reset links** | 256-bit random token, only its SHA-256 is stored, expires after 15 minutes, works once (checked and burnt in one atomic write), only the newest link is valid. The answer never reveals whether an email exists. The token is removed from the address bar, and `Referrer-Policy: no-referrer` stops it leaking. |
| **Server-side validation** | Every field is checked on the server (type, length, format, allowed values). Unexpected fields are refused, so nobody can send `role: "admin"`. Amounts must be whole millimes between 1 and 10¹². |
| **NoSQL injection** | The MongoDB equivalent of parameterized queries: queries are built field by field from validated plain values, never from request objects. Any key containing `$`, `.` or `[` and any `__proto__` key is refused before reaching a route. |
| **XSS** | React escapes all output; the server refuses `<` and `>` and control characters in stored text; a strict Content-Security-Policy only allows scripts and styles from the app itself. |
| **CSRF** | `SameSite=Strict` cookie, plus every write must carry the `X-Requested-With: TuniBudget` header and come from the app's own `Origin`. |
| **HTTPS** | In production, `APP_URL` must be `https://`, plain-HTTP pages are redirected, plain-HTTP API calls are refused, and HSTS tells browsers to never use HTTP again. The server can terminate TLS itself (`TLS_CERT_FILE`/`TLS_KEY_FILE`) or sit behind a host that does (`TRUST_PROXY=1`). |
| **Secrets** | All secrets live in `.env`, which is in `.gitignore`; `.env.example` documents them without values. The front-end bundle contains no key at all. |
| **Environment check** | At start-up the server refuses to run with a missing or placeholder secret, a database without a password or TLS in production, or no HTTPS in production, and lists what to fix without printing any secret. |
| **Database** | Production requires an authenticated, TLS-encrypted connection. Every query is filtered by the logged-in user's id, so nobody can read another user's data by guessing an id. Expired sessions, reset links and old logs are deleted automatically (TTL indexes). |
| **Money and amounts** | The server never trusts a balance or an amount computed by the browser: it reads balances from the database and uses conditional writes (`balance >= amount`) inside a transaction. Each transfer or operation carries an `Idempotency-Key`, so a double click or a network retry never moves the money twice. |
| **Logging and monitoring** | Security events (logins, failures, locks, blocked requests, resets, admin actions) are written as JSON lines and to the `auditLogs` collection (kept 180 days). Passwords, tokens and cookies are never logged. 10 blocked events from one IP in 15 minutes raise a `suspicious_activity` alert, also sent to `ALERT_WEBHOOK_URL` if set. |
| **Admin routes** | `/api/admin/*` needs a logged-in user whose role, read from the database on every request, is `admin`, and optionally an IP from `ADMIN_IP_ALLOWLIST`. Others get a 404. Admins are created only from the command line (`npm run make-admin`). Every admin request is logged. |
| **Headers and errors** | Helmet security headers, `X-Powered-By` removed, `Cache-Control: no-store` on the API, 10 kB body limit, request timeouts, and errors never send a stack trace to the browser. |

Admin endpoints: `GET /api/admin/security-summary`, `GET /api/admin/audit-logs?level=&event=&page=`, `GET /api/admin/users`, `POST /api/admin/users/:id/revoke-sessions`, `POST /api/admin/users/:id/disable`, `POST /api/admin/unlock-login`.

**Before going live**, connect an email provider in `server/mailer.js` (reset emails are only printed in development), and run `npm run audit:deps` regularly.

## The ACID transfer engine

The transfer runs in `server/routes/transfers.js` as one MongoDB multi-document transaction:

| Property | How it is guaranteed |
| --- | --- |
| **Atomicity** | Debit, credit and both ledger entries are written in one transaction. Any error, including the "simulate a crash" switch, aborts it and MongoDB undoes everything. |
| **Consistency** | Validated input; the debit is a conditional write `{ balance: { $gte: amount } }`, so a balance can never go negative. |
| **Isolation** | Both accounts are written first (the "lock" step). A concurrent transfer on the same account hits a write conflict and is retried by MongoDB on the up-to-date balance. |
| **Durability** | Committed with write concern `majority`. There is no route that edits or deletes a ledger entry. |

## Tech stack

- Front-end: React 18 (only `useState` and `useEffect`), Vite 5, plain CSS.
- Back-end: Node.js 20.12+, Express 5, the official MongoDB driver, Helmet, express-rate-limit. Password hashing, tokens and HMAC use Node's built-in `crypto`.

## Project structure

```
index.html
package.json              scripts: project, build, start, seed, make-admin, check-env, test
vite.config.js            forwards /api to the API in development
.env.example              every environment variable, documented (copy to .env)
scripts/dev.js            starts the API and Vite together
server/
  index.js                entry point: check env, connect, listen (HTTP or HTTPS)
  config.js               reads and checks the environment variables
  app.js                  Express app: security layers, API routes, built front-end
  db.js                   MongoDB connection, indexes, transaction helper
  errors.js               ApiError and the JSON error handler
  validate.js             server-side validation of every input
  idempotency.js          one request = one money movement
  mailer.js               password reset email
  security/               password.js, sessions.js, tokens.js, middleware.js, rateLimits.js, audit.js
  routes/                 auth, accounts, transactions, transfers, budgets, analytics, admin
  scripts/                seed.js, make-admin.js, check-env.js
  tests/                  unit tests (npm test)
src/
  main.jsx, App.jsx       app shell (restores the session on load)
  data.js                 demo data, loaded into MongoDB by `npm run seed`
  services/               the only layer the UI talks to: one function per API call
    api.js                fetch wrapper (cookies, CSRF header, idempotency keys, errors)
  utils/                  money.js, dates.js
  components/, pages/, styles/
```

## Money and data model

- All amounts are **integers in millimes** (1 TND = 1000 millimes). Floats are never used for money.
- `src/utils/money.js` is the only place that converts amounts (also used by the server). Display format: `7,847.350 TND`.
- Identifiers are string `_id` values such as `acc_0193…`, dates are stored as MongoDB dates, month keys are `"YYYY-MM"`.

| Collection | Fields |
| --- | --- |
| `users` | `_id`, `fullName`, `email`, `passwordHash`, `role`, `createdAt`, `passwordChangedAt`, `disabled` |
| `accounts` | `_id`, `userId`, `name`, `type`, `openingBalance`, `balance`, `currency`, `status`, `closedAt` |
| `categories` | `_id`, `name`, `kind` (`expense` / `income` / `transfer`) |
| `transactions` | `_id`, `userId`, `accountId`, `type` (`debit` / `credit`), `amount`, `categoryId`, `date`, `description`, `transferId`, `balanceAfter`, `seq` |
| `budgets` | `_id`, `userId`, `categoryId`, `month`, `limit` |
| `sessions`, `passwordResets`, `loginThrottle`, `idempotencyKeys`, `auditLogs` | security data, expired automatically |

Transfers use the neutral `Transfer` category and are excluded from spending and income statistics.

## Design

Dark "night" surfaces lit by an emerald glow, a green gradient balance card, gold accents and soft-yellow pill buttons, with the zellige eight-point star on the balance card and the login panel. Credit and debit are always distinguished by a sign (+ / −) as well as colour.
