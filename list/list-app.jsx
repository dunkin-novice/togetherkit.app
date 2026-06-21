// list-app.jsx — Together "Custom list" (the "+ Build new" feature).
// A user-named, flexible shared list: each item is a checkable note (title +
// body + check-off + important + label). Scoped to a list id from ?id=<...> and
// to the homespace. Same engine as the other apps; reuses the shared modules.
// Helpers namespaced (CI / CAvatar / CSwipeRow) for the single babel scope.

const { useState, useRef, useMemo, useEffect, Fragment } = React;
const CI = window.Icons;
const LIST_ID = (new URLSearchParams(location.search).get('id') || '').trim();

const CTONE = {
  sand:   { bg: '#f2eade', fg: '#9c7b54' }, dine: { bg: '#f4e8dd', fg: '#a8794f' },
  trip:   { bg: '#e7eef0', fg: '#5d7480' }, green: { bg: '#eef1e6', fg: '#6f7d52' },
  purple: { bg: '#efe8f1', fg: '#7e6f86' }, rose: { bg: '#f3e6e4', fg: '#a86a6a' }, teal: { bg: '#e6efed', fg: '#5e827b' },
};
const CTONE_CYCLE = ['sand', 'purple', 'rose', 'teal', 'trip', 'green', 'dine'];
const ctoneOf = (l) => CTONE[(l && l.tone) || 'sand'] || CTONE.sand;

const rowToCItem = (r) => ({ id: r.id, title: r.title || '', body: r.body || '', labelId: r.label_id, byUser: r.by_user, byName: r.by_name, date: r.date, done: !!r.done, important: !!r.important, pos: Number(r.pos) || 0 });
const cItemToRow = (it, hs) => ({ id: it.id, homespace_id: hs, list_id: LIST_ID, title: it.title, body: it.body || null, label_id: it.labelId || null, by_user: it.byUser, by_name: it.byName, date: it.date, done: !!it.done, important: !!it.important, pos: it.pos || 0 });
const rowToCL = (r) => ({ id: r.id, name: r.name, tone: r.tone, custom: !!r.custom, sort: r.sort });
const clToRow = (l, hs, sort) => ({ homespace_id: hs, list_id: LIST_ID, id: l.id, name: l.name, tone: l.tone, custom: !!l.custom, sort: sort != null ? sort : (l.sort || 0) });

function useListStore(homespaceId, me) {
  const BE = window.TogetherBackend; const { client } = BE;
  const [state, setState] = useState(() => ({
    labels: [], items: [], syncing: true,
    activeFilter: 'all', statusFilter: 'all', sortMode: 'smart',
    draft: { title: '', body: '', labelId: '', important: false },
    labelsOpen: false, newLabelName: '',
    detailId: null, editing: false, edit: { title: '', body: '', labelId: '' },
    addOpen: false, bugOpen: false, bugSent: false, bugText: '',
  }));
  const patch = (p) => setState(s => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
  const ref = useRef(state); ref.current = state;
  const meRef = useRef(me); meRef.current = me;
  const db = (p) => { Promise.resolve(p).then(r => { if (r && r.error) console.warn('[togetherkit/list] sync', r.error.message); }, e => console.warn('[togetherkit/list] sync', e)); };

  useEffect(() => {
    if (!homespaceId || !LIST_ID) return;
    let alive = true; patch({ syncing: true });
    const refetch = async () => {
      const [lr, ir] = await Promise.all([
        client.from('custom_labels').select('*').eq('homespace_id', homespaceId).eq('list_id', LIST_ID).order('sort', { ascending: true }),
        client.from('custom_items').select('*').eq('homespace_id', homespaceId).eq('list_id', LIST_ID).order('pos', { ascending: false }),
      ]);
      if (!alive) return;
      patch({ labels: (lr.data || []).map(rowToCL), items: (ir.data || []).map(rowToCItem), syncing: false });
    };
    refetch();
    const ch = client.channel('list:' + LIST_ID)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_items', filter: 'list_id=eq.' + LIST_ID }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_labels', filter: 'list_id=eq.' + LIST_ID }, refetch)
      .subscribe();
    return () => { alive = false; client.removeChannel(ch); };
  }, [client, homespaceId]);

  const actions = useMemo(() => ({
    set: patch,
    remove: (id) => { patch(s => ({ items: s.items.filter(i => i.id !== id) })); db(client.from('custom_items').delete().eq('id', id)); },
    toggleDone: (id) => { const it = ref.current.items.find(x => x.id === id); if (!it) return; patch(s => ({ items: s.items.map(x => x.id === id ? { ...x, done: !x.done } : x) })); db(client.from('custom_items').update({ done: !it.done, updated_at: new Date().toISOString() }).eq('id', id)); },
    toggleImportant: (id) => { const it = ref.current.items.find(x => x.id === id); if (!it) return; patch(s => ({ items: s.items.map(x => x.id === id ? { ...x, important: !x.important } : x) })); db(client.from('custom_items').update({ important: !it.important, updated_at: new Date().toISOString() }).eq('id', id)); },
    reorder: (ids) => { const base = Date.now(); patch(s => ({ items: s.items.map(it => { const i = ids.indexOf(it.id); return i >= 0 ? { ...it, pos: base - i } : it; }) })); ids.forEach((id, i) => db(client.from('custom_items').update({ pos: base - i }).eq('id', id))); },
    setDraft: (p) => patch(s => ({ draft: { ...s.draft, ...p } })),
    addItem: () => {
      const s = ref.current, d = s.draft, m = meRef.current || { uid: null, name: 'Me' };
      const title = (d.title || '').trim(); if (!title && !(d.body || '').trim()) return;
      const it = { id: BE.newId(), title: title || 'Untitled', body: d.body, labelId: d.labelId || null, byUser: m.uid, byName: m.name, date: 'Today', done: false, important: d.important, pos: Date.now() };
      patch(st => ({ items: [it, ...st.items], draft: { title: '', body: '', labelId: d.labelId, important: false }, addOpen: false }));
      db(client.from('custom_items').insert(cItemToRow(it, homespaceId)));
    },
    addLabel: () => {
      const s = ref.current, name = (s.newLabelName || '').trim(); if (!name) return;
      const tone = CTONE_CYCLE[s.labels.length % CTONE_CYCLE.length];
      const label = { id: 'cl' + Date.now(), name, tone, custom: true, sort: s.labels.length };
      patch(st => ({ labels: [...st.labels, label], newLabelName: '' }));
      db(client.from('custom_labels').insert(clToRow(label, homespaceId, label.sort)));
    },
    renameLabel: (id, value) => { patch(s => ({ labels: s.labels.map(l => l.id === id ? { ...l, name: value } : l) })); db(client.from('custom_labels').update({ name: value }).eq('homespace_id', homespaceId).eq('list_id', LIST_ID).eq('id', id)); },
    deleteLabel: (id) => {
      const s = ref.current, remaining = s.labels.filter(l => l.id !== id);
      patch(st => ({ labels: remaining, items: st.items.map(i => i.labelId === id ? { ...i, labelId: null } : i), activeFilter: st.activeFilter === id ? 'all' : st.activeFilter, draft: { ...st.draft, labelId: st.draft.labelId === id ? '' : st.draft.labelId } }));
      db(client.from('custom_items').update({ label_id: null }).eq('homespace_id', homespaceId).eq('list_id', LIST_ID).eq('label_id', id));
      db(client.from('custom_labels').delete().eq('homespace_id', homespaceId).eq('list_id', LIST_ID).eq('id', id));
    },
    startEdit: () => { const it = ref.current.items.find(x => x.id === ref.current.detailId); if (!it) return; patch({ editing: true, edit: { title: it.title, body: it.body, labelId: it.labelId || '' } }); },
    duplicateItem: () => { const it = ref.current.items.find(x => x.id === ref.current.detailId); if (!it) return; patch({ detailId: null, editing: false, addOpen: true, draft: { title: it.title, body: it.body, labelId: it.labelId || '', important: it.important } }); },
    setEdit: (p) => patch(s => ({ edit: { ...s.edit, ...p } })),
    saveEdit: () => { const s = ref.current, e = s.edit, title = (e.title || '').trim(); if (!title && !(e.body || '').trim()) return; const upd = { title: title || 'Untitled', body: e.body, labelId: e.labelId || null }; patch(st => ({ editing: false, items: st.items.map(i => i.id === st.detailId ? { ...i, ...upd } : i) })); db(client.from('custom_items').update({ title: upd.title, body: upd.body || null, label_id: upd.labelId, updated_at: new Date().toISOString() }).eq('id', s.detailId)); },
    deleteDetail: () => { const id = ref.current.detailId; patch({ detailId: null, editing: false }); patch(s => ({ items: s.items.filter(i => i.id !== id) })); db(client.from('custom_items').delete().eq('id', id)); },
    sendBug: () => { try { window.TogetherBackend.reportBug({ message: ref.current.bugText, page: 'custom-list:' + LIST_ID, homespaceId, byUser: (meRef.current || {}).uid, byName: (meRef.current || {}).name }); } catch (e) {} patch({ bugSent: true }); },
  }), [client, homespaceId, BE]);
  return [state, actions];
}

/* ── style fragments / small pieces ───────────────────────────────────────── */
const upper = { fontSize: 11, fontWeight: 800, color: '#aaa093', letterSpacing: '.6px', textTransform: 'uppercase' };
const chipBase = { padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block' };
const iconBtn = { border: 'none', background: 'none', padding: 2, cursor: 'pointer', lineHeight: 0 };
const importantTag = { fontSize: 11, fontWeight: 800, color: '#a8822f', background: '#f6edd6', padding: '3px 9px', borderRadius: 8 };
const closeX = { flexShrink: 0, width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#ece6db', color: '#857c70', fontSize: 17, cursor: 'pointer', lineHeight: 1 };
const fieldInput = { border: '1px solid #ece6db', background: '#fff', borderRadius: 13, padding: '13px 15px', fontSize: 15, fontFamily: 'inherit', color: '#3a352f', outline: 'none', fontWeight: 700, width: '100%' };
const selectStyle = { border: '1px solid #ece6db', background: '#fff', borderRadius: 12, padding: '12px 13px', fontSize: 14, fontFamily: 'inherit', color: '#3a352f', fontWeight: 700, outline: 'none', cursor: 'pointer', width: '100%', appearance: 'none', WebkitAppearance: 'none' };
const cancelBtn = { flex: 1, background: '#fff', color: '#7a7166', border: '1px solid #e6ded2', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' };
const modalTitle = { fontFamily: "'Quicksand',sans-serif", fontSize: 23, fontWeight: 700, margin: 0, color: '#3a352f' };
function CAvatar({ color, initial, size = 20 }) { return <span style={{ width: size, height: size, borderRadius: '50%', background: color, color: '#fff', fontWeight: 800, fontSize: size * 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initial}</span>; }
function Overlay({ onClose, z = 1200, children }) { return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: z, background: 'rgba(58,53,47,.42)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, animation: 'tog-fade .15s ease' }}>{children}</div>; }
function Sheet({ stop, maxWidth, children, style }) { return <div onClick={stop} style={{ width: '100%', maxWidth, background: '#f6f4ef', borderRadius: 26, boxShadow: '0 24px 60px rgba(58,53,47,.34)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column', animation: 'tog-pop .18s ease', ...style }}>{children}</div>; }
function Checkbox({ done, partner, onClick }) {
  return <button onClick={onClick} title={done ? 'Done' : 'Mark done'} style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0, marginTop: 2, transition: 'all .15s', border: done ? ('2px solid ' + partner) : '2px solid #dcd4c6', background: done ? partner : '#fff' }}>{done && <CI.Check size={14} color="#fff" />}</button>;
}

function CSwipeRow({ onDelete, onComplete, completeLabel = 'Done', completeColor = '#6f9c5a', radius = 18, children }) {
  const [dx, setDx] = useState(0); const [dragging, setDragging] = useState(false); const [removing, setRemoving] = useState(false);
  const st = useRef(null); const dxRef = useRef(0); const movedRef = useRef(false); const THRESHOLD = 88, MAX = 128;
  const applyDx = (n) => { dxRef.current = n; setDx(n); };
  const onPointerDown = (e) => { if (removing) return; if (e.target.closest('button, a, input, select, label, textarea')) return; st.current = { x: e.clientX, y: e.clientY, active: false }; movedRef.current = false; };
  const onPointerMove = (e) => {
    if (!st.current || removing) return;
    const dX = e.clientX - st.current.x, dY = e.clientY - st.current.y;
    if (!st.current.active) { if (Math.abs(dX) > 8 && Math.abs(dX) > Math.abs(dY)) { st.current.active = true; setDragging(true); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} } else if (Math.abs(dY) > 10) { st.current = null; return; } }
    if (st.current && st.current.active) { const next = Math.max(-MAX, Math.min(onComplete ? MAX : 0, dX)); applyDx(next); if (Math.abs(next) > 6) movedRef.current = true; }
  };
  const finish = () => { if (!st.current) { setDragging(false); return; } const active = st.current.active; st.current = null; setDragging(false); if (!active) return; if (dxRef.current <= -THRESHOLD) { setRemoving(true); window.setTimeout(() => onDelete && onDelete(), 200); } else if (onComplete && dxRef.current >= THRESHOLD) { applyDx(0); onComplete(); } else applyDx(0); };
  return (
    <div style={{ position: 'relative' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: radius, background: '#c4604c', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingRight: 22, color: '#fff', fontWeight: 800, fontSize: 14, opacity: (dx < 0 || removing) ? 1 : 0 }}><CI.Trash size={17} /> Delete</div>
      {onComplete && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: radius, background: completeColor, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, paddingLeft: 22, color: '#fff', fontWeight: 800, fontSize: 14, opacity: dx > 0 ? 1 : 0 }}><CI.Check size={16} color="#fff" /> {completeLabel}</div>}
      <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finish} onPointerCancel={finish} onClickCapture={(e) => { if (movedRef.current) { e.preventDefault(); e.stopPropagation(); movedRef.current = false; } }} style={{ position: 'relative', transform: removing ? 'translateX(-110%)' : ('translateX(' + dx + 'px)'), transition: dragging ? 'none' : 'transform .2s cubic-bezier(.3,.7,.4,1), opacity .2s ease', opacity: removing ? 0 : 1, touchAction: 'pan-y' }}>{children}</div>
    </div>
  );
}

function ItemCard({ item, partner }) {
  return (
    <div onClick={item.open} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, background: '#fff', borderRadius: 18, cursor: 'pointer', border: item.important ? '1.5px solid #e7d3a3' : '1px solid transparent', boxShadow: '0 1px 2px rgba(58,53,47,.05),0 6px 16px rgba(58,53,47,.035)' }}>
      <Checkbox done={item.done} partner={partner} onClick={item.check} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: item.done ? '#bdb5a9' : '#3a352f', textDecoration: item.done ? 'line-through' : 'none', fontFamily: "'Quicksand',sans-serif" }}>{item.title}</span>
          {item.important && <span style={importantTag}>Important</span>}
        </div>
        {item.body && <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 600, color: item.done ? '#c3bbae' : '#7a7166', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.body}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
          {item.labelName && <span style={{ ...chipBase, background: item.tone.bg, color: item.tone.fg }}>{item.labelName}</span>}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#9a9186', fontSize: 12, fontWeight: 600 }}><CAvatar color={item.byColor} initial={item.byInitial} size={20} />{item.byName}<span style={{ color: '#c3bbae' }}>· {item.date}</span></span>
        </div>
      </div>
      <button onClick={item.star} title="Mark important" style={iconBtn}><CI.Star size={19} filled={item.important} /></button>
    </div>
  );
}

function LabelFilters({ v }) { return <Fragment>{v.labelFilters.map(f => (<button key={f.id} onClick={f.select} style={f.chipStyle}>{f.showDot && <span style={f.dotStyle} />}{f.name}<span style={f.countStyle}>{f.count}</span></button>))}<button onClick={v.toggleLabels} style={v.newLabelChipStyle}>+ New Label</button></Fragment>; }
function StatusFilters({ v }) { return <Fragment>{v.statusFilters.map(s => (<button key={s.id} onClick={s.select} style={s.chipStyle}>{s.star && <CI.Star size={13} filled color="currentColor" />}{s.name}<span style={s.countStyle}>{s.count}</span></button>))}</Fragment>; }
function LabelsPanel({ v, partner, maxWidth }) {
  const labelInput = { flex: 1, border: 'none', background: '#f5f0e8', borderRadius: 11, padding: '10px 13px', fontSize: 14, fontFamily: 'inherit', fontWeight: 700, color: '#3a352f', outline: 'none' };
  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: 16, boxShadow: '0 1px 2px rgba(58,53,47,.05),0 8px 22px rgba(58,53,47,.05)', display: 'flex', flexDirection: 'column', gap: 14, maxWidth }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 17, color: '#3a352f' }}>Labels</span><button onClick={v.toggleLabels} style={{ background: 'none', border: 'none', color: '#a8794f', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button></div>
      {v.customLabels.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{v.customLabels.map(cl => (<div key={cl.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={cl.dotStyle} /><input value={cl.name} onChange={cl.rename} style={labelInput} /><button onClick={cl.remove} style={{ background: '#f6ece9', border: 'none', color: '#b07a6e', width: 34, height: 34, borderRadius: 10, fontSize: 16, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>×</button></div>))}</div> : <span style={{ fontSize: 13, color: '#b3a99c', fontWeight: 600 }}>No labels yet — add one below.</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #f0ebe2', paddingTop: 14 }}><span style={v.newLabelDot} /><input value={v.newLabelName} onChange={v.setNewLabelName} onKeyDown={v.onNewLabelKey} placeholder="New label name…" style={labelInput} /><button onClick={v.addLabel} style={{ background: partner, color: '#fff', border: 'none', borderRadius: 11, padding: '10px 16px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Add</button></div>
    </div>
  );
}

function AddModal({ v, primary }) {
  if (!v.s.addOpen) return null;
  const d = v.s.draft;
  return (
    <Overlay onClose={() => v.a.set({ addOpen: false })}><Sheet stop={v.stop} maxWidth={380}>
      <div style={{ padding: '22px 22px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><h2 style={modalTitle}>Add</h2><button onClick={() => v.a.set({ addOpen: false })} style={closeX}>×</button></div>
      <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input value={d.title} onChange={(e) => v.a.setDraft({ title: e.target.value })} placeholder="Title" style={{ ...fieldInput, fontFamily: "'Quicksand',sans-serif", fontSize: 17 }} autoFocus />
        <textarea value={d.body} onChange={(e) => v.a.setDraft({ body: e.target.value })} placeholder="Notes · optional" style={{ width: '100%', minHeight: 100, resize: 'vertical', border: '1px solid #ece6db', background: '#fff', borderRadius: 14, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', fontWeight: 600, color: '#3a352f', outline: 'none', lineHeight: 1.6 }} />
        <div style={{ position: 'relative' }}><select value={d.labelId} onChange={(e) => v.a.setDraft({ labelId: e.target.value })} style={selectStyle}><option value="">No label</option>{v.labelOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select><span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#b3a99c' }}><CI.Chevron size={15} /></span></div>
        <button onClick={() => v.a.setDraft({ important: !d.important })} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', borderRadius: 13, border: '1px solid ' + (d.important ? '#e7d3a3' : '#ece6db'), background: d.important ? '#fdf8ee' : '#fff', color: d.important ? '#a8822f' : '#7a7166', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}><CI.Star size={18} filled={d.important} color={d.important ? undefined : '#b9ad97'} /><span style={{ flex: 1, textAlign: 'left' }}>Mark as important</span></button>
      </div>
      <div style={{ padding: '16px 22px 22px', display: 'flex', gap: 10 }}><button onClick={() => v.a.set({ addOpen: false })} style={cancelBtn}>Cancel</button><button onClick={v.a.addItem} style={{ flex: 2, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button></div>
    </Sheet></Overlay>
  );
}
function DetailModal({ v, primary, partner }) {
  const it = v.detail; if (!it) return null;
  const editing = v.s.editing, e = v.s.edit;
  return (
    <Overlay onClose={() => v.a.set({ detailId: null, editing: false })} z={1000}><Sheet stop={v.stop} maxWidth={380} style={{ maxHeight: '92vh' }}>
      <div className="tog-scroll" style={{ overflowY: 'auto', padding: '22px 22px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          {!editing ? <h2 style={{ fontFamily: "'Quicksand',sans-serif", fontSize: 24, fontWeight: 700, margin: 0, color: '#3a352f', lineHeight: 1.15, textDecoration: it.done ? 'line-through' : 'none' }}>{it.title}</h2> : <input value={e.title} onChange={(ev) => v.a.setEdit({ title: ev.target.value })} style={{ flex: 1, border: '1px solid #ece6db', background: '#fff', borderRadius: 12, padding: '11px 13px', fontSize: 18, fontFamily: "'Quicksand',sans-serif", fontWeight: 700, color: '#3a352f', outline: 'none' }} />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}><button onClick={v.a.duplicateItem} title="Duplicate" style={{ border: 'none', background: '#ece6db', color: '#7a7166', width: 30, height: 30, borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button><button onClick={() => v.a.toggleImportant(it.id)} title="Mark important" style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', lineHeight: 0 }}><CI.Star size={22} filled={it.important} /></button><button onClick={() => v.a.set({ detailId: null, editing: false })} style={closeX}>×</button></div>
        </div>
        {!editing ? (
          <Fragment>
            {it.body && <p style={{ margin: '14px 0 0', fontSize: 15, fontWeight: 600, color: '#4a443c', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{it.body}</p>}
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{it.labelName && <span style={{ ...chipBase, background: it.tone.bg, color: it.tone.fg }}>{it.labelName}</span>}<span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: '#9a9186' }}><CAvatar color={it.byColor} initial={it.byInitial} size={22} />{it.byName} · {it.date}</span></div>
          </Fragment>
        ) : (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea value={e.body} onChange={(ev) => v.a.setEdit({ body: ev.target.value })} placeholder="Notes · optional" style={{ width: '100%', minHeight: 130, resize: 'vertical', border: '1px solid #ece6db', background: '#fff', borderRadius: 14, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', fontWeight: 600, color: '#3a352f', outline: 'none', lineHeight: 1.6 }} />
            <div style={{ position: 'relative' }}><select value={e.labelId} onChange={(ev) => v.a.setEdit({ labelId: ev.target.value })} style={selectStyle}><option value="">No label</option>{v.labelOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select><span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#b3a99c' }}><CI.Chevron size={15} /></span></div>
          </div>
        )}
      </div>
      <div style={{ padding: '14px 22px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={() => v.a.toggleDone(it.id)} style={{ background: it.done ? '#f3ece1' : partner, color: it.done ? '#a8794f' : '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>{it.done ? 'Mark as not done' : 'Mark as done'}</button>
        <div style={{ display: 'flex', gap: 10 }}>
          {!editing && <button onClick={v.a.startEdit} style={{ flex: 1, background: '#fff', color: '#7a7166', border: '1px solid #e6ded2', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>}
          {editing && <button onClick={v.a.saveEdit} style={{ flex: 1, background: partner, color: '#fff', border: 'none', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>}
          <button onClick={v.a.deleteDetail} style={{ flex: 1, background: '#f6ece9', color: '#b07a6e', border: 'none', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
        </div>
      </div>
    </Sheet></Overlay>
  );
}
function BugModal({ v, primary }) {
  if (!v.s.bugOpen) return null; const s = v.s;
  return (<Overlay onClose={() => v.a.set({ bugOpen: false, bugSent: false })} z={1400}><Sheet stop={v.stop} maxWidth={380}>{!s.bugSent ? (
    <div style={{ padding: '24px 22px' }}><div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}><div><h2 style={{ ...modalTitle, marginBottom: 4 }}>Report a Problem</h2><p style={{ margin: 0, fontSize: 14, color: '#9a9186', fontWeight: 600 }}>Help us improve Together.</p></div><button onClick={() => v.a.set({ bugOpen: false })} style={closeX}>×</button></div><textarea value={s.bugText} onChange={(e) => v.a.set({ bugText: e.target.value })} placeholder="Tell us what went wrong…" style={{ marginTop: 16, width: '100%', minHeight: 92, resize: 'vertical', background: '#fff', borderRadius: 14, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', fontWeight: 600, color: '#3a352f', outline: 'none', lineHeight: 1.5, border: '1px solid #ece6db' }} /><div style={{ marginTop: 18, display: 'flex', gap: 10 }}><button onClick={() => v.a.set({ bugOpen: false })} style={cancelBtn}>Cancel</button><button onClick={v.a.sendBug} style={{ flex: 2, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>Send Report</button></div></div>
  ) : (<div style={{ padding: '38px 28px 30px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}><h2 style={{ fontFamily: "'Quicksand',sans-serif", fontSize: 25, fontWeight: 700, margin: 0, color: '#3a352f' }}>Thanks ♥</h2><button onClick={() => v.a.set({ bugOpen: false, bugSent: false, bugText: '' })} style={{ marginTop: 6, width: '100%', background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button></div>)}</Sheet></Overlay>);
}

/* ── view-model ───────────────────────────────────────────────────────────── */
function buildView(state, actions, opts) {
  const { primary, partner, members = [] } = opts;
  const labelById = {}; state.labels.forEach(l => { labelById[l.id] = l; });
  const memberByUid = {}; members.forEach(m => { memberByUid[m.uid] = m; });
  const slotColor = (idx) => idx === 0 ? primary : idx === 1 ? partner : '#9a9186';
  const resolveBy = (uid, byName) => { const m = memberByUid[uid]; return m ? { name: m.name, color: slotColor(m.idx) } : { name: byName || 'Someone', color: '#9a9186' }; };
  const af = state.activeFilter, sf = state.statusFilter, sortMode = state.sortMode;
  const byLabel = state.items.filter(i => af === 'all' || i.labelId === af);
  const counts = { all: byLabel.length, todo: byLabel.filter(i => !i.done).length, done: byLabel.filter(i => i.done).length, important: byLabel.filter(i => i.important).length };
  let vis = byLabel.filter(i => sf === 'todo' ? !i.done : sf === 'done' ? i.done : sf === 'important' ? i.important : true);
  const rankOf = (i) => i.important && !i.done ? 0 : (!i.done ? 1 : (i.important ? 2 : 3));
  const indexed = vis.map((i, idx) => ({ i, idx }));
  if (sortMode === 'smart') indexed.sort((a, b) => (rankOf(a.i) - rankOf(b.i)) || (b.i.pos - a.i.pos));
  else if (sortMode === 'az') indexed.sort((a, b) => a.i.title.localeCompare(b.i.title));
  else indexed.sort((a, b) => (b.i.pos || 0) - (a.i.pos || 0));
  vis = indexed.map(x => x.i);
  const decorate = (it) => {
    const u = resolveBy(it.byUser, it.byName); const label = it.labelId ? labelById[it.labelId] : null; const tone = ctoneOf(label);
    return { id: it.id, title: it.title, body: it.body, done: it.done, important: it.important, date: it.date, labelName: label ? label.name : '', tone, byName: u.name, byColor: u.color, byInitial: (u.name[0] || '?').toUpperCase(),
      open: () => actions.set({ detailId: it.id, editing: false }), check: (e) => { e.stopPropagation(); actions.toggleDone(it.id); }, star: (e) => { e.stopPropagation(); actions.toggleImportant(it.id); }, doneSelf: () => actions.toggleDone(it.id), deleteSelf: () => actions.remove(it.id) };
  };
  const items = vis.map(decorate);
  const countFor = (id) => id === 'all' ? state.items.length : state.items.filter(i => i.labelId === id).length;
  const mkLabel = (id, name, fg, showDot) => { const active = af === id; return { id, name, showDot, count: countFor(id), select: () => actions.set({ activeFilter: id }), chipStyle: active ? { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, border: '1px solid ' + fg, background: fg, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' } : { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, border: '1px solid #ece6db', background: '#fff', color: '#7a7166', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }, dotStyle: { width: 8, height: 8, borderRadius: '50%', background: active ? 'rgba(255,255,255,.85)' : fg, flexShrink: 0 }, countStyle: active ? { fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,.25)', color: '#fff', borderRadius: 999, padding: '1px 7px', minWidth: 18, textAlign: 'center' } : { fontSize: 11, fontWeight: 800, background: '#f1ece3', color: '#a89e90', borderRadius: 999, padding: '1px 7px', minWidth: 18, textAlign: 'center' } }; };
  const labelFilters = [mkLabel('all', 'All', '#3a352f', false)].concat(state.labels.map(l => mkLabel(l.id, l.name, ctoneOf(l).fg, true)));
  const mkStatus = (id, name, count, isStar) => { const active = sf === id, accent = isStar ? '#d99a2b' : '#6f665b'; return { id, name, count, star: isStar, select: () => actions.set({ statusFilter: id }), chipStyle: active ? { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: '1px solid ' + accent, background: accent, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' } : { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: '1px solid #ece6db', background: '#fff', color: isStar ? '#a8822f' : '#7a7166', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }, countStyle: active ? { fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,.25)', color: '#fff', borderRadius: 999, padding: '1px 7px', minWidth: 18, textAlign: 'center' } : { fontSize: 11, fontWeight: 800, background: '#f1ece3', color: '#a89e90', borderRadius: 999, padding: '1px 7px', minWidth: 18, textAlign: 'center' } }; };
  const statusFilters = [mkStatus('all', 'All', counts.all, false), mkStatus('todo', 'To do', counts.todo, false), mkStatus('done', 'Done', counts.done, false), mkStatus('important', 'Important', counts.important, true)];
  const labelOptions = state.labels.map(l => ({ id: l.id, name: l.name }));
  const customLabels = state.labels.map(l => { const t = ctoneOf(l); return { id: l.id, name: l.name, dotStyle: { width: 12, height: 12, borderRadius: '50%', background: t.fg, flexShrink: 0 }, rename: (e) => actions.renameLabel(l.id, e.target.value), remove: () => actions.deleteLabel(l.id) }; });
  const newTone = CTONE[CTONE_CYCLE[state.labels.length % CTONE_CYCLE.length]];
  const todo = byLabel.filter(i => !i.done).length;
  const detail = state.items.find(i => i.id === state.detailId);
  return {
    s: state, a: actions, primary, partner, members, stop: (e) => e.stopPropagation(),
    items, labelFilters, statusFilters, labelOptions, customLabels,
    isEmpty: vis.length === 0, emptyText: (af === 'all' && sf === 'all') ? 'Empty list — tap Add to start.' : 'Nothing matches these filters.',
    todoLabel: todo + ' to do',
    sortMode, sortOptions: [{ id: 'smart', name: 'Smart order' }, { id: 'new', name: 'Newest' }, { id: 'az', name: 'Title A–Z' }],
    setSortMode: (e) => actions.set({ sortMode: e.target.value }),
    labelsOpen: state.labelsOpen, toggleLabels: () => actions.set(s => ({ labelsOpen: !s.labelsOpen })),
    newLabelChipStyle: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 999, border: '1px dashed #cbb9a2', background: state.labelsOpen ? '#f3ece1' : 'transparent', color: '#a8794f', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
    newLabelName: state.newLabelName, setNewLabelName: (e) => actions.set({ newLabelName: e.target.value }), addLabel: actions.addLabel, onNewLabelKey: (e) => { if (e.key === 'Enter') actions.addLabel(); }, newLabelDot: { width: 12, height: 12, borderRadius: '50%', background: newTone.fg, flexShrink: 0 },
    detail: detail ? decorate(detail) : null,
  };
}

/* ── board + shell ────────────────────────────────────────────────────────── */
function Brand({ titleSize, subSize, dot, primary, partner, subtitle, iconImage }) {
  return (<a href="../" title="Back to Together" style={{ display: 'flex', flexDirection: 'column', gap: 5, textDecoration: 'none', color: 'inherit' }}><div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}><CI.Logo size={dot} /></div><h1 style={{ fontFamily: "'Quicksand',sans-serif", fontSize: titleSize, fontWeight: 700, margin: 0, color: '#3a352f', letterSpacing: '.3px', display: 'flex', alignItems: 'center', gap: 9 }}>{iconImage && <img src={iconImage} alt="" style={{ width: Math.round(titleSize * 0.92), height: Math.round(titleSize * 0.92), borderRadius: 10, objectFit: 'cover' }} />}{subtitle || 'Together'}</h1><p style={{ margin: 0, fontSize: subSize, color: '#9a9186', fontWeight: 600 }}>Shared list · Together</p></a>);
}
function EmptyState({ text, pad }) { return <div style={{ textAlign: 'center', padding: pad, color: '#b3a99c', fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{text}</div>; }
const CFILT_KEY = 'togetherkit.list.filterui.' + LIST_ID;
function FilterGroup({ label, kind, v, open, onToggle, summary }) {
  return (<div><button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: '3px 2px', cursor: 'pointer', fontFamily: 'inherit' }}><span style={upper}>{label}</span><span style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#bcb3a6' }}>{!open && summary && <span style={{ fontSize: 12, fontWeight: 800, color: '#857c70', background: '#fff', border: '1px solid #ece6db', padding: '3px 11px', borderRadius: 999, whiteSpace: 'nowrap' }}>{summary}</span>}<CI.Chevron size={16} open={open} /></span></button>{open && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 9 }}>{kind === 'labels' ? <LabelFilters v={v} /> : <StatusFilters v={v} />}</div>}</div>);
}
function Board({ v, isDesktop, primary, partner, listName, iconImg }) {
  const { order: cOrder, bind: cBind } = window.TogetherReorder.useReorder(v.items.map(i => i.id), v.a.reorder, { enabled: v.sortMode === 'new' });
  const [open, setOpen] = useState(() => { try { return { labels: true, status: true, ...(JSON.parse(localStorage.getItem(CFILT_KEY)) || {}) }; } catch (e) { return { labels: true, status: true }; } });
  const toggle = (k) => setOpen(s => { const n = { ...s, [k]: !s[k] }; try { localStorage.setItem(CFILT_KEY, JSON.stringify(n)); } catch (e) {} return n; });
  const labS = (v.labelFilters.find(x => x.id === v.s.activeFilter) || {}).name || '';
  const statS = (v.statusFilters.find(x => x.id === v.s.statusFilter) || {}).name || '';
  const [exportOpen, setExportOpen] = useState(false);
  const addBtn = isDesktop ? { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: '12px 22px', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' } : { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: primary, color: '#fff', border: 'none', borderRadius: 15, padding: 14, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' };
  function ExportSheet({ onClose }) {
    const labels = v.s.labels; const nameByUid = {}; (v.members || []).forEach(m => { nameByUid[m.uid] = m.name; });
    const [selL, setSelL] = useState(() => new Set(labels.map(l => l.id).concat(['__none'])));
    const [incTodo, setIncTodo] = useState(true); const [incDone, setIncDone] = useState(true); const [impOnly, setImpOnly] = useState(false);
    const [fields, setFields] = useState({ body: true, label: true, by: true });
    const [copied, setCopied] = useState(false);
    const tL = (id) => setSelL(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); const tf = (k) => setFields(f => ({ ...f, [k]: !f[k] }));
    const rows = v.s.items.filter(i => selL.has(i.labelId || '__none')).filter(i => (i.done ? incDone : incTodo)).filter(i => !impOnly || i.important);
    const lines = rows.map(i => { const label = i.labelId ? labels.find(l => l.id === i.labelId) : null; let line = (i.done ? '✓ ' : '• ') + (i.title || 'Untitled'); if (fields.label && label) line += ' [' + label.name + ']'; if (i.important) line += ' ⭐'; if (fields.by && (nameByUid[i.byUser] || i.byName)) line += ' (' + (nameByUid[i.byUser] || i.byName) + ')'; if (fields.body && i.body) line += '\n   ' + i.body.replace(/\n/g, '\n   '); return line; });
    const text = lines.length ? ((listName || 'List') + '\n' + lines.join('\n')) : 'No items match these filters.';
    const doCopy = async () => { try { await navigator.clipboard.writeText(text); } catch (e) {} setCopied(true); window.setTimeout(() => { setCopied(false); onClose(); }, 800); };
    const Chip = ({ on, onClick, children }) => (<button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999, border: '1px solid ' + (on ? primary : '#ece6db'), background: on ? primary : '#fff', color: on ? '#fff' : '#8a8175', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{on && <span style={{ fontSize: 11 }}>✓</span>}{children}</button>);
    const Sec = ({ label, children }) => (<div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}><span style={upper}>{label}</span><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div></div>);
    return (<Overlay onClose={onClose} z={1300}><Sheet stop={v.stop} maxWidth={380}>
      <div style={{ padding: '22px 22px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><div><h2 style={modalTitle}>Export list</h2><p style={{ margin: '4px 0 0', fontSize: 14, color: '#9a9186', fontWeight: 600 }}>Choose what to copy.</p></div><button onClick={onClose} style={closeX}>×</button></div>
      <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 16 }}><Sec label="Labels to include">{labels.map(l => <Chip key={l.id} on={selL.has(l.id)} onClick={() => tL(l.id)}>{l.name}</Chip>)}<Chip on={selL.has('__none')} onClick={() => tL('__none')}>No label</Chip></Sec><Sec label="Status"><Chip on={incTodo} onClick={() => setIncTodo(x => !x)}>To do</Chip><Chip on={incDone} onClick={() => setIncDone(x => !x)}>Done</Chip><Chip on={impOnly} onClick={() => setImpOnly(x => !x)}>Important only</Chip></Sec><Sec label="Fields"><Chip on onClick={() => {}}>Title</Chip><Chip on={fields.body} onClick={() => tf('body')}>Notes</Chip><Chip on={fields.label} onClick={() => tf('label')}>Label</Chip><Chip on={fields.by} onClick={() => tf('by')}>Added by</Chip></Sec></div>
      <div style={{ padding: '16px 22px 22px', display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ fontSize: 12.5, fontWeight: 700, color: '#9a9186' }}>{lines.length} item{lines.length === 1 ? '' : 's'}</span><button onClick={doCopy} style={{ marginLeft: 'auto', flex: 1, maxWidth: 200, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>{copied ? 'Copied!' : 'Copy'}</button></div>
    </Sheet></Overlay>);
  }
  return (
    <div style={{ padding: isDesktop ? '38px 44px 46px' : '28px 18px 40px', display: 'flex', flexDirection: 'column', gap: isDesktop ? 22 : 18 }}>
      {isDesktop ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}><Brand titleSize={34} subSize={15} dot={20} primary={primary} partner={partner} subtitle={listName} iconImage={iconImg} /><button onClick={() => v.a.set({ addOpen: true })} style={addBtn}><CI.Plus size={17} />Add</button></div>
      ) : (
        <Fragment><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}><Brand titleSize={30} subSize={13.5} dot={18} primary={primary} partner={partner} subtitle={listName} iconImage={iconImg} /></div><button onClick={() => v.a.set({ addOpen: true })} style={addBtn}><CI.Plus size={16} />Add</button></Fragment>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? 14 : 13 }}><FilterGroup label="Labels" kind="labels" v={v} open={open.labels} onToggle={() => toggle('labels')} summary={labS} /><FilterGroup label="Status" kind="status" v={v} open={open.status} onToggle={() => toggle('status')} summary={statS} />{v.labelsOpen && <LabelsPanel v={v} partner={partner} maxWidth={isDesktop ? 560 : undefined} />}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px', gap: 10 }}><span style={{ fontSize: 12, fontWeight: 800, color: '#857c70', letterSpacing: '.6px', textTransform: 'uppercase' }}>{v.todoLabel}</span><div style={{ position: 'relative' }}><select value={v.sortMode} onChange={v.setSortMode} style={{ background: '#fff', border: '1px solid #ece6db', borderRadius: 9, padding: '5px 22px 5px 9px', fontSize: 12, fontFamily: 'inherit', color: '#7a7166', fontWeight: 700, outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}>{v.sortOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select><span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#b3a99c' }}><CI.Chevron size={12} /></span></div></div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={() => setExportOpen(true)} title="Export list" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #e6ded2', borderRadius: 12, padding: '9px 15px', fontSize: 13, fontFamily: 'inherit', color: '#7a7166', fontWeight: 800, cursor: 'pointer' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>Export</button></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cOrder.map(id => { const item = v.items.find(x => x.id === id); if (!item) return null; return (<div key={id} {...cBind(id)}><CSwipeRow onDelete={item.deleteSelf} onComplete={item.doneSelf} completeLabel={item.done ? 'Undo' : 'Done'}><ItemCard item={item} partner={partner} /></CSwipeRow></div>); })}
      </div>
      {v.s.syncing ? <EmptyState text="Syncing…" pad="40px 20px" /> : (v.isEmpty && <EmptyState text={v.emptyText} pad="40px 20px" />)}
      {exportOpen && <ExportSheet onClose={() => setExportOpen(false)} />}
    </div>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{ "primaryColor": "#c98a5c", "partnerColor": "#8a9b6e" }/*EDITMODE-END*/;
function useIsDesktop(bp = 720) { const get = () => typeof window !== 'undefined' && window.innerWidth >= bp; const [d, setD] = useState(get); useEffect(() => { const on = () => setD(get()); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []); return d; }
function App() {
  const sx = window.useTogetherSession();
  const { SignIn, Splash } = window.TogetherAccount;
  if (!sx.ready) return <Splash text="…" />;
  if (!sx.session) return <SignIn onGoogle={sx.actions.signInGoogle} />;
  if (!sx.homespaceId) return <Splash text={sx.error ? ('Error: ' + sx.error) : 'Setting up…'} />;
  if (!LIST_ID) return <Splash text="No list selected." />;
  return <BoardShell sx={sx} />;
}
function BoardShell({ sx }) {
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const { TweaksPanel, TweakSection, TweakColor } = window;
  const { HomeButton, AccountButton, AccountSheet } = window.TogetherAccount;
  const [accountOpen, setAccountOpen] = useState(false);
  const [listMeta, setListMeta] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const primary = tweaks.primaryColor || '#c98a5c', partner = tweaks.partnerColor || '#8a9b6e';
  const isDesktop = useIsDesktop();
  useEffect(() => { document.documentElement.style.setProperty('--primary', primary); document.documentElement.style.setProperty('--partner', partner); }, [primary, partner]);
  useEffect(() => {
    let alive = true;
    window.TogetherBackend.client.from('custom_lists').select('id,name,emoji,icon_image').eq('id', LIST_ID).maybeSingle().then(({ data }) => { if (!alive) return; if (data) { setListMeta(data); document.title = 'Together — ' + data.name; } else setNotFound(true); });
    return () => { alive = false; };
  }, [sx.homespaceId]);
  const [state, actions] = useListStore(sx.homespaceId, sx.me);
  const v = buildView(state, actions, { primary, partner, members: sx.members });
  if (notFound) return <div className="app"><div className="app-shell"><div style={{ padding: '60px 28px', textAlign: 'center' }}><h2 style={{ fontFamily: "'Quicksand',sans-serif", color: '#3a352f' }}>List not found</h2><a href="../" style={{ color: '#a8794f', fontWeight: 800 }}>← Back to Together</a></div></div></div>;
  const iconImg = listMeta && listMeta.icon_image;
  const listName = listMeta ? ((!iconImg && listMeta.emoji ? listMeta.emoji + ' ' : '') + listMeta.name) : 'List';
  return (
    <div className="app">
      <div className="app-shell"><Board v={v} isDesktop={isDesktop} primary={primary} partner={partner} listName={listName} iconImg={iconImg} /></div>
      <HomeButton href="../" />
      <AccountButton sx={sx} onOpen={() => setAccountOpen(true)} />
      {accountOpen && <AccountSheet sx={sx} onClose={() => setAccountOpen(false)} />}
      <button onClick={() => v.a.set({ bugOpen: true, bugSent: false })} title="Report a problem" style={{ position: 'fixed', top: 24, right: 24, zIndex: 900, width: 46, height: 46, borderRadius: '50%', border: '1px solid #ecd9c4', background: '#fffaf3', color: '#b07d42', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(58,53,47,.08),0 8px 20px rgba(58,53,47,.12)' }}><CI.Bug size={21} /></button>
      <AddModal v={v} primary={primary} /><DetailModal v={v} primary={primary} partner={partner} /><BugModal v={v} primary={primary} />
      <TweaksPanel title="Tweaks"><TweakSection label="People"><TweakColor label="Primary" value={tweaks.primaryColor} onChange={(c) => setTweak('primaryColor', c)} options={['#c98a5c', '#d97757', '#cf6a52', '#b07d42']} /><TweakColor label="Partner" value={tweaks.partnerColor} onChange={(c) => setTweak('partnerColor', c)} options={['#8a9b6e', '#6f8050', '#5e827b', '#7e6f86']} /></TweakSection></TweaksPanel>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
