// ideas-app.jsx — Together "Date Ideas" feature.
// Adapted from the Claude Design "Together Date Ideas" kit: the self-contained
// local store is replaced with a Supabase-backed, homespace-scoped store (so
// ideas are saved + shared + realtime, behind the same Google login as the
// shopping list), and the hardcoded Mia/Theo are replaced with the real signed-in
// homespace members. Auth/session/account/styles are reused from shopping-list/.

const { useState, useRef, useMemo, useEffect, Fragment } = React;

/* ── palette ──────────────────────────────────────────────────────────────── */
const TONE = {
  dine:     { bg: '#f4e8dd', fg: '#a8794f' },
  trip:     { bg: '#e7eef0', fg: '#5d7480' },
  activity: { bg: '#eef1e6', fg: '#6f7d52' },
  purple:   { bg: '#efe8f1', fg: '#7e6f86' },
  rose:     { bg: '#f3e6e4', fg: '#a86a6a' },
  teal:     { bg: '#e6efed', fg: '#5e827b' },
  sand:     { bg: '#f2eade', fg: '#9c7b54' },
};
const TONE_CYCLE = ['purple', 'rose', 'teal', 'sand', 'trip', 'activity', 'dine'];
const toneOf = (cat) => TONE[(cat && cat.tone) || 'dine'] || TONE.dine;
const mapsFor = (q) => 'https://www.google.com/maps/search/' + encodeURIComponent(q);

/* ── date helpers ─────────────────────────────────────────────────────────── */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n) => String(n).padStart(2, '0');
function fmtSchedule(dateStr, timeStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T' + (timeStr || '19:00'));
  if (isNaN(d)) return '';
  let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return DAYS[d.getDay()] + ', ' + MONS[d.getMonth()] + ' ' + d.getDate() + ' · ' + h + ':' + pad2(m) + ' ' + ap;
}
function nextSaturday() {
  const d = new Date();
  const add = (6 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}
// Prefilled Google Calendar "create event" link (no API/OAuth/billing needed).
// Pre-fills date/time, location, details, and guests (the partner) so the user
// just taps Save and the invite goes out.
function gcalUrl(name, dateStr, startStr, endStr, opts) {
  if (!dateStr) return '';
  opts = opts || {};
  const start = new Date(dateStr + 'T' + (startStr || '19:00'));
  const end = (endStr ? new Date(dateStr + 'T' + endStr) : new Date(start.getTime() + 2 * 3600 * 1000));
  const stamp = (d) => '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + pad2(d.getMinutes()) + '00';
  const p = new URLSearchParams({ action: 'TEMPLATE', text: name || 'Together date', dates: stamp(start) + '/' + stamp(end) });
  const details = [opts.note, opts.mapsUrl && ('Maps: ' + opts.mapsUrl), opts.siteUrl && ('Link: ' + opts.siteUrl)].filter(Boolean).join('\n');
  if (details) p.set('details', details);
  if (opts.location) p.set('location', opts.location);
  if (opts.guests && opts.guests.length) p.set('add', opts.guests.join(','));
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}

/* ── icons ────────────────────────────────────────────────────────────────── */
function DSvg({ size = 18, stroke = 2, fill = 'none', color, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
         stroke={fill === 'none' ? (color || 'currentColor') : 'none'}
         strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  );
}
const STAR = 'M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 18.7 6 21.8l1.2-6.6L2.4 9.5l6.6-.9z';
const DIcons = {
  Plus: ({ size = 16, stroke = 2.6 }) => <DSvg size={size} stroke={stroke}><path d="M12 5v14M5 12h14" /></DSvg>,
  Star: ({ size = 19, filled = false, color }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? (color || '#e0a93b') : 'none'} stroke={filled ? (color || '#e0a93b') : (color || '#c9bca6')} strokeWidth={filled ? 1.5 : 1.8} strokeLinejoin="round"><path d={STAR} /></svg>
  ),
  Camera: ({ size = 13, stroke = 2.2, color }) => (<DSvg size={size} stroke={stroke} color={color}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></DSvg>),
  Pin: ({ size = 14, stroke = 2, color }) => (<DSvg size={size} stroke={stroke} color={color}><path d="M12 21s-6-5.7-6-10a6 6 0 1 1 12 0c0 4.3-6 10-6 10z" /><circle cx="12" cy="11" r="2.2" /></DSvg>),
  Globe: ({ size = 14, stroke = 2, color }) => (<DSvg size={size} stroke={stroke} color={color}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.4 2.5 15 0 18M12 3c-2.5 2.4-2.5 15 0 18" /></DSvg>),
  Calendar: ({ size = 13, stroke = 2, color }) => (<DSvg size={size} stroke={stroke} color={color}><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></DSvg>),
  Heart: ({ size = 14, stroke = 2, color, fill }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill={fill || 'none'} stroke={color || 'currentColor'} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7-4.6-9.2-9C1.3 7.6 3 4.5 6.2 4.5c1.9 0 3.2 1 3.8 2.3.6-1.3 1.9-2.3 3.8-2.3 3.2 0 4.9 3.1 3.4 6.5C19 15.4 12 20 12 20z" /></svg>),
  Check: ({ size = 14, stroke = 3, color }) => <DSvg size={size} stroke={stroke} color={color}><path d="M4 12l5 5 11-12" /></DSvg>,
  Chevron: ({ size = 16, stroke = 2.4, open = true }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .18s ease' }}><path d="M6 9l6 6 6-6" /></svg>),
  Bug: ({ size = 21, stroke = 1.8 }) => (<DSvg size={size} stroke={stroke}><path d="M12 7.5v12.5" /><ellipse cx="12" cy="13.5" rx="5" ry="6.5" /><path d="M7 11 3 8.5M17 11l4-2.5M7 14.5H2.5M17 14.5h4.5M7.6 18 4 20.5M16.4 18 20 20.5" /><path d="M9 6.2a3 3 0 0 1 6 0" /></DSvg>),
  Trash: ({ size = 17, stroke = 2, color }) => (<DSvg size={size} stroke={stroke} color={color}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></DSvg>),
  Logo: ({ size = 18, primary, partner }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ width: size, height: size, borderRadius: '50%', background: primary }} />
      <span style={{ width: size, height: size, borderRadius: '50%', background: partner, marginLeft: -Math.round(size * 0.39) }} />
    </span>
  ),
};

/* ── seed categories (used to seed a brand-new homespace) ─────────────────── */
const SEED_CATS = [
  { id: 'dine', name: 'Dine', tone: 'dine', custom: false },
  { id: 'trip', name: 'Trip', tone: 'trip', custom: false },
  { id: 'act',  name: 'Activity', tone: 'activity', custom: false },
];

/* ── row ⇄ model mappers ──────────────────────────────────────────────────── */
const rowToIdea = (r) => ({ id: r.id, name: r.name, catId: r.cat_id, byUser: r.by_user, byName: r.by_name, date: r.date, scheduled: !!r.scheduled, schedText: r.sched_text || '', schedAt: r.sched_at || null, schedNote: r.sched_note || '', important: !!r.important, image: r.image, mapsUrl: r.maps_url || '', siteUrl: r.site_url || '', pos: Number(r.pos) || 0 });
const ideaToRow = (it, hs) => ({ id: it.id, homespace_id: hs, name: it.name, cat_id: it.catId, by_user: it.byUser, by_name: it.byName, date: it.date, scheduled: !!it.scheduled, sched_text: it.schedText || null, sched_note: it.schedNote || null, important: !!it.important, image: it.image, maps_url: it.mapsUrl || null, site_url: it.siteUrl || null, pos: it.pos || 0 });
const rowToCat = (r) => ({ id: r.id, name: r.name, tone: r.tone, custom: !!r.custom, sort: r.sort });
const catToRow = (c, hs, sort) => ({ homespace_id: hs, id: c.id, name: c.name, tone: c.tone, custom: !!c.custom, sort: sort != null ? sort : (c.sort || 0) });

/* ── Supabase-backed, homespace-scoped store ──────────────────────────────── */
function useIdeasStore(homespaceId, me, members) {
  const BE = window.TogetherBackend;
  const { client } = BE;
  const [state, setState] = useState(() => ({
    categories: [], ideas: [], syncing: true,
    activeFilter: 'all', statusFilter: 'all', sortMode: 'smart',
    draft: { name: '', catId: 'dine', mapsUrl: '', siteUrl: '', image: null, important: false },
    catsOpen: false, newCatName: '',
    detailId: null, editing: false, edit: { name: '', catId: 'dine', mapsUrl: '', siteUrl: '' },
    imageId: null,
    addOpen: false, bulkOpen: false, bulkText: '', bulkCat: 'dine',
    schedFor: null, schedDate: '', schedStart: '19:00', schedEnd: '', schedNote: '', schedInvite: true,
    bugOpen: false, bugSent: false, bugText: '', bugEmail: '', bugImage: null,
  }));
  const patch = (p) => setState(s => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
  const ref = useRef(state); ref.current = state;
  const meRef = useRef(me); meRef.current = me;
  const membersRef = useRef(members); membersRef.current = members;
  const readPhoto = (file, cb) => { if (!file) return; const r = new FileReader(); r.onload = () => cb(r.result); r.readAsDataURL(file); };
  const db = (p) => { Promise.resolve(p).then(r => { if (r && r.error) console.warn('[togetherkit/ideas] sync', r.error.message); }, e => console.warn('[togetherkit/ideas] sync', e)); };

  // load + realtime
  useEffect(() => {
    if (!homespaceId) return;
    let alive = true;
    patch({ syncing: true });
    const refetch = async () => {
      const [cr, ir] = await Promise.all([
        client.from('idea_categories').select('*').eq('homespace_id', homespaceId).order('sort', { ascending: true }),
        client.from('ideas').select('*').eq('homespace_id', homespaceId).order('pos', { ascending: false }),
      ]);
      if (!alive) return;
      let cats = (cr.data || []).map(rowToCat);
      // Seed the 3 starter categories only for a brand-new space (no categories
      // AND no ideas). Otherwise a user who deleted the defaults would get them
      // back on every reload.
      if (cats.length === 0 && !cr.error && (ir.data || []).length === 0) {
        const seed = SEED_CATS.map((c, i) => catToRow(c, homespaceId, i));
        await client.from('idea_categories').upsert(seed, { onConflict: 'homespace_id,id', ignoreDuplicates: true });
        cats = SEED_CATS.map((c, i) => ({ ...c, sort: i }));
      }
      patch({ categories: cats, ideas: (ir.data || []).map(rowToIdea), syncing: false });
    };
    refetch();
    const ch = client.channel('ideas:' + homespaceId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas', filter: 'homespace_id=eq.' + homespaceId }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'idea_categories', filter: 'homespace_id=eq.' + homespaceId }, refetch)
      .subscribe();
    return () => { alive = false; client.removeChannel(ch); };
  }, [client, homespaceId]);

  const actions = useMemo(() => ({
    set: patch,
    remove: (id) => { patch(s => ({ ideas: s.ideas.filter(i => i.id !== id) })); db(client.from('ideas').delete().eq('id', id)); },
    toggleImportant: (id) => { const it = ref.current.ideas.find(i => i.id === id); if (!it) return; patch(s => ({ ideas: s.ideas.map(i => i.id === id ? { ...i, important: !i.important } : i) })); db(client.from('ideas').update({ important: !it.important, updated_at: new Date().toISOString() }).eq('id', id)); },

    setDraft: (p) => patch(s => ({ draft: { ...s.draft, ...p } })),
    addIdea: () => {
      const s = ref.current, d = s.draft, m = meRef.current || { uid: null, name: 'Me' }, name = (d.name || '').trim();
      if (!name) return;
      const it = { id: BE.newId(), name, catId: d.catId, byUser: m.uid, byName: m.name, date: 'Today', scheduled: false, schedText: '', important: d.important, image: d.image, mapsUrl: (d.mapsUrl || '').trim(), siteUrl: (d.siteUrl || '').trim(), pos: Date.now() };
      patch(st => ({ ideas: [it, ...st.ideas], draft: { name: '', catId: d.catId, mapsUrl: '', siteUrl: '', image: null, important: false }, addOpen: false }));
      db(client.from('ideas').insert(ideaToRow(it, homespaceId)));
    },
    onDraftPhoto: (e) => readPhoto(e.target.files && e.target.files[0], (d) => patch(s => ({ draft: { ...s.draft, image: d } }))),

    addCategory: () => {
      const s = ref.current, name = (s.newCatName || '').trim(); if (!name) return;
      const tone = TONE_CYCLE[s.categories.length % TONE_CYCLE.length];
      const cat = { id: 'c' + Date.now(), name, tone, custom: true, sort: s.categories.length };
      patch(st => ({ categories: [...st.categories, cat], newCatName: '' }));
      db(client.from('idea_categories').insert(catToRow(cat, homespaceId, cat.sort)));
    },
    // Create a custom type on the fly (e.g. from the Add Idea modal) and return
    // its id so the caller can select it. Reuses an existing same-name category.
    createCategory: (rawName) => {
      const s = ref.current, name = (rawName || '').trim(); if (!name) return null;
      const existing = s.categories.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (existing) return existing.id;
      const tone = TONE_CYCLE[s.categories.length % TONE_CYCLE.length];
      const cat = { id: 'c' + Date.now(), name, tone, custom: true, sort: s.categories.length };
      patch(st => ({ categories: [...st.categories, cat] }));
      db(client.from('idea_categories').insert(catToRow(cat, homespaceId, cat.sort)));
      return cat.id;
    },
    renameCategory: (id, v) => { patch(s => ({ categories: s.categories.map(c => c.id === id ? { ...c, name: v } : c) })); db(client.from('idea_categories').update({ name: v }).eq('homespace_id', homespaceId).eq('id', id)); },
    deleteCategory: (id) => {
      const s = ref.current, remaining = s.categories.filter(c => c.id !== id), fb = remaining[0] ? remaining[0].id : '';
      patch(st => ({ categories: remaining, ideas: st.ideas.map(it => it.catId === id ? { ...it, catId: fb } : it), activeFilter: st.activeFilter === id ? 'all' : st.activeFilter, draft: { ...st.draft, catId: st.draft.catId === id ? fb : st.draft.catId } }));
      db(client.from('ideas').update({ cat_id: fb }).eq('homespace_id', homespaceId).eq('cat_id', id));
      db(client.from('idea_categories').delete().eq('homespace_id', homespaceId).eq('id', id));
    },

    startEdit: () => { const it = ref.current.ideas.find(i => i.id === ref.current.detailId); if (!it) return; patch({ editing: true, edit: { name: it.name, catId: it.catId, mapsUrl: it.mapsUrl, siteUrl: it.siteUrl } }); },
    setEdit: (p) => patch(s => ({ edit: { ...s.edit, ...p } })),
    saveEdit: () => { const s = ref.current, e = s.edit, name = (e.name || '').trim(); if (!name) return; const upd = { name, catId: e.catId, mapsUrl: (e.mapsUrl || '').trim(), siteUrl: (e.siteUrl || '').trim() }; patch(st => ({ editing: false, ideas: st.ideas.map(it => it.id === st.detailId ? { ...it, ...upd } : it) })); db(client.from('ideas').update({ name: upd.name, cat_id: upd.catId, maps_url: upd.mapsUrl || null, site_url: upd.siteUrl || null, updated_at: new Date().toISOString() }).eq('id', s.detailId)); },
    deleteDetail: () => { const id = ref.current.detailId; patch({ detailId: null, editing: false }); patch(s => ({ ideas: s.ideas.filter(i => i.id !== id) })); db(client.from('ideas').delete().eq('id', id)); },

    openSchedule: (id) => patch({ schedFor: id, schedDate: nextSaturday(), schedStart: '19:00', schedEnd: '', schedNote: '', schedInvite: true }),
    closeSchedule: () => patch({ schedFor: null }),
    saveSchedule: () => {
      const s = ref.current, id = s.schedFor;
      const text = fmtSchedule(s.schedDate, s.schedStart);
      const at = s.schedDate ? new Date(s.schedDate + 'T' + (s.schedStart || '19:00')).toISOString() : null;
      const idea = ref.current.ideas.find(i => i.id === id);
      patch(st => ({ schedFor: null, ideas: st.ideas.map(it => it.id === id ? { ...it, scheduled: true, schedText: text, schedNote: s.schedNote } : it) }));
      db(client.from('ideas').update({ scheduled: true, sched_text: text, sched_at: at, sched_note: s.schedNote || null, updated_at: new Date().toISOString() }).eq('id', id));
      // open a prefilled Google Calendar event: date/time, location, notes, and
      // (if "invite both" is on) the partner pre-added as a guest. One tap to save.
      try {
        const mem = membersRef.current || [], my = meRef.current;
        const guests = s.schedInvite ? mem.filter(m => m.email && (!my || m.uid !== my.uid)).map(m => m.email) : [];
        const url = gcalUrl(idea && idea.name, s.schedDate, s.schedStart, s.schedEnd, {
          note: s.schedNote, location: idea && idea.name, mapsUrl: idea && idea.mapsUrl, siteUrl: idea && idea.siteUrl, guests,
        });
        if (url) window.open(url, '_blank', 'noopener');
      } catch (e) {}
    },
    unschedule: (id) => { patch(s => ({ ideas: s.ideas.map(it => it.id === id ? { ...it, scheduled: false, schedText: '' } : it) })); db(client.from('ideas').update({ scheduled: false, sched_text: null, sched_at: null }).eq('id', id)); },

    saveBulk: () => {
      const s = ref.current, m = meRef.current || { uid: null, name: 'Me' };
      const lines = s.bulkText.split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) return;
      const base = Date.now();
      const items = lines.map((name, i) => ({ id: BE.newId(), name, catId: s.bulkCat, byUser: m.uid, byName: m.name, date: 'Today', scheduled: false, schedText: '', important: false, image: null, mapsUrl: '', siteUrl: '', pos: base + (lines.length - i) }));
      patch(st => ({ ideas: [...items, ...st.ideas], bulkOpen: false, bulkText: '' }));
      db(client.from('ideas').insert(items.map(it => ideaToRow(it, homespaceId))));
    },

    onBugPhoto: (e) => readPhoto(e.target.files && e.target.files[0], (d) => patch({ bugImage: d })),
    sendBug: () => { try { console.info('[Together] Bug report', { msg: ref.current.bugText, email: ref.current.bugEmail, feature: 'date-ideas' }); } catch (e) {} patch({ bugSent: true }); },
  }), [client, homespaceId, BE]);

  return [state, actions];
}

/* ── shared style fragments ───────────────────────────────────────────────── */
const chipBase = { padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block' };
const upper = { fontSize: 11, fontWeight: 800, color: '#aaa093', letterSpacing: '.6px', textTransform: 'uppercase' };
const thumbBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: '#f3ece1', color: '#b59a7d', width: 24, height: 24, borderRadius: 8, cursor: 'pointer', flexShrink: 0, padding: 0 };
const iconBtn = { border: 'none', background: 'none', padding: 2, cursor: 'pointer', lineHeight: 0 };
const importantTag = { fontSize: 11, fontWeight: 800, color: '#a8822f', background: '#f6edd6', padding: '3px 9px', borderRadius: 8 };
const closeX = { flexShrink: 0, width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#ece6db', color: '#857c70', fontSize: 17, cursor: 'pointer', lineHeight: 1 };
const fieldInput = { border: '1px solid #ece6db', background: '#fff', borderRadius: 13, padding: '13px 15px', fontSize: 15, fontFamily: 'inherit', color: '#3a352f', outline: 'none', fontWeight: 600, width: '100%' };
const selectStyle = { border: '1px solid #ece6db', background: '#fff', borderRadius: 12, padding: '12px 13px', fontSize: 14, fontFamily: 'inherit', color: '#3a352f', fontWeight: 700, outline: 'none', cursor: 'pointer', width: '100%', appearance: 'none', WebkitAppearance: 'none' };
const cancelBtn = { flex: 1, background: '#fff', color: '#7a7166', border: '1px solid #e6ded2', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' };
const modalTitle = { fontFamily: "'Quicksand',sans-serif", fontSize: 23, fontWeight: 700, margin: 0, color: '#3a352f' };
const openUrl = (e, url) => { e.stopPropagation(); if (url) window.open(url, '_blank', 'noopener'); };

/* ── small presentational pieces ──────────────────────────────────────────── */
function DAvatar({ color, initial, size = 20 }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', background: color, color: '#fff', fontWeight: 800, fontSize: size * 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initial}</span>;
}
function StatusPill({ idea }) {
  const sched = idea.scheduled;
  const st = sched ? { background: '#e7ede0', color: '#6f7d52' } : { background: '#f6ebdc', color: '#b07d42' };
  return (
    <span style={{ padding: '5px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, letterSpacing: '.3px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5, ...st }}>
      {sched ? <DIcons.Calendar size={12} /> : null}{sched ? idea.schedText : 'Idea'}
    </span>
  );
}
function CalCircle({ scheduled, partner, onClick, size = 26 }) {
  return (
    <button onClick={onClick} title={scheduled ? 'Scheduled' : 'Schedule this'} style={{ width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0, transition: 'all .15s', border: scheduled ? ('2px solid ' + partner) : '2px solid #dcd4c6', background: scheduled ? partner : '#fff' }}>
      {scheduled ? <DIcons.Check size={14} color="#fff" /> : <DIcons.Calendar size={13} color="#c2b59f" />}
    </button>
  );
}
function LinkButtons({ idea }) {
  return (
    <Fragment>
      {idea.image && <button onClick={idea.openImg} title="View photo" style={thumbBtn}><DIcons.Camera size={13} /></button>}
      {idea.mapsUrl && <button onClick={(e) => openUrl(e, idea.mapsUrl)} title="Open in Maps" style={thumbBtn}><DIcons.Pin size={13} color="#b59a7d" /></button>}
      {idea.siteUrl && <button onClick={(e) => openUrl(e, idea.siteUrl)} title="Visit site" style={thumbBtn}><DIcons.Globe size={13} color="#b59a7d" /></button>}
    </Fragment>
  );
}
// Swipe-left-to-delete wrapper (same gesture as the shopping list). Drag a
// card/row left to reveal a red Delete affordance; release past the threshold
// removes it, a tap passes through, a vertical drag yields to scrolling.
function DSwipeRow({ onDelete, radius = 0, frontBg, children }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const st = useRef(null);
  const dxRef = useRef(0);
  const movedRef = useRef(false);
  const THRESHOLD = 88, MAX = 128;
  const applyDx = (n) => { dxRef.current = n; setDx(n); };
  const onPointerDown = (e) => {
    if (removing) return;
    if (e.target.closest('button, a, input, select, label')) return;
    st.current = { x: e.clientX, y: e.clientY, active: false };
    movedRef.current = false;
  };
  const onPointerMove = (e) => {
    if (!st.current || removing) return;
    const dX = e.clientX - st.current.x, dY = e.clientY - st.current.y;
    if (!st.current.active) {
      if (Math.abs(dX) > 8 && Math.abs(dX) > Math.abs(dY)) { st.current.active = true; setDragging(true); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} }
      else if (Math.abs(dY) > 10) { st.current = null; return; }
    }
    if (st.current && st.current.active) { const next = Math.max(-MAX, Math.min(0, dX)); applyDx(next); if (next < -6) movedRef.current = true; }
  };
  const finish = () => {
    if (!st.current) { setDragging(false); return; }
    const active = st.current.active; st.current = null; setDragging(false);
    if (!active) return;
    if (dxRef.current <= -THRESHOLD) { setRemoving(true); window.setTimeout(() => onDelete && onDelete(), 200); }
    else applyDx(0);
  };
  return (
    <div style={{ position: 'relative' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: radius, background: '#c4604c', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingRight: 22, color: '#fff', fontWeight: 800, fontSize: 14, opacity: (dx < 0 || removing) ? 1 : 0 }}>
        <DIcons.Trash size={17} /> Delete
      </div>
      <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finish} onPointerCancel={finish}
        onClickCapture={(e) => { if (movedRef.current) { e.preventDefault(); e.stopPropagation(); movedRef.current = false; } }}
        style={{ position: 'relative', background: frontBg, transform: removing ? 'translateX(-110%)' : ('translateX(' + dx + 'px)'), transition: dragging ? 'none' : 'transform .2s cubic-bezier(.3,.7,.4,1), opacity .2s ease', opacity: removing ? 0 : 1, touchAction: 'pan-y' }}>
        {children}
      </div>
    </div>
  );
}

function IdeaCard({ idea, partner }) {
  return (
    <div onClick={idea.open} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: '#fff', borderRadius: 18, cursor: 'pointer', border: idea.important ? '1.5px solid #e7d3a3' : '1px solid transparent', boxShadow: '0 1px 2px rgba(58,53,47,.05),0 6px 16px rgba(58,53,47,.035)' }}>
      <CalCircle scheduled={idea.scheduled} partner={partner} onClick={idea.circle} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '.1px', color: '#3a352f' }}>{idea.name}</span>
          <LinkButtons idea={idea} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
          <span style={{ ...chipBase, background: idea.tone.bg, color: idea.tone.fg }}>{idea.catName}</span>
          {idea.important && <span style={importantTag}>Important</span>}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#9a9186', fontSize: 12, fontWeight: 600 }}>
            <DAvatar color={idea.byColor} initial={idea.byInitial} size={20} />{idea.byName}
            <span style={{ color: '#c3bbae' }}>· {idea.date}</span>
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
        <button onClick={idea.star} title="Mark important" style={iconBtn}><DIcons.Star size={19} filled={idea.important} /></button>
        <StatusPill idea={idea} />
      </div>
    </div>
  );
}
const DESK_COLS = '40px minmax(0,1fr) 150px 176px 196px 30px';
function IdeaRow({ idea, partner }) {
  return (
    <div onClick={idea.open} style={{ display: 'grid', gridTemplateColumns: DESK_COLS, gap: 14, alignItems: 'center', padding: '15px 6px', borderBottom: '1px solid #f4efe7', cursor: 'pointer', background: idea.important ? '#fdf8ee' : 'transparent' }}>
      <CalCircle scheduled={idea.scheduled} partner={partner} onClick={idea.circle} />
      <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <span style={{ fontSize: 15.5, fontWeight: 700, color: '#3a352f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{idea.name}</span>
        <LinkButtons idea={idea} />
      </span>
      <span><span style={{ ...chipBase, background: idea.tone.bg, color: idea.tone.fg }}>{idea.catName}</span></span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#7a7166', fontSize: 13, fontWeight: 600, minWidth: 0 }}>
        <DAvatar color={idea.byColor} initial={idea.byInitial} size={26} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{idea.byName}<span style={{ color: '#b8b0a3' }}> · {idea.date}</span></span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <button onClick={idea.star} title="Mark important" style={{ ...iconBtn, flexShrink: 0 }}><DIcons.Star size={18} filled={idea.important} /></button>
        <StatusPill idea={idea} />
      </span>
      <button onClick={idea.remove} style={{ background: 'none', border: 'none', color: '#cfc7ba', fontSize: 18, cursor: 'pointer', padding: 2, lineHeight: 1 }}>×</button>
    </div>
  );
}
function CategoryFilters({ v }) {
  return (
    <Fragment>
      {v.catFilters.map(f => (<button key={f.id} onClick={f.select} style={f.chipStyle}>{f.showDot && <span style={f.dotStyle} />}{f.name}<span style={f.countStyle}>{f.count}</span></button>))}
      <button onClick={v.toggleCats} style={v.newCatChipStyle}>+ New Category</button>
    </Fragment>
  );
}
function StatusFilters({ v }) {
  return (
    <Fragment>
      {v.statusFilters.map(s => (<button key={s.id} onClick={s.select} style={s.chipStyle}>{s.star && <DIcons.Star size={13} filled color="currentColor" />}{s.name}<span style={s.countStyle}>{s.count}</span></button>))}
    </Fragment>
  );
}
function CategoriesPanel({ v, partner, maxWidth }) {
  const labelInput = { flex: 1, border: 'none', background: '#f5f0e8', borderRadius: 11, padding: '10px 13px', fontSize: 14, fontFamily: 'inherit', fontWeight: 700, color: '#3a352f', outline: 'none' };
  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: 16, boxShadow: '0 1px 2px rgba(58,53,47,.05),0 8px 22px rgba(58,53,47,.05)', display: 'flex', flexDirection: 'column', gap: 14, maxWidth }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 17, color: '#3a352f' }}>Categories</span>
        <button onClick={v.toggleCats} style={{ background: 'none', border: 'none', color: '#a8794f', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={upper}>Your categories</span>
        {v.manageCats.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {v.manageCats.map(cl => (
              <div key={cl.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={cl.dotStyle} /><input value={cl.name} onChange={cl.rename} style={labelInput} />
                <button onClick={cl.remove} title="Delete category" style={{ background: '#f6ece9', border: 'none', color: '#b07a6e', width: 34, height: 34, borderRadius: 10, fontSize: 16, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        ) : <span style={{ fontSize: 13, color: '#b3a99c', fontWeight: 600 }}>No categories yet — add one below.</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #f0ebe2', paddingTop: 14 }}>
        <span style={v.newCatDot} />
        <input value={v.newCatName} onChange={v.setNewCatName} onKeyDown={v.onNewCatKey} placeholder="New category name…" style={labelInput} />
        <button onClick={v.addCategory} style={{ background: partner, color: '#fff', border: 'none', borderRadius: 11, padding: '10px 16px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Add</button>
      </div>
    </div>
  );
}

/* ── overlay / sheet (fixed, full-viewport) ───────────────────────────────── */
function Overlay({ onClose, z = 1200, children }) {
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: z, background: 'rgba(58,53,47,.42)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, animation: 'tog-fade .15s ease' }}>{children}</div>;
}
function Sheet({ stop, maxWidth, children, style }) {
  return <div onClick={stop} style={{ width: '100%', maxWidth, background: '#f6f4ef', borderRadius: 26, boxShadow: '0 24px 60px rgba(58,53,47,.34)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column', animation: 'tog-pop .18s ease', ...style }}>{children}</div>;
}
function FieldWithIcon({ icon, ...rest }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, border: '1px solid #ece6db', background: '#fff', borderRadius: 13, padding: '0 13px' }}>
      <span style={{ color: '#b59a7d', flexShrink: 0, display: 'flex' }}>{icon}</span>
      <input {...rest} style={{ flex: 1, border: 'none', background: 'none', padding: '12px 0', fontSize: 14, fontFamily: 'inherit', color: '#3a352f', outline: 'none', fontWeight: 600 }} />
    </div>
  );
}

/* ── modals ───────────────────────────────────────────────────────────────── */
function AddModal({ v, primary }) {
  const [showNew, setShowNew] = useState(false);
  const [newType, setNewType] = useState('');
  if (!v.s.addOpen) return null;
  const d = v.s.draft;
  const createType = () => {
    const id = v.a.createCategory(newType);
    if (id) { v.a.setDraft({ catId: id }); setNewType(''); setShowNew(false); }
  };
  return (
    <Overlay onClose={() => v.a.set({ addOpen: false })}>
      <Sheet stop={v.stop} maxWidth={360}>
        <div style={{ padding: '22px 22px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <h2 style={modalTitle}>Add Idea</h2>
          <button onClick={() => v.a.set({ addOpen: false })} style={closeX}>×</button>
        </div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input value={d.name} onChange={(e) => v.a.setDraft({ name: e.target.value })} placeholder="What should we do?" style={fieldInput} />
          <div style={{ position: 'relative' }}>
            <select value={d.catId} onChange={(e) => { if (e.target.value === '__new__') { setShowNew(true); } else { setShowNew(false); v.a.setDraft({ catId: e.target.value }); } }} style={selectStyle}>
              {v.catOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              <option value="__new__">+ New type…</option>
            </select>
            <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#b3a99c' }}><DIcons.Chevron size={15} /></span>
          </div>
          {showNew && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input autoFocus value={newType} onChange={(e) => setNewType(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createType(); }} placeholder="Name your own type…" style={{ ...fieldInput, flex: 1 }} />
              <button onClick={createType} disabled={!newType.trim()} style={{ flexShrink: 0, background: newType.trim() ? primary : '#d9cfc0', color: '#fff', border: 'none', borderRadius: 13, padding: '0 18px', fontWeight: 800, fontSize: 14, cursor: newType.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>Add</button>
            </div>
          )}
          <FieldWithIcon icon={<DIcons.Pin size={16} />} value={d.mapsUrl} onChange={(e) => v.a.setDraft({ mapsUrl: e.target.value })} placeholder="Google Maps link · optional" />
          <FieldWithIcon icon={<DIcons.Globe size={16} />} value={d.siteUrl} onChange={(e) => v.a.setDraft({ siteUrl: e.target.value })} placeholder="Website link · optional" />
          {d.image ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#fff', border: '1px solid #ece6db', borderRadius: 13, padding: '9px 11px' }}>
              <img src={d.image} alt="" style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#7a7166' }}>Photo attached</span>
              <button onClick={() => v.a.setDraft({ image: null })} style={{ background: '#f5f0e8', border: 'none', color: '#b07a6e', width: 30, height: 30, borderRadius: 9, fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px dashed #d9cbb7', borderRadius: 13, padding: 12, color: '#a8794f', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
              <DIcons.Camera size={16} stroke={2} /> Add a photo <span style={{ color: '#c3b29a', fontWeight: 600 }}>· optional</span>
              <input type="file" accept="image/*" onChange={v.a.onDraftPhoto} style={{ display: 'none' }} />
            </label>
          )}
          <button onClick={() => v.a.setDraft({ important: !d.important })} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', borderRadius: 13, border: '1px solid ' + (d.important ? '#e7d3a3' : '#ece6db'), background: d.important ? '#fdf8ee' : '#fff', color: d.important ? '#a8822f' : '#7a7166', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            <DIcons.Star size={18} filled={d.important} color={d.important ? undefined : '#b9ad97'} />
            <span style={{ flex: 1, textAlign: 'left' }}>Mark as important</span>
          </button>
        </div>
        <div style={{ padding: '16px 22px 22px', display: 'flex', gap: 10 }}>
          <button onClick={() => v.a.set({ addOpen: false })} style={cancelBtn}>Cancel</button>
          <button onClick={v.a.addIdea} style={{ flex: 2, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>Save Idea</button>
        </div>
      </Sheet>
    </Overlay>
  );
}
function BulkModal({ v, primary }) {
  if (!v.s.bulkOpen) return null;
  const lines = v.s.bulkText.split('\n').map(l => l.trim()).filter(Boolean);
  return (
    <Overlay onClose={() => v.a.set({ bulkOpen: false })}>
      <Sheet stop={v.stop} maxWidth={440}>
        <div style={{ padding: '22px 22px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div><h2 style={{ ...modalTitle, marginBottom: 4 }}>Quick Add</h2><p style={{ margin: 0, fontSize: 14, color: '#9a9186', fontWeight: 600 }}>Paste a list — one idea per line.</p></div>
          <button onClick={() => v.a.set({ bulkOpen: false })} style={closeX}>×</button>
        </div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          <textarea value={v.s.bulkText} onChange={(e) => v.a.set({ bulkText: e.target.value })} placeholder={'Picnic at the botanical garden\nVinyl record shopping\nDay trip to the coast'} style={{ width: '100%', minHeight: 120, resize: 'vertical', border: '1px solid #ece6db', background: '#fff', borderRadius: 14, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', fontWeight: 600, color: '#3a352f', outline: 'none', lineHeight: 1.7 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, fontWeight: 700, color: '#857c70' }}>
            <span>Add to</span>
            <div style={{ position: 'relative' }}>
              <select value={v.s.bulkCat} onChange={(e) => v.a.set({ bulkCat: e.target.value })} style={{ ...selectStyle, width: 'auto', padding: '8px 30px 8px 11px', borderRadius: 10, fontSize: 13 }}>{v.catOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#b3a99c' }}><DIcons.Chevron size={13} /></span>
            </div>
          </div>
          {lines.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={upper}>Preview</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#6f7d52', background: '#eef1e6', padding: '3px 10px', borderRadius: 999 }}>{lines.length + (lines.length === 1 ? ' idea ready' : ' ideas ready')}</span>
              </div>
              {lines.map((ln, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: '#fff', border: '1px solid #ece6db', borderRadius: 12 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#e7ede0', color: '#6f7d52', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><DIcons.Check size={12} /></span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, color: '#3a352f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ln}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '16px 22px 22px', display: 'flex', gap: 10 }}>
          <button onClick={() => v.a.set({ bulkOpen: false })} style={cancelBtn}>Cancel</button>
          <button onClick={v.a.saveBulk} style={{ flex: 2, background: lines.length ? primary : '#d9cfc0', color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: lines.length ? 'pointer' : 'default', fontFamily: 'inherit' }}>{lines.length ? ('Add ' + lines.length + (lines.length === 1 ? ' idea' : ' ideas')) : 'Add ideas'}</button>
        </div>
      </Sheet>
    </Overlay>
  );
}
function DetailModal({ v, primary, partner }) {
  const idea = v.detail;
  if (!idea) return null;
  const editing = v.s.editing, e = v.s.edit;
  const Row = ({ label, children, last }) => (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 2px', borderBottom: last ? 'none' : '1px solid #ece6db' }}><span style={{ fontSize: 13, fontWeight: 700, color: '#a89e90' }}>{label}</span>{children}</div>);
  const LinkRow = ({ icon, label, url }) => (
    <button onClick={(ev) => openUrl(ev, url)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: '#fff', border: '1px solid #ece6db', borderRadius: 13, padding: '12px 13px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, background: '#f3ece1', color: '#a8794f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: '#3a352f' }}>{label}</span>
      <span style={{ color: '#c3b6a3', fontSize: 18, lineHeight: 1 }}>›</span>
    </button>
  );
  return (
    <Overlay onClose={() => v.a.set({ detailId: null, editing: false })} z={1000}>
      <Sheet stop={v.stop} maxWidth={360} style={{ maxHeight: '92vh' }}>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '22px 22px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            {!editing
              ? <h2 style={{ fontFamily: "'Quicksand',sans-serif", fontSize: 24, fontWeight: 700, margin: 0, color: '#3a352f', lineHeight: 1.15 }}>{idea.name}</h2>
              : <input value={e.name} onChange={(ev) => v.a.setEdit({ name: ev.target.value })} style={{ flex: 1, border: '1px solid #ece6db', background: '#fff', borderRadius: 12, padding: '11px 13px', fontSize: 18, fontFamily: "'Quicksand',sans-serif", fontWeight: 700, color: '#3a352f', outline: 'none' }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button onClick={() => v.a.toggleImportant(idea.id)} title="Mark important" style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', lineHeight: 0 }}><DIcons.Star size={22} filled={idea.important} /></button>
              <button onClick={() => v.a.set({ detailId: null, editing: false })} style={closeX}>×</button>
            </div>
          </div>
          {idea.image && (
            <button onClick={() => v.a.set({ imageId: idea.id })} style={{ display: 'block', width: '100%', marginTop: 16, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}>
              <img src={idea.image} alt={idea.name} style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 16, display: 'block' }} />
            </button>
          )}
          {!editing && (
            <Fragment>
              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Row label="Category"><span style={{ ...chipBase, background: idea.tone.bg, color: idea.tone.fg }}>{idea.catName}</span></Row>
                <Row label="Added by"><span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 700, color: '#3a352f' }}><DAvatar color={idea.byColor} initial={idea.byInitial} size={22} />{idea.byName}</span></Row>
                <Row label="Created"><span style={{ fontSize: 14, fontWeight: 700, color: '#3a352f' }}>{idea.date}</span></Row>
                <Row label="Status" last><StatusPill idea={idea} /></Row>
              </div>
              {(idea.mapsUrl || idea.siteUrl) && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {idea.mapsUrl && <LinkRow icon={<DIcons.Pin size={16} />} label="Open in Maps" url={idea.mapsUrl} />}
                  {idea.siteUrl && <LinkRow icon={<DIcons.Globe size={16} />} label="Visit site" url={idea.siteUrl} />}
                </div>
              )}
            </Fragment>
          )}
          {editing && (
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <select value={e.catId} onChange={(ev) => v.a.setEdit({ catId: ev.target.value })} style={selectStyle}>{v.catOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#b3a99c' }}><DIcons.Chevron size={15} /></span>
              </div>
              <FieldWithIcon icon={<DIcons.Pin size={16} />} value={e.mapsUrl} onChange={(ev) => v.a.setEdit({ mapsUrl: ev.target.value })} placeholder="Google Maps link · optional" />
              <FieldWithIcon icon={<DIcons.Globe size={16} />} value={e.siteUrl} onChange={(ev) => v.a.setEdit({ siteUrl: ev.target.value })} placeholder="Website link · optional" />
            </div>
          )}
        </div>
        <div style={{ padding: '14px 22px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!editing && (
            <Fragment>
              <button onClick={() => v.a.openSchedule(idea.id)} style={{ background: partner, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <DIcons.Calendar size={16} color="#fff" />{idea.scheduled ? 'Reschedule' : 'Schedule'}
              </button>
              {idea.scheduled && <button onClick={() => v.a.unschedule(idea.id)} style={{ background: '#f3ece1', color: '#a8794f', border: 'none', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Remove from calendar</button>}
            </Fragment>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            {!editing && <button onClick={v.a.startEdit} style={{ flex: 1, background: '#fff', color: '#7a7166', border: '1px solid #e6ded2', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>}
            {editing && <button onClick={v.a.saveEdit} style={{ flex: 1, background: partner, color: '#fff', border: 'none', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>}
            <button onClick={v.a.deleteDetail} style={{ flex: 1, background: '#f6ece9', color: '#b07a6e', border: 'none', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
          </div>
        </div>
      </Sheet>
    </Overlay>
  );
}
function ScheduleModal({ v, primary, partner }) {
  if (!v.s.schedFor) return null;
  const s = v.s, idea = v.allById[s.schedFor];
  const members = v.members || [];
  const timeField = { border: '1px solid #ece6db', background: '#fff', borderRadius: 12, padding: '11px 12px', fontSize: 14, fontFamily: 'inherit', color: '#3a352f', fontWeight: 700, outline: 'none', width: '100%' };
  const InviteAvatar = ({ m }) => (<span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><DAvatar color={m.idx === 0 ? primary : partner} initial={(m.name[0] || '?').toUpperCase()} size={26} /><span style={{ fontSize: 13.5, fontWeight: 700, color: '#3a352f' }}>{m.name}</span></span>);
  return (
    <Overlay onClose={v.a.closeSchedule} z={1100}>
      <Sheet stop={v.stop} maxWidth={360}>
        <div style={{ padding: '22px 22px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div><h2 style={{ ...modalTitle, marginBottom: 4 }}>Schedule</h2><p style={{ margin: 0, fontSize: 14, color: '#9a9186', fontWeight: 600 }}>{idea ? idea.name : ''}</p></div>
          <button onClick={v.a.closeSchedule} style={closeX}>×</button>
        </div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><span style={upper}>Date</span><input type="date" value={s.schedDate} onChange={(e) => v.a.set({ schedDate: e.target.value })} style={timeField} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}><span style={upper}>Start</span><input type="time" value={s.schedStart} onChange={(e) => v.a.set({ schedStart: e.target.value })} style={timeField} /></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}><span style={upper}>End <span style={{ color: '#c3b29a' }}>· optional</span></span><input type="time" value={s.schedEnd} onChange={(e) => v.a.set({ schedEnd: e.target.value })} style={timeField} /></div>
          </div>
          <button onClick={() => v.a.set({ schedInvite: !s.schedInvite })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#fff', border: '1px solid ' + (s.schedInvite ? '#cfe0cf' : '#ece6db'), borderRadius: 14, padding: '13px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: '#3a352f' }}>Invite both of us</span>
              <span style={{ display: 'flex', gap: 14 }}>{members.slice(0, 2).map(m => <InviteAvatar key={m.uid} m={m} />)}</span>
            </span>
            <span style={{ width: 44, height: 26, borderRadius: 999, background: s.schedInvite ? partner : '#ddd5c8', position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
              <span style={{ position: 'absolute', top: 3, left: s.schedInvite ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
            </span>
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}><span style={upper}>Note <span style={{ color: '#c3b29a' }}>· optional</span></span><textarea value={s.schedNote} onChange={(e) => v.a.set({ schedNote: e.target.value })} placeholder="Anything to remember…" style={{ width: '100%', minHeight: 64, resize: 'vertical', border: '1px solid #ece6db', background: '#fff', borderRadius: 13, padding: '11px 13px', fontSize: 14, fontFamily: 'inherit', fontWeight: 600, color: '#3a352f', outline: 'none', lineHeight: 1.5 }} /></div>
          <p style={{ margin: 0, fontSize: 12.5, color: '#9a9186', fontWeight: 600, lineHeight: 1.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, marginTop: 1, display: 'flex' }}><DIcons.Heart size={15} color={partner} /></span>
            Saves the date and opens Google Calendar — prefilled with the place and your partner invited. Just tap Save.
          </p>
        </div>
        <div style={{ padding: '16px 22px 22px', display: 'flex', gap: 10 }}>
          <button onClick={v.a.closeSchedule} style={cancelBtn}>Cancel</button>
          <button onClick={v.a.saveSchedule} style={{ flex: 2, background: partner, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><DIcons.Calendar size={16} color="#fff" />Add to Google Calendar</button>
        </div>
      </Sheet>
    </Overlay>
  );
}
function ImageModal({ v }) {
  const it = v.allById[v.s.imageId];
  if (!it) return null;
  return (
    <div onClick={() => v.a.set({ imageId: null })} style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(40,36,32,.78)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'tog-fade .15s ease' }}>
      <div onClick={v.stop} style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, animation: 'tog-pop .18s ease' }}>
        <img src={it.image} alt={it.name} style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.4)' }} />
        <span style={{ fontFamily: "'Quicksand',sans-serif", fontSize: 18, fontWeight: 700, color: '#fff' }}>{it.name}</span>
        <button onClick={() => v.a.set({ imageId: null })} style={{ background: 'rgba(255,255,255,.16)', color: '#fff', border: '1px solid rgba(255,255,255,.3)', borderRadius: 13, padding: '11px 26px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
      </div>
    </div>
  );
}
function BugModal({ v, primary }) {
  if (!v.s.bugOpen) return null;
  const s = v.s;
  return (
    <Overlay onClose={() => v.a.set({ bugOpen: false, bugSent: false })} z={1400}>
      <Sheet stop={v.stop} maxWidth={380} style={{ maxHeight: '92vh' }}>
        {!s.bugSent ? (
          <div className="tog-scroll" style={{ overflowY: 'auto', padding: '24px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div><h2 style={{ ...modalTitle, marginBottom: 4 }}>Report a Problem</h2><p style={{ margin: 0, fontSize: 14, color: '#9a9186', fontWeight: 600 }}>Help us improve Together.</p></div>
              <button onClick={() => v.a.set({ bugOpen: false })} style={closeX}>×</button>
            </div>
            <div style={{ marginTop: 16 }}><span style={upper}>What happened?</span><textarea value={s.bugText} onChange={(e) => v.a.set({ bugText: e.target.value })} placeholder="Tell us what went wrong…" style={{ marginTop: 8, width: '100%', minHeight: 92, resize: 'vertical', background: '#fff', borderRadius: 14, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', fontWeight: 600, color: '#3a352f', outline: 'none', lineHeight: 1.5, border: '1px solid #ece6db' }} /></div>
            <div style={{ marginTop: 14 }}><span style={upper}>Email <span style={{ color: '#c3b29a' }}>· optional</span></span><input value={s.bugEmail} onChange={(e) => v.a.set({ bugEmail: e.target.value })} type="email" placeholder="you@example.com" style={{ marginTop: 8, width: '100%', background: '#fff', borderRadius: 13, padding: '12px 14px', fontSize: 14.5, fontFamily: 'inherit', fontWeight: 600, color: '#3a352f', outline: 'none', border: '1px solid #ece6db' }} /></div>
            <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
              <button onClick={() => v.a.set({ bugOpen: false })} style={cancelBtn}>Cancel</button>
              <button onClick={v.a.sendBug} style={{ flex: 2, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>Send Report</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '38px 28px 30px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 62, height: 62, borderRadius: '50%', background: '#f6e0dc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DIcons.Heart size={28} color="#d08a86" fill="#d08a86" /></div>
            <h2 style={{ fontFamily: "'Quicksand',sans-serif", fontSize: 25, fontWeight: 700, margin: 0, color: '#3a352f' }}>Thanks</h2>
            <p style={{ margin: 0, fontSize: 14.5, color: '#9a9186', fontWeight: 600, lineHeight: 1.55, maxWidth: 260 }}>Your report has been sent. We'll take a look as soon as possible.</p>
            <button onClick={() => v.a.set({ bugOpen: false, bugSent: false, bugText: '', bugEmail: '' })} style={{ marginTop: 6, width: '100%', background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
          </div>
        )}
      </Sheet>
    </Overlay>
  );
}

/* ── view-model builder ───────────────────────────────────────────────────── */
function buildView(state, actions, opts) {
  const { primary, partner, members = [], me = null } = opts;
  const catById = {}; state.categories.forEach(c => { catById[c.id] = c; });
  const memberByUid = {}; members.forEach(m => { memberByUid[m.uid] = m; });
  const slotColor = (idx) => idx === 0 ? primary : idx === 1 ? partner : '#9a9186';
  const resolveBy = (uid, byName) => { const m = memberByUid[uid]; return m ? { name: m.name, color: slotColor(m.idx) } : { name: byName || 'Someone', color: '#9a9186' }; };
  const allById = {}; state.ideas.forEach(i => { allById[i.id] = i; });

  const af = state.activeFilter, sf = state.statusFilter, sortMode = state.sortMode;
  const byCat = state.ideas.filter(it => af === 'all' || it.catId === af);
  const statusCounts = { all: byCat.length, idea: byCat.filter(i => !i.scheduled).length, scheduled: byCat.filter(i => i.scheduled).length, important: byCat.filter(i => i.important).length };
  let vis = byCat.filter(it => sf === 'idea' ? !it.scheduled : sf === 'scheduled' ? it.scheduled : sf === 'important' ? it.important : true);
  const rankOf = (it) => it.important && !it.scheduled ? 0 : (!it.scheduled ? 1 : (it.important ? 2 : 3));
  const indexed = vis.map((it, i) => ({ it, i }));
  if (sortMode === 'smart') indexed.sort((a, b) => (rankOf(a.it) - rankOf(b.it)) || (a.i - b.i));
  else if (sortMode === 'az') indexed.sort((a, b) => a.it.name.localeCompare(b.it.name));
  else if (sortMode === 'new') indexed.sort((a, b) => (b.it.pos || 0) - (a.it.pos || 0));
  vis = indexed.map(x => x.it);

  const decorate = (it) => {
    const u = resolveBy(it.byUser, it.byName); const cat = catById[it.catId]; const tone = toneOf(cat);
    return {
      id: it.id, name: it.name, scheduled: it.scheduled, schedText: it.schedText, schedAt: it.schedAt, important: it.important,
      image: it.image, mapsUrl: it.mapsUrl, siteUrl: it.siteUrl, date: it.date,
      catName: cat ? cat.name : '—', tone, byName: u.name, byColor: u.color, byInitial: (u.name[0] || '?').toUpperCase(),
      open: () => actions.set({ detailId: it.id, editing: false }),
      openImg: (e) => { e.stopPropagation(); actions.set({ imageId: it.id }); },
      star: (e) => { e.stopPropagation(); actions.toggleImportant(it.id); },
      remove: (e) => { e.stopPropagation(); actions.remove(it.id); },
      deleteSelf: () => actions.remove(it.id),
      circle: (e) => { e.stopPropagation(); if (it.scheduled) actions.unschedule(it.id); else actions.openSchedule(it.id); },
    };
  };
  const ideas = vis.map(decorate);

  const countFor = (id) => id === 'all' ? state.ideas.length : state.ideas.filter(i => i.catId === id).length;
  const mkCatFilter = (id, name, fg, showDot) => {
    const active = af === id;
    return {
      id, name, showDot, count: countFor(id), select: () => actions.set({ activeFilter: id }),
      chipStyle: active
        ? { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, border: '1px solid ' + fg, background: fg, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
        : { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, border: '1px solid #ece6db', background: '#fff', color: '#7a7166', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
      dotStyle: { width: 8, height: 8, borderRadius: '50%', background: active ? 'rgba(255,255,255,.85)' : fg, flexShrink: 0 },
      countStyle: active ? { fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,.25)', color: '#fff', borderRadius: 999, padding: '1px 7px', minWidth: 18, textAlign: 'center' } : { fontSize: 11, fontWeight: 800, background: '#f1ece3', color: '#a89e90', borderRadius: 999, padding: '1px 7px', minWidth: 18, textAlign: 'center' },
    };
  };
  const catFilters = [mkCatFilter('all', 'All Ideas', '#3a352f', false)].concat(state.categories.map(c => mkCatFilter(c.id, c.name, toneOf(c).fg, true)));

  const mkStatusChip = (id, name, count, isStar) => {
    const active = sf === id, accent = isStar ? '#d99a2b' : '#6f665b';
    return {
      id, name, count, star: isStar, select: () => actions.set({ statusFilter: id }),
      chipStyle: active
        ? { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: '1px solid ' + accent, background: accent, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
        : { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: '1px solid #ece6db', background: '#fff', color: isStar ? '#a8822f' : '#7a7166', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
      countStyle: active ? { fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,.25)', color: '#fff', borderRadius: 999, padding: '1px 7px', minWidth: 18, textAlign: 'center' } : { fontSize: 11, fontWeight: 800, background: '#f1ece3', color: '#a89e90', borderRadius: 999, padding: '1px 7px', minWidth: 18, textAlign: 'center' },
    };
  };
  const statusFilters = [mkStatusChip('all', 'All', statusCounts.all, false), mkStatusChip('idea', 'Ideas', statusCounts.idea, false), mkStatusChip('scheduled', 'Scheduled', statusCounts.scheduled, false), mkStatusChip('important', 'Important', statusCounts.important, true)];

  const catOptions = state.categories.map(c => ({ id: c.id, name: c.name }));
  // Every category is editable — defaults and custom alike can be renamed/deleted.
  const manageCats = state.categories.map(c => { const t = toneOf(c); return { id: c.id, name: c.name, custom: c.custom, dotStyle: { width: 12, height: 12, borderRadius: '50%', background: t.fg, flexShrink: 0 }, rename: (e) => actions.renameCategory(c.id, e.target.value), remove: () => actions.deleteCategory(c.id) }; });
  const newTone = TONE[TONE_CYCLE[state.categories.length % TONE_CYCLE.length]];

  const activeName = af === 'all' ? '' : (catById[af] ? catById[af].name : '');
  const sfName = { all: '', idea: 'Ideas', scheduled: 'Scheduled', important: 'Important' }[sf];
  let listHeading = af === 'all' ? 'Our ideas' : activeName;
  if (sf !== 'all') listHeading = (af === 'all' ? sfName : (activeName + ' · ' + sfName));

  const detail = state.ideas.find(i => i.id === state.detailId);
  const ideaCount = state.ideas.filter(i => !i.scheduled).length;

  return {
    s: state, a: actions, allById, primary, partner, members, me,
    stop: (e) => e.stopPropagation(),
    ideas, catFilters, statusFilters, catOptions, manageCats,
    // all scheduled ideas (ignores list filters) — for the calendar view
    scheduledList: state.ideas.filter(i => i.scheduled && i.schedAt).map(decorate),
    isEmpty: vis.length === 0,
    emptyText: (af === 'all' && sf === 'all') ? 'No ideas yet. Add the first thing you two want to do.' : 'Nothing matches these filters.',
    listHeading, planLabel: ideaCount + ' to plan',
    sortMode, sortOptions: [{ id: 'smart', name: 'Smart order' }, { id: 'az', name: 'Name A–Z' }, { id: 'new', name: 'Newest' }],
    setSortMode: (e) => actions.set({ sortMode: e.target.value }),
    catsOpen: state.catsOpen, toggleCats: () => actions.set(s => ({ catsOpen: !s.catsOpen })),
    newCatChipStyle: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 999, border: '1px dashed #cbb9a2', background: state.catsOpen ? '#f3ece1' : 'transparent', color: '#a8794f', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
    newCatName: state.newCatName, setNewCatName: (e) => actions.set({ newCatName: e.target.value }),
    addCategory: actions.addCategory, onNewCatKey: (e) => { if (e.key === 'Enter') actions.addCategory(); },
    newCatDot: { width: 12, height: 12, borderRadius: '50%', background: newTone.fg, flexShrink: 0 },
    detail: detail ? decorate(detail) : null,
  };
}

/* ── header / filters / board ─────────────────────────────────────────────── */
function Brand({ titleSize, subSize, dot, primary, partner }) {
  return (
    <a href="../" title="Back to Together" style={{ display: 'flex', flexDirection: 'column', gap: 5, textDecoration: 'none', color: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}><DIcons.Logo size={dot} primary={primary} partner={partner} /></div>
      <h1 style={{ fontFamily: "'Quicksand',sans-serif", fontSize: titleSize, fontWeight: 700, margin: 0, color: '#3a352f', letterSpacing: '.3px' }}>Together</h1>
      <p style={{ margin: 0, fontSize: subSize, color: '#9a9186', fontWeight: 600 }}>Date ideas, trips &amp; activities for us</p>
    </a>
  );
}
function EmptyState({ text, pad }) {
  return <div style={{ textAlign: 'center', padding: pad, color: '#b3a99c', fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{text}</div>;
}
function FilterGroup({ label, kind, v, open, onToggle, summary }) {
  return (
    <div>
      <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: '3px 2px', cursor: 'pointer', fontFamily: 'inherit' }}>
        <span style={upper}>{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#bcb3a6' }}>
          {!open && summary && <span style={{ fontSize: 12, fontWeight: 800, color: '#857c70', background: '#fff', border: '1px solid #ece6db', padding: '3px 11px', borderRadius: 999, whiteSpace: 'nowrap' }}>{summary}</span>}
          <DIcons.Chevron size={16} open={open} />
        </span>
      </button>
      {open && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 9 }}>{kind === 'cats' ? <CategoryFilters v={v} /> : <StatusFilters v={v} />}</div>}
    </div>
  );
}
const FILT_KEY = 'togetherkit.ideas.filterui';
/* ── calendar view (shared planned dates, from the app's own data) ─────────── */
function CalendarView({ items, month, onPrev, onNext, onToday, primary, partner, members, me, onOpen }) {
  const y = month.getFullYear(), m = month.getMonth();
  const firstDay = new Date(y, m, 1).getDay();              // 0 = Sun
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  const isToday = (d) => today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

  const byDay = {};
  items.forEach(it => { const d = new Date(it.schedAt); if (!isNaN(d) && d.getFullYear() === y && d.getMonth() === m) (byDay[d.getDate()] = byDay[d.getDate()] || []).push(it); });
  const agenda = items.map(it => ({ it, d: new Date(it.schedAt) })).filter(x => !isNaN(x.d) && x.d.getFullYear() === y && x.d.getMonth() === m).sort((a, b) => a.d - b.d);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const navBtn = { width: 36, height: 36, borderRadius: 11, border: '1px solid #ece6db', background: '#fff', color: '#7a7166', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
  const wd = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onPrev} style={navBtn} title="Previous month"><span style={{ transform: 'rotate(90deg)', display: 'flex' }}><DIcons.Chevron size={16} /></span></button>
        <button onClick={onToday} title="Jump to today" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          <span style={{ fontFamily: "'Quicksand',sans-serif", fontSize: 20, fontWeight: 700, color: '#3a352f' }}>{MONS[m]} {y}</span>
        </button>
        <button onClick={onNext} style={navBtn} title="Next month"><span style={{ transform: 'rotate(-90deg)', display: 'flex' }}><DIcons.Chevron size={16} /></span></button>
      </div>

      <div style={{ background: '#fff', borderRadius: 18, padding: 12, boxShadow: '0 1px 2px rgba(58,53,47,.05),0 8px 22px rgba(58,53,47,.05)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 6 }}>
          {wd.map((w, i) => <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#b3a99c' }}>{w}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={'e' + i} />;
            const dayItems = byDay[d] || [];
            const has = dayItems.length > 0;
            return (
              <button key={d} onClick={has ? () => onOpen(dayItems[0].id) : undefined} disabled={!has}
                style={{ aspectRatio: '1 / 1', minHeight: 42, border: 'none', borderRadius: 10, cursor: has ? 'pointer' : 'default', fontFamily: 'inherit', padding: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: isToday(d) ? '#f4e8dd' : (has ? '#faf7f2' : 'transparent') }}>
                <span style={{ fontSize: 13, fontWeight: isToday(d) ? 800 : 600, color: isToday(d) ? '#a8794f' : '#3a352f' }}>{d}</span>
                {has && (
                  <span style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {dayItems.slice(0, 3).map((it, k) => <span key={k} style={{ width: 5, height: 5, borderRadius: '50%', background: it.byColor }} />)}
                    {dayItems.length > 3 && <span style={{ fontSize: 8, color: '#b3a99c', fontWeight: 800 }}>+{dayItems.length - 3}</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {members && members.length > 0 && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', padding: '0 4px' }}>
          {members.slice(0, 2).map(mem => (
            <span key={mem.uid} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: mem.idx === 0 ? primary : partner }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#7a7166' }}>{me && mem.uid === me.uid ? 'You' : mem.name}</span>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <span style={upper}>This month</span>
        {agenda.length ? agenda.map(({ it, d }) => (
          <button key={it.id} onClick={() => onOpen(it.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', borderRadius: 14, border: '1px solid transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(58,53,47,.05),0 6px 16px rgba(58,53,47,.035)' }}>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 38 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#b3a99c', textTransform: 'uppercase' }}>{DAYS[d.getDay()]}</span>
              <span style={{ fontSize: 19, fontWeight: 800, color: '#3a352f', lineHeight: 1 }}>{d.getDate()}</span>
            </span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: it.byColor, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#3a352f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
              <div style={{ fontSize: 12.5, color: '#9a9186', fontWeight: 600, marginTop: 2 }}>{(it.schedText || it.catName)} · {it.byName}</div>
            </span>
          </button>
        )) : <EmptyState text="No dates planned this month. Schedule a date idea to see it here." pad="28px 20px" />}
      </div>
    </div>
  );
}

function Board({ v, isDesktop, primary, partner }) {
  const [open, setOpen] = useState(() => { try { return { cats: true, status: true, ...(JSON.parse(localStorage.getItem(FILT_KEY)) || {}) }; } catch (e) { return { cats: true, status: true }; } });
  const toggle = (k) => setOpen(s => { const n = { ...s, [k]: !s[k] }; try { localStorage.setItem(FILT_KEY, JSON.stringify(n)); } catch (e) {} return n; });
  const [viewMode, setViewMode] = useState('list');
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const shiftMonth = (n) => setMonth(mo => new Date(mo.getFullYear(), mo.getMonth() + n, 1));
  const goToday = () => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); };
  const catSummary = (v.catFilters.find(x => x.id === v.s.activeFilter) || {}).name || '';
  const statSummary = (v.statusFilters.find(x => x.id === v.s.statusFilter) || {}).name || '';
  const addBtn = isDesktop
    ? { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: '12px 22px', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }
    : { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: primary, color: '#fff', border: 'none', borderRadius: 15, padding: 14, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' };
  const bulkBtn = isDesktop
    ? { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#fff', color: '#a8794f', border: '1px solid #ecd9c4', borderRadius: 14, padding: '12px 22px', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }
    : { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#fff', color: '#a8794f', border: '1px solid #ecd9c4', borderRadius: 15, padding: 14, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' };
  return (
    <div style={{ padding: isDesktop ? '38px 44px 46px' : '28px 18px 40px', display: 'flex', flexDirection: 'column', gap: isDesktop ? 22 : 18 }}>
      {isDesktop ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}>
          <Brand titleSize={34} subSize={15} dot={20} primary={primary} partner={partner} />
          <div style={{ display: 'flex', gap: 11 }}>
            <button onClick={() => v.a.set({ addOpen: true })} style={addBtn}><DIcons.Plus size={17} />Add Idea</button>
            <button onClick={() => v.a.set({ bulkOpen: true, bulkText: '' })} style={bulkBtn}><DIcons.Plus size={17} />Quick Add</button>
          </div>
        </div>
      ) : (
        <Fragment>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}><Brand titleSize={30} subSize={13.5} dot={18} primary={primary} partner={partner} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => v.a.set({ addOpen: true })} style={addBtn}><DIcons.Plus size={16} />Add Idea</button>
            <button onClick={() => v.a.set({ bulkOpen: true, bulkText: '' })} style={bulkBtn}><DIcons.Plus size={16} />Quick Add</button>
          </div>
        </Fragment>
      )}
      {/* List ⇄ Calendar toggle */}
      <div style={{ display: 'flex', gap: 4, background: '#efe9e0', borderRadius: 12, padding: 4, alignSelf: isDesktop ? 'flex-start' : 'stretch' }}>
        {[['list', 'List'], ['calendar', 'Calendar']].map(([id, label]) => (
          <button key={id} onClick={() => setViewMode(id)}
            style={{ flex: isDesktop ? '0 0 auto' : 1, padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, background: viewMode === id ? '#fff' : 'transparent', color: viewMode === id ? '#a8794f' : '#9a9186', boxShadow: viewMode === id ? '0 1px 2px rgba(58,53,47,.08)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {viewMode === 'calendar' && (
        <CalendarView items={v.scheduledList} month={month} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} onToday={goToday}
                      primary={primary} partner={partner} members={v.members} me={v.me} onOpen={(id) => v.a.set({ detailId: id, editing: false })} />
      )}

      {viewMode === 'list' && (
      <Fragment>
      <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? 14 : 13 }}>
        <FilterGroup label="Categories" kind="cats" v={v} open={open.cats} onToggle={() => toggle('cats')} summary={catSummary} />
        <FilterGroup label="Status" kind="status" v={v} open={open.status} onToggle={() => toggle('status')} summary={statSummary} />
        {v.catsOpen && <CategoriesPanel v={v} partner={partner} maxWidth={isDesktop ? 560 : undefined} />}
      </div>
      {isDesktop ? (
        <div style={{ background: '#fff', borderRadius: 22, padding: '6px 22px 12px', boxShadow: '0 1px 2px rgba(58,53,47,.05),0 10px 30px rgba(58,53,47,.05)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: DESK_COLS, gap: 14, alignItems: 'center', padding: '16px 6px', borderBottom: '1px solid #f0ebe2' }}>
            <span />{['Idea', 'Category', 'Added by', 'Status'].map(h => <span key={h} style={{ fontSize: 11, fontWeight: 800, color: '#aaa093', letterSpacing: '.7px', textTransform: 'uppercase' }}>{h}</span>)}<span />
          </div>
          {v.ideas.map(idea => (
            <DSwipeRow key={idea.id} radius={0} frontBg={idea.important ? '#fdf8ee' : '#fff'} onDelete={idea.deleteSelf}>
              <IdeaRow idea={idea} partner={partner} />
            </DSwipeRow>
          ))}
          {v.isEmpty && <EmptyState text={v.emptyText} pad="44px 20px" />}
        </div>
      ) : (
        <Fragment>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#857c70', letterSpacing: '.6px', textTransform: 'uppercase' }}>{v.listHeading}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <select value={v.sortMode} onChange={v.setSortMode} style={{ background: '#fff', border: '1px solid #ece6db', borderRadius: 9, padding: '5px 22px 5px 9px', fontSize: 12, fontFamily: 'inherit', color: '#7a7166', fontWeight: 700, outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}>{v.sortOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#b3a99c' }}><DIcons.Chevron size={12} /></span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#b07d42', background: '#f6ebdc', padding: '4px 11px', borderRadius: 999, whiteSpace: 'nowrap' }}>{v.planLabel}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {v.ideas.map(idea => (
              <DSwipeRow key={idea.id} radius={18} onDelete={idea.deleteSelf}>
                <IdeaCard idea={idea} partner={partner} />
              </DSwipeRow>
            ))}
            {v.isEmpty && <EmptyState text={v.emptyText} pad="34px 20px" />}
          </div>
        </Fragment>
      )}
      </Fragment>
      )}
    </div>
  );
}

/* ── auth gate + app shell ────────────────────────────────────────────────── */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{ "primaryColor": "#c98a5c", "partnerColor": "#8a9b6e" }/*EDITMODE-END*/;
function useIsDesktop(bp = 720) {
  const get = () => typeof window !== 'undefined' && window.innerWidth >= bp;
  const [d, setD] = useState(get);
  useEffect(() => { const on = () => setD(get()); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  return d;
}
function App() {
  const sx = window.useTogetherSession();
  const { SignIn, Splash } = window.TogetherAccount;
  if (!sx.ready) return <Splash text="…" />;
  if (!sx.session) return <SignIn onGoogle={sx.actions.signInGoogle} />;
  if (!sx.homespaceId) return <Splash text={sx.error ? ('Something went wrong: ' + sx.error) : 'Setting up your space…'} />;
  return <BoardShell sx={sx} />;
}
function BoardShell({ sx }) {
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const { TweaksPanel, TweakSection, TweakColor } = window;
  const { AccountButton, AccountSheet } = window.TogetherAccount;
  const [accountOpen, setAccountOpen] = useState(false);
  const primary = tweaks.primaryColor || '#c98a5c';
  const partner = tweaks.partnerColor || '#8a9b6e';
  const isDesktop = useIsDesktop();
  useEffect(() => { document.documentElement.style.setProperty('--primary', primary); document.documentElement.style.setProperty('--partner', partner); }, [primary, partner]);
  const [state, actions] = useIdeasStore(sx.homespaceId, sx.me, sx.members);
  const v = buildView(state, actions, { primary, partner, members: sx.members, me: sx.me });
  return (
    <div className="app">
      <div className="app-shell">
        {state.syncing ? <EmptyState text="Syncing…" pad="64px 20px" /> : <Board v={v} isDesktop={isDesktop} primary={primary} partner={partner} />}
      </div>

      <AccountButton sx={sx} onOpen={() => setAccountOpen(true)} />
      {accountOpen && <AccountSheet sx={sx} onClose={() => setAccountOpen(false)} />}

      <button onClick={() => actions.set({ bugOpen: true, bugSent: false })} title="Report a problem"
        style={{ position: 'fixed', top: 24, right: 24, zIndex: 900, width: 46, height: 46, borderRadius: '50%', border: '1px solid #ecd9c4', background: '#fffaf3', color: '#b07d42', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(58,53,47,.08),0 8px 20px rgba(58,53,47,.12)' }}>
        <DIcons.Bug size={21} />
      </button>

      <AddModal v={v} primary={primary} />
      <BulkModal v={v} primary={primary} />
      <DetailModal v={v} primary={primary} partner={partner} />
      <ScheduleModal v={v} primary={primary} partner={partner} />
      <ImageModal v={v} />
      <BugModal v={v} primary={primary} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="People">
          <TweakColor label="Primary" value={tweaks.primaryColor} onChange={(c) => setTweak('primaryColor', c)} options={['#c98a5c', '#d97757', '#cf6a52', '#b07d42']} />
          <TweakColor label="Partner" value={tweaks.partnerColor} onChange={(c) => setTweak('partnerColor', c)} options={['#8a9b6e', '#6f8050', '#5e827b', '#7e6f86']} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
