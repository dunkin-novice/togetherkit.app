// store.jsx — all Together state + actions as a hook (window.useTogetherStore).
// This is the React port of the source DCLogic class methods.

// Persist the durable slice of state to localStorage so the list survives
// refreshes and revisits on the same device (transient UI like open modals and
// drafts is intentionally not saved).
const STORAGE_KEY = 'together.shopping-list.v1';
function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items) || !Array.isArray(data.labels)) return null;
    return data;
  } catch (e) { return null; }
}

function useTogetherStore() {
  const D = window.TogetherData;
  const saved = loadSaved();

  const [state, setState] = React.useState(() => ({
    labels: saved ? saved.labels : D.INITIAL_LABELS,
    items: saved ? saved.items : D.INITIAL_ITEMS,
    activeFilter: 'all',
    statusFilter: 'all',
    sortMode: (saved && saved.sortMode) || 'smart',
    currentUser: (saved && saved.currentUser) || 'Dunkin',

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

  // merge helper so call sites read like the original setState(updater|patch)
  const patch = React.useCallback((p) => {
    setState(s => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
  }, []);

  // Save whenever the durable slice changes.
  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        labels: state.labels, items: state.items,
        sortMode: state.sortMode, currentUser: state.currentUser,
      }));
    } catch (e) { /* storage full / disabled — list still works for the session */ }
  }, [state.labels, state.items, state.sortMode, state.currentUser]);

  const readPhoto = (file, cb) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => cb(r.result);
    r.readAsDataURL(file);
  };

  const actions = React.useMemo(() => ({
    set: patch,

    // ── items ──────────────────────────────────────────────
    toggle: (id) => patch(s => ({ items: s.items.map(it => it.id === id ? { ...it, done: !it.done } : it) })),
    toggleImportant: (id) => patch(s => ({ items: s.items.map(it => it.id === id ? { ...it, important: !it.important } : it) })),
    remove: (id) => patch(s => ({ items: s.items.filter(it => it.id !== id) })),

    addItem: () => patch(s => {
      const name = (s.draftName || '').trim();
      if (!name) return {};
      const it = {
        id: Date.now(), name, qty: s.draftQty || 1,
        unit: (s.draftUnit || 'pcs').trim() || 'pcs',
        labelId: s.draftLabel, by: s.currentUser, date: 'Today',
        done: false, important: s.draftImportant, image: s.draftImage,
      };
      return { items: [it, ...s.items], draftName: '', draftQty: 1, draftImage: null, draftImportant: false, addOpen: false };
    }),

    // ── labels ─────────────────────────────────────────────
    addLabel: () => patch(s => {
      const name = (s.newLabelName || '').trim();
      if (!name) return {};
      const id = 'lbl' + Date.now();
      return { labels: [...s.labels, { id, name, tone: s.labels.length, custom: true }], newLabelName: '' };
    }),
    renameLabel: (id, value) => patch(s => ({ labels: s.labels.map(l => l.id === id ? { ...l, name: value } : l) })),
    deleteLabel: (id) => patch(s => {
      const labels = s.labels.filter(l => l.id !== id);
      const fallback = labels[0] ? labels[0].id : '';
      const items = s.items.map(it => it.labelId === id ? { ...it, labelId: fallback } : it);
      return {
        labels, items,
        activeFilter: s.activeFilter === id ? 'all' : s.activeFilter,
        draftLabel: s.draftLabel === id ? fallback : s.draftLabel,
      };
    }),

    // ── detail edit ────────────────────────────────────────
    startEdit: () => patch(s => {
      const it = s.items.find(i => i.id === s.detailId);
      if (!it) return {};
      return { editing: true, edit: { name: it.name, qty: it.qty, unit: it.unit, labelId: it.labelId } };
    }),
    saveEdit: () => patch(s => {
      const e = s.edit;
      const name = (e.name || '').trim();
      if (!name) return {};
      return {
        editing: false,
        items: s.items.map(it => it.id === s.detailId
          ? { ...it, name, qty: e.qty || 1, unit: (e.unit || 'pcs').trim() || 'pcs', labelId: e.labelId } : it),
      };
    }),

    // ── bulk add ───────────────────────────────────────────
    removeBulkLine: (i) => patch(s => {
      const lines = s.bulkText.split('\n');
      lines.splice(i, 1);
      return { bulkText: lines.join('\n') };
    }),
    saveBulk: () => patch(s => {
      const parsed = s.bulkText.split('\n').map(l => D.parseBulkLine(l)).filter(r => r && r.valid);
      if (!parsed.length) return {};
      const labelId = s.bulkLabel || (s.activeFilter !== 'all' ? s.activeFilter : (s.labels[0] && s.labels[0].id));
      const now = Date.now();
      const newItems = parsed.map((r, idx) => ({
        id: now + idx, name: r.name, qty: r.qty, unit: r.unit,
        labelId, by: s.currentUser, date: 'Today', done: false, important: false, image: null,
      }));
      return { items: [...newItems, ...s.items], bulkOpen: false, bulkText: '', bulkTemplateShown: false };
    }),

    // ── photos ─────────────────────────────────────────────
    onDraftPhoto: (e) => readPhoto(e.target.files && e.target.files[0], (d) => patch({ draftImage: d })),
    onBugPhoto: (e) => readPhoto(e.target.files && e.target.files[0], (d) => patch({ bugImage: d })),

    // ── bug report ─────────────────────────────────────────
    sendBug: () => patch(s => {
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
      return { bugSent: true };
    }),
  }), [patch, D]);

  return [state, actions];
}

window.useTogetherStore = useTogetherStore;
