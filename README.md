# TuniBudget

A personal finance and mini-banking web app. Hold several accounts in Tunisian dinar (TND), move money between them safely, and track your spending with categories, monthly budgets and charts.

Built for the **CS324** course (Professors Bochra Khiari and Aymen Hammami).

> **Current scope: front-end only.** There is no backend and no database. All data is mock data kept in memory in the browser, and reloading the page resets it. The ACID transfer engine is simulated in the front-end, in a service layer designed to be swapped for real API calls later.

## Team

- Emna Ghozzi
- Layth Ridene
- Yassin Chalghaf
- Jad Kmayel

## Features

- **Authentication and accounts**: register, log in and log out (simulated). Create several accounts (checking, savings, cash), rename them, and close them only when the balance is exactly 0. Closed accounts stay visible so history is preserved.
- **Atomic transfers**: move money between your own accounts. Each transfer creates two linked ledger entries (a debit and a credit) sharing one `transferId`. The Transfer page shows a live transaction journal (begin, lock, debit, credit, commit or rollback), a "simulate a crash" switch and a concurrency demo.
- **Transaction history**: an immutable ledger with filters (account, type, category, date range, min/max amount), pagination (10 rows per page, newest first) and the balance after each movement. Add expenses and income; an expense can never exceed the account balance.
- **Categories and budgets**: a monthly budget per expense category. Status is **ok** below 80 %, **near the limit** from 80 % to below 100 %, and **exceeded** from 100 %, always shown with an icon and text, never colour alone.
- **Dashboard and analytics**: total balance, a 30/90-day balance curve with hover details, a month summary (income, expenses, what is left), spending by category, budget alerts and the latest movements.
- **Light and dark themes**, responsive layout, keyboard accessible, and fully offline (no CDNs, system font stack, inline SVG icons).

## The ACID transfer engine

The core of the project is the transfer, modelled as a database transaction:

| Property | How it is guaranteed |
| --- | --- |
| **Atomicity** | Debit and credit are applied to a draft copy and committed in a single assignment. Any failure discards the draft and nothing changes. |
| **Consistency** | Amounts must be integers greater than 0, accounts must differ, belong to the user and be active, and a balance can never go negative. |
| **Isolation** | Transfers run through a global lock queue, so a second transfer waits and sees the up-to-date balance (no double spending). |
| **Durability** | Committed movements stay in the ledger. There is no edit or delete function for transactions. |

The flow in `src/services/transfers.js`: validate, enter the lock queue, **BEGIN** (draft copy), check balance, **debit**, optional simulated crash (rollback), **credit**, **COMMIT**.

## Tech stack

- HTML, CSS, JavaScript
- React 18 (only `useState` and `useEffect`)
- Vite 5 (build tool)

Runtime dependencies are limited to `react` and `react-dom`. There is no router, no state library, no chart library and no UI kit: navigation is a `page` state in `App`, shared state is lifted into `App` and passed down through props, and charts are hand-drawn SVG.

## Getting started

You need [Node.js](https://nodejs.org/) installed.

```bash
npm install
npm run project
```

The app opens in your browser at `http://localhost:5173`.

Other scripts:

```bash
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

### Demo accounts

Password for both: `demo1234`

| Email | Data |
| --- | --- |
| `amine@tunibudget.tn` | 3 accounts, 4 months of history |
| `salma@tunibudget.tn` | 2 accounts |

The login page also has a button that fills in the first demo account for you. Seed dates are generated relative to today, so the current month always contains data.

## Project structure

```
index.html
package.json
vite.config.js
agent.md                  conventions for AI coding agents
src/
  main.jsx                mounts <App />
  App.jsx                 global state (user, page, version, toast, theme) + page switch
  data.js                 mock data (the only seed of the project)
  services/               fake "API": the only layer the UI talks to
    errors.js             ServiceError, delay, global lock queue, settings
    session.js            current user id (plays the role of an auth token)
    db.js                 in-memory database built from data.js
    queries.js            shared internal helpers (ownership checks, month totals)
    auth.js               login, register, logout
    accounts.js           getAccounts, createAccount, renameAccount, closeAccount
    transactions.js       getCategories, getTransactions, addOperation
    transfers.js          planTransferSteps, transfer (the ACID simulation)
    budgets.js            getBudgets, setBudget, removeBudget
    analytics.js          getMonthSummary, getSpendingByCategory, getBalanceHistory
    index.js              re-exports everything
  utils/                  money.js, dates.js, hash.js
  components/             reusable pieces (NavBar, Toast, Pagination, charts, ...)
  pages/                  Auth, Dashboard, Accounts, Transfer, History, Budgets
  styles/                 global.css, layout.css, components.css, pages.css
```

## Architecture rules

1. Components and pages import only from `src/services/index.js`, never from `data.js` or `db.js`.
2. Every service function is async and has a small simulated latency, so pages handle loading and error states as they would with a real API.
3. Errors are `ServiceError` instances with a stable `code` (for example `INSUFFICIENT_FUNDS`, `SAME_ACCOUNT`, `ACCOUNT_NOT_EMPTY`) and a readable English message.
4. `login()` stores the user in `session.js` and every service reads it from there, mimicking an `Authorization` header.
5. Filtering, sorting and pagination happen in the services. Business rules live in `services/` and `utils/`, not in components.
6. After any write, a page calls `onChange()`, which bumps a `version` counter in `App`; pages reload when it changes.
7. State is never mutated in place.

## Money and data model

- All amounts are **integers in millimes** (1 TND = 1000 millimes). Floats are never used for money.
- `src/utils/money.js` is the only place that converts amounts. Display format: `7,847.350 TND`.
- Identifiers are string `_id` values, dates are ISO 8601, and month keys are `"YYYY-MM"`.

| Collection | Fields |
| --- | --- |
| `users` | `_id`, `fullName`, `email`, `passwordHash` |
| `accounts` | `_id`, `userId`, `name`, `type`, `openingBalance`, `currency`, `status`, `closedAt` |
| `categories` | `_id`, `name`, `kind` (`expense` / `income` / `transfer`) |
| `transactions` | `_id`, `accountId`, `type` (`debit` / `credit`), `amount`, `categoryId`, `date`, `description`, `transferId` |
| `budgets` | `_id`, `userId`, `categoryId`, `month`, `limit` |

Transfers use the neutral `Transfer` category and are excluded from spending and income statistics.

## Roadmap: MongoDB backend

The backend (Node + MongoDB) will be added later. Because the UI only talks to `src/services/`, the migration is small:

- Replace the body of each service function with a `fetch` to the API, keeping the same name, arguments, return shape and error codes.
- Run real transfers inside a **MongoDB multi-document transaction** (`session.withTransaction`, which needs a replica set such as MongoDB Atlas) with conditional updates like `{ _id, balance: { $gte: amount } }` and `$inc`, so concurrent transfers cannot overdraw an account.
- Hash passwords with bcrypt on the server and use JWT sessions.
- Keep the ledger collection append-only (no update or delete routes).

## Design

Inspired by Tunisia: the blue of the doors of Sidi Bou Said, chalk-white backgrounds and a zellige eight-point star pattern on the balance hero and login panel. Credit and debit are always distinguished by a sign (+ / −) as well as colour.
