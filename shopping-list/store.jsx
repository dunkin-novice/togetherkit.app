// store.jsx — Together state + actions (window.useTogetherStore), backed by
// Supabase so the list is shared and live across devices.
//
// Durable data (labels, items) lives in Supabase, scoped to the room code from
// supabase.jsx; transient UI (open modals, drafts, filters) stays local. Each
// mutation updates local state optimistically *and* writes to Supabase; a
// realtime subscription re-pulls the room whenever either device changes it, so
// both phones converge within a second.

// Small per-device prefs (who's adding, sort order) — not shared, just sticky.
const PREFS_KEY = 'togetherkit.prefs.v1';
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { return {}; }
}

function useTogetherStore() {
  const D = window.TogetherData;
  const BE = window.TogetherBackend;
  const { client, room } = BE;
  const prefs = loadPrefs();

  const [state, setState] = React.useState(() => ({
    labels: [], items: [],
    syncing: true,
    activeFilter: 'all',
    statusFilter: 'all',
    sortMode: prefs.sortMode || 'smart',
    currentUser: prefs.currentUser || 'Dunkin',

    // add-item draft
    draftName: '', draftQty: 1, draftUnit: 'pcs', draftLabel: 'ing',
    draftImage: null, draftImportant: false,

    // labels editor
    labelsOpen: false, newLabelName: '',

    // detail / edit
    detailId: null, editing: false,
    edit: { name: '', qty: 1, unit: 'pcs', labelId: 'ing' },

    // image viewer
    imageId: null,

    // modals
    addOpen: false,
    bulkOpen: false, bulkText: '', bulkTemplateShown: false, bulkLabel: '',
    bugOpen: false, bugSent: false, bugText: '', bugEmail: '', bugImage: null,
  }));

  const patch = React.useCallback((p) => {
    setState(s => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
  }, []);

  // latest state for async actions (which are memoized and can't close over it)
  const stateRef = React.useRef(state);
  stateRef.current = state;

  // remember per-device prefs
  React.useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ sortMode: state.sortMode, currentUser: state.currentUser })); } catch (e) {}
  }, [state.sortMode, state.currentUser]);

  // ── load + seed + realtime ───────────────────────────────────────────────
  React.useEffect(() => {
    let alive = true;
    const refetch = async () => {
      const [lr, ir] = await Promise.all([
        client.from('labels').select('*').eq('room', room).order('sort', { ascending: true }),
        client.from('items').select('*').eq('room', room).order('pos', { ascending: false }),
      ]);
      if (!alive) return;
      let labels = (lr.data || []).map(BE.rowToLabel);
      if (labels.length === 0 && !lr.error) {
        // brand-new room → seed the three default labels
        const seed = D.INITIAL_LABELS.map((l, i) => BE.labelToRow(l, room, i));
        await client.from('labels').upsert(seed, { onConflict: 'room,id', ignoreDuplicates: true });
        labels = D.INITIAL_LABELS.map(l => ({ id: l.id, name: l.name, tone: l.tone, custom: l.custom, sort: 0 }));
      }
      patch({ labels, items: (ir.data || []).map(BE.rowToItem), syncing: false });
    };
    refetch();
    const ch = client.channel('room:' + room)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: 'room=eq.' + room }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'labels', filter: 'room=eq.' + room }, refetch)
      .subscribe();
    return () => { alive = false; client.removeChannel(ch); };
  }, [client, room, patch, D, BE]);

  const readPhoto = (file, cb) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => cb(r.result);
    r.readAsDataURL(file);
  };
  // fire-and-forget DB write; failures keep the optimistic local state
  const db = (promise) => { Promise.resolve(promise).then(r => { if (r && r.error) console.warn('[togetherkit] sync error', r.error.message); }, e => console.warn('[togetherkit] sync error', e)); };

  const actions = React.useMemo(() => ({
    set: patch,

    // ── items ──────────────────────────────────────────────
    toggle: (id) => {
      const it = stateRef.current.items.find(i => i.id === id); if (!it) return;
      patch(s => ({ items: s.items.map(i => i.id === id ? { ...i, done: !i.done } : i) }));
      db(client.from('items').update({ done: !it.done, updated_at: new Date().toISOString() }).eq('id', id));
    },
    toggleImportant: (id) => {
      const it = stateRef.current.items.find(i => i.id === id); if (!it) return;
      patch(s => ({ items: s.items.map(i => i.id === id ? { ...i, important: !i.important } : i) }));
      db(client.from('items').update({ important: !it.important, updated_at: new Date().toISOString() }).eq('id', id));
    },
    remove: (id) => {
      patch(s => ({ items: s.items.filter(i => i.id !== id) }));
      db(client.from('items').delete().eq('id', id));
    },

    addItem: () => {
      const s = stateRef.current;
      const name = (s.draftName || '').trim();
      if (!name) return;
      const it = {
        id: BE.newId(), name, qty: s.draftQty || 1,
        unit: (s.draftUnit || 'pcs').trim() || 'pcs',
        labelId: s.draftLabel, by: s.currentUser, date: 'Today',
        done: false, important: s.draftImportant, image: s.draftImage, pos: Date.now(),
      };
      patch(st => ({ items: [it, ...st.items], draftName: '', draftQty: 1, draftImage: null, draftImportant: false, addOpen: false }));
      db(client.from('items').insert(BE.itemToRow(it, room)));
    },

    // ── labels ─────────────────────────────────────────────
    addLabel: () => {
      const s = stateRef.current;
      const name = (s.newLabelName || '').trim();
      if (!name) return;
      const label = { id: 'lbl' + Date.now(), name, tone: s.labels.length, custom: true, sort: s.labels.length };
      patch(st => ({ labels: [...st.labels, label], newLabelName: '' }));
      db(client.from('labels').insert(BE.labelToRow(label, room, label.sort)));
    },
    renameLabel: (id, value) => {
      patch(s => ({ labels: s.labels.map(l => l.id === id ? { ...l, name: value } : l) }));
      db(client.from('labels').update({ name: value }).eq('room', room).eq('id', id));
    },
    deleteLabel: (id) => {
      const s = stateRef.current;
      const remaining = s.labels.filter(l => l.id !== id);
      const fallback = remaining[0] ? remaining[0].id : '';
      patch(st => ({
        labels: remaining,
        items: st.items.map(it => it.labelId === id ? { ...it, labelId: fallback } : it),
        activeFilter: st.activeFilter === id ? 'all' : st.activeFilter,
        draftLabel: st.draftLabel === id ? fallback : st.draftLabel,
      }));
      db(client.from('items').update({ label_id: fallback }).eq('room', room).eq('label_id', id));
      db(client.from('labels').delete().eq('room', room).eq('id', id));
    },

    // ── detail edit ────────────────────────────────────────
    startEdit: () => {
      const it = stateRef.current.items.find(i => i.id === stateRef.current.detailId);
      if (!it) return;
      patch({ editing: true, edit: { name: it.name, qty: it.qty, unit: it.unit, labelId: it.labelId } });
    },
    saveEdit: () => {
      const s = stateRef.current;
      const e = s.edit;
      const name = (e.name || '').trim();
      if (!name) return;
      const upd = { name, qty: e.qty || 1, unit: (e.unit || 'pcs').trim() || 'pcs', labelId: e.labelId };
      patch(st => ({ editing: false, items: st.items.map(it => it.id === st.detailId ? { ...it, ...upd } : it) }));
      db(client.from('items').update({ name: upd.name, qty: upd.qty, unit: upd.unit, label_id: upd.labelId, updated_at: new Date().toISOString() }).eq('id', s.detailId));
    },

    // ── bulk add ───────────────────────────────────────────
    removeBulkLine: (i) => patch(s => {
      const lines = s.bulkText.split('\n');
      lines.splice(i, 1);
      return { bulkText: lines.join('\n') };
    }),
    saveBulk: () => {
      const s = stateRef.current;
      const parsed = s.bulkText.split('\n').map(l => D.parseBulkLine(l)).filter(r => r && r.valid);
      if (!parsed.length) return;
      const labelId = s.bulkLabel || (s.activeFilter !== 'all' ? s.activeFilter : (s.labels[0] && s.labels[0].id));
      const base = Date.now();
      const n = parsed.length;
      const newItems = parsed.map((r, idx) => ({
        id: BE.newId(), name: r.name, qty: r.qty, unit: r.unit,
        labelId, by: s.currentUser, date: 'Today', done: false, important: false, image: null,
        pos: base + (n - idx),
      }));
      patch(st => ({ items: [...newItems, ...st.items], bulkOpen: false, bulkText: '', bulkTemplateShown: false }));
      db(client.from('items').insert(newItems.map(it => BE.itemToRow(it, room))));
    },

    // ── photos ─────────────────────────────────────────────
    onDraftPhoto: (e) => readPhoto(e.target.files && e.target.files[0], (d) => patch({ draftImage: d })),
    onBugPhoto: (e) => readPhoto(e.target.files && e.target.files[0], (d) => patch({ bugImage: d })),

    // ── bug report ─────────────────────────────────────────
    sendBug: () => {
      const s = stateRef.current;
      const af = s.activeFilter;
      const labelName = af === 'all' ? 'All Items' : (s.labels.find(l => l.id === af) || {}).name;
      const visibleCount = s.items.filter(it => af === 'all' || it.labelId === af).length;
      const debug = {
        timestamp: new Date().toISOString(),
        url: (typeof location !== 'undefined' ? location.href : ''),
        browser: (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
        device: (typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent)) ? 'Mobile' : 'Desktop',
        selectedLabel: labelName, statusFilter: s.statusFilter, currentUser: s.currentUser,
        visibleItemCount: visibleCount, appVersion: 'Together 1.5',
      };
      try { console.info('[Together] Bug report submitted', { message: s.bugText, email: s.bugEmail, debug }); } catch (e) {}
      patch({ bugSent: true });
    },
  }), [patch, D, BE, client, room]);

  return [state, actions];
}

window.useTogetherStore = useTogetherStore;
