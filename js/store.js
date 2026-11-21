/**
 * Freelance Money Planner — data layer (js/store.js)
 *
 * Owns the app state: what it looks like, how it is saved to
 * localStorage, and how it is imported / exported as JSON. The UI
 * (js/app.js) never touches localStorage directly — it goes through here.
 *
 * Data lives ONLY in the user's browser. There is no account, no server
 * and no upload. Exporting a JSON backup is the user's way to move data
 * between devices.
 */

'use strict';

(function (global) {
  const FMP = global.FMP;
  const STORAGE_KEY = 'freelance-money-planner-v1';

  /* ------------------------------------------------------------------ */
  /* Demo data                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * A realistic freelancer month in PKR (November 2026). Amounts are in
   * minor units (paisa). Also shipped as examples/demo-data.json so it
   * can be imported on its own. Currency is PKR because the sample
   * freelancer is based in Pakistan — change it in Settings any time.
   */
  const DEMO_DATA = {
    version: 1,
    settings: { currency: 'PKR', taxRate: 10, businessName: 'Hasnaat Anjum — Freelance', name: 'Hasnaat' },
    envelopes: [
      { id: 'env-rent', name: 'Rent & Utilities', budgetMinor: 4500000, color: '#1d4ed8' },
      { id: 'env-food', name: 'Food & Groceries', budgetMinor: 2500000, color: '#059669' },
      { id: 'env-tools', name: 'Tools & Software', budgetMinor: 800000, color: '#d97706' },
      { id: 'env-transport', name: 'Transport', budgetMinor: 600000, color: '#7c3aed' },
      { id: 'env-fun', name: 'Fun & Personal', budgetMinor: 1000000, color: '#db2777' },
    ],
    income: [
      { id: 'inc-1', date: '2026-11-02', client: 'Ayesha — Boutique Website', source: 'Client work', category: 'Web design', amountMinor: 8500000, status: 'received', note: 'Homepage + 5 pages, paid in full' },
      { id: 'inc-2', date: '2026-11-09', client: 'Bilal — SEO Monthly', source: 'Client work', category: 'SEO', amountMinor: 4000000, status: 'received', note: 'November retainer' },
      { id: 'inc-3', date: '2026-11-14', client: 'eBay — Vintage Finds', source: 'eBay sales', category: 'eBay', amountMinor: 1850000, status: 'received', note: '3 orders, after fees' },
      { id: 'inc-4', date: '2026-11-25', client: 'Sara — Logo & Brand Kit', source: 'Client work', category: 'Design', amountMinor: 6000000, status: 'expected', note: 'Due on delivery, 25 Nov' },
      { id: 'inc-5', date: '2026-11-10', client: 'Omar — Landing Page', source: 'Client work', category: 'Web design', amountMinor: 3500000, status: 'expected', note: 'Overdue — chased on 18 Nov' },
      { id: 'inc-6', date: '2026-10-06', client: 'Ayesha — Boutique Website', source: 'Client work', category: 'Web design', amountMinor: 7000000, status: 'received', note: 'Deposit, October' },
      { id: 'inc-7', date: '2026-10-18', client: 'Bilal — SEO Monthly', source: 'Client work', category: 'SEO', amountMinor: 4000000, status: 'received', note: 'October retainer' },
      { id: 'inc-8', date: '2026-09-12', client: 'Danish — Store Setup', source: 'Client work', category: 'Web design', amountMinor: 9500000, status: 'received', note: 'Shopify-style store build' },
      { id: 'inc-9', date: '2026-09-28', client: 'Bilal — SEO Monthly', source: 'Client work', category: 'SEO', amountMinor: 4000000, status: 'received', note: 'September retainer' },
    ],
    expenses: [
      { id: 'exp-1', date: '2026-11-01', envelopeId: 'env-rent', amountMinor: 3500000, note: 'November rent' },
      { id: 'exp-2', date: '2026-11-03', envelopeId: 'env-food', amountMinor: 420000, note: 'Weekly groceries' },
      { id: 'exp-3', date: '2026-11-05', envelopeId: 'env-tools', amountMinor: 299900, note: 'Canva Pro (monthly)' },
      { id: 'exp-4', date: '2026-11-07', envelopeId: 'env-food', amountMinor: 180000, note: 'Lunch with client' },
      { id: 'exp-5', date: '2026-11-08', envelopeId: 'env-transport', amountMinor: 150000, note: 'Fuel' },
      { id: 'exp-6', date: '2026-11-12', envelopeId: 'env-tools', amountMinor: 150000, note: 'Domain renewal' },
      { id: 'exp-7', date: '2026-11-15', envelopeId: 'env-fun', amountMinor: 350000, note: 'Cinema + dinner' },
      { id: 'exp-8', date: '2026-11-17', envelopeId: 'env-food', amountMinor: 380000, note: 'Weekly groceries' },
      { id: 'exp-9', date: '2026-11-19', envelopeId: 'env-transport', amountMinor: 120000, note: 'Ride-hailing' },
    ],
    bills: [
      { id: 'bill-1', name: 'Internet (PTCL)', amountMinor: 450000, dayOfMonth: 5, category: 'Utilities', paidMonths: ['2026-11'] },
      { id: 'bill-2', name: 'Mobile package', amountMinor: 150000, dayOfMonth: 10, category: 'Utilities', paidMonths: ['2026-11'] },
      { id: 'bill-3', name: 'Electricity', amountMinor: 800000, dayOfMonth: 18, category: 'Utilities', paidMonths: [] },
      { id: 'bill-4', name: 'Figma (annual / 12)', amountMinor: 180000, dayOfMonth: 22, category: 'Tools', paidMonths: [] },
      { id: 'bill-5', name: 'Gym', amountMinor: 300000, dayOfMonth: 1, category: 'Personal', paidMonths: ['2026-11'] },
    ],
    goals: [
      { id: 'goal-1', name: 'New laptop', targetMinor: 25000000, savedMinor: 14500000, deadline: '2027-02-28', note: 'MacBook for client work' },
      { id: 'goal-2', name: 'Emergency fund (3 months)', targetMinor: 30000000, savedMinor: 9000000, deadline: '2027-06-30', note: 'Covers rent + food if work dries up' },
      { id: 'goal-3', name: 'Eid gifts fund', targetMinor: 5000000, savedMinor: 5000000, deadline: '2027-03-20', note: 'Done — fully saved' },
    ],
  };

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  /** Empty state: a brand-new user starts here. */
  function defaultState() {
    return {
      version: 1,
      settings: { currency: 'PKR', taxRate: 10, businessName: '', name: '' },
      income: [],
      expenses: [],
      envelopes: [
        { id: 'env-rent', name: 'Rent & Utilities', budgetMinor: 0, color: '#1d4ed8' },
        { id: 'env-food', name: 'Food & Groceries', budgetMinor: 0, color: '#059669' },
        { id: 'env-tools', name: 'Tools & Software', budgetMinor: 0, color: '#d97706' },
        { id: 'env-transport', name: 'Transport', budgetMinor: 0, color: '#7c3aed' },
        { id: 'env-fun', name: 'Fun & Personal', budgetMinor: 0, color: '#db2777' },
      ],
      bills: [],
      goals: [],
    };
  }

  /** A deep copy of the demo data (callers may mutate the result freely). */
  function demoState() {
    return JSON.parse(JSON.stringify(DEMO_DATA));
  }

  /** Unique-enough id for new rows: timestamp + random suffix. */
  function newId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 8);
  }

  /* ------------------------------------------------------------------ */
  /* Persistence (localStorage)                                          */
  /* ------------------------------------------------------------------ */

  function storageAvailable() {
    try {
      return typeof localStorage !== 'undefined' && localStorage !== null;
    } catch (e) {
      return false;
    }
  }

  /** Load saved state, or null when nothing is saved yet. */
  function load() {
    if (!storageAvailable()) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const problems = FMP.validateImport(data);
      if (problems.length) return null; // corrupt save: start clean, never crash
      return normalise(data);
    } catch (e) {
      return null;
    }
  }

  /** Save state. Returns false when storage is unavailable. */
  function save(state) {
    if (!storageAvailable()) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Remove all saved data (Settings → danger zone). */
  function clear() {
    if (!storageAvailable()) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  /**
   * Fill in any fields an older / partial save is missing, so the app
   * never has to guard against undefined lists.
   */
  function normalise(data) {
    const base = defaultState();
    const out = Object.assign({}, base, data);
    out.settings = Object.assign({}, base.settings, data.settings || {});
    for (const key of ['income', 'expenses', 'bills', 'goals', 'envelopes']) {
      out[key] = Array.isArray(data[key]) ? data[key] : base[key];
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Import / export                                                     */
  /* ------------------------------------------------------------------ */

  /** Serialise state to a pretty JSON backup string. */
  function exportJSON(state) {
    return JSON.stringify(state, null, 2);
  }

  /**
   * Parse an imported JSON string. Returns { state } on success or
   * { error } with a human-readable message on failure.
   */
  function importJSON(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { error: 'That file is not valid JSON.' };
    }
    const problems = FMP.validateImport(data);
    if (problems.length) return { error: problems.join(' ') };
    return { state: normalise(data) };
  }

  /* ------------------------------------------------------------------ */
  /* Exports                                                             */
  /* ------------------------------------------------------------------ */

  const api = {
    STORAGE_KEY, DEMO_DATA,
    defaultState, demoState, newId,
    storageAvailable, load, save, clear, normalise,
    exportJSON, importJSON,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.FMPStore = api;
})(typeof window !== 'undefined' ? window : globalThis);
