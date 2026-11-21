# 💰 Freelance Money Planner

**Plan irregular freelance income properly — tax pot, envelope budgets, bills and savings goals in one offline web app. No account, no upload, no subscription.**

Freelancers do not earn a salary. One month brings Rs. 140,000, the next
Rs. 60,000 — and most budgeting apps assume a steady paycheque, so they
either mislead you or charge $10–15/month for the privilege (YNAB), demand
an install and a self-hosted server (Actual Budget), or die quietly
(Mint, 2024). This planner is built for the way freelancers actually get
paid: it plans from your **3-month average income**, sets aside tax before
you can spend it, and treats expected payments as what they are — not
yours yet.

## The problem it fills

- **Irregular income:** a good month makes you feel rich and a dry month
  makes you panic. Planning from a 3-month average (zeros included, so a
  dry month drags the average down honestly) gives you one safe monthly
  budget number to live by.
- **Tax surprises:** freelancers forget tax until it is due. A
  configurable tax pot (default 10%) is carved out of every rupee received
  and shown separately from money you can spend.
- **Bills slipping:** rent, internet, subscriptions — the app flags bills
  due in the next 7 days and overdue ones, and paying a bill records the
  expense automatically so reports stay honest.
- **No savings plan:** goals show exactly how much to save per month to
  hit a deadline, instead of a vague "save more".

## Who it helps

Freelancers, eBay sellers, marketers, designers, developers and small
business owners — anyone whose income arrives in lumps, in PKR, USD, GBP,
EUR, INR or AED. It pairs naturally with an invoice tool: invoice the
client, then track the payment here until it lands.

## Features

- **Dashboard** — income received vs expected, expenses, balance, tax pot,
  savings rate, 3-month average + safe monthly budget, "needs attention"
  alerts (overdue payments, bills due soon, envelopes over budget, goals
  near deadline), goals snapshot, recent activity.
- **Income** — received vs expected entries (client, category, type, note);
  mark expected payments received when they land; 3-month average and
  safe budget always visible.
- **Expenses & envelopes** — envelope budgets per category with live
  remaining amounts and overspend warnings; add/edit/delete envelopes;
  expenses attach to an envelope.
- **Recurring bills** — name, amount, day of month, category; statuses
  paid / due soon / overdue / upcoming (short months handled — a bill due
  on the 31st falls on the 28th in February); marking paid creates the
  expense for you.
- **Savings goals** — target, deadline, already-saved; progress bars and
  the exact monthly saving needed to finish on time.
- **Reports** — monthly summary (including "truly spendable" =
  balance minus tax pot), spending-by-category bar chart, 6-month
  income-vs-expenses line chart, CSV export (income / expenses), full
  JSON backup + import, print / save-as-PDF monthly report.
- **Settings** — 6 currencies, tax rate, business name; one-click demo
  data; erase-all with confirmation.
- **Money done right** — every amount is stored and calculated in integer
  minor units (paisa/cents), never floats, so totals never drift by a
  few paisa. All logic is covered by 20 automated tests.
- **Private by design** — data lives only in your browser's localStorage.
  No account, no server, no analytics, no upload. Export a JSON backup
  to move devices.

## How to use it

No install, no build step, no backend.

1. **Open `index.html`** — double-click it, or serve the folder:
   `python3 -m http.server` and visit `http://localhost:8000`.
2. **Load the demo data** (Settings → Load demo data) to see a realistic
   freelancer month, or start empty and add your own income.
3. Add income as **received** or **expected**, set envelope budgets,
   add your recurring bills and a savings goal.
4. Check the Dashboard each week: pay what is due soon, chase what is
   overdue, and keep spending under the safe budget.
5. At month end, open Reports, export CSVs, and print / save the PDF.

Your data is saved automatically in the browser. Use Reports →
**Download full backup (JSON)** regularly — clearing browser data
erases it.

## Demo data

Settings → **Load demo data** fills in a realistic November 2026 month
for a Pakistani freelancer (PKR): Rs. 143,500 received, Rs. 95,000
expected (one payment overdue), Rs. 55,499 spent, a 10% tax pot, 5 bills
and 3 goals. See `examples/demo-data.json` (the same data, importable)
and `examples/sample-monthly-report.md` (the month it produces).

## Run the tests

```bash
node --test js/money.test.js
# 20 tests — money maths, dates, averages, tax pot, envelopes,
# bill statuses, goals, CSV export and import validation.
```

## Technologies

- HTML + CSS + vanilla JavaScript — zero dependencies, zero build step,
  works from a double-clicked file.
- Hand-rolled canvas charts (no chart library, no network calls).
- `localStorage` for persistence; JSON for backup / import.
- Node's built-in test runner for the core money module (`js/money.js`
  is pure functions — no DOM — so it is testable in plain Node).

## Project structure

```
freelance-money-planner/
├── index.html                  # the whole app UI
├── css/styles.css              # navy theme, responsive + print styles
├── js/
│   ├── money.js                # pure money/date logic (tested)
│   ├── money.test.js           # 20 tests, node --test
│   ├── store.js                # localStorage, import/export, demo data
│   ├── charts.js               # dependency-free canvas charts
│   └── app.js                  # UI wiring (tabs, forms, rendering)
├── examples/
│   ├── demo-data.json          # importable demo month
│   └── sample-monthly-report.md# the report the demo data produces
├── LICENSE                     # MIT
└── README.md
```

## Screenshots

Open `index.html` and load the demo data — the Dashboard, Reports charts
and Goals tabs are the tour. (No screenshots are bundled; the app is a
single file you can run immediately.)

## License

MIT — see [LICENSE](LICENSE).
