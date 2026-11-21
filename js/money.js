/**
 * Freelance Money Planner — core money logic (js/money.js)
 *
 * Pure functions only: no DOM, no localStorage, no network. That is why
 * this file can be tested in plain Node (see js/money.test.js) and reused
 * by the browser app (js/app.js) without change.
 *
 * GOLDEN RULE: money is always stored and calculated in INTEGER MINOR
 * UNITS (paisa / cents). Never store or add decimal amounts — 0.1 + 0.2
 * style float drift would silently corrupt a freelancer's books.
 *   toMinor("85,000.50") -> 8500050
 *   fromMinor(8500050)   -> 85000.5
 */

'use strict';

/* ------------------------------------------------------------------ */
/* Currencies                                                          */
/* ------------------------------------------------------------------ */

/** Supported currencies. `minor` is always 100 (2 decimal places). */
const CURRENCIES = {
  PKR: { code: 'PKR', symbol: 'Rs. ', decimals: 2 },
  USD: { code: 'USD', symbol: '$', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', decimals: 2 },
  INR: { code: 'INR', symbol: '₹', decimals: 2 },
  AED: { code: 'AED', symbol: 'AED ', decimals: 2 },
};

/** Fall back to USD for an unknown currency code (never crash on bad data). */
function currencyInfo(code) {
  return CURRENCIES[code] || CURRENCIES.USD;
}

/* ------------------------------------------------------------------ */
/* Minor-unit conversion                                               */
/* ------------------------------------------------------------------ */

/**
 * Convert a user-typed amount ("85,000.50", 85000.5, "85000") to integer
 * minor units. Returns null when the input is not a usable amount.
 * Accepts commas and surrounding whitespace; rejects negatives here —
 * callers decide whether a negative is meaningful (it never is for this app).
 */
function toMinor(input) {
  if (input === null || input === undefined || input === '') return null;
  const cleaned = String(input).replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Math.round(parseFloat(cleaned) * 100);
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}

/** Minor units back to a plain number (e.g. 8500050 -> 85000.5). */
function fromMinor(minor) {
  return minor / 100;
}

/**
 * Format minor units for display, e.g. formatMoney(8500050, 'PKR')
 * -> "Rs. 85,000.50". Negative values keep the minus sign in front.
 */
function formatMoney(minor, currencyCode) {
  const info = currencyInfo(currencyCode);
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + info.symbol + grouped + '.' + frac;
}

/** Short form without decimals when the amount is whole, e.g. "Rs. 85,000". */
function formatMoneyShort(minor, currencyCode) {
  if (minor % 100 === 0) {
    return formatMoney(minor, currencyCode).replace(/\.00$/, '');
  }
  return formatMoney(minor, currencyCode);
}

/* ------------------------------------------------------------------ */
/* Dates and months                                                    */
/* ------------------------------------------------------------------ */

/** "2026-11-21" -> "2026-11". Returns null for anything malformed. */
function monthKey(dateStr) {
  if (typeof dateStr !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return m[1] + '-' + m[2];
}

/** Shift a "YYYY-MM" key by n months (n may be negative). */
function addMonths(ym, n) {
  const parts = ym.split('-');
  let year = Number(parts[0]);
  let month = Number(parts[1]) - 1 + n;
  year += Math.floor(month / 12);
  month = ((month % 12) + 12) % 12;
  return year + '-' + String(month + 1).padStart(2, '0');
}

/** Today's date as "YYYY-MM-DD" in the user's local timezone. */
function todayStr(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/** Number of days in a given month ("2026-02" -> 28). */
function daysInMonth(ym) {
  const parts = ym.split('-');
  return new Date(Number(parts[0]), Number(parts[1]), 0).getDate();
}

/** Whole days from date A to date B ("2026-11-01" -> "2026-11-21" = 20). */
function daysBetween(a, b) {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  const da = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((db - da) / 86400000);
}

/** Is the string a real calendar date (rejects 2026-02-30 etc.)? */
function isValidDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) &&
    d.getMonth() === Number(m[2]) - 1 &&
    d.getDate() === Number(m[3]);
}

/* ------------------------------------------------------------------ */
/* Monthly totals                                                      */
/* ------------------------------------------------------------------ */

/**
 * Sum the `amountMinor` of entries whose date falls in the given month.
 * `filter` optionally narrows by entry fields, e.g. { status: 'received' }.
 */
function sumForMonth(entries, ym, filter) {
  let total = 0;
  for (const e of entries || []) {
    if (monthKey(e.date) !== ym) continue;
    if (filter) {
      let ok = true;
      for (const key of Object.keys(filter)) {
        if (e[key] !== filter[key]) { ok = false; break; }
      }
      if (!ok) continue;
    }
    total += e.amountMinor || 0;
  }
  return total;
}

/**
 * Average RECEIVED income over the last `n` calendar months ending at
 * `refMonth` (zeros included — a dry month must drag the average down,
 * otherwise the "safe budget" would lie). Returns integer minor units.
 */
function averageIncome(incomeEntries, refMonth, n) {
  const months = n || 3;
  let total = 0;
  for (let i = months - 1; i >= 0; i--) {
    const ym = addMonths(refMonth, -i);
    total += sumForMonth(incomeEntries, ym, { status: 'received' });
  }
  return Math.round(total / months);
}

/**
 * Tax pot: the slice of received income to set aside for tax.
 * `ratePct` is e.g. 10 for 10%. Rounded to the nearest minor unit.
 */
function taxPot(receivedMinor, ratePct) {
  if (!ratePct || ratePct <= 0) return 0;
  return Math.round((receivedMinor * ratePct) / 100);
}

/**
 * Safe monthly budget: what a freelancer can actually plan to spend —
 * average income minus the tax slice. Never negative.
 */
function safeMonthlyBudget(averageMinor, ratePct) {
  return Math.max(0, averageMinor - taxPot(averageMinor, ratePct));
}

/** Savings rate for a month, in whole percent (0 when income is 0). */
function savingsRate(incomeMinor, expenseMinor) {
  if (incomeMinor <= 0) return 0;
  const saved = incomeMinor - expenseMinor;
  if (saved <= 0) return 0;
  return Math.round((saved / incomeMinor) * 100);
}

/* ------------------------------------------------------------------ */
/* Envelopes (category budgets)                                        */
/* ------------------------------------------------------------------ */

/** Money left in an envelope: budget minus what was spent. May be negative. */
function envelopeRemaining(budgetMinor, spentMinor) {
  return budgetMinor - spentMinor;
}

/** Envelope usage in whole percent (0 when the budget is 0). */
function envelopeUsagePct(budgetMinor, spentMinor) {
  if (budgetMinor <= 0) return 0;
  return Math.round((spentMinor / budgetMinor) * 100);
}

/** Total spent in one envelope category during a month. */
function spentInEnvelope(expenses, envelopeId, ym) {
  let total = 0;
  for (const e of expenses || []) {
    if (e.envelopeId === envelopeId && monthKey(e.date) === ym) {
      total += e.amountMinor || 0;
    }
  }
  return total;
}

/** Spending grouped by envelope/category for one month: { name: minor }. */
function spendingByCategory(expenses, envelopes, ym) {
  const byId = {};
  for (const env of envelopes || []) byId[env.id] = env.name;
  const totals = {};
  for (const e of expenses || []) {
    if (monthKey(e.date) !== ym) continue;
    const name = byId[e.envelopeId] || 'Uncategorised';
    totals[name] = (totals[name] || 0) + (e.amountMinor || 0);
  }
  return totals;
}

/* ------------------------------------------------------------------ */
/* Bills                                                               */
/* ------------------------------------------------------------------ */

/**
 * Work out a bill's next due date and status relative to `today`
 * ("YYYY-MM-DD"). A bill is due on `bill.dayOfMonth` each month; if that
 * day already passed this month and the bill is not marked paid for this
 * month, it is overdue. `paidMonths` is a list of "YYYY-MM" keys the
 * bill was already paid in.
 *
 * Returns { nextDue: "YYYY-MM-DD", status: "overdue"|"due-soon"|"upcoming"|"paid",
 *           daysUntil: number }.
 * "due-soon" means due within the next 7 days (including today).
 */
function billStatus(bill, today, paidMonths) {
  const ym = monthKey(today);
  const paid = (paidMonths || []).includes(ym);
  const dim = daysInMonth(ym);
  const day = Math.min(bill.dayOfMonth, dim);
  let due = ym + '-' + String(day).padStart(2, '0');
  if (paid) {
    const nextYm = addMonths(ym, 1);
    const nextDim = daysInMonth(nextYm);
    const nextDay = Math.min(bill.dayOfMonth, nextDim);
    const nextDue = nextYm + '-' + String(nextDay).padStart(2, '0');
    return { nextDue, status: 'paid', daysUntil: daysBetween(today, nextDue) };
  }
  if (daysBetween(due, today) > 0) {
    // This month's date passed unpaid — overdue.
    return { nextDue: due, status: 'overdue', daysUntil: daysBetween(today, due) };
  }
  const days = daysBetween(today, due);
  return {
    nextDue: due,
    status: days <= 7 ? 'due-soon' : 'upcoming',
    daysUntil: days,
  };
}

/* ------------------------------------------------------------------ */
/* Client payments (expected income)                                   */
/* ------------------------------------------------------------------ */

/** Expected income entries whose due date has passed and are unpaid. */
function overduePayments(incomeEntries, today) {
  return (incomeEntries || []).filter(function (e) {
    return e.status === 'expected' && e.date && daysBetween(e.date, today) > 0;
  });
}

/** Expected income due within the next `withinDays` days (not yet overdue). */
function upcomingPayments(incomeEntries, today, withinDays) {
  const n = withinDays === undefined ? 14 : withinDays;
  return (incomeEntries || []).filter(function (e) {
    if (e.status !== 'expected' || !e.date) return false;
    const d = daysBetween(today, e.date);
    return d >= 0 && d <= n;
  });
}

/* ------------------------------------------------------------------ */
/* Savings goals                                                       */
/* ------------------------------------------------------------------ */

/** Goal progress: percent (capped at 100) and amount still to save. */
function goalProgress(savedMinor, targetMinor) {
  if (targetMinor <= 0) return { pct: 0, remainingMinor: 0 };
  const pct = Math.min(100, Math.round((savedMinor / targetMinor) * 100));
  return { pct, remainingMinor: Math.max(0, targetMinor - savedMinor) };
}

/**
 * Whole months from `today` until the goal deadline ("YYYY-MM-DD").
 * Returns 0 when the deadline has passed (caller shows "overdue").
 */
function monthsUntil(deadline, today) {
  if (!isValidDate(deadline)) return null;
  const dm = monthKey(deadline);
  const tm = monthKey(today);
  const dp = dm.split('-').map(Number);
  const tp = tm.split('-').map(Number);
  const months = (dp[0] - tp[0]) * 12 + (dp[1] - tp[1]);
  return Math.max(0, months);
}

/** Monthly saving needed to hit the goal by its deadline (0 if already met). */
function monthlySavingNeeded(savedMinor, targetMinor, deadline, today) {
  const remaining = Math.max(0, targetMinor - savedMinor);
  if (remaining === 0) return 0;
  const months = monthsUntil(deadline, today);
  if (months === null || months === 0) return remaining;
  return Math.ceil(remaining / months);
}

/* ------------------------------------------------------------------ */
/* Reports and export                                                  */
/* ------------------------------------------------------------------ */

/**
 * Totals for each of the last `n` months ending at `refMonth`, oldest first:
 * [{ month: "2026-09", incomeMinor, expenseMinor }, ...]
 */
function monthlySeries(incomeEntries, expenseEntries, refMonth, n) {
  const out = [];
  const count = n || 6;
  for (let i = count - 1; i >= 0; i--) {
    const ym = addMonths(refMonth, -i);
    out.push({
      month: ym,
      incomeMinor: sumForMonth(incomeEntries, ym, { status: 'received' }),
      expenseMinor: sumForMonth(expenseEntries, ym),
    });
  }
  return out;
}

/** Escape one CSV cell (quotes, commas and newlines). */
function csvCell(value) {
  const s = String(value === null || value === undefined ? '' : value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Build a CSV string from a header array and rows of values. */
function buildCSV(headers, rows) {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  return lines.join('\n') + '\n';
}

/**
 * Validate a full imported data object (from JSON import). Returns an
 * array of problem strings; empty means the data is usable. Imported
 * money must already be in minor units.
 */
function validateImport(data) {
  const problems = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['Data is not an object.'];
  }
  for (const key of ['income', 'expenses', 'bills', 'goals', 'envelopes']) {
    if (data[key] !== undefined && !Array.isArray(data[key])) {
      problems.push('"' + key + '" must be a list.');
    }
  }
  const checkMoney = function (list, label) {
    for (const item of list || []) {
      if (item && typeof item.amountMinor !== 'number') {
        problems.push(label + ' entry "' + (item.description || item.name || '?') +
          '" has no valid amountMinor.');
      }
    }
  };
  checkMoney(data.income, 'Income');
  checkMoney(data.expenses, 'Expense');
  for (const b of data.bills || []) {
    if (b && typeof b.amountMinor !== 'number') {
      problems.push('Bill "' + (b.name || '?') + '" has no valid amountMinor.');
    }
  }
  for (const g of data.goals || []) {
    if (g && (typeof g.savedMinor !== 'number' || typeof g.targetMinor !== 'number')) {
      problems.push('Goal "' + (g.name || '?') + '" has no valid saved/target amounts.');
    }
  }
  return problems;
}

/* ------------------------------------------------------------------ */
/* Exports (Node + browser)                                            */
/* ------------------------------------------------------------------ */

const api = {
  CURRENCIES, currencyInfo,
  toMinor, fromMinor, formatMoney, formatMoneyShort,
  monthKey, addMonths, todayStr, daysInMonth, daysBetween, isValidDate,
  sumForMonth, averageIncome, taxPot, safeMonthlyBudget, savingsRate,
  envelopeRemaining, envelopeUsagePct, spentInEnvelope, spendingByCategory,
  billStatus, overduePayments, upcomingPayments,
  goalProgress, monthsUntil, monthlySavingNeeded,
  monthlySeries, csvCell, buildCSV, validateImport,
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.FMP = api;
