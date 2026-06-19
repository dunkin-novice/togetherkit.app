// supabase.jsx — shared-backend config, client, room code, and row⇄model mappers.
//
// The list is scoped by a "room" code carried in the URL hash, so sharing the
// link shares the list. The anon key below is the *publishable* key (safe to
// ship in client code); privacy of a given list rests on its unguessable room
// code rather than on hiding the key.

const SUPABASE_URL = 'https://gpnznsopzmwwpncsozxz.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdwbnpuc29wem13d3BuY3Nvenh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTE3MTgsImV4cCI6MjA5NzQyNzcxOH0.WVeqygpDAY54ZZCTB9iXI-jH9hmKTOWBMty9HJoGtVo';

// Resolve the shared-list room: URL hash wins, then a remembered one, else a
// fresh code. The chosen code is written back to both the hash and storage so
// the link is shareable and sticky across reloads.
function resolveRoom() {
  const fromHash = (location.hash || '').replace(/^#/, '').trim();
  let room = fromHash;
  if (!room) { try { room = (localStorage.getItem('togetherkit.room') || '').trim(); } catch (e) {} }
  if (!room) {
    room = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  try { localStorage.setItem('togetherkit.room', room); } catch (e) {}
  if ((location.hash || '').replace(/^#/, '') !== room) {
    try { history.replaceState(null, '', '#' + room); } catch (e) {}
  }
  return room;
}

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 5 } },
});

// row ⇄ client-model mappers ------------------------------------------------
const rowToItem = (r) => ({
  id: r.id, name: r.name, qty: Number(r.qty), unit: r.unit,
  labelId: r.label_id, by: r.by_user, date: r.date,
  done: !!r.done, important: !!r.important, image: r.image, pos: Number(r.pos) || 0,
});
const itemToRow = (it, room) => ({
  id: it.id, room, name: it.name, qty: it.qty, unit: it.unit,
  label_id: it.labelId, by_user: it.by, date: it.date,
  done: !!it.done, important: !!it.important, image: it.image, pos: it.pos || 0,
});
const rowToLabel = (r) => ({ id: r.id, name: r.name, tone: r.tone, custom: !!r.custom, sort: r.sort });
const labelToRow = (l, room, sort) => ({ room, id: l.id, name: l.name, tone: l.tone, custom: !!l.custom, sort: sort != null ? sort : (l.sort || 0) });

const newId = () => (window.crypto && crypto.randomUUID)
  ? crypto.randomUUID()
  : 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

window.TogetherBackend = {
  client, room: resolveRoom(),
  rowToItem, itemToRow, rowToLabel, labelToRow, newId,
  SUPABASE_URL,
};
