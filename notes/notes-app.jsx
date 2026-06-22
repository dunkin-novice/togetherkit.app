// notes-app.jsx — Together "Shared Notes".
// A shared board of free-form notes (title + body) for two. Same engine as the
// shopping list / date ideas (accounts, homespace, realtime, swipe, filters,
// export) but each item is a blank note block; labels start empty (no presets).
// Reuses the shared modules (icons/supabase/session/account/tweaks/styles).
// Local helpers are namespaced (NI / NAvatar / NSwipeRow) so they don't collide
// with the shared modules in the page's single babel scope.

const { useState, useRef, useMemo, useEffect, Fragment } = React;
const NI = window.Icons;

/* ── label tones ──────────────────────────────────────────────────────────── */
const NTONE = {
  sand:   { bg: '#f2eade', fg: '#9c7b54' },
  dine:   { bg: '#f4e8dd', fg: '#a8794f' },
  trip:   { bg: '#e7eef0', fg: '#5d7480' },
  green:  { bg: '#eef1e6', fg: '#6f7d52' },
  purple: { bg: '#efe8f1', fg: '#7e6f86' },
  rose:   { bg: '#f3e6e4', fg: '#a86a6a' },
  teal:   { bg: '#e6efed', fg: '#5e827b' },
};
const NTONE_CYCLE = ['sand', 'purple', 'rose', 'teal', 'trip', 'green', 'dine'];
const ntoneOf = (l) => NTONE[(l && l.tone) || 'sand'] || NTONE.sand;

/* ── mappers ──────────────────────────────────────────────────────────────── */
const rowToNote = (r) => ({ id: r.id, title: r.title || '', body: r.body || '', labelId: r.label_id, byUser: r.by_user, byName: r.by_name, date: r.date, important: !!r.important, pos: Number(r.pos) || 0 });
const noteToRow = (n, hs) => ({ id: n.id, homespace_id: hs, title: n.title, body: n.body || null, label_id: n.labelId || null, by_user: n.byUser, by_name: n.byName, date: n.date, important: !!n.important, pos: n.pos || 0 });
const rowToNL = (r) => ({ id: r.id, name: r.name, tone: r.tone, custom: !!r.custom, sort: r.sort });
const nlToRow = (l, hs, sort) => ({ homespace_id: hs, id: l.id, name: l.name, tone: l.tone, custom: !!l.custom, sort: sort != null ? sort : (l.sort || 0) });

/* ── store ────────────────────────────────────────────────────────────────── */
function useNotesStore(homespaceId, me) {
  const BE = window.TogetherBackend;
  const { client } = BE;
  const [state, setState] = useState(() => ({
    labels: [], notes: [], syncing: true,
    activeFilter: 'all', statusFilter: 'all', sortMode: 'new',
    draft: { title: '', body: '', labelId: '', important: false },
    labelsOpen: false, newLabelName: '',
    detailId: null, editing: false, edit: { title: '', body: '', labelId: '' },
    addOpen: false,
    bugOpen: false, bugSent: false, bugText: '', bugEmail: '',
  }));
  const patch = (p) => setState(s => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
  const ref = useRef(state); ref.current = state;
  const meRef = useRef(me); meRef.current = me;
  const db = (p) => { Promise.resolve(p).then(r => { if (r && r.error) console.warn('[togetherkit/notes] sync', r.error.message); }, e => console.warn('[togetherkit/notes] sync', e)); };

  useEffect(() => {
    if (!homespaceId) return;
    let alive = true;
    patch({ syncing: true });
    const refetch = async () => {
      const [lr, nr] = await Promise.all([
        client.from('note_labels').select('*').eq('homespace_id', homespaceId).order('sort', { ascending: true }),
        client.from('notes').select('*').eq('homespace_id', homespaceId).order('pos', { ascending: false }),
      ]);
      if (!alive) return;
      patch({ labels: (lr.data || []).map(rowToNL), notes: (nr.data || []).map(rowToNote), syncing: false });
    };
    refetch();
    const ch = client.channel('notes:' + homespaceId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: 'homespace_id=eq.' + homespaceId }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'note_labels', filter: 'homespace_id=eq.' + homespaceId }, refetch)
      .subscribe();
    return () => { alive = false; client.removeChannel(ch); };
  }, [client, homespaceId]);

  const actions = useMemo(() => ({
    set: patch,
    remove: (id) => { patch(s => ({ notes: s.notes.filter(n => n.id !== id) })); db(client.from('notes').delete().eq('id', id)); },
    toggleImportant: (id) => { const n = ref.current.notes.find(x => x.id === id); if (!n) return; patch(s => ({ notes: s.notes.map(x => x.id === id ? { ...x, important: !x.important } : x) })); db(client.from('notes').update({ important: !n.important, updated_at: new Date().toISOString() }).eq('id', id)); },
    reorder: (ids) => { const base = Date.now(); patch(s => ({ notes: s.notes.map(n => { const i = ids.indexOf(n.id); return i >= 0 ? { ...n, pos: base - i } : n; }) })); ids.forEach((id, i) => db(client.from('notes').update({ pos: base - i }).eq('id', id))); },
    setDraft: (p) => patch(s => ({ draft: { ...s.draft, ...p } })),
    addNote: () => {
      const s = ref.current, d = s.draft, m = meRef.current || { uid: null, name: 'Me' };
      const title = (d.title || '').trim();
      if (!title && !(d.body || '').trim()) return;
      const n = { id: BE.newId(), title: title || 'Untitled', body: d.body, labelId: d.labelId || null, byUser: m.uid, byName: m.name, date: 'Today', important: d.important, pos: Date.now() };
      patch(st => ({ notes: [n, ...st.notes], draft: { title: '', body: '', labelId: d.labelId, important: false }, addOpen: false }));
      db(client.from('notes').insert(noteToRow(n, homespaceId)));
    },
    addLabel: () => {
      const s = ref.current, name = (s.newLabelName || '').trim(); if (!name) return;
      const tone = NTONE_CYCLE[s.labels.length % NTONE_CYCLE.length];
      const label = { id: 'nl' + Date.now(), name, tone, custom: true, sort: s.labels.length };
      patch(st => ({ labels: [...st.labels, label], newLabelName: '' }));
      db(client.from('note_labels').insert(nlToRow(label, homespaceId, label.sort)));
    },
    // create a label inline (from the Add dialog) and select it on the draft
    createLabelInline: (name) => {
      const s = ref.current; name = (name || '').trim(); if (!name) return;
      const existing = s.labels.find(l => l.name.toLowerCase() === name.toLowerCase());
      if (existing) { patch(st => ({ draft: { ...st.draft, labelId: existing.id } })); return; }
      const tone = NTONE_CYCLE[s.labels.length % NTONE_CYCLE.length];
      const label = { id: 'nl' + Date.now(), name, tone, custom: true, sort: s.labels.length };
      patch(st => ({ labels: [...st.labels, label], draft: { ...st.draft, labelId: label.id } }));
      db(client.from('note_labels').insert(nlToRow(label, homespaceId, label.sort)));
    },
    renameLabel: (id, value) => { patch(s => ({ labels: s.labels.map(l => l.id === id ? { ...l, name: value } : l) })); db(client.from('note_labels').update({ name: value }).eq('homespace_id', homespaceId).eq('id', id)); },
    deleteLabel: (id) => {
      const s = ref.current, remaining = s.labels.filter(l => l.id !== id);
      patch(st => ({ labels: remaining, notes: st.notes.map(n => n.labelId === id ? { ...n, labelId: null } : n), activeFilter: st.activeFilter === id ? 'all' : st.activeFilter, draft: { ...st.draft, labelId: st.draft.labelId === id ? '' : st.draft.labelId } }));
      db(client.from('notes').update({ label_id: null }).eq('homespace_id', homespaceId).eq('label_id', id));
      db(client.from('note_labels').delete().eq('homespace_id', homespaceId).eq('id', id));
    },
    startEdit: () => { const n = ref.current.notes.find(x => x.id === ref.current.detailId); if (!n) return; patch({ editing: true, edit: { title: n.title, body: n.body, labelId: n.labelId || '' } }); },
    duplicateItem: () => { const n = ref.current.notes.find(x => x.id === ref.current.detailId); if (!n) return; patch({ detailId: null, editing: false, addOpen: true, draft: { title: n.title, body: n.body, labelId: n.labelId || '', important: n.important } }); },
    setEdit: (p) => patch(s => ({ edit: { ...s.edit, ...p } })),
    saveEdit: () => { const s = ref.current, e = s.edit, title = (e.title || '').trim(); if (!title && !(e.body || '').trim()) return; const upd = { title: title || 'Untitled', body: e.body, labelId: e.labelId || null }; patch(st => ({ editing: false, notes: st.notes.map(n => n.id === st.detailId ? { ...n, ...upd } : n) })); db(client.from('notes').update({ title: upd.title, body: upd.body || null, label_id: upd.labelId, updated_at: new Date().toISOString() }).eq('id', s.detailId)); },
    deleteDetail: () => { const id = ref.current.detailId; patch({ detailId: null, editing: false }); patch(s => ({ notes: s.notes.filter(n => n.id !== id) })); db(client.from('notes').delete().eq('id', id)); },
    sendBug: () => { try { window.TogetherBackend.reportBug({ message: ref.current.bugText, page: 'notes', homespaceId, byUser: (meRef.current || {}).uid, byName: (meRef.current || {}).name }); } catch (e) {} patch({ bugSent: true }); },
  }), [client, homespaceId, BE]);

  return [state, actions];
}

/* ── shared style fragments ───────────────────────────────────────────────── */
const upper = { fontSize: 11, fontWeight: 800, color: '#aaa093', letterSpacing: '.6px', textTransform: 'uppercase' };
const chipBase = { padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block' };
const iconBtn = { border: 'none', background: 'none', padding: 9, margin: -7, cursor: 'pointer', lineHeight: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const importantTag = { fontSize: 11, fontWeight: 800, color: '#a8822f', background: '#f6edd6', padding: '3px 9px', borderRadius: 8 };
const closeX = { flexShrink: 0, width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#ece6db', color: '#857c70', fontSize: 17, cursor: 'pointer', lineHeight: 1 };
const fieldInput = { border: '1px solid #ece6db', background: '#fff', borderRadius: 13, padding: '13px 15px', fontSize: 15, fontFamily: 'inherit', color: '#3a352f', outline: 'none', fontWeight: 700, width: '100%' };
const selectStyle = { border: '1px solid #ece6db', background: '#fff', borderRadius: 12, padding: '12px 13px', fontSize: 14, fontFamily: 'inherit', color: '#3a352f', fontWeight: 700, outline: 'none', cursor: 'pointer', width: '100%', appearance: 'none', WebkitAppearance: 'none' };
const cancelBtn = { flex: 1, background: '#fff', color: '#7a7166', border: '1px solid #e6ded2', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' };
const modalTitle = { fontFamily: "'Quicksand',sans-serif", fontSize: 23, fontWeight: 700, margin: 0, color: '#3a352f' };

function NAvatar({ color, initial, size = 20 }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', background: color, color: '#fff', fontWeight: 800, fontSize: size * 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initial}</span>;
}
function Overlay({ onClose, z = 1200, children }) {
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: z, background: 'rgba(58,53,47,.42)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, animation: 'tog-fade .15s ease' }}>{children}</div>;
}
function Sheet({ stop, maxWidth, children, style }) {
  return <div onClick={stop} style={{ width: '100%', maxWidth, background: '#f6f4ef', borderRadius: 26, boxShadow: '0 24px 60px rgba(58,53,47,.34)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column', animation: 'tog-pop .18s ease', ...style }}>{children}</div>;
}

/* ── swipe (left = delete, right = toggle important) ──────────────────────── */
function NSwipeRow({ onDelete, onComplete, completeLabel = 'Important', completeColor = '#d6a43b', radius = 18, children }) {
  const [dx, setDx] = useState(0); const [dragging, setDragging] = useState(false); const [removing, setRemoving] = useState(false);
  const st = useRef(null); const dxRef = useRef(0); const movedRef = useRef(false);
  const THRESHOLD = 88, MAX = 128; const applyDx = (n) => { dxRef.current = n; setDx(n); };
  const onPointerDown = (e) => { if (removing) return; if (e.target.closest('button, a, input, select, label, textarea')) return; st.current = { x: e.clientX, y: e.clientY, active: false }; movedRef.current = false; };
  const onPointerMove = (e) => {
    if (!st.current || removing) return;
    const dX = e.clientX - st.current.x, dY = e.clientY - st.current.y;
    if (!st.current.active) { if (Math.abs(dX) > 8 && Math.abs(dX) > Math.abs(dY)) { st.current.active = true; setDragging(true); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} } else if (Math.abs(dY) > 10) { st.current = null; return; } }
    if (st.current && st.current.active) { const next = Math.max(-MAX, Math.min(onComplete ? MAX : 0, dX)); applyDx(next); if (Math.abs(next) > 6) movedRef.current = true; }
  };
  const finish = () => {
    if (!st.current) { setDragging(false); return; }
    const active = st.current.active; st.current = null; setDragging(false);
    if (!active) return;
    if (dxRef.current <= -THRESHOLD) { setRemoving(true); window.setTimeout(() => onDelete && onDelete(), 200); }
    else if (onComplete && dxRef.current >= THRESHOLD) { applyDx(0); onComplete(); }
    else applyDx(0);
  };
  return (
    <div style={{ position: 'relative' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: radius, background: '#c4604c', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingRight: 22, color: '#fff', fontWeight: 800, fontSize: 14, opacity: (dx < 0 || removing) ? 1 : 0 }}><NI.Trash size={17} /> Delete</div>
      {onComplete && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: radius, background: completeColor, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, paddingLeft: 22, color: '#fff', fontWeight: 800, fontSize: 14, opacity: dx > 0 ? 1 : 0 }}><NI.Star size={16} filled color="#fff" /> {completeLabel}</div>}
      <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finish} onPointerCancel={finish}
        onClickCapture={(e) => { if (movedRef.current) { e.preventDefault(); e.stopPropagation(); movedRef.current = false; } }}
        style={{ position: 'relative', transform: removing ? 'translateX(-110%)' : ('translateX(' + dx + 'px)'), transition: dragging ? 'none' : 'transform .2s cubic-bezier(.3,.7,.4,1), opacity .2s ease', opacity: removing ? 0 : 1, touchAction: 'pan-y' }}>
        {children}
      </div>
    </div>
  );
}

/* ── note card ────────────────────────────────────────────────────────────── */
function NoteCard({ note }) {
  return (
    <div onClick={note.open} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, background: '#fff', borderRadius: 18, cursor: 'pointer', border: note.important ? '1.5px solid #e7d3a3' : '1px solid transparent', boxShadow: '0 1px 2px rgba(58,53,47,.05),0 6px 16px rgba(58,53,47,.035)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '.1px', color: '#3a352f', fontFamily: "'Quicksand',sans-serif" }}>{note.title}</span>
          {note.important && <span style={importantTag}>Important</span>}
        </div>
        {note.body && <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 600, color: '#7a7166', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{note.body}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
          {note.labelName && <span style={{ ...chipBase, background: note.tone.bg, color: note.tone.fg }}>{note.labelName}</span>}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#9a9186', fontSize: 12, fontWeight: 600 }}>
            <NAvatar color={note.byColor} initial={note.byInitial} size={20} />{note.byName}<span style={{ color: '#c3bbae' }}>· {note.date}</span>
          </span>
        </div>
      </div>
      <button onClick={note.star} title="Mark important" aria-label={note.important ? 'Unmark important' : 'Mark important'} style={iconBtn}><NI.Star size={19} filled={note.important} /></button>
    </div>
  );
}

/* ── filter chips ─────────────────────────────────────────────────────────── */
function LabelFilters({ v }) {
  return (
    <Fragment>
      {v.labelFilters.map(f => (<button key={f.id} onClick={f.select} style={f.chipStyle}>{f.showDot && <span style={f.dotStyle} />}{f.name}<span style={f.countStyle}>{f.count}</span></button>))}
      <button onClick={v.toggleLabels} style={v.newLabelChipStyle}>+ New Label</button>
    </Fragment>
  );
}
function StatusFilters({ v }) {
  return <Fragment>{v.statusFilters.map(s => (<button key={s.id} onClick={s.select} style={s.chipStyle}>{s.star && <NI.Star size={13} filled color="currentColor" />}{s.name}<span style={s.countStyle}>{s.count}</span></button>))}</Fragment>;
}
function LabelsPanel({ v, partner, maxWidth }) {
  const labelInput = { flex: 1, border: 'none', background: '#f5f0e8', borderRadius: 11, padding: '10px 13px', fontSize: 14, fontFamily: 'inherit', fontWeight: 700, color: '#3a352f', outline: 'none' };
  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: 16, boxShadow: '0 1px 2px rgba(58,53,47,.05),0 8px 22px rgba(58,53,47,.05)', display: 'flex', flexDirection: 'column', gap: 14, maxWidth }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: "'Quicksand',sans-serif", fontWeight: 700, fontSize: 17, color: '#3a352f' }}>Labels</span>
        <button onClick={v.toggleLabels} style={{ background: 'none', border: 'none', color: '#a8794f', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
      </div>
      {v.customLabels.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {v.customLabels.map(cl => (
            <div key={cl.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={cl.dotStyle} /><input value={cl.name} onChange={cl.rename} style={labelInput} />
              <button onClick={cl.remove} aria-label="Delete label" style={{ background: '#f6ece9', border: 'none', color: '#b07a6e', width: 40, height: 40, borderRadius: 10, fontSize: 16, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      ) : <span style={{ fontSize: 13, color: '#b3a99c', fontWeight: 600 }}>No labels yet — add one below.</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #f0ebe2', paddingTop: 14 }}>
        <span style={v.newLabelDot} />
        <input value={v.newLabelName} onChange={v.setNewLabelName} onKeyDown={v.onNewLabelKey} placeholder="New label name…" style={labelInput} />
        <button onClick={v.addLabel} style={{ background: partner, color: '#fff', border: 'none', borderRadius: 11, padding: '10px 16px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Add</button>
      </div>
    </div>
  );
}

/* ── modals ───────────────────────────────────────────────────────────────── */
function AddModal({ v, primary }) {
  if (!v.s.addOpen) return null;
  const d = v.s.draft;
  const [showNew, setShowNew] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const createLabel = () => { const n = newLabel.trim(); if (!n) return; v.a.createLabelInline(n); setShowNew(false); setNewLabel(''); };
  return (
    <Overlay onClose={() => v.a.set({ addOpen: false })}>
      <Sheet stop={v.stop} maxWidth={380}>
        <div style={{ padding: '22px 22px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <h2 style={modalTitle}>New note</h2>
          <button onClick={() => v.a.set({ addOpen: false })} aria-label="Close" style={closeX}>×</button>
        </div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input value={d.title} onChange={(e) => v.a.setDraft({ title: e.target.value })} placeholder="Note title" style={{ ...fieldInput, fontFamily: "'Quicksand',sans-serif", fontSize: 17 }} autoFocus />
          <textarea value={d.body} onChange={(e) => v.a.setDraft({ body: e.target.value })} placeholder="Write anything…" style={{ width: '100%', minHeight: 130, resize: 'vertical', border: '1px solid #ece6db', background: '#fff', borderRadius: 14, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', fontWeight: 600, color: '#3a352f', outline: 'none', lineHeight: 1.6 }} />
          <div style={{ position: 'relative' }}>
            <select value={showNew ? '__new' : (d.labelId || '')} onChange={(e) => { const val = e.target.value; if (val === '__new') { setShowNew(true); } else { setShowNew(false); v.a.setDraft({ labelId: val }); } }} style={selectStyle}>
              <option value="">No label</option>
              {v.labelOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              <option value="__new">+ Create new label…</option>
            </select>
            <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#b3a99c' }}><NI.Chevron size={15} /></span>
          </div>
          {showNew && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createLabel(); }} placeholder="New label name…" autoFocus style={{ flex: 1, border: '1px solid #ece6db', background: '#fff', borderRadius: 12, padding: '11px 13px', fontSize: 14, fontFamily: 'inherit', fontWeight: 700, color: '#3a352f', outline: 'none' }} />
              <button onClick={createLabel} style={{ background: 'var(--partner)', color: '#fff', border: 'none', borderRadius: 12, padding: '0 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
            </div>
          )}
          <button onClick={() => v.a.setDraft({ important: !d.important })} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', borderRadius: 13, border: '1px solid ' + (d.important ? '#e7d3a3' : '#ece6db'), background: d.important ? '#fdf8ee' : '#fff', color: d.important ? '#a8822f' : '#7a7166', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            <NI.Star size={18} filled={d.important} color={d.important ? undefined : '#b9ad97'} /><span style={{ flex: 1, textAlign: 'left' }}>Mark as important</span>
          </button>
        </div>
        <div style={{ padding: '16px 22px 22px', display: 'flex', gap: 10 }}>
          <button onClick={() => v.a.set({ addOpen: false })} style={cancelBtn}>Cancel</button>
          <button onClick={v.a.addNote} style={{ flex: 2, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>Save note</button>
        </div>
      </Sheet>
    </Overlay>
  );
}
function DetailModal({ v, primary, partner }) {
  const note = v.detail;
  if (!note) return null;
  const editing = v.s.editing, e = v.s.edit;
  return (
    <Overlay onClose={() => v.a.set({ detailId: null, editing: false })} z={1000}>
      <Sheet stop={v.stop} maxWidth={380} style={{ maxHeight: '92vh' }}>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '22px 22px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            {!editing
              ? <h2 style={{ fontFamily: "'Quicksand',sans-serif", fontSize: 24, fontWeight: 700, margin: 0, color: '#3a352f', lineHeight: 1.15 }}>{note.title}</h2>
              : <input value={e.title} onChange={(ev) => v.a.setEdit({ title: ev.target.value })} style={{ flex: 1, border: '1px solid #ece6db', background: '#fff', borderRadius: 12, padding: '11px 13px', fontSize: 18, fontFamily: "'Quicksand',sans-serif", fontWeight: 700, color: '#3a352f', outline: 'none' }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button onClick={v.a.duplicateItem} title="Duplicate" aria-label="Duplicate" style={{ border: 'none', background: '#ece6db', color: '#7a7166', width: 40, height: 40, borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button>
              <button onClick={() => v.a.toggleImportant(note.id)} title="Mark important" aria-label={note.important ? 'Unmark important' : 'Mark important'} style={{ border: 'none', background: 'none', padding: 9, cursor: 'pointer', lineHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><NI.Star size={22} filled={note.important} /></button>
              <button onClick={() => v.a.set({ detailId: null, editing: false })} aria-label="Close" style={closeX}>×</button>
            </div>
          </div>
          {!editing ? (
            <Fragment>
              {note.body && <p style={{ margin: '14px 0 0', fontSize: 15, fontWeight: 600, color: '#4a443c', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{note.body}</p>}
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {note.labelName && <span style={{ ...chipBase, background: note.tone.bg, color: note.tone.fg }}>{note.labelName}</span>}
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: '#9a9186' }}><NAvatar color={note.byColor} initial={note.byInitial} size={22} />{note.byName} · {note.date}</span>
              </div>
            </Fragment>
          ) : (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <textarea value={e.body} onChange={(ev) => v.a.setEdit({ body: ev.target.value })} placeholder="Write anything…" style={{ width: '100%', minHeight: 150, resize: 'vertical', border: '1px solid #ece6db', background: '#fff', borderRadius: 14, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', fontWeight: 600, color: '#3a352f', outline: 'none', lineHeight: 1.6 }} />
              <div style={{ position: 'relative' }}>
                <select value={e.labelId} onChange={(ev) => v.a.setEdit({ labelId: ev.target.value })} style={selectStyle}>
                  <option value="">No label</option>
                  {v.labelOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#b3a99c' }}><NI.Chevron size={15} /></span>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '14px 22px 22px', display: 'flex', gap: 10 }}>
          {!editing && <button onClick={v.a.startEdit} style={{ flex: 1, background: '#fff', color: '#7a7166', border: '1px solid #e6ded2', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>}
          {editing && <button onClick={v.a.saveEdit} style={{ flex: 1, background: partner, color: '#fff', border: 'none', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>}
          <button onClick={v.a.deleteDetail} style={{ flex: 1, background: '#f6ece9', color: '#b07a6e', border: 'none', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
        </div>
      </Sheet>
    </Overlay>
  );
}
function BugModal({ v, primary }) {
  if (!v.s.bugOpen) return null;
  const s = v.s;
  return (
    <Overlay onClose={() => v.a.set({ bugOpen: false, bugSent: false })} z={1400}>
      <Sheet stop={v.stop} maxWidth={380}>
        {!s.bugSent ? (
          <div style={{ padding: '24px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div><h2 style={{ ...modalTitle, marginBottom: 4 }}>Report a Problem</h2><p style={{ margin: 0, fontSize: 14, color: '#9a9186', fontWeight: 600 }}>Help us improve Together.</p></div>
              <button onClick={() => v.a.set({ bugOpen: false })} aria-label="Close" style={closeX}>×</button>
            </div>
            <textarea value={s.bugText} onChange={(e) => v.a.set({ bugText: e.target.value })} placeholder="Tell us what went wrong…" style={{ marginTop: 16, width: '100%', minHeight: 92, resize: 'vertical', background: '#fff', borderRadius: 14, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', fontWeight: 600, color: '#3a352f', outline: 'none', lineHeight: 1.5, border: '1px solid #ece6db' }} />
            <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
              <button onClick={() => v.a.set({ bugOpen: false })} style={cancelBtn}>Cancel</button>
              <button onClick={v.a.sendBug} style={{ flex: 2, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>Send Report</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '38px 28px 30px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <h2 style={{ fontFamily: "'Quicksand',sans-serif", fontSize: 25, fontWeight: 700, margin: 0, color: '#3a352f' }}>Thanks ♥</h2>
            <p style={{ margin: 0, fontSize: 14.5, color: '#9a9186', fontWeight: 600, lineHeight: 1.55, maxWidth: 260 }}>Your report has been sent.</p>
            <button onClick={() => v.a.set({ bugOpen: false, bugSent: false, bugText: '' })} style={{ marginTop: 6, width: '100%', background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
          </div>
        )}
      </Sheet>
    </Overlay>
  );
}

/* ── view-model ───────────────────────────────────────────────────────────── */
function buildView(state, actions, opts) {
  const { primary, partner, members = [] } = opts;
  const labelById = {}; state.labels.forEach(l => { labelById[l.id] = l; });
  const memberByUid = {}; members.forEach(m => { memberByUid[m.uid] = m; });
  const slotColor = (idx) => idx === 0 ? primary : idx === 1 ? partner : '#9a9186';
  const resolveBy = (uid, byName) => { const m = memberByUid[uid]; return m ? { name: m.name, color: slotColor(m.idx) } : { name: byName || 'Someone', color: '#9a9186' }; };

  const af = state.activeFilter, sf = state.statusFilter, sortMode = state.sortMode;
  const byLabel = state.notes.filter(n => af === 'all' || n.labelId === af);
  const statusCounts = { all: byLabel.length, important: byLabel.filter(n => n.important).length };
  let vis = byLabel.filter(n => sf === 'important' ? n.important : true);
  const indexed = vis.map((n, i) => ({ n, i }));
  if (sortMode === 'smart') indexed.sort((a, b) => (Number(b.n.important) - Number(a.n.important)) || (b.n.pos - a.n.pos));
  else if (sortMode === 'az') indexed.sort((a, b) => a.n.title.localeCompare(b.n.title));
  else indexed.sort((a, b) => (b.n.pos || 0) - (a.n.pos || 0));
  vis = indexed.map(x => x.n);

  const decorate = (n) => {
    const u = resolveBy(n.byUser, n.byName); const label = n.labelId ? labelById[n.labelId] : null; const tone = ntoneOf(label);
    return {
      id: n.id, title: n.title, body: n.body, important: n.important, date: n.date,
      labelName: label ? label.name : '', tone, byName: u.name, byColor: u.color, byInitial: (u.name[0] || '?').toUpperCase(),
      open: () => actions.set({ detailId: n.id, editing: false }),
      star: (e) => { e.stopPropagation(); actions.toggleImportant(n.id); },
      starSelf: () => actions.toggleImportant(n.id),
      deleteSelf: () => actions.remove(n.id),
    };
  };
  const notes = vis.map(decorate);

  const countFor = (id) => id === 'all' ? state.notes.length : state.notes.filter(n => n.labelId === id).length;
  const mkLabelFilter = (id, name, fg, showDot) => {
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
  const labelFilters = [mkLabelFilter('all', 'All Notes', '#3a352f', false)].concat(state.labels.map(l => mkLabelFilter(l.id, l.name, ntoneOf(l).fg, true)));
  const mkStatus = (id, name, count, isStar) => {
    const active = sf === id, accent = isStar ? '#d99a2b' : '#6f665b';
    return {
      id, name, count, star: isStar, select: () => actions.set({ statusFilter: id }),
      chipStyle: active ? { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: '1px solid ' + accent, background: accent, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' } : { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: '1px solid #ece6db', background: '#fff', color: isStar ? '#a8822f' : '#7a7166', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
      countStyle: active ? { fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,.25)', color: '#fff', borderRadius: 999, padding: '1px 7px', minWidth: 18, textAlign: 'center' } : { fontSize: 11, fontWeight: 800, background: '#f1ece3', color: '#a89e90', borderRadius: 999, padding: '1px 7px', minWidth: 18, textAlign: 'center' },
    };
  };
  const statusFilters = [mkStatus('all', 'All', statusCounts.all, false), mkStatus('important', 'Important', statusCounts.important, true)];

  const labelOptions = state.labels.map(l => ({ id: l.id, name: l.name }));
  const customLabels = state.labels.map(l => { const t = ntoneOf(l); return { id: l.id, name: l.name, dotStyle: { width: 12, height: 12, borderRadius: '50%', background: t.fg, flexShrink: 0 }, rename: (e) => actions.renameLabel(l.id, e.target.value), remove: () => actions.deleteLabel(l.id) }; });
  const newTone = NTONE[NTONE_CYCLE[state.labels.length % NTONE_CYCLE.length]];
  const activeName = af === 'all' ? '' : (labelById[af] ? labelById[af].name : '');
  let listHeading = af === 'all' ? 'Our notes' : activeName;
  if (sf === 'important') listHeading = (af === 'all' ? 'Important' : (activeName + ' · Important'));
  const detail = state.notes.find(n => n.id === state.detailId);

  return {
    s: state, a: actions, primary, partner, members,
    stop: (e) => e.stopPropagation(),
    notes, labelFilters, statusFilters, labelOptions, customLabels,
    isEmpty: vis.length === 0,
    emptyText: (af === 'all' && sf === 'all') ? 'No notes yet. Tap “New note” to write your first.' : 'Nothing matches these filters.',
    listHeading, count: state.notes.length,
    sortMode, sortOptions: [{ id: 'new', name: 'Newest' }, { id: 'smart', name: 'Important first' }, { id: 'az', name: 'Title A–Z' }],
    setSortMode: (e) => actions.set({ sortMode: e.target.value }),
    labelsOpen: state.labelsOpen, toggleLabels: () => actions.set(s => ({ labelsOpen: !s.labelsOpen })),
    newLabelChipStyle: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 999, border: '1px dashed #cbb9a2', background: state.labelsOpen ? '#f3ece1' : 'transparent', color: '#a8794f', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
    newLabelName: state.newLabelName, setNewLabelName: (e) => actions.set({ newLabelName: e.target.value }),
    addLabel: actions.addLabel, onNewLabelKey: (e) => { if (e.key === 'Enter') actions.addLabel(); },
    newLabelDot: { width: 12, height: 12, borderRadius: '50%', background: newTone.fg, flexShrink: 0 },
    detail: detail ? decorate(detail) : null,
  };
}

/* ── board ────────────────────────────────────────────────────────────────── */
function Brand({ titleSize, subSize, dot, primary, partner }) {
  return (
    <a href="../" title="Back to Together" style={{ display: 'flex', flexDirection: 'column', gap: 5, textDecoration: 'none', color: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}><NI.Logo size={dot} /></div>
      <h1 style={{ fontFamily: "'Quicksand',sans-serif", fontSize: titleSize, fontWeight: 700, margin: 0, color: '#3a352f', letterSpacing: '.3px' }}>Together</h1>
      <p style={{ margin: 0, fontSize: subSize, color: '#9a9186', fontWeight: 600 }}>Shared notes for us</p>
    </a>
  );
}
function EmptyState({ text, pad }) { return <div style={{ textAlign: 'center', padding: pad, color: '#b3a99c', fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{text}</div>; }
const NFILT_KEY = 'togetherkit.notes.filterui';
function FilterGroup({ label, kind, v, open, onToggle, summary }) {
  return (
    <div>
      <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: '3px 2px', cursor: 'pointer', fontFamily: 'inherit' }}>
        <span style={upper}>{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#bcb3a6' }}>
          {!open && summary && <span style={{ fontSize: 12, fontWeight: 800, color: '#857c70', background: '#fff', border: '1px solid #ece6db', padding: '3px 11px', borderRadius: 999, whiteSpace: 'nowrap' }}>{summary}</span>}
          <NI.Chevron size={16} open={open} />
        </span>
      </button>
      {open && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 9 }}>{kind === 'labels' ? <LabelFilters v={v} /> : <StatusFilters v={v} />}</div>}
    </div>
  );
}
function Board({ v, isDesktop, primary, partner }) {
  const { order: noteOrder, dragId: noteDragId, bind: noteBind } = window.TogetherReorder.useReorder(v.notes.map(n => n.id), v.a.reorder, { enabled: v.sortMode === 'new' });
  const [open, setOpen] = useState(() => { try { return { labels: true, status: true, ...(JSON.parse(localStorage.getItem(NFILT_KEY)) || {}) }; } catch (e) { return { labels: true, status: true }; } });
  const toggle = (k) => setOpen(s => { const n = { ...s, [k]: !s[k] }; try { localStorage.setItem(NFILT_KEY, JSON.stringify(n)); } catch (e) {} return n; });
  const labSummary = (v.labelFilters.find(x => x.id === v.s.activeFilter) || {}).name || '';
  const statSummary = (v.statusFilters.find(x => x.id === v.s.statusFilter) || {}).name || '';
  const [exportOpen, setExportOpen] = useState(false);
  const addBtn = isDesktop ? { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: '12px 22px', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' } : { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: primary, color: '#fff', border: 'none', borderRadius: 15, padding: 14, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' };

  function ExportSheet({ onClose }) {
    const labels = v.s.labels; const nameByUid = {}; (v.members || []).forEach(m => { nameByUid[m.uid] = m.name; });
    const af = v.s.activeFilter, sf = v.s.statusFilter;
    const [selL, setSelL] = useState(() => new Set(af === 'all' ? labels.map(l => l.id).concat(['__none']) : [af]));
    const [impOnly, setImpOnly] = useState(sf === 'important');
    const [fields, setFields] = useState({ body: true, label: true, by: true });
    const [copied, setCopied] = useState(false);
    const tL = (id) => setSelL(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const tf = (k) => setFields(f => ({ ...f, [k]: !f[k] }));
    const rows = v.s.notes.filter(n => selL.has(n.labelId || '__none')).filter(n => !impOnly || n.important);
    const lines = rows.map(n => {
      const label = n.labelId ? labels.find(l => l.id === n.labelId) : null;
      let line = (n.important ? '⭐ ' : '• ') + (n.title || 'Untitled');
      if (fields.label && label) line += ' [' + label.name + ']';
      if (fields.by && (nameByUid[n.byUser] || n.byName)) line += ' (' + (nameByUid[n.byUser] || n.byName) + ')';
      if (fields.body && n.body) line += '\n   ' + n.body.replace(/\n/g, '\n   ');
      return line;
    });
    const text = lines.length ? ('📝 Notes\n' + lines.join('\n\n')) : 'No notes match these filters.';
    const doCopy = async () => { try { await navigator.clipboard.writeText(text); } catch (e) {} setCopied(true); window.setTimeout(() => { setCopied(false); onClose(); }, 800); };
    const Chip = ({ on, onClick, children }) => (<button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999, border: '1px solid ' + (on ? primary : '#ece6db'), background: on ? primary : '#fff', color: on ? '#fff' : '#8a8175', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{on && <span style={{ fontSize: 11 }}>✓</span>}{children}</button>);
    const Sec = ({ label, children }) => (<div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}><span style={upper}>{label}</span><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div></div>);
    return (
      <Overlay onClose={onClose} z={1300}>
        <Sheet stop={v.stop} maxWidth={380}>
          <div style={{ padding: '22px 22px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div><h2 style={modalTitle}>Export notes</h2><p style={{ margin: '4px 0 0', fontSize: 14, color: '#9a9186', fontWeight: 600 }}>Choose what to copy.</p></div>
            <button onClick={onClose} aria-label="Close" style={closeX}>×</button>
          </div>
          <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Sec label="Labels to include">{labels.map(l => <Chip key={l.id} on={selL.has(l.id)} onClick={() => tL(l.id)}>{l.name}</Chip>)}<Chip on={selL.has('__none')} onClick={() => tL('__none')}>No label</Chip></Sec>
            <Sec label="Status"><Chip on={impOnly} onClick={() => setImpOnly(x => !x)}>Important only</Chip></Sec>
            <Sec label="Fields"><Chip on onClick={() => {}}>Title</Chip><Chip on={fields.body} onClick={() => tf('body')}>Body</Chip><Chip on={fields.label} onClick={() => tf('label')}>Label</Chip><Chip on={fields.by} onClick={() => tf('by')}>Added by</Chip></Sec>
          </div>
          <div style={{ padding: '16px 22px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#9a9186' }}>{lines.length} note{lines.length === 1 ? '' : 's'}</span>
            <button onClick={doCopy} style={{ marginLeft: 'auto', flex: 1, maxWidth: 200, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>{copied ? 'Copied!' : 'Copy'}</button>
          </div>
        </Sheet>
      </Overlay>
    );
  }

  return (
    <div style={{ padding: isDesktop ? '38px 44px 46px' : '28px 18px 40px', display: 'flex', flexDirection: 'column', gap: isDesktop ? 22 : 18 }}>
      {isDesktop ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}>
          <Brand titleSize={34} subSize={15} dot={20} primary={primary} partner={partner} />
          <button onClick={() => v.a.set({ addOpen: true })} style={addBtn}><NI.Plus size={17} />New note</button>
        </div>
      ) : (
        <Fragment>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}><Brand titleSize={30} subSize={13.5} dot={18} primary={primary} partner={partner} /></div>
          <button onClick={() => v.a.set({ addOpen: true })} style={addBtn}><NI.Plus size={16} />New note</button>
        </Fragment>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? 14 : 13 }}>
        <FilterGroup label="Labels" kind="labels" v={v} open={open.labels} onToggle={() => toggle('labels')} summary={labSummary} />
        <FilterGroup label="Status" kind="status" v={v} open={open.status} onToggle={() => toggle('status')} summary={statSummary} />
        {v.labelsOpen && <LabelsPanel v={v} partner={partner} maxWidth={isDesktop ? 560 : undefined} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#857c70', letterSpacing: '.6px', textTransform: 'uppercase' }}>{v.listHeading}</span>
        <div style={{ position: 'relative' }}>
          <select value={v.sortMode} onChange={v.setSortMode} style={{ background: '#fff', border: '1px solid #ece6db', borderRadius: 9, padding: '5px 22px 5px 9px', fontSize: 12, fontFamily: 'inherit', color: '#7a7166', fontWeight: 700, outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}>{v.sortOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#b3a99c' }}><NI.Chevron size={12} /></span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setExportOpen(true)} title="Export notes" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #e6ded2', borderRadius: 12, padding: '9px 15px', fontSize: 13, fontFamily: 'inherit', color: '#7a7166', fontWeight: 800, cursor: 'pointer' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
          Export
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 12 }}>
        {noteOrder.map(id => { const note = v.notes.find(n => n.id === id); if (!note) return null; return (
          <div key={id} {...noteBind(id)}>
            <NSwipeRow onDelete={note.deleteSelf} onComplete={note.starSelf} completeLabel={note.important ? 'Unstar' : 'Important'}>
              <NoteCard note={note} />
            </NSwipeRow>
          </div>
        ); })}
      </div>
      {v.s.syncing ? <EmptyState text="Syncing…" pad="40px 20px" /> : (v.isEmpty && <EmptyState text={v.emptyText} pad="40px 20px" />)}
      {exportOpen && <ExportSheet onClose={() => setExportOpen(false)} />}
    </div>
  );
}

/* ── auth gate + shell ────────────────────────────────────────────────────── */
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
  const { HomeButton, AccountButton, AccountSheet } = window.TogetherAccount;
  const [accountOpen, setAccountOpen] = useState(false);
  const primary = tweaks.primaryColor || '#c98a5c', partner = tweaks.partnerColor || '#8a9b6e';
  const isDesktop = useIsDesktop();
  useEffect(() => { document.documentElement.style.setProperty('--primary', primary); document.documentElement.style.setProperty('--partner', partner); }, [primary, partner]);
  const [state, actions] = useNotesStore(sx.homespaceId, sx.me);
  const v = buildView(state, actions, { primary, partner, members: sx.members });
  return (
    <div className="app">
      <div className="app-shell"><Board v={v} isDesktop={isDesktop} primary={primary} partner={partner} /></div>
      <HomeButton href="../" />
      <AccountButton sx={sx} onOpen={() => setAccountOpen(true)} />
      {accountOpen && <AccountSheet sx={sx} onClose={() => setAccountOpen(false)} />}
      <button onClick={() => v.a.set({ bugOpen: true, bugSent: false })} title="Report a problem" aria-label="Report a problem" style={{ position: 'fixed', top: 24, right: 24, zIndex: 900, width: 46, height: 46, borderRadius: '50%', border: '1px solid #ecd9c4', background: '#fffaf3', color: '#b07d42', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(58,53,47,.08),0 8px 20px rgba(58,53,47,.12)' }}><NI.Bug size={21} /></button>
      <AddModal v={v} primary={primary} />
      <DetailModal v={v} primary={primary} partner={partner} />
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
