// store.jsx — Together list state + actions (window.useTogetherStore), scoped to
// a homespace and backed by Supabase. Items are attributed to the signed-in user
// (`me`); realtime keeps both partners' devices in sync.

const PREFS_KEY = 'togetherkit.prefs.v1';
function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { return {}; }
}

function useTogetherStore(homespaceId, me) {
  const D = window.TogetherData;
  const BE = window.TogetherBackend;
  const { client } = BE;
  const prefs = loadPrefs();

  const [state, setState] = React.useState(() => ({
    labels: [], items: [],
    syncing: true,
    activeFilter: 'all',
    statusFilter: 'all',
    sortMode: prefs.sortMode || 'smart',

    draftName: '', draftQty: 1, draftUnit: 'pcs', draftLabel: 'ing',
    draftImage: null, draftImportant: false,

    labelsOpen: false, newLabelName: '',

    detailId: null, editing: false,
    edit: { name: '', qty: 1, unit: 'pcs', labelId: 'ing' },

    imageId: null,

    addOpen: false,
    bulkOpen: false, bulkText: '', bulkTemplateShown: false, bulkLabel: '',
    bugOpen: false, bugSent: false, bugText: '', bugEmail: '', bugImage: null,
  }));

  const patch = React.useCallback((p) => {
    setState(s => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
  }, []);

  const stateRef = React.useRef(state); stateRef.current = state;
  const meRef = React.useRef(me); meRef.current = me;

  React.useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ sortMode: state.sortMode })); } catch (e) {}
  }, [state.sortMode]);

  // load + realtime, scoped to the homespace
  React.useEffect(() => {
    if (!homespaceId) return;
    let alive = true;
    patch({ syncing: true });
    const refetch = async () => {
      const [lr, ir] = await Promise.all([
        client.from('labels').select('*').eq('homespace_id', homespaceId).order('sort', { ascending: true }),
        client.from('items').select('*').eq('homespace_id', homespaceId).order('pos', { ascending: false }),
      ]);
      if (!alive) return;
      let labels = (lr.data || []).map(BE.rowToLabel);
      if (labels.length === 0 && !lr.error) {
        const seed = D.INITIAL_LABELS.map((l, i) => BE.labelToRow(l, homespaceId, i));
        await client.from('labels').upsert(seed, { onConflict: 'homespace_id,id', ignoreDuplicates: true });
        labels = D.INITIAL_LABELS.map(l => ({ id: l.id, name: l.name, tone: l.tone, custom: l.custom, sort: 0 }));
      }
      patch({ labels, items: (ir.data || []).map(BE.rowToItem), syncing: false });
    };
    refetch();
    const ch = client.channel('items:' + homespaceId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: 'homespace_id=eq.' + homespaceId }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'labels', filter: 'homespace_id=eq.' + homespaceId }, refetch)
      .subscribe();
    return () => { alive = false; client.removeChannel(ch); };
  }, [client, homespaceId, patch, D, BE]);

  const readPhoto = (file, cb) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => cb(r.result);
    r.readAsDataURL(file);
  };
  const db = (p) => { Promise.resolve(p).then(r => { if (r && r.error) console.warn('[togetherkit] sync error', r.error.message); }, e => console.warn('[togetherkit] sync error', e)); };

  const actions = React.useMemo(() => ({
    set: patch,

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
      const s = stateRef.current, m = meRef.current || { uid: null, name: 'Me' };
      const name = (s.draftName || '').trim();
      if (!name) return;
      const it = {
        id: BE.newId(), name, qty: s.draftQty || 1,
        unit: (s.draftUnit || 'pcs').trim() || 'pcs', labelId: s.draftLabel,
        byUser: m.uid, byName: m.name, date: 'Today',
        done: false, important: s.draftImportant, image: s.draftImage, pos: Date.now(),
      };
      patch(st => ({ items: [it, ...st.items], draftName: '', draftQty: 1, draftImage: null, draftImportant: false, addOpen: false }));
      db(client.from('items').insert(BE.itemToRow(it, homespaceId)));
    },

    addLabel: () => {
      const s = stateRef.current;
      const name = (s.newLabelName || '').trim();
      if (!name) return;
      const label = { id: 'lbl' + Date.now(), name, tone: s.labels.length, custom: true, sort: s.labels.length };
      patch(st => ({ labels: [...st.labels, label], newLabelName: '' }));
      db(client.from('labels').insert(BE.labelToRow(label, homespaceId, label.sort)));
    },
    renameLabel: (id, value) => {
      patch(s => ({ labels: s.labels.map(l => l.id === id ? { ...l, name: value } : l) }));
      db(client.from('labels').update({ name: value }).eq('homespace_id', homespaceId).eq('id', id));
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
      db(client.from('items').update({ label_id: fallback }).eq('homespace_id', homespaceId).eq('label_id', id));
      db(client.from('labels').delete().eq('homespace_id', homespaceId).eq('id', id));
    },

    startEdit: () => {
      const it = stateRef.current.items.find(i => i.id === stateRef.current.detailId);
      if (!it) return;
      patch({ editing: true, edit: { name: it.name, qty: it.qty, unit: it.unit, labelId: it.labelId } });
    },
    saveEdit: () => {
      const s = stateRef.current, e = s.edit;
      const name = (e.name || '').trim();
      if (!name) return;
      const upd = { name, qty: e.qty || 1, unit: (e.unit || 'pcs').trim() || 'pcs', labelId: e.labelId };
      patch(st => ({ editing: false, items: st.items.map(it => it.id === st.detailId ? { ...it, ...upd } : it) }));
      db(client.from('items').update({ name: upd.name, qty: upd.qty, unit: upd.unit, label_id: upd.labelId, updated_at: new Date().toISOString() }).eq('id', s.detailId));
    },

    removeBulkLine: (i) => patch(s => { const lines = s.bulkText.split('\n'); lines.splice(i, 1); return { bulkText: lines.join('\n') }; }),
    saveBulk: () => {
      const s = stateRef.current, m = meRef.current || { uid: null, name: 'Me' };
      const parsed = s.bulkText.split('\n').map(l => D.parseBulkLine(l)).filter(r => r && r.valid);
      if (!parsed.length) return;
      const labelId = s.bulkLabel || (s.activeFilter !== 'all' ? s.activeFilter : (s.labels[0] && s.labels[0].id));
      const base = Date.now(), n = parsed.length;
      const newItems = parsed.map((r, idx) => ({
        id: BE.newId(), name: r.name, qty: r.qty, unit: r.unit, labelId,
        byUser: m.uid, byName: m.name, date: 'Today', done: false, important: false, image: null,
        pos: base + (n - idx),
      }));
      patch(st => ({ items: [...newItems, ...st.items], bulkOpen: false, bulkText: '', bulkTemplateShown: false }));
      db(client.from('items').insert(newItems.map(it => BE.itemToRow(it, homespaceId))));
    },

    onDraftPhoto: (e) => readPhoto(e.target.files && e.target.files[0], (d) => patch({ draftImage: d })),
    onBugPhoto: (e) => readPhoto(e.target.files && e.target.files[0], (d) => patch({ bugImage: d })),

    sendBug: () => {
      const s = stateRef.current, m = meRef.current || {};
      try {
        console.info('[Together] Bug report', { message: s.bugText, email: s.bugEmail, by: m.name, homespaceId,
          when: new Date().toISOString(), ua: navigator.userAgent });
      } catch (e) {}
      patch({ bugSent: true });
    },
  }), [patch, D, BE, client, homespaceId]);

  return [state, actions];
}

window.useTogetherStore = useTogetherStore;
