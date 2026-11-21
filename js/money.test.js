/**
 * Freelance Money Planner — tests for js/money.js
 *
 * Run:  node --test js/money.test.js
 * (Node's built-in test runner, no dependencies to install.)
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('./money.js');

/* ------------------------- minor-unit conversion ------------------------- */

test('toMinor parses plain, comma and decimal amounts', () => {
  assert.equal(M.toMinor('85000'), 8500000);
  assert.equal(M.toMinor('85,000.50'), 8500050);
  assert.equal(M.toMinor(1250.75), 125075);
  assert.equal(M.toMinor('  500 '), 50000);
  assert.equal(M.toMinor('0.01'), 1);
});

test('toMinor rejects junk, zero, negatives and 3-decimal amounts', () => {
  assert.equal(M.toMinor(''), null);
  assert.equal(M.toMinor('abc'), null);
  assert.equal(M.toMinor('12.345'), null);
  assert.equal(M.toMinor('0'), null);
  assert.equal(M.toMinor('-50'), null);
  assert.equal(M.toMinor(null), null);
  assert.equal(M.toMinor('10.5.2'), null);
});

test('fromMinor and formatMoney round-trip', () => {
  assert.equal(M.fromMinor(8500050), 85000.5);
  assert.equal(M.formatMoney(8500050, 'PKR'), 'Rs. 85,000.50');
  assert.equal(M.formatMoney(125075, 'USD'), '$1,250.75');
  assert.equal(M.formatMoney(100000, 'GBP'), '£1,000.00');
  assert.equal(M.formatMoney(-5000, 'USD'), '-$50.00');
  assert.equal(M.formatMoney(100000, 'XXX'), '$1,000.00'); // unknown code -> USD
  assert.equal(M.formatMoneyShort(8500000, 'PKR'), 'Rs. 85,000');
  assert.equal(M.formatMoneyShort(8500050, 'PKR'), 'Rs. 85,000.50');
});

/* ------------------------------ dates ----------------------------------- */

test('monthKey extracts YYYY-MM and rejects bad dates', () => {
  assert.equal(M.monthKey('2026-11-21'), '2026-11');
  assert.equal(M.monthKey('2026-13-01'), null);
  assert.equal(M.monthKey('21/11/2026'), null);
  assert.equal(M.monthKey(''), null);
});

test('addMonths crosses year boundaries both ways', () => {
  assert.equal(M.addMonths('2026-11', 1), '2026-12');
  assert.equal(M.addMonths('2026-12', 1), '2027-01');
  assert.equal(M.addMonths('2026-01', -1), '2025-12');
  assert.equal(M.addMonths('2026-11', -3), '2026-08');
  assert.equal(M.addMonths('2026-11', 0), '2026-11');
});

test('daysInMonth and daysBetween handle leap years', () => {
  assert.equal(M.daysInMonth('2026-02'), 28);
  assert.equal(M.daysInMonth('2024-02'), 29);
  assert.equal(M.daysBetween('2026-11-01', '2026-11-21'), 20);
  assert.equal(M.daysBetween('2026-11-21', '2026-11-01'), -20);
  assert.equal(M.daysBetween('2026-11-21', '2026-11-21'), 0);
});

test('isValidDate rejects impossible calendar dates', () => {
  assert.equal(M.isValidDate('2026-02-30'), false);
  assert.equal(M.isValidDate('2024-02-29'), true);
  assert.equal(M.isValidDate('2026-11-21'), true);
  assert.equal(M.isValidDate('not-a-date'), false);
});

/* --------------------------- monthly totals ------------------------------ */

const income = [
  { date: '2026-09-05', amountMinor: 10000000, status: 'received' },
  { date: '2026-10-10', amountMinor: 8000000, status: 'received' },
  { date: '2026-10-20', amountMinor: 2000000, status: 'expected' }, // not counted
  { date: '2026-11-02', amountMinor: 12000000, status: 'received' },
  { date: '2026-11-15', amountMinor: 5000000, status: 'expected' },
];

test('sumForMonth filters by month and status', () => {
  assert.equal(M.sumForMonth(income, '2026-10'), 10000000);
  assert.equal(M.sumForMonth(income, '2026-10', { status: 'received' }), 8000000);
  assert.equal(M.sumForMonth(income, '2026-11', { status: 'received' }), 12000000);
  assert.equal(M.sumForMonth(income, '2026-12'), 0);
  assert.equal(M.sumForMonth([], '2026-11'), 0);
});

test('averageIncome averages 3 months including a zero month', () => {
  // Sep 100,000 + Oct 80,000 + Nov 120,000 = 300,000 / 3 = 100,000
  assert.equal(M.averageIncome(income, '2026-11', 3), 10000000);
  // Ending Aug: Jun/Jul/Aug all empty -> 0
  assert.equal(M.averageIncome(income, '2026-08', 3), 0);
  // Ending Oct: Aug 0 + Sep 100,000 + Oct 80,000 = 180,000 / 3 = 60,000
  assert.equal(M.averageIncome(income, '2026-10', 3), 6000000);
});

test('taxPot and safeMonthlyBudget', () => {
  assert.equal(M.taxPot(10000000, 10), 1000000);
  assert.equal(M.taxPot(10000000, 0), 0);
  assert.equal(M.taxPot(999999, 10), 100000); // rounds to nearest minor unit
  assert.equal(M.safeMonthlyBudget(10000000, 10), 9000000);
  assert.equal(M.safeMonthlyBudget(0, 10), 0);
});

test('savingsRate', () => {
  assert.equal(M.savingsRate(10000000, 6000000), 40);
  assert.equal(M.savingsRate(10000000, 10000000), 0);
  assert.equal(M.savingsRate(10000000, 12000000), 0); // overspent -> 0, not negative
  assert.equal(M.savingsRate(0, 500000), 0);
});

/* ------------------------------ envelopes -------------------------------- */

test('envelope maths: remaining, usage, spent, by-category', () => {
  assert.equal(M.envelopeRemaining(5000000, 3200000), 1800000);
  assert.equal(M.envelopeRemaining(5000000, 6000000), -1000000); // overspent
  assert.equal(M.envelopeUsagePct(5000000, 2500000), 50);
  assert.equal(M.envelopeUsagePct(0, 100000), 0);

  const expenses = [
    { date: '2026-11-03', amountMinor: 150000, envelopeId: 'food' },
    { date: '2026-11-10', amountMinor: 250000, envelopeId: 'food' },
    { date: '2026-10-10', amountMinor: 900000, envelopeId: 'food' }, // other month
    { date: '2026-11-05', amountMinor: 500000, envelopeId: 'tools' },
  ];
  assert.equal(M.spentInEnvelope(expenses, 'food', '2026-11'), 400000);
  assert.equal(M.spentInEnvelope(expenses, 'tools', '2026-11'), 500000);
  assert.equal(M.spentInEnvelope(expenses, 'nope', '2026-11'), 0);
  assert.deepEqual(
    M.spendingByCategory(expenses, [{ id: 'food', name: 'Food' }, { id: 'tools', name: 'Tools' }], '2026-11'),
    { Food: 400000, Tools: 500000 }
  );
});

/* -------------------------------- bills ---------------------------------- */

test('billStatus: paid, upcoming, due-soon, overdue', () => {
  const bill = { dayOfMonth: 15 };
  assert.equal(M.billStatus(bill, '2026-11-10', []).status, 'due-soon'); // 5 days away
  assert.equal(M.billStatus(bill, '2026-11-10', []).nextDue, '2026-11-15');
  assert.equal(M.billStatus(bill, '2026-11-01', []).status, 'upcoming');
  assert.equal(M.billStatus(bill, '2026-11-20', []).status, 'overdue');
  assert.equal(M.billStatus(bill, '2026-11-20', []).daysUntil, -5);
  const paid = M.billStatus(bill, '2026-11-20', ['2026-11']);
  assert.equal(paid.status, 'paid');
  assert.equal(paid.nextDue, '2026-12-15');
});

test('billStatus clamps day-of-month to short months', () => {
  const bill = { dayOfMonth: 31 };
  // Feb 2026 has 28 days, so the bill falls on the 28th
  assert.equal(M.billStatus(bill, '2026-02-10', []).nextDue, '2026-02-28');
});

/* --------------------------- client payments ----------------------------- */

test('overduePayments and upcomingPayments', () => {
  const list = [
    { date: '2026-11-10', amountMinor: 100000, status: 'expected' }, // overdue on 21st
    { date: '2026-11-25', amountMinor: 200000, status: 'expected' }, // within 14 days
    { date: '2026-12-20', amountMinor: 300000, status: 'expected' }, // too far
    { date: '2026-11-05', amountMinor: 400000, status: 'received' }, // received, ignored
  ];
  assert.equal(M.overduePayments(list, '2026-11-21').length, 1);
  assert.equal(M.upcomingPayments(list, '2026-11-21', 14).length, 1);
  assert.equal(M.upcomingPayments(list, '2026-11-21', 30).length, 2);
});

/* ------------------------------ goals ------------------------------------ */

test('goalProgress caps at 100 and reports remaining', () => {
  assert.deepEqual(M.goalProgress(2500000, 10000000), { pct: 25, remainingMinor: 7500000 });
  assert.deepEqual(M.goalProgress(12000000, 10000000), { pct: 100, remainingMinor: 0 });
  assert.deepEqual(M.goalProgress(0, 0), { pct: 0, remainingMinor: 0 });
});

test('monthsUntil and monthlySavingNeeded', () => {
  assert.equal(M.monthsUntil('2027-02-15', '2026-11-21'), 3);
  assert.equal(M.monthsUntil('2026-11-01', '2026-11-21'), 0); // past deadline
  assert.equal(M.monthlySavingNeeded(2000000, 10000000, '2027-02-15', '2026-11-21'), 2666667);
  assert.equal(M.monthlySavingNeeded(10000000, 10000000, '2027-02-15', '2026-11-21'), 0);
});

/* --------------------------- reports / export ---------------------------- */

test('monthlySeries returns oldest-first totals', () => {
  const expenses = [
    { date: '2026-11-03', amountMinor: 4000000 },
    { date: '2026-10-03', amountMinor: 3000000 },
  ];
  const series = M.monthlySeries(income, expenses, '2026-11', 3);
  assert.deepEqual(series.map((s) => s.month), ['2026-09', '2026-10', '2026-11']);
  assert.equal(series[2].incomeMinor, 12000000);
  assert.equal(series[2].expenseMinor, 4000000);
  assert.equal(series[0].incomeMinor, 10000000);
});

test('buildCSV quotes commas and quotes', () => {
  const csv = M.buildCSV(['Date', 'Note', 'Amount'], [
    ['2026-11-03', 'Lunch, "team"', '1500'],
    ['2026-11-04', 'Simple', '200'],
  ]);
  assert.equal(csv,
    'Date,Note,Amount\n2026-11-03,"Lunch, ""team""",1500\n2026-11-04,Simple,200\n');
});

test('validateImport catches bad data and accepts good data', () => {
  assert.deepEqual(M.validateImport({ income: [], expenses: [], bills: [], goals: [], envelopes: [] }), []);
  assert.ok(M.validateImport(null).length > 0);
  assert.ok(M.validateImport({ income: [{ amountMinor: 'oops' }] }).length > 0);
  assert.ok(M.validateImport({ bills: 'not-a-list' }).length > 0);
  assert.deepEqual(M.validateImport({ income: [{ amountMinor: 100 }] }), []);
});
