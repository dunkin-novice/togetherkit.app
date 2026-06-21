// supabase.jsx — backend client, auth helpers, and row⇄model mappers.
//
// Accounts + shared "homespaces": you sign in (Google), get a homespace, and
// invite your partner by link. Data is scoped to the homespace and protected by
// database row-level rules, so only members can read/write it.

const SUPABASE_URL = 'https://gpnznsopzmwwpncsozxz.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwbnpuc29wem13d3BuY3Nvenh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTE3MTgsImV4cCI6MjA5NzQyNzcxOH0.WVeqygpDAY54ZZCTB9iXI-jH9hmKTOWBMty9HJoGtVo';

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  realtime: { params: { eventsPerSecond: 5 } },
});

// row ⇄ client-model mappers ------------------------------------------------
const rowToItem = (r) => ({
  id: r.id, name: r.name, qty: Number(r.qty), unit: r.unit,
  labelId: r.label_id, byUser: r.by_user, byName: r.by_name, date: r.date,
  done: !!r.done, important: !!r.important, image: r.image, pos: Number(r.pos) || 0,
});
const itemToRow = (it, homespaceId) => ({
  id: it.id, homespace_id: homespaceId, name: it.name, qty: it.qty, unit: it.unit,
  label_id: it.labelId, by_user: it.byUser, by_name: it.byName, date: it.date,
  done: !!it.done, important: !!it.important, image: it.image, pos: it.pos || 0,
});
const rowToLabel = (r) => ({ id: r.id, name: r.name, tone: r.tone, custom: !!r.custom, sort: r.sort });
const labelToRow = (l, homespaceId, sort) => ({ homespace_id: homespaceId, id: l.id, name: l.name, tone: l.tone, custom: !!l.custom, sort: sort != null ? sort : (l.sort || 0) });

const newId = () => (window.crypto && crypto.randomUUID)
  ? crypto.randomUUID()
  : 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// where to return to after the Google round-trip (drop any ?invite from the
// redirect target — we read it from the current URL before navigating away)
const appUrl = () => location.origin + location.pathname;

const auth = {
  signInGoogle: () => {
    // Preserve a pending ?invite across the Google round-trip (belt-and-braces:
    // it's also kept in the redirectTo query) so joining a homespace is reliable.
    try { const inv = new URLSearchParams(location.search).get('invite'); if (inv) localStorage.setItem('togetherkit.pendinginvite', inv); } catch (e) {}
    // prompt=select_account forces Google's account chooser every time, so after
    // signing out you can pick a different account (not silently re-use the last).
    return client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appUrl() + location.search, queryParams: { prompt: 'select_account' } } });
  },
  signInPassword: (email, password) => client.auth.signInWithPassword({ email, password }), // used for local testing
  signOut: () => client.auth.signOut(),
};

// Store a bug report (fire-and-forget). Captured in the bug_reports table —
// the bug button used to only console.log, so feedback was being lost.
const reportBug = (info) => {
  try {
    return client.from('bug_reports').insert({
      message: (info && info.message) || '',
      page: (info && info.page) || location.pathname,
      homespace_id: (info && info.homespaceId) || null,
      by_user: (info && info.byUser) || null,
      by_name: (info && info.byName) || null,
      user_agent: navigator.userAgent,
    }).then(r => { if (r && r.error) console.warn('[togetherkit] bug report failed', r.error.message); }, () => {});
  } catch (e) { return Promise.resolve(); }
};

window.TogetherBackend = {
  client, auth, rowToItem, itemToRow, rowToLabel, labelToRow, newId, SUPABASE_URL, reportBug,
};
