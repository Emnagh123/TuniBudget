# agent.md — TuniBudget

Instructions for AI coding agents working on this repository. Read this whole file before changing anything. The whole project (code, comments, UI text, file names, commit messages) is written in **English**.

## 1. What the project is

**TuniBudget** is a personal finance and mini-banking web app built for the **CS324** course (professors: Bochra Khiari and Aymen Hammami). Team: Emna Ghozzi, Layth Ridene, Yassin Chalghaf, Jad Kmayel.

A user:

- holds **several accounts in Tunisian dinar (TND)**;
- **transfers money** between their own accounts safely;
- **tracks spending** with categorized transactions, monthly budgets and charts.

The heart of the project is the **transfer engine**, designed as a database transaction with **ACID** guarantees:

- **Atomicity**: a transfer (debit + credit) succeeds as a whole or is rolled back as a whole.
- **Consistency**: no negative balance, no money created or lost.
- **Isolation**: two simultaneous operations on the same account cannot spend the same money twice.
- **Durability**: once committed, a movement stays in the history and can never be edited or deleted.

## 2. Current scope: front-end + secure API

- The React front-end talks to a **Node.js (Express 5) + MongoDB** API in `server/`, through `src/services/` only.
- Demo data lives in `src/data.js` and is loaded into MongoDB with `npm run seed`.
- MongoDB must run as a **replica set** (Atlas, or `mongod --replSet rs0`): transfers use multi-document transactions.
- Secrets live in `.env` (never committed; `.env.example` documents every variable). The server checks them at start-up.
- Still forbidden: external CDNs, `localStorage`/`sessionStorage` (the session is an HttpOnly cookie), storing any token or secret in the front-end.

**The project runs with:**

```
npm install
npm run seed      (once, after filling .env)
npm run project
```

`npm run build` and `npm test` must also succeed with no error.

## 3. Hard technical constraints

Allowed technologies: **HTML, CSS, JavaScript, React** in the front-end; **Node.js, Express, MongoDB** in `server/`.

React hooks allowed: **`useState` and `useEffect` only.**

- Forbidden: `useContext`/`createContext`, `useReducer`, `useRef`, `useMemo`, `useCallback`, `useLayoutEffect`, `useId`, `memo`, custom hooks, and any other hook.
- Forbidden libraries: Redux, Zustand, React Router, chart libraries, UI kits (MUI, Tailwind, Bootstrap…), icon packs, date or money libraries, axios, etc. Front-end runtime dependencies: `react` and `react-dom`. Server dependencies: `express`, `mongodb`, `helmet`, `express-rate-limit` (password hashing and tokens use Node's built-in `crypto`). Dev dependencies: `vite` and `@vitejs/plugin-react`. Do not add a dependency without an explicit request.
- Consequences:
  - **Shared state** lives in `App` and goes down through **props** (lifting state up). No Context.
  - **Navigation** has no router: a `page` state in `App` decides which page is rendered.
  - **Charts** are drawn by hand in **SVG** (or `div` + CSS).
  - **Derived values** (totals, percentages, filtered lists) are computed in the render with plain JavaScript.
  - **Data loading** uses `useEffect` + `useState` (`data`, `error`) in each page, calling the functions of `src/services/`.
  - `useEffect` is for loading data, timers (toast auto-dismiss) and the document title. Never use an effect to compute a value that can be computed during render.
- Fonts, icons and images are local files or inline SVG. Use a system font stack. No CDN.

Code style:

- Function components only, one component per file, PascalCase file names for components.
- Plain CSS files in `src/styles/` with CSS variables (design tokens in `global.css`). No CSS-in-JS, no inline style for anything that is not truly dynamic.
- Responsive (desktop and mobile), keyboard accessible, visible focus, real `<button>`, `<a>`, `<label>` elements.
- Short comments only where the ACID simulation or a non-obvious rule needs explaining.

## 4. Features (in priority order)

### 1. Authentication and account management

- Register, log in, log out, forgot/reset password (expiring one-time link), handled by the API (section 8).
- The logged-in user is kept in the state of `App`, restored from the session cookie on load (`getCurrentUser`). Without a user, only the login/register page is shown.
- A user can **create and manage several accounts**: name, type (checking, savings, cash), balance, currency TND. Accounts can be renamed and can be closed only when the balance is exactly 0. Closed accounts stay visible (history is kept).

### 2. Atomic money transfers (core of the project)

- Form: source account, destination account, amount, optional note.
- Validation rules:
  - source ≠ destination, both accounts belong to the user and are active;
  - amount is an **integer > 0 in millimes**;
  - the source balance must be sufficient (a balance never goes negative).
- A transfer creates **two linked ledger entries** (one debit, one credit) sharing the same `transferId`.
- **Atomicity**: debit, credit and ledger entries are written in **one MongoDB transaction**. If any step fails, **nothing changes** (rollback).
- **Isolation**: both accounts are written first inside the transaction; a concurrent transfer gets a write conflict and is retried on the up-to-date balance.
- The Transfer page shows the **transaction journal** (begin, lock, debit, credit, commit, or rollback) and has a "simulate a crash" switch, so the ACID behaviour can be shown live in the course presentation.

### 3. Transaction history (ledger)

- Lists **all** movements. They are **immutable**: no edit button, no delete button, no service function that edits or deletes a transaction.
- Filters: account, type (expense / income / transfer), category, date range, min/max amount.
- Pagination (10 rows per page), newest first, with the account balance after each movement.
- A form adds a new **expense** or **income** to an account. An expense can never exceed the account balance.

### 4. Categories and budgets

- Every transaction has a category (food, transport, bills, rent, leisure, health, shopping, salary, freelance…). Transfers use the neutral category `Transfer` and are **excluded** from spending and income statistics.
- A monthly budget per expense category (create, edit the limit, remove).
- Status: **ok** below 80 % of the limit, **near the limit** from 80 % to below 100 %, **exceeded** from 100 %. Status is never shown with colour alone (icon + text).

### 5. Dashboard and spending analytics

- Total balance, balance curve over time (30 or 90 days) with hover details.
- Month summary: income, expenses, what is left.
- Spending by category (ranked bars), budget alerts, latest movements.

### 6. Plans and payments

- Three kinds of user: free user, Premium user (paid), admin (every Premium feature, plus the Admin page).
- Limits and prices live only in `server/plans.js`; routes enforce them with `perksOf(req.user)` and the `PLAN_LIMIT` error.
- Simulated checkout in `server/routes/billing.js` + `server/card.js`: the server computes the price, the card number and CVC are never stored, a payment and the plan change are one transaction.

## 5. Money and data model

- **All amounts are integers in millimes** (1 TND = 1000 millimes). Never use floats for money.
- `src/utils/money.js` is the only place that converts: `formatMillimes`, `formatTnd`, `splitMillimes`, `parseTndToMillimes`. User input in dinars is converted to millimes before any calculation.
- Display format: `7,847.350 TND` (English number format, always 3 decimals).
- Identifiers are strings called **`_id`** (like a serialized MongoDB `ObjectId`). References use the same format. Dates are **ISO 8601** strings. Month keys are `"YYYY-MM"`.

Collections (the arrays exported by `src/data.js`):

| Collection     | Fields                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`        | `_id`, `fullName`, `email`, `passwordHash`                                                                                                            |
| `accounts`     | `_id`, `userId`, `name`, `type` (`checking` / `savings` / `cash`), `openingBalance`, `currency` (`"TND"`), `status` (`active` / `closed`), `closedAt` |
| `categories`   | `_id`, `name`, `kind` (`expense` / `income` / `transfer`)                                                                                             |
| `transactions` | `_id`, `accountId`, `type` (`debit` / `credit`), `amount` (positive millimes), `categoryId`, `date`, `description`, `transferId` (nullable)           |
| `budgets`      | `_id`, `userId`, `categoryId`, `month`, `limit` (millimes)                                                                                            |

`npm run seed` (server/scripts/seed.js) loads the seed into MongoDB and computes each account `balance` and each transaction `balanceAfter` from `openingBalance` and the ordered ledger. Seed dates are generated relative to today, so the current month always contains data. In MongoDB, dates are stored as Date values and transactions also carry `userId`.

Demo accounts (password `demo1234`): `amine@tunibudget.tn` (3 accounts, 4 months of history) and `salma@tunibudget.tn` (2 accounts).

## 6. Architecture

```
index.html
package.json              scripts: project, build, start, seed, make-admin, check-env, test
vite.config.js            forwards /api to the API in development
.env.example              documented environment variables (copy to .env, never commit .env)
scripts/dev.js            starts the API and Vite together
server/
  index.js                entry point: loadConfig, connect, listen (HTTP or HTTPS)
  config.js               reads and checks environment variables
  app.js                  middleware order: requestId, HTTPS, helmet, /api (no-store, rate limit, JSON 10 kB, injection guard, CSRF), routes, static dist, error handler
  db.js                   MongoDB collections, indexes, inTransaction()
  errors.js               ApiError (code -> HTTP status), errorHandler
  validate.js             every input goes through these functions
  idempotency.js          Idempotency-Key for money movements
  mailer.js               password reset email (console in development)
  security/               password.js (scrypt), sessions.js (cookie + Mongo sessions), tokens.js, middleware.js, rateLimits.js, audit.js
  routes/                 auth, accounts, transactions (+ categories), transfers, budgets, analytics, admin
  scripts/                seed.js, make-admin.js, check-env.js
  tests/                  node:test unit tests
src/
  main.jsx                mounts <App />
  App.jsx                 global state (user, page, version, toast, theme) + page switch + session restore
  data.js                 demo data, only read by server/scripts/seed.js
  services/               the ONLY layer the UI talks to
    api.js                fetch wrapper: cookie session, X-Requested-With, Idempotency-Key, ServiceError
    errors.js             ServiceError
    auth.js, accounts.js, transactions.js, transfers.js, budgets.js, analytics.js
    index.js              re-exports everything
  utils/                  money.js (shared with the server), dates.js
  components/, pages/, styles/
```

Rules:

1. **Components and pages never call `fetch` and never import `data.js`.** They import from `src/services/index.js` only.
2. **Every service function is async** and returns a Promise. Pages handle `loading` and `error` states.
3. **Errors** are `ServiceError` instances with a stable `code` and a human-readable English `message`, the same as the API's. Codes: `UNAUTHENTICATED`, `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `EMAIL_TAKEN`, `ACCOUNT_NOT_FOUND`, `ACCOUNT_NOT_EMPTY`, `ACCOUNT_CLOSED`, `SAME_ACCOUNT`, `INVALID_AMOUNT`, `INSUFFICIENT_FUNDS`, `CATEGORY_NOT_FOUND`, `BUDGET_NOT_FOUND`, `TRANSFER_FAILED`, `DUPLICATE_REQUEST`, `RESET_LINK_INVALID`, `RATE_LIMITED`, `FORBIDDEN`, `NOT_FOUND`, `NETWORK_ERROR`, `SERVER_ERROR`.
4. **The UI never handles a token.** The session is an HttpOnly cookie set by the server; every route reads the user from it (`requireAuth`), never from the request body.
5. **Filtering, sorting and pagination happen on the server**, e.g. `getTransactions({ accountId, type, categoryId, from, to, minAmount, maxAmount, page, limit })` returns `{ items, total, page, limit, totalPages }`.
6. **Business rules live on the server.** Components only display and collect input; client-side checks are for comfort only.
7. **Refreshing data**: after any write, a page calls `onChange()` (it bumps the `version` counter in `App`); pages reload when `version` changes.
8. State is never mutated in place: build new objects and arrays.

## 7. How the ACID transfer works

`server/routes/transfers.js` → `POST /api/transfers` `{ fromAccountId, toAccountId, amount, description, simulateFailure }`:

1. Validate the input (ids, integer amount > 0, different accounts). Invalid input fails before any transaction starts.
2. **BEGIN** a MongoDB transaction (`inTransaction`, snapshot read concern, majority write concern). Claim the Idempotency-Key.
3. Check ownership and active status of both accounts, then **lock** them by writing to both (concurrent transfers get a write conflict and are retried by MongoDB).
4. **Debit** with a conditional write `{ balance: { $gte: amount } }` + `$inc`. If no document matches, **rollback** (`INSUFFICIENT_FUNDS`).
5. If `simulateFailure` is set, throw: MongoDB aborts the transaction and the debit disappears (`TRANSFER_FAILED`).
6. **Credit** the destination and insert both ledger entries (same `transferId`).
7. **COMMIT** when the function returns.

The response (or the error body) contains the `steps` journal (`begin`, `lock`, `debit`, `credit`, `commit`, `rollback`) shown by the Transfer page. `planTransferSteps()` in `src/services/transfers.js` builds the same titles for the preview.

## 8. Security rules (do not weaken)

- Passwords: scrypt (`server/security/password.js`), policy in `validate.newPassword`. Never log or return a hash.
- Sessions: random token in an `HttpOnly`, `SameSite=Strict` cookie (`Secure` + `__Host-` in production); only an HMAC of it is stored; 8 h absolute, 30 min idle; all sessions end on password reset.
- Every route validates its input with `server/validate.js` and `onlyFields` (no mass assignment). MongoDB filters are built from validated plain values only; never pass `req.body` or `req.query` into a query.
- Every query on user data is filtered by `req.user._id`.
- Writes require the `X-Requested-With: TuniBudget` header and the app's Origin (CSRF).
- Money movements: conditional writes inside `inTransaction`, plus an `Idempotency-Key`. Amounts and balances are never trusted from the browser.
- Reset links: random token, SHA-256 stored, 15 min, single use, generic answer.
- Rate limits in `server/security/rateLimits.js`; security events through `audit()`; admin routes behind `requireAuth` + `requireAdmin` and created only with `npm run make-admin`.
- Production: HTTPS enforced (redirect/refuse + HSTS), env checked at start-up, `.env` never committed.

## 9. Design conventions

- Visual identity: light mode is the default. Fixed hero panels retain dark "night" surfaces (`#0B0D0C`) lit by an emerald aurora glow, alongside a green gradient balance card, gold accents and a soft-yellow pill call to action with a dark round arrow; the zellige eight-point star stays on the balance hero and the login panel. Dark mode remains available through the theme toggle.
- Tokens (in `global.css`): background `#0B0D0C` / card `#141816` (dark), `#F1F3EE` / `#FFFFFF` (light); accent emerald (`--blue` `#5CC893` dark, `#1F7A55` light; the historic token names are kept), call to action `--cta` `#FBF38C`, gold `--gold` `#E2C36C`, green (money in), amber (near the limit), red (exceeded). Shapes: 24 px panels, pill buttons and tabs. Credit/debit are always told apart by a sign (+ / −) as well as colour.
- Millimes are a first-class part of every amount: the integer part is large, the `.350` part is lighter.
- Charts: thin 2 px lines, bars with a rounded data end, one hue for one series, direct labels only where useful, hover details, and a text alternative (`aria-label`).
- Error and empty states say what happened and what to do next.

## 10. Working rules for the agent

1. Respect sections 2, 3 and 8 strictly: no new dependency, no other hook, no weaker security rule.
2. Do not add features outside the five listed above without an explicit request. Finish them in priority order.
3. Keep UI text, code, comments and file names in English.
4. Handle edge cases: empty lists, insufficient balance, invalid forms, filters with no result, loading and error states.
5. The ledger is immutable: never add edit or delete actions for transactions.
6. Before saying a task is done, check that `npm install` then `npm run project` start without error, that the browser console is clean, and that `npm run build` and `npm test` pass.
7. Keep the code readable: this project is graded and presented orally.
