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

## 2. Current scope: front-end only

- There is **NO backend and NO database** for now. All data is **mock data** that lives in `src/data.js` and is kept **in memory** in the browser.
- Forbidden for now: servers (Node/Express…), databases (SQL, SQLite, MongoDB, Firebase…), real network calls (`fetch`, `axios`…), `.env` files, Docker, external CDNs, `localStorage`/`sessionStorage`.
- The ACID engine is **simulated in the front-end** (section 7), in code that is easy to replace later by real API calls (section 8).
- Reloading the page resets the data to the seed in `src/data.js`. This is intended.

**The project must run with exactly these two commands, on any machine that has Node.js:**

```
npm install
npm run project
```

`npm run build` must also succeed with no error.

## 3. Hard technical constraints

Allowed technologies: **HTML, CSS, JavaScript, React**. Nothing else at runtime.

React hooks allowed: **`useState` and `useEffect` only.**

- Forbidden: `useContext`/`createContext`, `useReducer`, `useRef`, `useMemo`, `useCallback`, `useLayoutEffect`, `useId`, `memo`, custom hooks, and any other hook.
- Forbidden libraries: Redux, Zustand, React Router, chart libraries, UI kits (MUI, Tailwind, Bootstrap…), icon packs, date or money libraries, axios, etc. The only runtime dependencies are `react` and `react-dom`. The only dev dependencies are `vite` and `@vitejs/plugin-react`.
- Consequences:
  - **Shared state** lives in `App` and goes down through **props** (lifting state up). No Context.
  - **Navigation** has no router: a `page` state in `App` decides which page is rendered.
  - **Charts** are drawn by hand in **SVG** (or `div` + CSS).
  - **Derived values** (totals, percentages, filtered lists) are computed in the render with plain JavaScript.
  - **Data loading** uses `useEffect` + `useState` (`data`, `error`) in each page, calling the functions of `src/services/`.
  - `useEffect` is for loading data, timers (toast auto-dismiss) and the document title. Never use an effect to compute a value that can be computed during render.
- Fonts, icons and images are local files or inline SVG. Use a system font stack. The app must work offline.

Code style:

- Function components only, one component per file, PascalCase file names for components.
- Plain CSS files in `src/styles/` with CSS variables (design tokens in `global.css`). No CSS-in-JS, no inline style for anything that is not truly dynamic.
- Responsive (desktop and mobile), keyboard accessible, visible focus, real `<button>`, `<a>`, `<label>` elements.
- Short comments only where the ACID simulation or a non-obvious rule needs explaining.

## 4. Features (in priority order)

### 1. Authentication and account management

- Register, log in, log out (simulated against mock users; the password "hash" is simulated, never store a real secret).
- The logged-in user is kept in the state of `App`. Without a user, only the login/register page is shown.
- A user can **create and manage several accounts**: name, type (checking, savings, cash), balance, currency TND. Accounts can be renamed and can be closed only when the balance is exactly 0. Closed accounts stay visible (history is kept).

### 2. Atomic money transfers (core of the project)

- Form: source account, destination account, amount, optional note.
- Validation rules:
  - source ≠ destination, both accounts belong to the user and are active;
  - amount is an **integer > 0 in millimes**;
  - the source balance must be sufficient (a balance never goes negative).
- A transfer creates **two linked ledger entries** (one debit, one credit) sharing the same `transferId`.
- **Atomicity**: the new state is built on a draft copy, validated, then applied in **one single commit**. If any step fails, **nothing changes** (rollback).
- **Isolation (simulated)**: transfers go through a global lock queue; each transfer is evaluated against the up-to-date balance.
- The Transfer page shows the **transaction journal** (begin, lock, debit, credit, commit, or rollback) and has a "simulate a crash" switch plus a concurrency demo, so the ACID behaviour can be shown live in the course presentation.

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

At start-up `src/services/db.js` copies the seed, then computes each account `balance` and each transaction `balanceAfter` from `openingBalance` and the ordered ledger. Seed dates are generated relative to today, so the current month always contains data.

Demo accounts (password `demo1234`): `amine@tunibudget.tn` (3 accounts, 4 months of history) and `salma@tunibudget.tn` (2 accounts).

## 6. Architecture

```
index.html
package.json              scripts: project, build, preview
vite.config.js
agent.md
src/
  main.jsx                mounts <App />
  App.jsx                 global state (user, page, version, toast) + page switch
  data.js                 MOCK DATA (the only seed of the project)
  services/               fake "API": the ONLY layer the UI talks to
    errors.js             ServiceError, delay, global lock queue, settings
    session.js            current user id (plays the role of an auth token)
    db.js                 in-memory database built from data.js
    queries.js            internal helpers shared by services (ownership checks, month totals)
    auth.js               login, register, logout
    accounts.js           getAccounts, createAccount, renameAccount, closeAccount
    transactions.js       getCategories, getTransactions, addOperation
    transfers.js          planTransferSteps, transfer (the ACID simulation)
    budgets.js            getBudgets, setBudget, removeBudget
    analytics.js          getMonthSummary, getSpendingByCategory, getBalanceHistory
    index.js              re-exports everything
  utils/                  money.js, dates.js, hash.js
  components/             reusable pieces (NavBar, Toast, Pagination, charts…)
  pages/                  AuthPage, DashboardPage, AccountsPage, TransferPage, HistoryPage, BudgetsPage
  styles/                 global.css, layout.css, components.css, pages.css
```

Rules:

1. **Components and pages never import `data.js` or `db.js`.** They import from `src/services/index.js` only.
2. **Every service function is async** and returns a Promise, with a small simulated latency (`settings.latencyMs`). Pages handle `loading` and `error` states as they would with a real API.
3. **Errors** are `ServiceError` instances with a stable `code` and a human-readable English `message`. Codes: `UNAUTHENTICATED`, `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `ACCOUNT_NOT_FOUND`, `ACCOUNT_NOT_EMPTY`, `ACCOUNT_CLOSED`, `SAME_ACCOUNT`, `INVALID_AMOUNT`, `INSUFFICIENT_FUNDS`, `CATEGORY_NOT_FOUND`, `TRANSFER_FAILED`.
4. **The UI does not know who is logged in through arguments.** `login()` stores the user in `session.js`; every service reads it (this mimics an `Authorization` header).
5. **Filtering, sorting and pagination happen in the services**, e.g. `getTransactions({ accountId, type, categoryId, from, to, minAmount, maxAmount, page, limit })` returns `{ items, total, page, limit, totalPages }`.
6. **Business rules live in `services/` and `utils/`**, not in components. Components only display and collect input.
7. **Refreshing data**: after any write, a page calls `onChange()` (it bumps the `version` counter in `App`); pages reload when `version` changes.
8. State is never mutated in place: build new objects and arrays.

## 7. How the ACID transfer is simulated

`services/transfers.js` → `transfer({ fromAccountId, toAccountId, amount, description, simulateFailure })`:

1. Validate the input (amount, different accounts, ownership, active accounts). Invalid input fails immediately, before any transaction starts.
2. Enter the **global lock queue** (`withLock`). Only one transfer runs at a time, so a second transfer waits and then sees the up-to-date balance (isolation).
3. **BEGIN**: copy the accounts and the ledger into a **draft**.
4. Check the source balance on the draft. If it is too low, **rollback** (`INSUFFICIENT_FUNDS`).
5. **Debit** the source on the draft. Wait a moment (a crash can happen here).
6. If `simulateFailure` is set, **rollback** (`TRANSFER_FAILED`): the draft is thrown away, the real data is untouched.
7. **Credit** the destination on the draft.
8. **COMMIT**: replace the real accounts and ledger with the draft in a single assignment.

The function returns (or attaches to the thrown error) a list of `steps` (`begin`, `lock`, `debit`, `credit`, `commit`, `rollback`) with their status. The Transfer page shows them as a journal. `planTransferSteps()` builds the same titles for the "what will happen" preview.

## 8. Preparing the future MongoDB backend

The backend will be added later (Node + MongoDB). Keeping the rules of section 6 makes the migration small:

- Replace the **body** of each function in `src/services/` by a `fetch` to the API, keeping the same name, arguments, return shape and error codes. Pages and components do not change.
- Add one `API_URL` constant in `src/services/`. Only at that stage can `.env` files and `fetch` be introduced.
- Seed data already uses `_id`, ISO dates and integer millimes, so documents map directly to MongoDB collections.
- The real transfer must use a **MongoDB multi-document transaction** (`session.withTransaction`, which needs a replica set; MongoDB Atlas provides one) and update balances with conditional updates such as `{ _id, balance: { $gte: amount } }` with `$inc`, so two concurrent transfers cannot overdraw an account.
- Passwords are hashed with bcrypt on the server and sessions use a JWT. The front-end never handles hashes.
- The ledger collection must stay append-only (no update or delete routes).

## 9. Design conventions

- Visual identity: the blue of the doors of Sidi Bou Said, chalk-white backgrounds, a zellige eight-point star pattern on the balance hero and the login panel.
- Tokens (in `global.css`): ink `#0B1F4B`, blue `#1D4FB8`, deep blue `#123B8F`, background `#F4F5F7`, muted text `#56607A`, green `#11704F` (money in), amber (near the limit), red `#B8321A` (exceeded). Credit/debit are always told apart by a sign (+ / −) as well as colour.
- Millimes are a first-class part of every amount: the integer part is large, the `.350` part is lighter.
- Charts: thin 2 px lines, bars with a rounded data end, one hue for one series, direct labels only where useful, hover details, and a text alternative (`aria-label`).
- Error and empty states say what happened and what to do next.

## 10. Working rules for the agent

1. Respect sections 2 and 3 strictly: no new dependency, no other hook, no network.
2. Do not add features outside the five listed above without an explicit request. Finish them in priority order.
3. Keep UI text, code, comments and file names in English.
4. Handle edge cases: empty lists, insufficient balance, invalid forms, filters with no result, loading and error states.
5. The ledger is immutable: never add edit or delete actions for transactions.
6. Before saying a task is done, check that `npm install` then `npm run project` start without error, that the browser console is clean and that `npm run build` passes.
7. Keep the code readable: this project is graded and presented orally.
