/**
 * Freelance Money Planner — UI (js/app.js)
 *
 * Plain vanilla JS, no framework, no build step. All money math lives in
 * js/money.js (window.FMP) and all persistence in js/store.js
 * (window.FMPStore); this file only wires the DOM to those two modules.
 *
 * One rule: every change goes through `update()` — mutate state, save,
 * re-render the active tab. That keeps the screen and the saved data
 * in sync with no stale views.
 */

'use strict';

(function () {
  var FMP = window.FMP;
  var Store = window.FMPStore;

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  var state = Store.load() || Store.defaultState();
  var currentMonth = FMP.monthKey(FMP.todayStr()) || '2026-11';
  var activeTab = 'dashboard';

  /** Mutate state, persist, re-render. The single funnel for all changes. */
  function update(fn) {
    fn(state);
    Store.save(state);
    render();
  }

  /** Current currency code, e.g. "PKR". */
  function cur() {
    return state.settings.currency || 'PKR';
  }

  /** Format minor units in the user's currency. */
  function money(minor) {
    return FMP.formatMoney(minor, cur());
  }

  /* ------------------------------------------------------------------ */
  /* Small DOM helpers                                                   */
  /* ------------------------------------------------------------------ */

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  /** Escape user text before it goes into innerHTML (never trust input). */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Today's date for <input type="date"> defaults. */
  function todayInput() { return FMP.todayStr(); }

  /** Read a money field; returns { minor } or { error }. */
  function readMoney(input) {
    var minor = FMP.toMinor(input.value);
    if (minor === null) return { error: 'Enter a valid amount greater than 0 (e.g. 2500 or 2,500.50).' };
    return { minor: minor };
  }

  /** Short toast message at the bottom of the screen. */
  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  /* ------------------------------------------------------------------ */
  /* Month navigation                                                    */
  /* ------------------------------------------------------------------ */

  function monthLabel(ym) {
    var parts = ym.split('-');
    var names = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return names[Number(parts[1]) - 1] + ' ' + parts[0];
  }

  function setMonth(ym) {
    currentMonth = ym;
    $('#month-label').textContent = monthLabel(ym);
    render();
  }

  /* ------------------------------------------------------------------ */
  /* Shared month figures                                                */
  /* ------------------------------------------------------------------ */

  function monthFigures(ym) {
    var received = FMP.sumForMonth(state.income, ym, { status: 'received' });
    var expected = FMP.sumForMonth(state.income, ym, { status: 'expected' });
    var expenses = FMP.sumForMonth(state.expenses, ym);
    var tax = FMP.taxPot(received, state.settings.taxRate || 0);
    return {
      received: received,
      expected: expected,
      expenses: expenses,
      tax: tax,
      balance: received - expenses,
      spendable: received - expenses - tax,
      savingsRate: FMP.savingsRate(received, expenses),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Dashboard                                                           */
  /* ------------------------------------------------------------------ */

  function renderDashboard() {
    var f = monthFigures(currentMonth);
    var avg = FMP.averageIncome(state.income, currentMonth, 3);
    var safe = FMP.safeMonthlyBudget(avg, state.settings.taxRate || 0);
    var today = FMP.todayStr();

    $('#stat-received').textContent = money(f.received);
    $('#stat-expected').textContent = money(f.expected);
    $('#stat-expenses').textContent = money(f.expenses);
    $('#stat-balance').textContent = money(f.balance);
    $('#stat-tax').textContent = money(f.tax);
    $('#stat-savings').textContent = f.savingsRate + '%';
    $('#avg-income').textContent = money(avg);
    $('#safe-budget').textContent = money(safe);
    $('#tax-rate-label').textContent = (state.settings.taxRate || 0) + '%';

    // --- Needs attention -------------------------------------------------
    var alerts = [];
    var overdue = FMP.overduePayments(state.income, today);
    overdue.forEach(function (p) {
      alerts.push({ kind: 'bad', text: 'Overdue payment: ' + money(p.amountMinor) + ' from ' + (p.client || 'a client') + ' (due ' + p.date + ').' });
    });
    state.bills.forEach(function (b) {
      var s = FMP.billStatus(b, today, b.paidMonths || []);
      if (s.status === 'overdue') {
        alerts.push({ kind: 'bad', text: 'Bill overdue: ' + b.name + ' — ' + money(b.amountMinor) + ' was due ' + s.nextDue + '.' });
      } else if (s.status === 'due-soon') {
        alerts.push({ kind: 'warn', text: 'Bill due soon: ' + b.name + ' — ' + money(b.amountMinor) + ' on ' + s.nextDue + '.' });
      }
    });
    state.envelopes.forEach(function (env) {
      var spent = FMP.spentInEnvelope(state.expenses, env.id, currentMonth);
      if (env.budgetMinor > 0 && spent > env.budgetMinor) {
        alerts.push({ kind: 'bad', text: 'Envelope over budget: ' + env.name + ' spent ' + money(spent) + ' of ' + money(env.budgetMinor) + '.' });
      }
    });
    state.goals.forEach(function (g) {
      var months = FMP.monthsUntil(g.deadline, today);
      if (months !== null && months <= 1 && g.savedMinor < g.targetMinor) {
        alerts.push({ kind: 'warn', text: 'Goal deadline near: ' + g.name + ' needs ' + money(g.targetMinor - g.savedMinor) + ' more by ' + g.deadline + '.' });
      }
    });
    $('#alerts').innerHTML = alerts.length
      ? alerts.map(function (a) {
          return '<li class="alert alert-' + a.kind + '">' + esc(a.text) + '</li>';
        }).join('')
      : '<li class="alert alert-ok">All clear — nothing overdue, nothing over budget.</li>';

    // --- Goals snapshot ---------------------------------------------------
    var goalsHtml = state.goals.slice(0, 3).map(function (g) {
      var p = FMP.goalProgress(g.savedMinor, g.targetMinor);
      return '<div class="goal-mini"><div class="goal-mini-head"><strong>' + esc(g.name) + '</strong>' +
        '<span>' + p.pct + '%</span></div>' +
        '<div class="bar"><div class="bar-fill" style="width:' + p.pct + '%"></div></div>' +
        '<small>' + money(g.savedMinor) + ' of ' + money(g.targetMinor) + '</small></div>';
    }).join('');
    $('#goals-snapshot').innerHTML = goalsHtml ||
      '<p class="muted">No savings goals yet — add one in the Goals tab.</p>';

    // --- Recent activity ---------------------------------------------------
    var activity = [];
    state.income.forEach(function (i) {
      activity.push({ date: i.date, text: (i.status === 'received' ? 'Received ' : 'Expected ') + money(i.amountMinor) + ' — ' + (i.client || i.source || 'income'), kind: i.status === 'received' ? 'in' : 'wait' });
    });
    state.expenses.forEach(function (e) {
      var env = state.envelopes.find(function (x) { return x.id === e.envelopeId; });
      activity.push({ date: e.date, text: 'Spent ' + money(e.amountMinor) + ' — ' + (env ? env.name : 'Uncategorised') + (e.note ? ' (' + e.note + ')' : ''), kind: 'out' });
    });
    activity.sort(function (a, b) { return b.date.localeCompare(a.date); });
    $('#recent-activity').innerHTML = activity.slice(0, 8).map(function (a) {
      return '<li><span class="dot dot-' + a.kind + '"></span><span>' + esc(a.text) + '</span><time>' + a.date + '</time></li>';
    }).join('') || '<li class="muted">Nothing yet — add income or an expense to get started.</li>';
  }

  /* ------------------------------------------------------------------ */
  /* Income                                                              */
  /* ------------------------------------------------------------------ */

  function renderIncome() {
    var avg = FMP.averageIncome(state.income, currentMonth, 3);
    var safe = FMP.safeMonthlyBudget(avg, state.settings.taxRate || 0);
    $('#income-avg').textContent = money(avg);
    $('#income-safe').textContent = money(safe);

    var rows = state.income
      .filter(function (i) { return FMP.monthKey(i.date) === currentMonth; })
      .sort(function (a, b) { return b.date.localeCompare(a.date); });
    $('#income-table-body').innerHTML = rows.map(function (i) {
      var action = i.status === 'expected'
        ? '<button class="btn btn-small" data-action="mark-received" data-id="' + i.id + '">Mark received</button> '
        : '';
      return '<tr><td>' + i.date + '</td><td>' + esc(i.client || '—') + '</td>' +
        '<td>' + esc(i.category || '—') + '</td><td>' + esc(i.source || '—') + '</td>' +
        '<td class="num">' + money(i.amountMinor) + '</td>' +
        '<td><span class="badge badge-' + i.status + '">' + i.status + '</span></td>' +
        '<td>' + action + '<button class="btn btn-small btn-danger" data-action="delete-income" data-id="' + i.id + '">Delete</button></td></tr>';
    }).join('') || '<tr><td colspan="7" class="muted">No income recorded for ' + monthLabel(currentMonth) + ' yet.</td></tr>';
  }

  function addIncome(form) {
    var amount = readMoney(form.amount);
    if (amount.error) { toast(amount.error); return; }
    if (!FMP.isValidDate(form.date.value)) { toast('Pick a valid date.'); return; }
    var entry = {
      id: Store.newId('inc'),
      date: form.date.value,
      client: form.client.value.trim(),
      category: form.category.value.trim(),
      source: form.source.value,
      amountMinor: amount.minor,
      status: form.status.value,
      note: form.note.value.trim(),
    };
    update(function (s) { s.income.push(entry); });
    form.reset();
    form.date.value = todayInput();
    toast('Income added: ' + money(amount.minor) + '.');
  }

  /* ------------------------------------------------------------------ */
  /* Expenses + envelopes                                                */
  /* ------------------------------------------------------------------ */

  function renderExpenses() {
    var envHtml = state.envelopes.map(function (env) {
      var spent = FMP.spentInEnvelope(state.expenses, env.id, currentMonth);
      var remaining = FMP.envelopeRemaining(env.budgetMinor, spent);
      var pct = FMP.envelopeUsagePct(env.budgetMinor, spent);
      var over = env.budgetMinor > 0 && spent > env.budgetMinor;
      return '<div class="card env-card">' +
        '<div class="env-head"><span class="swatch" style="background:' + esc(env.color || '#1d4ed8') + '"></span>' +
        '<strong>' + esc(env.name) + '</strong>' +
        '<button class="btn btn-small btn-danger" data-action="delete-envelope" data-id="' + env.id + '">Delete</button></div>' +
        '<div class="bar"><div class="bar-fill' + (over ? ' bar-over' : '') + '" style="width:' + Math.min(100, pct) + '%"></div></div>' +
        '<p class="env-numbers"><span>Spent ' + money(spent) + '</span><span>' + (over ? 'Over by ' + money(-remaining) : money(remaining) + ' left') + '</span></p>' +
        '<label class="inline-label">Monthly budget <input type="text" inputmode="decimal" data-envelope-budget="' + env.id + '" value="' + (env.budgetMinor ? FMP.fromMinor(env.budgetMinor) : '') + '" placeholder="e.g. 25000"> ' +
        '<button class="btn btn-small" data-action="save-envelope-budget" data-id="' + env.id + '">Save</button></label>' +
        '</div>';
    }).join('');
    $('#envelope-list').innerHTML = envHtml;

    var options = state.envelopes.map(function (env) {
      return '<option value="' + env.id + '">' + esc(env.name) + '</option>';
    }).join('');
    $('#expense-envelope').innerHTML = options;

    var rows = state.expenses
      .filter(function (e) { return FMP.monthKey(e.date) === currentMonth; })
      .sort(function (a, b) { return b.date.localeCompare(a.date); });
    $('#expense-table-body').innerHTML = rows.map(function (e) {
      var env = state.envelopes.find(function (x) { return x.id === e.envelopeId; });
      return '<tr><td>' + e.date + '</td><td>' + esc(env ? env.name : 'Uncategorised') + '</td>' +
        '<td>' + esc(e.note || '—') + '</td><td class="num">' + money(e.amountMinor) + '</td>' +
        '<td><button class="btn btn-small btn-danger" data-action="delete-expense" data-id="' + e.id + '">Delete</button></td></tr>';
    }).join('') || '<tr><td colspan="5" class="muted">No expenses recorded for ' + monthLabel(currentMonth) + ' yet.</td></tr>';
  }

  function addExpense(form) {
    var amount = readMoney(form.amount);
    if (amount.error) { toast(amount.error); return; }
    if (!FMP.isValidDate(form.date.value)) { toast('Pick a valid date.'); return; }
    var entry = {
      id: Store.newId('exp'),
      date: form.date.value,
      envelopeId: form.envelope.value,
      amountMinor: amount.minor,
      note: form.note.value.trim(),
    };
    update(function (s) { s.expenses.push(entry); });
    form.reset();
    form.date.value = todayInput();
    toast('Expense added: ' + money(amount.minor) + '.');
  }

  /* ------------------------------------------------------------------ */
  /* Bills                                                               */
  /* ------------------------------------------------------------------ */

  function renderBills() {
    var today = FMP.todayStr();
    var rows = state.bills.slice().sort(function (a, b) { return a.dayOfMonth - b.dayOfMonth; });
    $('#bills-table-body').innerHTML = rows.map(function (b) {
      var s = FMP.billStatus(b, today, b.paidMonths || []);
      var action = s.status === 'paid'
        ? '<button class="btn btn-small" data-action="unmark-bill" data-id="' + b.id + '">Mark unpaid</button> '
        : '<button class="btn btn-small" data-action="mark-bill" data-id="' + b.id + '">Mark paid</button> ';
      return '<tr><td>' + esc(b.name) + '</td><td>' + esc(b.category || '—') + '</td>' +
        '<td class="num">' + money(b.amountMinor) + '</td><td>Day ' + b.dayOfMonth + '</td>' +
        '<td>' + s.nextDue + '</td><td><span class="badge badge-' + s.status + '">' + s.status + '</span></td>' +
        '<td>' + action + '<button class="btn btn-small btn-danger" data-action="delete-bill" data-id="' + b.id + '">Delete</button></td></tr>';
    }).join('') || '<tr><td colspan="7" class="muted">No recurring bills yet — add rent, internet, subscriptions and the like.</td></tr>';
  }

  function addBill(form) {
    var amount = readMoney(form.amount);
    if (amount.error) { toast(amount.error); return; }
    var day = parseInt(form.day.value, 10);
    if (!day || day < 1 || day > 31) { toast('Day of month must be 1–31.'); return; }
    if (!form.billname.value.trim()) { toast('Give the bill a name.'); return; }
    var bill = {
      id: Store.newId('bill'),
      name: form.billname.value.trim(),
      amountMinor: amount.minor,
      dayOfMonth: day,
      category: form.category.value.trim() || 'General',
      paidMonths: [],
    };
    update(function (s) { s.bills.push(bill); });
    form.reset();
    toast('Bill added: ' + bill.name + '.');
  }

  /** Paying a bill also records the expense, so reports stay honest. */
  function markBillPaid(id) {
    var today = FMP.todayStr();
    var ym = FMP.monthKey(today);
    update(function (s) {
      var bill = s.bills.find(function (b) { return b.id === id; });
      if (!bill) return;
      if (!(bill.paidMonths || []).includes(ym)) {
        bill.paidMonths = (bill.paidMonths || []).concat([ym]);
        var expense = {
          id: Store.newId('exp'),
          date: today,
          envelopeId: null,
          amountMinor: bill.amountMinor,
          note: 'Bill paid: ' + bill.name,
        };
        bill.paidExpenseId = expense.id;
        s.expenses.push(expense);
      }
    });
    toast('Bill marked paid for ' + monthLabel(ym) + '.');
  }

  function unmarkBill(id) {
    var ym = FMP.monthKey(FMP.todayStr());
    update(function (s) {
      var bill = s.bills.find(function (b) { return b.id === id; });
      if (!bill) return;
      bill.paidMonths = (bill.paidMonths || []).filter(function (m) { return m !== ym; });
      if (bill.paidExpenseId) {
        s.expenses = s.expenses.filter(function (e) { return e.id !== bill.paidExpenseId; });
        delete bill.paidExpenseId;
      }
    });
    toast('Bill marked unpaid for ' + monthLabel(ym) + '.');
  }

  /* ------------------------------------------------------------------ */
  /* Goals                                                               */
  /* ------------------------------------------------------------------ */

  function renderGoals() {
    var today = FMP.todayStr();
    $('#goals-list').innerHTML = state.goals.map(function (g) {
      var p = FMP.goalProgress(g.savedMinor, g.targetMinor);
      var need = FMP.monthlySavingNeeded(g.savedMinor, g.targetMinor, g.deadline, today);
      return '<div class="card goal-card">' +
        '<div class="goal-head"><strong>' + esc(g.name) + '</strong>' +
        '<span class="badge badge-goal">' + p.pct + '%</span></div>' +
        (g.note ? '<p class="muted">' + esc(g.note) + '</p>' : '') +
        '<div class="bar bar-tall"><div class="bar-fill" style="width:' + p.pct + '%"></div></div>' +
        '<p class="goal-numbers"><span>' + money(g.savedMinor) + ' saved</span><span>' + money(g.targetMinor) + ' target</span></p>' +
        '<p class="muted">Deadline ' + esc(g.deadline || '—') + ' · ' +
        (p.remainingMinor ? 'Save ' + money(need) + ' / month to get there.' : 'Goal reached — well done!') + '</p>' +
        '<div class="goal-actions">' +
        '<button class="btn btn-small" data-action="add-to-goal" data-id="' + g.id + '">+ Add money</button> ' +
        '<button class="btn btn-small btn-danger" data-action="delete-goal" data-id="' + g.id + '">Delete</button>' +
        '</div></div>';
    }).join('') || '<p class="muted">No savings goals yet. A goal turns spare money into a plan — try “Emergency fund” or “New laptop”.</p>';
  }

  function addGoal(form) {
    var target = readMoney(form.target);
    if (target.error) { toast(target.error); return; }
    var saved = form.saved.value.trim() ? FMP.toMinor(form.saved.value) : 0;
    if (saved === null) { toast('“Already saved” must be a valid amount.'); return; }
    if (!form.goalname.value.trim()) { toast('Give the goal a name.'); return; }
    if (form.deadline.value && !FMP.isValidDate(form.deadline.value)) { toast('Pick a valid deadline date.'); return; }
    var goal = {
      id: Store.newId('goal'),
      name: form.goalname.value.trim(),
      targetMinor: target.minor,
      savedMinor: saved,
      deadline: form.deadline.value || '',
      note: form.note.value.trim(),
    };
    update(function (s) { s.goals.push(goal); });
    form.reset();
    toast('Goal added: ' + goal.name + '.');
  }

  /* ------------------------------------------------------------------ */
  /* Reports                                                             */
  /* ------------------------------------------------------------------ */

  function renderReports() {
    var f = monthFigures(currentMonth);
    $('#report-month').textContent = monthLabel(currentMonth);
    $('#rep-received').textContent = money(f.received);
    $('#rep-expected').textContent = money(f.expected);
    $('#rep-expenses').textContent = money(f.expenses);
    $('#rep-tax').textContent = money(f.tax);
    $('#rep-balance').textContent = money(f.balance);
    $('#rep-spendable').textContent = money(f.spendable);
    $('#rep-savings').textContent = f.savingsRate + '%';

    var byCat = FMP.spendingByCategory(state.expenses, state.envelopes, currentMonth);
    var items = Object.keys(byCat).map(function (name) {
      var env = state.envelopes.find(function (e) { return e.name === name; });
      return { label: name, valueMinor: byCat[name], color: env ? env.color : '#64748b' };
    }).sort(function (a, b) { return b.valueMinor - a.valueMinor; });
    window.FMPCharts.barChart($('#chart-spending'), items, cur());

    var series = FMP.monthlySeries(state.income, state.expenses, currentMonth, 6);
    window.FMPCharts.lineChart($('#chart-trend'), series, cur());
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 100);
  }

  function exportMonthCSV(kind) {
    var rows = [];
    var filename = 'freelance-money-' + kind + '-' + currentMonth + '.csv';
    if (kind === 'income') {
      rows = state.income
        .filter(function (i) { return FMP.monthKey(i.date) === currentMonth; })
        .map(function (i) { return [i.date, i.client || '', i.category || '', i.source || '', i.status, FMP.fromMinor(i.amountMinor), i.note || '']; });
      download(filename, FMP.buildCSV(['Date', 'Client', 'Category', 'Source', 'Status', 'Amount', 'Note'], rows), 'text/csv');
    } else {
      rows = state.expenses
        .filter(function (e) { return FMP.monthKey(e.date) === currentMonth; })
        .map(function (e) {
          var env = state.envelopes.find(function (x) { return x.id === e.envelopeId; });
          return [e.date, env ? env.name : 'Uncategorised', FMP.fromMinor(e.amountMinor), e.note || ''];
        });
      download(filename, FMP.buildCSV(['Date', 'Category', 'Amount', 'Note'], rows), 'text/csv');
    }
    toast('Exported ' + filename + '.');
  }

  /* ------------------------------------------------------------------ */
  /* Settings                                                            */
  /* ------------------------------------------------------------------ */

  function renderSettings() {
    $('#set-business').value = state.settings.businessName || '';
    $('#set-name').value = state.settings.name || '';
    $('#set-currency').value = cur();
    $('#set-tax').value = state.settings.taxRate === undefined ? 10 : state.settings.taxRate;
  }

  /* ------------------------------------------------------------------ */
  /* Tabs + render                                                       */
  /* ------------------------------------------------------------------ */

  var renderers = {
    dashboard: renderDashboard,
    income: renderIncome,
    expenses: renderExpenses,
    bills: renderBills,
    goals: renderGoals,
    reports: renderReports,
    settings: renderSettings,
  };

  function render() {
    $all('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === activeTab);
    });
    $all('.tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'tab-' + activeTab);
    });
    $('#month-label').textContent = monthLabel(currentMonth);
    var dm = $('#dashboard-month');
    if (dm) dm.textContent = monthLabel(currentMonth);
    $all('.month-inline').forEach(function (el) { el.textContent = monthLabel(currentMonth); });
    var fn = renderers[activeTab];
    if (fn) fn();
    if (activeTab === 'reports') {
      // Charts need the panel visible to measure their width.
      requestAnimationFrame(function () { renderReports(); });
    }
  }

  function switchTab(tab) {
    activeTab = tab;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

  function bind() {
    // Tabs.
    $all('.tab-btn').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.dataset.tab); });
    });

    // Month navigation.
    $('#month-prev').addEventListener('click', function () { setMonth(FMP.addMonths(currentMonth, -1)); });
    $('#month-next').addEventListener('click', function () { setMonth(FMP.addMonths(currentMonth, 1)); });
    $('#month-today').addEventListener('click', function () { setMonth(FMP.monthKey(FMP.todayStr())); });

    // Forms.
    $('#form-income').addEventListener('submit', function (e) { e.preventDefault(); addIncome(e.target); });
    $('#form-expense').addEventListener('submit', function (e) { e.preventDefault(); addExpense(e.target); });
    $('#form-envelope').addEventListener('submit', function (e) {
      e.preventDefault();
      var budget = e.target.budget.value.trim() ? FMP.toMinor(e.target.budget.value) : 0;
      if (budget === null) { toast('Budget must be a valid amount.'); return; }
      if (!e.target.envname.value.trim()) { toast('Give the envelope a name.'); return; }
      var env = { id: Store.newId('env'), name: e.target.envname.value.trim(), budgetMinor: budget, color: e.target.color.value };
      update(function (s) { s.envelopes.push(env); });
      e.target.reset();
      toast('Envelope added: ' + env.name + '.');
    });
    $('#form-bill').addEventListener('submit', function (e) { e.preventDefault(); addBill(e.target); });
    $('#form-goal').addEventListener('submit', function (e) { e.preventDefault(); addGoal(e.target); });

    // Settings form.
    $('#form-settings').addEventListener('submit', function (e) {
      e.preventDefault();
      var tax = parseFloat(e.target.tax.value);
      if (isNaN(tax) || tax < 0 || tax > 100) { toast('Tax rate must be 0–100.'); return; }
      update(function (s) {
        s.settings.businessName = e.target.business.value.trim();
        s.settings.name = e.target.yourname.value.trim();
        s.settings.currency = e.target.currency.value;
        s.settings.taxRate = tax;
      });
      toast('Settings saved.');
    });

    // Reports buttons.
    $('#btn-export-income').addEventListener('click', function () { exportMonthCSV('income'); });
    $('#btn-export-expenses').addEventListener('click', function () { exportMonthCSV('expenses'); });
    $('#btn-export-json').addEventListener('click', function () {
      download('freelance-money-backup.json', Store.exportJSON(state), 'application/json');
      toast('Backup downloaded. Keep it safe — it is the only copy outside this browser.');
    });
    $('#btn-print').addEventListener('click', function () { window.print(); });
    $('#import-file').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var result = Store.importJSON(String(reader.result));
        if (result.error) { toast('Import failed: ' + result.error); return; }
        state = result.state;
        Store.save(state);
        render();
        toast('Backup imported.');
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Demo data + reset.
    $('#btn-demo').addEventListener('click', function () {
      if (state.income.length || state.expenses.length) {
        if (!confirm('This replaces your current data with the demo month. Continue?')) return;
      }
      state = Store.demoState();
      Store.save(state);
      setMonth('2026-11');
      toast('Demo data loaded — explore, then reset it in Settings when done.');
    });
    $('#btn-reset').addEventListener('click', function () {
      if (!confirm('Erase ALL your data in this app? This cannot be undone. Export a backup first if you need it.')) return;
      state = Store.defaultState();
      Store.save(state);
      render();
      toast('All data erased. Fresh start.');
    });

    // Delegated row buttons (mark received, delete, bill actions, goals).
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;
      var id = btn.dataset.id;

      if (action === 'mark-received') {
        update(function (s) {
          var item = s.income.find(function (i) { return i.id === id; });
          if (item) item.status = 'received';
        });
        toast('Marked as received.');
      }
      if (action === 'delete-income' && confirm('Delete this income entry?')) {
        update(function (s) { s.income = s.income.filter(function (i) { return i.id !== id; }); });
        toast('Income deleted.');
      }
      if (action === 'delete-expense' && confirm('Delete this expense?')) {
        update(function (s) { s.expenses = s.expenses.filter(function (x) { return x.id !== id; }); });
        toast('Expense deleted.');
      }
      if (action === 'delete-envelope') {
        var env = state.envelopes.find(function (x) { return x.id === id; });
        if (env && confirm('Delete envelope "' + env.name + '"? Its expenses become Uncategorised.')) {
          update(function (s) {
            s.envelopes = s.envelopes.filter(function (x) { return x.id !== id; });
            s.expenses.forEach(function (x) { if (x.envelopeId === id) x.envelopeId = null; });
          });
          toast('Envelope deleted.');
        }
      }
      if (action === 'save-envelope-budget') {
        var input = document.querySelector('[data-envelope-budget="' + id + '"]');
        var budget = input.value.trim() === '' ? 0 : FMP.toMinor(input.value);
        if (budget === null) { toast('Budget must be a valid amount.'); return; }
        update(function (s) {
          var item = s.envelopes.find(function (x) { return x.id === id; });
          if (item) item.budgetMinor = budget;
        });
        toast('Budget saved.');
      }
      if (action === 'mark-bill') markBillPaid(id);
      if (action === 'unmark-bill') unmarkBill(id);
      if (action === 'delete-bill' && confirm('Delete this bill?')) {
        update(function (s) { s.bills = s.bills.filter(function (b) { return b.id !== id; }); });
        toast('Bill deleted.');
      }
      if (action === 'add-to-goal') {
        var raw = prompt('How much did you add to this goal?');
        if (raw === null) return;
        var amount = FMP.toMinor(raw);
        if (amount === null) { toast('Enter a valid amount.'); return; }
        update(function (s) {
          var g = s.goals.find(function (x) { return x.id === id; });
          if (g) g.savedMinor += amount;
        });
        toast('Added ' + money(amount) + ' to the goal.');
      }
      if (action === 'delete-goal' && confirm('Delete this goal?')) {
        update(function (s) { s.goals = s.goals.filter(function (g) { return g.id !== id; }); });
        toast('Goal deleted.');
      }
    });

    // Redraw charts when the window is resized (reports tab only).
    window.addEventListener('resize', function () {
      if (activeTab === 'reports') renderReports();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */

  document.addEventListener('DOMContentLoaded', function () {
    // Default dates on the two main forms.
    var d1 = document.querySelector('#form-income [name="date"]');
    var d2 = document.querySelector('#form-expense [name="date"]');
    if (d1) d1.value = todayInput();
    if (d2) d2.value = todayInput();
    bind();
    render();
  });
})();
