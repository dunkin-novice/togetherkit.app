// fitness-app.jsx — Together "Shared Fitness".
// Two logs in one shared space: Workouts (exercise sets — searchable exercise,
// weight + unit + reps + date) and Body (weight + collapsible fat/muscle stats).
// Each tab has a line graph; entries are colour-coded per person. Reuses the kit.

const { useState, useRef, useMemo, useEffect, Fragment } = React;
const FI = window.Icons;

const UNITS = ['kg', 'lb'];
const EXERCISES = [
  'Bench Press', 'Incline Bench Press', 'Dumbbell Press', 'Chest Fly', 'Push-up', 'Cable Crossover',
  'Deadlift', 'Romanian Deadlift', 'Pull-up', 'Lat Pulldown', 'Barbell Row', 'Seated Row', 'Face Pull',
  'Squat', 'Front Squat', 'Leg Press', 'Lunge', 'Leg Curl', 'Leg Extension', 'Calf Raise', 'Hip Thrust', 'Glute Bridge',
  'Overhead Press', 'Lateral Raise', 'Front Raise', 'Arnold Press', 'Shrug',
  'Bicep Curl', 'Hammer Curl', 'Preacher Curl', 'Tricep Extension', 'Tricep Pushdown', 'Dip',
  'Plank', 'Crunch', 'Leg Raise', 'Russian Twist', 'Cable Crunch',
  'Treadmill', 'Cycling', 'Rowing', 'Elliptical',
];
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const shortDate = (s) => { if (!s) return ''; const p = String(s).split('-'); return p.length === 3 ? (Number(p[1]) + '/' + Number(p[2])) : s; };

const rowToW = (r) => ({ id: r.id, exercise: r.exercise, weight: r.weight, unit: r.unit || 'kg', reps: r.reps, sets: r.sets, setsDetail: r.sets_detail || null, date: r.log_date, byUser: r.by_user, byName: r.by_name });
const rowToB = (r) => ({ id: r.id, date: r.log_date, weight: r.weight, unit: r.unit || 'kg', bodyFat: r.body_fat, muscleMass: r.muscle_mass, fatMass: r.fat_mass, byUser: r.by_user, byName: r.by_name });
// heaviest weight in an entry (handles per-set detail / drop sets)
const maxW = (w) => { if (w.setsDetail && w.setsDetail.length) { const ws = w.setsDetail.map(s => Number(s.weight)).filter(x => !isNaN(x)); return ws.length ? Math.max(...ws) : null; } return w.weight != null ? Number(w.weight) : null; };
const emptyWBlock = (unit) => ({ ex: '', unit: unit || 'kg', mode: 'simple', sets: '', reps: '', weight: '', rows: [{ weight: '', reps: '', drop: false }] });
// summarise an entry for the list card
const setsText = (w) => {
  if (w.setsDetail && w.setsDetail.length) return w.setsDetail.map(s => (s.weight != null ? s.weight : '–') + '×' + (s.reps != null ? s.reps : '–') + (s.drop ? ' drop' : '')).join(', ');
  const parts = [];
  if (w.weight != null) parts.push(w.weight + ' ' + w.unit); else parts.push('bodyweight');
  if (w.reps != null) parts.push('× ' + w.reps);
  if (w.sets != null) parts.push('· ' + w.sets + ' set' + (w.sets === 1 ? '' : 's'));
  return parts.join(' ');
};

function useFitnessStore(homespaceId, me) {
  const BE = window.TogetherBackend; const { client } = BE;
  const [state, setState] = useState(() => ({
    tab: 'workouts', workouts: [], body: [], syncing: true,
    wAddOpen: false, wSession: { date: today(), blocks: [emptyWBlock('kg')] }, exFocusKey: null,
    wEditId: null, wEdit: null,
    bAddOpen: false, bDraft: { weight: '', unit: 'kg', bodyFat: '', muscleMass: '', fatMass: '', date: today(), advanced: false },
    graphExercise: '', bodyMetric: 'weight',
  }));
  const patch = (p) => setState(s => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
  const ref = useRef(state); ref.current = state;
  const meRef = useRef(me); meRef.current = me;
  const db = (p) => { Promise.resolve(p).then(r => { if (r && r.error) console.warn('[togetherkit/fitness]', r.error.message); }, e => console.warn('[togetherkit/fitness]', e)); };

  useEffect(() => {
    if (!homespaceId) return; let alive = true; patch({ syncing: true });
    const refetch = async () => {
      const [w, b] = await Promise.all([
        client.from('fitness_logs').select('*').eq('homespace_id', homespaceId).order('log_date', { ascending: true }),
        client.from('body_logs').select('*').eq('homespace_id', homespaceId).order('log_date', { ascending: true }),
      ]);
      if (!alive) return;
      patch(s => ({ workouts: (w.data || []).map(rowToW), body: (b.data || []).map(rowToB), syncing: false, graphExercise: s.graphExercise || ((w.data || []).slice(-1)[0] || {}).exercise || '' }));
    };
    refetch();
    const ch = client.channel('fitness:' + homespaceId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fitness_logs', filter: 'homespace_id=eq.' + homespaceId }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'body_logs', filter: 'homespace_id=eq.' + homespaceId }, refetch)
      .subscribe();
    return () => { alive = false; client.removeChannel(ch); };
  }, [client, homespaceId]);

  const actions = useMemo(() => ({
    set: patch,
    setBDraft: (p) => patch(s => ({ bDraft: { ...s.bDraft, ...p } })),
    // ── workout session builder (multi-exercise) ──
    setSession: (p) => patch(s => ({ wSession: { ...s.wSession, ...p } })),
    setBlock: (i, p) => patch(s => ({ wSession: { ...s.wSession, blocks: s.wSession.blocks.map((b, k) => k === i ? { ...b, ...p } : b) } })),
    addBlock: () => patch(s => ({ wSession: { ...s.wSession, blocks: [...s.wSession.blocks, emptyWBlock((s.wSession.blocks.slice(-1)[0] || {}).unit)] }, exFocusKey: s.wSession.blocks.length })),
    removeBlock: (i) => patch(s => ({ wSession: { ...s.wSession, blocks: s.wSession.blocks.length > 1 ? s.wSession.blocks.filter((_, k) => k !== i) : s.wSession.blocks } })),
    setRow: (i, j, p) => patch(s => ({ wSession: { ...s.wSession, blocks: s.wSession.blocks.map((b, k) => k === i ? { ...b, rows: b.rows.map((r, rj) => rj === j ? { ...r, ...p } : r) } : b) } })),
    addRow: (i) => patch(s => ({ wSession: { ...s.wSession, blocks: s.wSession.blocks.map((b, k) => k === i ? { ...b, rows: [...b.rows, { weight: (b.rows.slice(-1)[0] || {}).weight || '', reps: '', drop: false }] } : b) } })),
    removeRow: (i, j) => patch(s => ({ wSession: { ...s.wSession, blocks: s.wSession.blocks.map((b, k) => k === i ? { ...b, rows: b.rows.length > 1 ? b.rows.filter((_, rj) => rj !== j) : b.rows } : b) } })),
    addSession: () => {
      const s = ref.current, sess = s.wSession, m = meRef.current || { uid: null, name: 'Me' };
      const valid = sess.blocks.filter(b => (b.ex || '').trim());
      if (!valid.length) return;
      const rows = valid.map(b => {
        const ex = b.ex.trim();
        if (b.mode === 'detail') {
          const rs = b.rows.filter(r => r.weight !== '' || r.reps !== '').map(r => ({ weight: r.weight === '' ? null : Number(r.weight), reps: r.reps === '' ? null : Number(r.reps), drop: !!r.drop }));
          const ws = rs.map(r => r.weight).filter(x => x != null);
          return { id: BE.newId(), exercise: ex, weight: ws.length ? Math.max(...ws) : null, unit: b.unit, reps: rs[0] ? rs[0].reps : null, sets: rs.length || null, setsDetail: rs.length ? rs : null, date: sess.date, byUser: m.uid, byName: m.name };
        }
        return { id: BE.newId(), exercise: ex, weight: b.weight === '' ? null : Number(b.weight), unit: b.unit, reps: b.reps === '' ? null : Number(b.reps), sets: b.sets === '' ? null : Number(b.sets), setsDetail: null, date: sess.date, byUser: m.uid, byName: m.name };
      });
      patch(st => ({ workouts: [...st.workouts, ...rows].sort((a, b) => (a.date < b.date ? -1 : 1)), wAddOpen: false, exFocusKey: null, graphExercise: st.graphExercise || rows[0].exercise, wSession: { date: today(), blocks: [emptyWBlock((sess.blocks.slice(-1)[0] || {}).unit)] } }));
      rows.forEach(w => db(client.from('fitness_logs').insert({ id: w.id, homespace_id: homespaceId, exercise: w.exercise, weight: w.weight, unit: w.unit, reps: w.reps, sets: w.sets, sets_detail: w.setsDetail, log_date: w.date, by_user: w.byUser, by_name: w.byName, pos: Date.now() })));
    },
    startEditWorkout: (id) => { const w = ref.current.workouts.find(x => x.id === id); if (!w) return; patch({ wEditId: id, wEdit: { exercise: w.exercise, weight: w.weight == null ? '' : String(w.weight), unit: w.unit, reps: w.reps == null ? '' : String(w.reps), sets: w.sets == null ? '' : String(w.sets), date: w.date } }); },
    setEdit: (p) => patch(s => ({ wEdit: { ...s.wEdit, ...p } })),
    saveEditWorkout: () => {
      const s = ref.current, e = s.wEdit, id = s.wEditId; if (!e) return; const ex = (e.exercise || '').trim(); if (!ex) return;
      const upd = { exercise: ex, weight: e.weight === '' ? null : Number(e.weight), unit: e.unit, reps: e.reps === '' ? null : Number(e.reps), sets: e.sets === '' ? null : Number(e.sets), sets_detail: null };
      patch(st => ({ wEditId: null, wEdit: null, workouts: st.workouts.map(w => w.id === id ? { ...w, exercise: ex, weight: upd.weight, unit: e.unit, reps: upd.reps, sets: upd.sets, setsDetail: null } : w) }));
      db(client.from('fitness_logs').update(upd).eq('id', id));
    },
    addBody: () => {
      const s = ref.current, d = s.bDraft, m = meRef.current || { uid: null, name: 'Me' };
      if (d.weight === '' && d.bodyFat === '' && d.muscleMass === '' && d.fatMass === '') return;
      const num = (v) => v === '' ? null : Number(v);
      const e = { id: BE.newId(), date: d.date, weight: num(d.weight), unit: d.unit, bodyFat: num(d.bodyFat), muscleMass: num(d.muscleMass), fatMass: num(d.fatMass), byUser: m.uid, byName: m.name };
      patch(st => ({ body: [...st.body, e].sort((a, b) => (a.date < b.date ? -1 : 1)), bAddOpen: false, bDraft: { weight: '', unit: d.unit, bodyFat: '', muscleMass: '', fatMass: '', date: today(), advanced: false } }));
      db(client.from('body_logs').insert({ id: e.id, homespace_id: homespaceId, log_date: e.date, weight: e.weight, unit: e.unit, body_fat: e.bodyFat, muscle_mass: e.muscleMass, fat_mass: e.fatMass, by_user: e.byUser, by_name: e.byName }));
    },
    removeWorkout: (id) => { patch(s => ({ workouts: s.workouts.filter(w => w.id !== id) })); db(client.from('fitness_logs').delete().eq('id', id)); },
    removeBody: (id) => { patch(s => ({ body: s.body.filter(b => b.id !== id) })); db(client.from('body_logs').delete().eq('id', id)); },
  }), [client, homespaceId, BE]);
  return [state, actions];
}

/* ── small UI bits ────────────────────────────────────────────────────────── */
const upper = { fontSize: 11, fontWeight: 800, color: '#aaa093', letterSpacing: '.6px', textTransform: 'uppercase' };
const closeX = { flexShrink: 0, width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#ece6db', color: '#857c70', fontSize: 17, cursor: 'pointer', lineHeight: 1 };
const fieldInput = { border: '1px solid #ece6db', background: '#fff', borderRadius: 12, padding: '12px 13px', fontSize: 15, fontFamily: 'inherit', color: '#3a352f', outline: 'none', fontWeight: 700, width: '100%' };
const modalTitle = { fontFamily: "'Quicksand',sans-serif", fontSize: 22, fontWeight: 700, margin: 0, color: '#3a352f' };
const cancelBtn = { flex: 1, background: '#fff', color: '#7a7166', border: '1px solid #e6ded2', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' };
// Top-aligned + scrollable so the on-screen keyboard never traps the fields.
function Overlay({ onClose, z = 1200, children }) { return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: z, background: 'rgba(58,53,47,.42)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px 30vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>{children}</div>; }
function Sheet({ stop, maxWidth, children }) { return <div onClick={stop} style={{ width: '100%', maxWidth, background: '#f6f4ef', borderRadius: 26, boxShadow: '0 24px 60px rgba(58,53,47,.34)', display: 'flex', flexDirection: 'column', marginTop: 'auto', marginBottom: 'auto' }}>{children}</div>; }
const focusScroll = (e) => { try { setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250); } catch (_) {} };
function Avi({ color, initial }) { return <span style={{ width: 18, height: 18, borderRadius: '50%', background: color, color: '#fff', fontWeight: 800, fontSize: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initial}</span>; }

/* ── line chart (no library) ──────────────────────────────────────────────── */
function LineChart({ series, height }) {
  height = height || 190; const W = 340, H = height, padL = 34, padB = 22, padT = 12, padR = 10;
  const pts = series.flatMap(s => s.points);
  if (pts.length < 1) return <div style={{ padding: '30px 10px', textAlign: 'center', color: '#b3a99c', fontSize: 13, fontWeight: 600 }}>Log a couple of entries to see the graph.</div>;
  const xs = pts.map(p => p.t), ys = pts.map(p => p.y);
  let minX = Math.min(...xs), maxX = Math.max(...xs); if (minX === maxX) { minX -= 86400000; maxX += 86400000; }
  let minY = Math.min(...ys), maxY = Math.max(...ys); if (minY === maxY) { minY -= 1; maxY += 1; } const padY = (maxY - minY) * 0.12; minY -= padY; maxY += padY;
  const sx = (t) => padL + (t - minX) / (maxX - minX) * (W - padL - padR);
  const sy = (y) => padT + (1 - (y - minY) / (maxY - minY)) * (H - padT - padB);
  const fmt = (v) => Math.round(v * 10) / 10;
  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#ece6db" strokeWidth="1" />
      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="#ece6db" strokeWidth="1" />
      <text x={padL - 5} y={sy(maxY) + 4} textAnchor="end" fontSize="9" fill="#b3a99c">{fmt(maxY)}</text>
      <text x={padL - 5} y={sy(minY) + 4} textAnchor="end" fontSize="9" fill="#b3a99c">{fmt(minY)}</text>
      <text x={padL} y={H - 6} textAnchor="start" fontSize="9" fill="#b3a99c">{shortDate(new Date(minX).toISOString().slice(0, 10))}</text>
      <text x={W - padR} y={H - 6} textAnchor="end" fontSize="9" fill="#b3a99c">{shortDate(new Date(maxX).toISOString().slice(0, 10))}</text>
      {series.map((s, i) => {
        const sorted = s.points.slice().sort((a, b) => a.t - b.t);
        const d = sorted.map((p, j) => (j ? 'L' : 'M') + sx(p.t).toFixed(1) + ' ' + sy(p.y).toFixed(1)).join(' ');
        return <g key={i}>{sorted.length > 1 && <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}{sorted.map((p, j) => <circle key={j} cx={sx(p.t)} cy={sy(p.y)} r="3.2" fill={s.color} />)}</g>;
      })}
    </svg>
  );
}

/* ── view-model ───────────────────────────────────────────────────────────── */
function buildView(state, actions, opts) {
  const { primary, partner, members = [] } = opts;
  const memById = {}; members.forEach(m => { memById[m.uid] = m; });
  const colorOf = (uid) => { const m = memById[uid]; if (!m) return '#9a9186'; return m.idx === 0 ? primary : m.idx === 1 ? partner : '#9a9186'; };
  const nameOf = (uid, fallback) => (memById[uid] && memById[uid].name) || fallback || 'Someone';
  const initialOf = (uid, fallback) => (nameOf(uid, fallback)[0] || '?').toUpperCase();
  const ts = (d) => { const p = String(d).split('-'); return Date.UTC(+p[0], (+p[1]) - 1, +p[2]); };

  const exercisesLogged = [...new Set(state.workouts.map(w => w.exercise))].sort();
  const ge = state.graphExercise && exercisesLogged.includes(state.graphExercise) ? state.graphExercise : (exercisesLogged[0] || '');
  // workout graph: per person, max weight per day for the selected exercise
  const wSeriesMap = {};
  state.workouts.filter(w => w.exercise === ge && maxW(w) != null).forEach(w => {
    const k = w.byUser || 'x'; wSeriesMap[k] = wSeriesMap[k] || {};
    const day = w.date; const v = maxW(w);
    if (wSeriesMap[k][day] == null || v > wSeriesMap[k][day]) wSeriesMap[k][day] = v;
  });
  const wSeries = Object.keys(wSeriesMap).map(uid => ({ name: nameOf(uid), color: colorOf(uid), points: Object.keys(wSeriesMap[uid]).map(day => ({ t: ts(day), y: wSeriesMap[uid][day] })) }));

  // body graph: per person, chosen metric over time
  const metric = state.bodyMetric; const metricField = { weight: 'weight', fat: 'bodyFat', muscle: 'muscleMass' }[metric] || 'weight';
  const bSeriesMap = {};
  state.body.forEach(b => { const v = b[metricField]; if (v == null) return; const k = b.byUser || 'x'; bSeriesMap[k] = bSeriesMap[k] || []; bSeriesMap[k].push({ t: ts(b.date), y: Number(v) }); });
  const bSeries = Object.keys(bSeriesMap).map(uid => ({ name: nameOf(uid), color: colorOf(uid), points: bSeriesMap[uid] }));

  const workoutsByDate = state.workouts.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).map(w => ({ ...w, color: colorOf(w.byUser), initial: initialOf(w.byUser, w.byName), who: nameOf(w.byUser, w.byName), summary: setsText(w), edit: () => actions.startEditWorkout(w.id), remove: () => actions.removeWorkout(w.id) }));
  const bodyByDate = state.body.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).map(b => ({ ...b, color: colorOf(b.byUser), initial: initialOf(b.byUser, b.byName), who: nameOf(b.byUser, b.byName), remove: () => actions.removeBody(b.id) }));

  // ── her-vs-you comparison ──
  const weekAgo = Date.now() - 7 * 86400000;
  const stat = {};
  members.forEach(m => { stat[m.uid] = { sets: 0, vol: 0, weekSets: 0, weekVol: 0, pr: {} }; });
  state.workouts.forEach(w => { const s = stat[w.byUser]; if (!s) return; const nSets = w.sets || (w.setsDetail ? w.setsDetail.length : 1) || 1; s.sets += nSets; const mw = maxW(w); const vol = (mw || 0) * (Number(w.reps) || 1) * nSets; s.vol += vol; if (mw != null && (s.pr[w.exercise] == null || mw > s.pr[w.exercise])) s.pr[w.exercise] = mw; if (ts(w.date) >= weekAgo) { s.weekSets += nSets; s.weekVol += vol; } });
  const latestBody = {}; state.body.forEach(b => { const c = latestBody[b.byUser]; if (!c || b.date > c.date) latestBody[b.byUser] = b; });
  const compExercises = [...new Set(state.workouts.map(w => w.exercise))].sort();
  const comparePeople = members.map(m => ({ uid: m.uid, name: nameOf(m.uid), color: colorOf(m.uid), initial: initialOf(m.uid), stat: stat[m.uid] || { sets: 0, vol: 0, weekSets: 0, weekVol: 0, pr: {} }, body: latestBody[m.uid] || null }));
  const prRows = compExercises.map(ex => { const cells = comparePeople.map(p => ({ uid: p.uid, weight: p.stat.pr[ex] != null ? p.stat.pr[ex] : null })); const best = Math.max(-1, ...cells.map(c => c.weight == null ? -1 : c.weight)); return { exercise: ex, cells: cells.map(c => ({ ...c, win: c.weight != null && c.weight === best && best > 0 })) }; });

  return {
    s: state, a: actions, primary, partner, members, stop: (e) => e.stopPropagation(),
    exercisesLogged, graphExercise: ge, wSeries, bSeries, bodyMetric: metric,
    workouts: workoutsByDate, body: bodyByDate,
    compare: { people: comparePeople, prRows },
    exSuggestions: (q) => { const t = (q || '').toLowerCase().trim(); const base = t ? EXERCISES.filter(e => e.toLowerCase().includes(t)) : EXERCISES; return base.slice(0, 8); },
  };
}

/* ── modals ───────────────────────────────────────────────────────────────── */
const numIn = { border: '1px solid #ece6db', background: '#fff', borderRadius: 10, padding: '10px 8px', fontSize: 14, fontFamily: 'inherit', color: '#3a352f', outline: 'none', fontWeight: 700, width: '100%', textAlign: 'center' };
function AddWorkout({ v, primary }) {
  if (!v.s.wAddOpen) return null;
  const sess = v.s.wSession;
  const close = () => v.a.set({ wAddOpen: false, exFocusKey: null });
  const UnitToggle = ({ b, i }) => <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid #ece6db', flexShrink: 0 }}>{UNITS.map(u => <button key={u} onClick={() => v.a.setBlock(i, { unit: u })} style={{ border: 'none', padding: '0 11px', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: b.unit === u ? primary : '#fff', color: b.unit === u ? '#fff' : '#9a9186' }}>{u}</button>)}</div>;
  return (
    <Overlay onClose={close}>
      <Sheet stop={v.stop} maxWidth={400}>
        <div style={{ padding: '20px 22px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><h2 style={modalTitle}>Log a workout</h2><button onClick={close} style={closeX}>×</button></div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sess.blocks.map((b, i) => {
            const sugg = v.exSuggestions(b.ex);
            return (
              <div key={i} style={{ border: '1px solid #ece6db', borderRadius: 16, padding: 12, background: '#fff', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
                {sess.blocks.length > 1 && <button onClick={() => v.a.removeBlock(i)} title="Remove" style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', border: 'none', background: '#f3ece1', color: '#b3a99c', fontSize: 14, cursor: 'pointer', lineHeight: 1, zIndex: 2 }}>×</button>}
                <div style={{ position: 'relative' }}>
                  <input value={b.ex} onChange={(e) => v.a.setBlock(i, { ex: e.target.value })} onFocus={(e) => { v.a.set({ exFocusKey: i }); focusScroll(e); }} placeholder="Search exercise…" style={{ ...fieldInput, fontFamily: "'Quicksand',sans-serif", fontSize: 15.5, paddingRight: 34 }} />
                  {v.s.exFocusKey === i && sugg.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 5, background: '#fff', border: '1px solid #ece6db', borderRadius: 13, boxShadow: '0 10px 26px rgba(58,53,47,.16)', zIndex: 6, maxHeight: 200, overflowY: 'auto', padding: 5 }}>
                      {sugg.map(name => <button key={name} onMouseDown={(e) => { e.preventDefault(); v.a.set({ exFocusKey: null }); v.a.setBlock(i, { ex: name }); }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '9px 11px', borderRadius: 9, fontSize: 14, fontWeight: 700, color: '#3a352f', cursor: 'pointer', fontFamily: 'inherit' }}>{name}</button>)}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <button onClick={() => v.a.setBlock(i, { mode: b.mode === 'simple' ? 'detail' : 'simple' })} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', color: '#a8794f', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                    {b.mode === 'simple' ? 'Per-set / drop set' : 'Simple'}
                  </button>
                  <UnitToggle b={b} i={i} />
                </div>
                {b.mode === 'simple' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 10, fontWeight: 800, color: '#aaa093', marginBottom: 3, textAlign: 'center' }}>SETS</div><input value={b.sets} onChange={(e) => v.a.setBlock(i, { sets: e.target.value })} onFocus={focusScroll} type="number" inputMode="numeric" placeholder="3" style={numIn} /></div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 10, fontWeight: 800, color: '#aaa093', marginBottom: 3, textAlign: 'center' }}>REPS</div><input value={b.reps} onChange={(e) => v.a.setBlock(i, { reps: e.target.value })} onFocus={focusScroll} type="number" inputMode="numeric" placeholder="8" style={numIn} /></div>
                    <div style={{ flex: 1.2 }}><div style={{ fontSize: 10, fontWeight: 800, color: '#aaa093', marginBottom: 3, textAlign: 'center' }}>WEIGHT</div><input value={b.weight} onChange={(e) => v.a.setBlock(i, { weight: e.target.value })} onFocus={focusScroll} type="number" inputMode="decimal" placeholder="60" style={numIn} /></div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {b.rows.map((r, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#b3a99c', width: 16 }}>{j + 1}</span>
                        <input value={r.weight} onChange={(e) => v.a.setRow(i, j, { weight: e.target.value })} onFocus={focusScroll} type="number" inputMode="decimal" placeholder="kg" style={{ ...numIn, flex: 1 }} />
                        <span style={{ color: '#c3bbae', fontWeight: 800 }}>×</span>
                        <input value={r.reps} onChange={(e) => v.a.setRow(i, j, { reps: e.target.value })} onFocus={focusScroll} type="number" inputMode="numeric" placeholder="reps" style={{ ...numIn, flex: 1 }} />
                        <button onClick={() => v.a.setRow(i, j, { drop: !r.drop })} title="Drop set" style={{ border: 'none', borderRadius: 8, padding: '7px 9px', fontWeight: 800, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', background: r.drop ? '#cf6a52' : '#f3ece1', color: r.drop ? '#fff' : '#a89e90', flexShrink: 0 }}>drop</button>
                        {b.rows.length > 1 && <button onClick={() => v.a.removeRow(i, j)} style={{ border: 'none', background: 'none', color: '#cbb9a2', fontSize: 16, cursor: 'pointer', padding: '0 2px' }}>×</button>}
                      </div>
                    ))}
                    <button onClick={() => v.a.addRow(i)} style={{ alignSelf: 'flex-start', border: '1px dashed #d9cbb7', background: 'none', color: '#a8794f', borderRadius: 9, padding: '6px 12px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add set</button>
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={v.a.addBlock} style={{ border: '1px dashed #cbb9a2', background: 'transparent', color: '#a8794f', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add another exercise</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ ...upper, flexShrink: 0 }}>Date</span><input value={sess.date} onChange={(e) => v.a.setSession({ date: e.target.value })} type="date" style={{ ...fieldInput, flex: 1 }} /></div>
        </div>
        <div style={{ padding: '14px 18px 20px', display: 'flex', gap: 10 }}><button onClick={close} style={cancelBtn}>Cancel</button><button onClick={v.a.addSession} style={{ flex: 2, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>Save workout</button></div>
      </Sheet>
    </Overlay>
  );
}
function EditWorkout({ v, primary }) {
  if (!v.s.wEdit) return null;
  const e = v.s.wEdit; const close = () => v.a.set({ wEditId: null, wEdit: null });
  return (
    <Overlay onClose={close} z={1250}>
      <Sheet stop={v.stop} maxWidth={380}>
        <div style={{ padding: '20px 22px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><h2 style={modalTitle}>Edit set</h2><button onClick={close} style={closeX}>×</button></div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input value={e.exercise} onChange={(ev) => v.a.setEdit({ exercise: ev.target.value })} onFocus={focusScroll} placeholder="Exercise" style={{ ...fieldInput, fontFamily: "'Quicksand',sans-serif", fontSize: 16 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 10, fontWeight: 800, color: '#aaa093', marginBottom: 3, textAlign: 'center' }}>SETS</div><input value={e.sets} onChange={(ev) => v.a.setEdit({ sets: ev.target.value })} onFocus={focusScroll} type="number" style={numIn} /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 10, fontWeight: 800, color: '#aaa093', marginBottom: 3, textAlign: 'center' }}>REPS</div><input value={e.reps} onChange={(ev) => v.a.setEdit({ reps: ev.target.value })} onFocus={focusScroll} type="number" style={numIn} /></div>
            <div style={{ flex: 1.2 }}><div style={{ fontSize: 10, fontWeight: 800, color: '#aaa093', marginBottom: 3, textAlign: 'center' }}>WEIGHT</div><input value={e.weight} onChange={(ev) => v.a.setEdit({ weight: ev.target.value })} onFocus={focusScroll} type="number" style={numIn} /></div>
            <div><div style={{ fontSize: 10, fontWeight: 800, color: '#aaa093', marginBottom: 3, textAlign: 'center' }}>UNIT</div><div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid #ece6db' }}>{UNITS.map(u => <button key={u} onClick={() => v.a.setEdit({ unit: u })} style={{ border: 'none', padding: '8px 9px', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: e.unit === u ? primary : '#fff', color: e.unit === u ? '#fff' : '#9a9186' }}>{u}</button>)}</div></div>
          </div>
          <input value={e.date} onChange={(ev) => v.a.setEdit({ date: ev.target.value })} type="date" style={fieldInput} />
        </div>
        <div style={{ padding: '14px 22px 20px', display: 'flex', gap: 10 }}>
          <button onClick={() => { v.a.removeWorkout(v.s.wEditId); close(); }} style={{ flex: 1, background: '#f6ece9', color: '#b07a6e', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
          <button onClick={v.a.saveEditWorkout} style={{ flex: 2, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
        </div>
      </Sheet>
    </Overlay>
  );
}
function AddBody({ v, primary }) {
  if (!v.s.bAddOpen) return null;
  const d = v.s.bDraft;
  return (
    <Overlay onClose={() => v.a.set({ bAddOpen: false })}>
      <Sheet stop={v.stop} maxWidth={380}>
        <div style={{ padding: '22px 22px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><h2 style={modalTitle}>Log body stats</h2><button onClick={() => v.a.set({ bAddOpen: false })} style={closeX}>×</button></div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={d.weight} onChange={(e) => v.a.setBDraft({ weight: e.target.value })} type="number" inputMode="decimal" placeholder="Weight" autoFocus style={{ ...fieldInput, flex: 1 }} />
            <div style={{ display: 'flex', borderRadius: 12, overflow: 'hidden', border: '1px solid #ece6db' }}>{UNITS.map(u => <button key={u} onClick={() => v.a.setBDraft({ unit: u })} style={{ border: 'none', padding: '0 14px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', background: d.unit === u ? primary : '#fff', color: d.unit === u ? '#fff' : '#9a9186' }}>{u}</button>)}</div>
          </div>
          <input value={d.date} onChange={(e) => v.a.setBDraft({ date: e.target.value })} type="date" style={fieldInput} />
          <button onClick={() => v.a.setBDraft({ advanced: !d.advanced })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px', color: '#a8794f', fontWeight: 800, fontSize: 13 }}>
            <span>Advanced — fat & muscle</span><FI.Chevron size={16} open={d.advanced} />
          </button>
          {d.advanced && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={d.bodyFat} onChange={(e) => v.a.setBDraft({ bodyFat: e.target.value })} type="number" inputMode="decimal" placeholder="Body fat %" style={fieldInput} />
              <input value={d.muscleMass} onChange={(e) => v.a.setBDraft({ muscleMass: e.target.value })} type="number" inputMode="decimal" placeholder={'Muscle mass (' + d.unit + ')'} style={fieldInput} />
              <input value={d.fatMass} onChange={(e) => v.a.setBDraft({ fatMass: e.target.value })} type="number" inputMode="decimal" placeholder={'Fat mass (' + d.unit + ')'} style={fieldInput} />
            </div>
          )}
        </div>
        <div style={{ padding: '16px 22px 22px', display: 'flex', gap: 10 }}><button onClick={() => v.a.set({ bAddOpen: false })} style={cancelBtn}>Cancel</button><button onClick={v.a.addBody} style={{ flex: 2, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button></div>
      </Sheet>
    </Overlay>
  );
}

/* ── board ────────────────────────────────────────────────────────────────── */
function Brand({ titleSize, subSize, dot }) {
  return (<a href="../" title="Back to Together" style={{ display: 'flex', flexDirection: 'column', gap: 5, textDecoration: 'none', color: 'inherit' }}><div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}><FI.Logo size={dot} /></div><h1 style={{ fontFamily: "'Quicksand',sans-serif", fontSize: titleSize, fontWeight: 700, margin: 0, color: '#3a352f', letterSpacing: '.3px' }}>Fitness</h1><p style={{ margin: 0, fontSize: subSize, color: '#9a9186', fontWeight: 600 }}>Train & track · Together</p></a>);
}
function useIsDesktop(bp = 720) { const get = () => typeof window !== 'undefined' && window.innerWidth >= bp; const [d, setD] = useState(get); useEffect(() => { const on = () => setD(get()); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []); return d; }
const card = { background: '#fff', borderRadius: 18, padding: 16, boxShadow: '0 1px 2px rgba(58,53,47,.05),0 6px 16px rgba(58,53,47,.035)' };
const selStyle = { border: '1px solid #ece6db', background: '#fff', borderRadius: 10, padding: '7px 26px 7px 11px', fontSize: 13, fontFamily: 'inherit', color: '#3a352f', fontWeight: 700, outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' };

function CompareSection({ v }) {
  const people = v.compare.people, rows = v.compare.prRows;
  const fmt = (n) => Math.round(n * 10) / 10;
  const Big = ({ p }) => (
    <div style={{ flex: 1, minWidth: 0, textAlign: 'center', background: '#faf8f4', borderRadius: 14, padding: '12px 8px' }}>
      <span style={{ width: 30, height: 30, borderRadius: '50%', background: p.color, color: '#fff', fontWeight: 800, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>{p.initial}</span>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#3a352f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: p.color, fontFamily: "'Quicksand',sans-serif", marginTop: 4 }}>{p.stat.weekSets}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9a9186' }}>sets this week</div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#9a9186', marginTop: 4 }}>{fmt(p.stat.weekVol)} vol · {p.stat.sets} all-time</div>
    </div>
  );
  return (
    <Fragment>
      <div style={card}>
        <span style={upper}>This week</span>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>{people.map(p => <Big key={p.uid} p={p} />)}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <span style={upper}>Personal records — heaviest 🏆</span>
        {rows.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#b3a99c', fontWeight: 600, fontSize: 14, padding: '24px 10px' }}>Log some sets to compare PRs.</div>}
        {rows.map(r => (
          <div key={r.exercise} style={{ ...card, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: '#3a352f' }}>{r.exercise}</span>
            <div style={{ display: 'flex', gap: 7 }}>
              {r.cells.map(c => { const p = people.find(x => x.uid === c.uid) || {}; return (
                <span key={c.uid} title={p.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 800, color: c.win ? '#fff' : (c.weight == null ? '#c3bbae' : '#7a7166'), background: c.win ? (p.color || '#6f9c5a') : '#f2ece2', padding: '4px 9px', borderRadius: 9 }}>{c.win && '🏆'}<span style={{ width: 7, height: 7, borderRadius: '50%', background: c.win ? 'rgba(255,255,255,.8)' : (p.color || '#ccc') }} />{c.weight == null ? '–' : fmt(c.weight)}</span>
              ); })}
            </div>
          </div>
        ))}
      </div>
      <div style={card}>
        <span style={upper}>Body now</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {people.map(p => (
            <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: p.color, color: '#fff', fontWeight: 800, fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{p.initial}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#3a352f', flex: 1 }}>{p.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: p.body ? '#7a7166' : '#c3bbae' }}>{p.body ? ([p.body.weight != null ? p.body.weight + ' ' + p.body.unit : null, p.body.bodyFat != null ? 'fat ' + p.body.bodyFat + '%' : null, p.body.muscleMass != null ? 'musc ' + p.body.muscleMass : null].filter(Boolean).join(' · ') || '—') : 'no entry yet'}</span>
            </div>
          ))}
        </div>
      </div>
    </Fragment>
  );
}

function Board({ v, isDesktop, primary, partner }) {
  const tab = v.s.tab;
  const addBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: isDesktop ? '12px 22px' : 14, fontWeight: 800, fontSize: isDesktop ? 14.5 : 15, cursor: 'pointer', fontFamily: 'inherit', width: isDesktop ? 'auto' : '100%' };
  const TabBtn = ({ id, label }) => <button onClick={() => v.a.set({ tab: id })} style={{ flex: 1, padding: '9px 8px', borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 13.5, background: tab === id ? '#fff' : 'transparent', color: tab === id ? '#3a352f' : '#9a9186', boxShadow: tab === id ? '0 1px 2px rgba(58,53,47,.06)' : 'none' }}>{label}</button>;
  const legend = (series) => series.length > 1 && <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>{series.map((s, i) => <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#7a7166' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />{s.name}</span>)}</div>;

  return (
    <div style={{ padding: isDesktop ? '38px 44px 46px' : '28px 18px 40px', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 640, margin: '0 auto' }}>
      {isDesktop
        ? <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}><Brand titleSize={34} subSize={15} dot={20} />{tab !== 'compare' && <button onClick={() => v.a.set(tab === 'workouts' ? { wAddOpen: true } : { bAddOpen: true })} style={addBtn}><FI.Plus size={17} />{tab === 'workouts' ? 'Log a set' : 'Log body stats'}</button>}</div>
        : <Fragment><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}><Brand titleSize={30} subSize={13.5} dot={18} /></div></Fragment>}

      <div style={{ display: 'flex', gap: 4, background: '#ece6db', borderRadius: 13, padding: 4 }}><TabBtn id="workouts" label="🏋️ Workouts" /><TabBtn id="body" label="📊 Body" /><TabBtn id="compare" label="🏆 Compare" /></div>
      {!isDesktop && tab !== 'compare' && <button onClick={() => v.a.set(tab === 'workouts' ? { wAddOpen: true } : { bAddOpen: true })} style={addBtn}><FI.Plus size={16} />{tab === 'workouts' ? 'Log a set' : 'Log body stats'}</button>}

      {tab === 'compare' ? <CompareSection v={v} /> : tab === 'workouts' ? (
        <Fragment>
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
              <span style={upper}>Progress</span>
              {v.exercisesLogged.length > 0 && <div style={{ position: 'relative' }}><select value={v.graphExercise} onChange={(e) => v.a.set({ graphExercise: e.target.value })} style={selStyle}>{v.exercisesLogged.map(e => <option key={e} value={e}>{e}</option>)}</select><span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#b3a99c' }}><FI.Chevron size={12} /></span></div>}
            </div>
            <LineChart series={v.wSeries} />
            {legend(v.wSeries)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span style={upper}>{v.workouts.length} set{v.workouts.length === 1 ? '' : 's'}</span>
            {v.workouts.map(w => (
              <div key={w.id} onClick={w.edit} style={{ ...card, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#3a352f', fontFamily: "'Quicksand',sans-serif" }}>{w.exercise}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#7a7166', marginTop: 2 }}>{w.summary}</div>
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#9a9186' }}><Avi color={w.color} initial={w.initial} />{shortDate(w.date)}</span>
                <button onClick={(ev) => { ev.stopPropagation(); w.remove(); }} title="Delete" style={{ border: 'none', background: 'none', color: '#cbb9a2', cursor: 'pointer', padding: 4, lineHeight: 0 }}><FI.Trash size={16} /></button>
              </div>
            ))}
            {!v.s.syncing && v.workouts.length === 0 && <div style={{ textAlign: 'center', padding: '30px 10px', color: '#b3a99c', fontWeight: 600, fontSize: 14 }}>No sets yet — tap “Log a set”.</div>}
          </div>
        </Fragment>
      ) : (
        <Fragment>
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
              <span style={upper}>Trend</span>
              <div style={{ position: 'relative' }}><select value={v.bodyMetric} onChange={(e) => v.a.set({ bodyMetric: e.target.value })} style={selStyle}><option value="weight">Weight</option><option value="fat">Body fat %</option><option value="muscle">Muscle mass</option></select><span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#b3a99c' }}><FI.Chevron size={12} /></span></div>
            </div>
            <LineChart series={v.bSeries} />
            {legend(v.bSeries)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span style={upper}>{v.body.length} entr{v.body.length === 1 ? 'y' : 'ies'}</span>
            {v.body.map(b => (
              <div key={b.id} style={{ ...card, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#3a352f' }}>{b.weight != null ? b.weight + ' ' + b.unit : '—'}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#7a7166', marginTop: 2 }}>{[b.bodyFat != null ? 'fat ' + b.bodyFat + '%' : null, b.muscleMass != null ? 'muscle ' + b.muscleMass : null].filter(Boolean).join(' · ') || ' '}</div>
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#9a9186' }}><Avi color={b.color} initial={b.initial} />{shortDate(b.date)}</span>
                <button onClick={b.remove} title="Delete" style={{ border: 'none', background: 'none', color: '#cbb9a2', cursor: 'pointer', padding: 4, lineHeight: 0 }}><FI.Trash size={16} /></button>
              </div>
            ))}
            {!v.s.syncing && v.body.length === 0 && <div style={{ textAlign: 'center', padding: '30px 10px', color: '#b3a99c', fontWeight: 600, fontSize: 14 }}>No entries yet — tap “Log body stats”.</div>}
          </div>
        </Fragment>
      )}
    </div>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{ "primaryColor": "#c98a5c", "partnerColor": "#8a9b6e" }/*EDITMODE-END*/;
function App() {
  const sx = window.useTogetherSession();
  const { SignIn, Splash } = window.TogetherAccount;
  if (!sx.ready) return <Splash text="…" />;
  if (!sx.session) return <SignIn onGoogle={sx.actions.signInGoogle} />;
  if (!sx.homespaceId) return <Splash text={sx.error ? ('Error: ' + sx.error) : 'Setting up…'} />;
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
  const [state, actions] = useFitnessStore(sx.homespaceId, sx.me);
  const v = buildView(state, actions, { primary, partner, members: sx.members });
  return (
    <div className="app">
      <div className="app-shell"><Board v={v} isDesktop={isDesktop} primary={primary} partner={partner} /></div>
      <HomeButton href="../" />
      <AccountButton sx={sx} onOpen={() => setAccountOpen(true)} />
      {accountOpen && <AccountSheet sx={sx} onClose={() => setAccountOpen(false)} />}
      <AddWorkout v={v} primary={primary} /><EditWorkout v={v} primary={primary} /><AddBody v={v} primary={primary} />
      <TweaksPanel title="Tweaks"><TweakSection label="People"><TweakColor label="Primary" value={tweaks.primaryColor} onChange={(c) => setTweak('primaryColor', c)} options={['#c98a5c', '#d97757', '#cf6a52', '#b07d42']} /><TweakColor label="Partner" value={tweaks.partnerColor} onChange={(c) => setTweak('partnerColor', c)} options={['#8a9b6e', '#6f8050', '#5e827b', '#7e6f86']} /></TweakSection></TweaksPanel>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
