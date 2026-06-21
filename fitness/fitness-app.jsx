// fitness-app.jsx — Together "Shared Fitness".
// Two logs in one shared space: Workouts (exercise sets — searchable exercise,
// weight + unit + reps + date) and Body (weight + collapsible fat/muscle stats).
// Each tab has a line graph; entries are colour-coded per person. Reuses the kit.

const { useState, useRef, useMemo, useEffect, Fragment } = React;
const FI = window.Icons;

const UNITS = ['kg', 'lb'];
const REACT_EMOJIS = ['👏', '🔥', '💪', '❤️', '😮', '👑'];
const EXERCISES = [
  'Bench Press', 'Incline Bench Press', 'Dumbbell Press', 'Chest Fly', 'Push-up', 'Cable Crossover',
  'Deadlift', 'Romanian Deadlift', 'Pull-up', 'Lat Pulldown', 'Barbell Row', 'Seated Row', 'Face Pull',
  'Squat', 'Front Squat', 'Leg Press', 'Lunge', 'Leg Curl', 'Leg Extension', 'Calf Raise', 'Hip Thrust', 'Glute Bridge',
  'Overhead Press', 'Lateral Raise', 'Front Raise', 'Arnold Press', 'Shrug',
  'Bicep Curl', 'Hammer Curl', 'Preacher Curl', 'Tricep Extension', 'Tricep Pushdown', 'Dip',
  'Plank', 'Crunch', 'Leg Raise', 'Russian Twist', 'Cable Crunch',
  'Treadmill', 'Cycling', 'Rowing', 'Elliptical',
];
const STARTERS = [
  { name: 'Full Body', exercises: [{ ex: 'Squat', sets: 3, reps: 8 }, { ex: 'Bench Press', sets: 3, reps: 8 }, { ex: 'Barbell Row', sets: 3, reps: 8 }, { ex: 'Overhead Press', sets: 3, reps: 10 }, { ex: 'Deadlift', sets: 1, reps: 5 }] },
  { name: 'Upper', exercises: [{ ex: 'Bench Press', sets: 4, reps: 6 }, { ex: 'Barbell Row', sets: 4, reps: 6 }, { ex: 'Overhead Press', sets: 3, reps: 8 }, { ex: 'Lat Pulldown', sets: 3, reps: 10 }, { ex: 'Bicep Curl', sets: 3, reps: 12 }, { ex: 'Tricep Pushdown', sets: 3, reps: 12 }] },
  { name: 'Lower', exercises: [{ ex: 'Squat', sets: 4, reps: 6 }, { ex: 'Romanian Deadlift', sets: 3, reps: 8 }, { ex: 'Leg Press', sets: 3, reps: 10 }, { ex: 'Leg Curl', sets: 3, reps: 12 }, { ex: 'Calf Raise', sets: 4, reps: 15 }] },
  { name: 'Push', exercises: [{ ex: 'Bench Press', sets: 4, reps: 6 }, { ex: 'Overhead Press', sets: 3, reps: 8 }, { ex: 'Incline Bench Press', sets: 3, reps: 10 }, { ex: 'Lateral Raise', sets: 3, reps: 15 }, { ex: 'Tricep Pushdown', sets: 3, reps: 12 }] },
  { name: 'Pull', exercises: [{ ex: 'Deadlift', sets: 3, reps: 5 }, { ex: 'Pull-up', sets: 3, reps: 8 }, { ex: 'Barbell Row', sets: 3, reps: 8 }, { ex: 'Lat Pulldown', sets: 3, reps: 12 }, { ex: 'Bicep Curl', sets: 3, reps: 12 }] },
  { name: 'Legs', exercises: [{ ex: 'Squat', sets: 4, reps: 6 }, { ex: 'Leg Press', sets: 3, reps: 10 }, { ex: 'Lunge', sets: 3, reps: 10 }, { ex: 'Leg Curl', sets: 3, reps: 12 }, { ex: 'Calf Raise', sets: 4, reps: 15 }] },
];
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const shortDate = (s) => { if (!s) return ''; const p = String(s).split('-'); return p.length === 3 ? (Number(p[1]) + '/' + Number(p[2])) : s; };

const rowToW = (r) => ({ id: r.id, exercise: r.exercise, weight: r.weight, unit: r.unit || 'kg', reps: r.reps, sets: r.sets, setsDetail: r.sets_detail || null, date: r.log_date, byUser: r.by_user, byName: r.by_name });
const rowToB = (r) => ({ id: r.id, date: r.log_date, weight: r.weight, unit: r.unit || 'kg', bodyFat: r.body_fat, muscleMass: r.muscle_mass, fatMass: r.fat_mass, byUser: r.by_user, byName: r.by_name });
const rowToRoutine = (r) => ({ id: r.id, name: r.name, exercises: Array.isArray(r.exercises) ? r.exercises : [], byUser: r.by_user, byName: r.by_name });
const emptyRRow = (unit) => ({ ex: '', sets: '', reps: '', weight: '', unit: unit || 'kg' });
// heaviest weight in an entry (handles per-set detail / drop sets)
const maxW = (w) => { if (w.setsDetail && w.setsDetail.length) { const ws = w.setsDetail.map(s => Number(s.weight)).filter(x => !isNaN(x)); return ws.length ? Math.max(...ws) : null; } return w.weight != null ? Number(w.weight) : null; };
const emptyWBlock = (unit) => ({ ex: '', unit: unit || 'kg', mode: 'simple', sets: '', reps: '', weight: '', rows: [{ weight: '', reps: '', drop: false }] });
// estimated 1-rep-max (Epley) — best set in an entry
const e1rmOf = (w) => {
  const calc = (wt, rp) => { const n = Number(wt); if (isNaN(n)) return null; const r = Number(rp); return n * (1 + (isNaN(r) ? 0 : r) / 30); };
  if (w.setsDetail && w.setsDetail.length) { let best = null; w.setsDetail.forEach(s => { const e = calc(s.weight, s.reps); if (e != null && (best == null || e > best)) best = e; }); return best; }
  return calc(maxW(w), w.reps);
};
const round1 = (n) => Math.round(n * 10) / 10;
// plate calculator — weights per side given a barbell
const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25], PLATES_LB = [45, 35, 25, 10, 5, 2.5];
const platesText = (total, unit) => {
  const bar = unit === 'lb' ? 45 : 20; let perSide = (Number(total) - bar) / 2;
  if (isNaN(perSide) || perSide <= 0) return null;
  const out = []; (unit === 'lb' ? PLATES_LB : PLATES_KG).forEach(p => { while (perSide + 1e-6 >= p) { out.push(p); perSide -= p; } });
  if (perSide > 0.02 || !out.length) return null;
  return out.join(' + ');
};
let _actx = null;
const beep = () => { try { _actx = _actx || new (window.AudioContext || window.webkitAudioContext)(); const o = _actx.createOscillator(), g = _actx.createGain(); o.connect(g); g.connect(_actx.destination); o.frequency.value = 880; g.gain.value = 0.07; o.start(); setTimeout(() => { o.frequency.value = 1100; }, 90); setTimeout(() => o.stop(), 200); } catch (e) {} };
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
    tab: 'workouts', workouts: [], body: [], routines: [], reactions: [], syncing: true,
    routineModal: false, routineEdit: null, reactOpen: null, rest: null,
    wAddOpen: false, wSession: { date: today(), blocks: [emptyWBlock('kg')] }, exFocusKey: null,
    wEditId: null, wEdit: null, prToast: null,
    bAddOpen: false, bDraft: { weight: '', unit: 'kg', bodyFat: '', muscleMass: '', fatMass: '', date: today(), advanced: false },
    graphExercise: '', bodyMetric: 'weight', workoutMetric: 'weight', exLib: [],
  }));
  const patch = (p) => setState(s => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
  const ref = useRef(state); ref.current = state;
  const meRef = useRef(me); meRef.current = me;
  const db = (p) => { Promise.resolve(p).then(r => { if (r && r.error) console.warn('[togetherkit/fitness]', r.error.message); }, e => console.warn('[togetherkit/fitness]', e)); };

  // lazy-load the bundled exercise library (873 exercises) once
  useEffect(() => {
    let alive = true;
    fetch('exercises.json').then(r => r.json()).then(data => { if (!alive) return; patch({ exLib: (data || []).map(x => ({ name: x.n, muscles: x.m || [], sub: [(x.m || [])[0], x.e].filter(Boolean).join(' · ') })) }); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!homespaceId) return; let alive = true; patch({ syncing: true });
    const refetch = async () => {
      const [w, b, rt, rx] = await Promise.all([
        client.from('fitness_logs').select('*').eq('homespace_id', homespaceId).order('log_date', { ascending: true }),
        client.from('body_logs').select('*').eq('homespace_id', homespaceId).order('log_date', { ascending: true }),
        client.from('fitness_routines').select('*').eq('homespace_id', homespaceId).order('pos', { ascending: true }),
        client.from('fitness_reactions').select('*').eq('homespace_id', homespaceId),
      ]);
      if (!alive) return;
      patch(s => ({ workouts: (w.data || []).map(rowToW), body: (b.data || []).map(rowToB), routines: (rt.data || []).map(rowToRoutine), reactions: (rx.data || []).map(r => ({ logId: r.log_id, userId: r.user_id, emoji: r.emoji, byName: r.by_name })), syncing: false, graphExercise: s.graphExercise || ((w.data || []).slice(-1)[0] || {}).exercise || '' }));
    };
    refetch();
    const ch = client.channel('fitness:' + homespaceId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fitness_logs', filter: 'homespace_id=eq.' + homespaceId }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'body_logs', filter: 'homespace_id=eq.' + homespaceId }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fitness_routines', filter: 'homespace_id=eq.' + homespaceId }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fitness_reactions', filter: 'homespace_id=eq.' + homespaceId }, refetch)
      .subscribe();
    return () => { alive = false; client.removeChannel(ch); };
  }, [client, homespaceId]);

  const actions = useMemo(() => ({
    set: patch,
    startRest: (sec) => patch({ rest: { endsAt: Date.now() + sec * 1000, total: sec } }),
    addRest: (sec) => patch(s => ({ rest: s.rest ? { ...s.rest, endsAt: s.rest.endsAt + sec * 1000, total: s.rest.total + sec } : { endsAt: Date.now() + sec * 1000, total: sec } })),
    stopRest: () => patch({ rest: null }),
    setBDraft: (p) => patch(s => ({ bDraft: { ...s.bDraft, ...p } })),
    // ── workout session builder (multi-exercise) ──
    setSession: (p) => patch(s => ({ wSession: { ...s.wSession, ...p } })),
    setBlock: (i, p) => patch(s => ({ wSession: { ...s.wSession, blocks: s.wSession.blocks.map((b, k) => k === i ? { ...b, ...p } : b) } })),
    // pick an exercise + prefill from the user's last session of it (if the block is empty)
    pickExercise: (i, name) => {
      const s = ref.current, m = meRef.current || {};
      const mine = s.workouts.filter(w => w.byUser === m.uid && w.exercise === name);
      const last = mine.length ? mine.reduce((a, w) => (w.date > a.date ? w : a), mine[0]) : null;
      patch(st => ({ exFocusKey: null, wSession: { ...st.wSession, blocks: st.wSession.blocks.map((b, k) => {
        if (k !== i) return b;
        const nb = { ...b, ex: name };
        if (last && b.mode === 'simple' && b.weight === '' && b.reps === '' && b.sets === '') { nb.weight = last.weight == null ? '' : String(last.weight); nb.reps = last.reps == null ? '' : String(last.reps); nb.sets = last.sets == null ? '' : String(last.sets); nb.unit = last.unit || b.unit; }
        return nb;
      }) } }));
    },
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
      // detect new personal records (heaviest ever for me on that exercise)
      const myPrev = {}; s.workouts.filter(w => w.byUser === m.uid).forEach(w => { const mw = maxW(w); if (mw == null) return; if (myPrev[w.exercise] == null || mw > myPrev[w.exercise]) myPrev[w.exercise] = mw; });
      const prHits = [];
      rows.forEach(w => { const mw = maxW(w); if (mw != null && (myPrev[w.exercise] == null || mw > myPrev[w.exercise])) { prHits.push(w.exercise + ' ' + mw + w.unit); myPrev[w.exercise] = mw; } });
      const toast = prHits.length ? ('🏆 New PR! ' + prHits.join(' · ')) : null;
      patch(st => ({ workouts: [...st.workouts, ...rows].sort((a, b) => (a.date < b.date ? -1 : 1)), wAddOpen: false, exFocusKey: null, prToast: toast, graphExercise: st.graphExercise || rows[0].exercise, wSession: { date: today(), blocks: [emptyWBlock((sess.blocks.slice(-1)[0] || {}).unit)] } }));
      if (toast) setTimeout(() => patch({ prToast: null }), 4000);
      rows.forEach(w => db(client.from('fitness_logs').insert({ id: w.id, homespace_id: homespaceId, exercise: w.exercise, weight: w.weight, unit: w.unit, reps: w.reps, sets: w.sets, sets_detail: w.setsDetail, log_date: w.date, by_user: w.byUser, by_name: w.byName, pos: Date.now() })));
    },
    repeatLast: () => {
      const s = ref.current, m = meRef.current || { uid: null };
      const mine = s.workouts.filter(w => w.byUser === m.uid);
      if (!mine.length) return;
      const lastDate = mine.reduce((a, w) => (w.date > a ? w.date : a), mine[0].date);
      const blocks = mine.filter(w => w.date === lastDate).map(w => (w.setsDetail && w.setsDetail.length)
        ? { ex: w.exercise, unit: w.unit, mode: 'detail', sets: '', reps: '', weight: '', rows: w.setsDetail.map(r => ({ weight: r.weight == null ? '' : String(r.weight), reps: r.reps == null ? '' : String(r.reps), drop: !!r.drop })) }
        : { ex: w.exercise, unit: w.unit, mode: 'simple', sets: w.sets == null ? '' : String(w.sets), reps: w.reps == null ? '' : String(w.reps), weight: w.weight == null ? '' : String(w.weight), rows: [{ weight: '', reps: '', drop: false }] });
      patch({ wSession: { date: today(), blocks: blocks.length ? blocks : [emptyWBlock('kg')] }, wAddOpen: true, exFocusKey: null });
    },
    // ── routines / templates ──
    newRoutine: () => patch({ routineEdit: { id: null, name: '', rows: [emptyRRow('kg')] } }),
    editRoutine: (id) => { const r = ref.current.routines.find(x => x.id === id); if (!r) return; patch({ routineEdit: { id, name: r.name, rows: r.exercises.length ? r.exercises.map(e => ({ ex: e.ex || e.exercise || '', sets: e.sets == null ? '' : String(e.sets), reps: e.reps == null ? '' : String(e.reps), weight: e.weight == null ? '' : String(e.weight), unit: e.unit || 'kg' })) : [emptyRRow('kg')] } }); },
    setRoutineEdit: (p) => patch(s => ({ routineEdit: { ...s.routineEdit, ...p } })),
    routineRowSet: (j, p) => patch(s => ({ routineEdit: { ...s.routineEdit, rows: s.routineEdit.rows.map((r, k) => k === j ? { ...r, ...p } : r) } })),
    routineRowAdd: () => patch(s => ({ routineEdit: { ...s.routineEdit, rows: [...s.routineEdit.rows, emptyRRow((s.routineEdit.rows.slice(-1)[0] || {}).unit)] } })),
    routineRowRemove: (j) => patch(s => ({ routineEdit: { ...s.routineEdit, rows: s.routineEdit.rows.length > 1 ? s.routineEdit.rows.filter((_, k) => k !== j) : s.routineEdit.rows } })),
    saveRoutine: () => {
      const s = ref.current, re = s.routineEdit, m = meRef.current || {}; if (!re) return;
      const name = (re.name || '').trim() || 'Routine';
      const exercises = re.rows.filter(r => (r.ex || '').trim()).map(r => ({ ex: r.ex.trim(), sets: r.sets === '' ? null : Number(r.sets), reps: r.reps === '' ? null : Number(r.reps), weight: r.weight === '' ? null : Number(r.weight), unit: r.unit }));
      if (!exercises.length) { patch({ routineEdit: null }); return; }
      const id = re.id || BE.newId();
      patch(st => ({ routineEdit: null, routines: re.id ? st.routines.map(x => x.id === id ? { ...x, name, exercises } : x) : [...st.routines, { id, name, exercises, byUser: m.uid, byName: m.name }] }));
      if (re.id) db(client.from('fitness_routines').update({ name, exercises }).eq('id', id));
      else db(client.from('fitness_routines').insert({ id, homespace_id: homespaceId, name, exercises, by_user: m.uid, by_name: m.name, pos: Date.now() }));
    },
    deleteRoutine: (id) => { patch(s => ({ routines: s.routines.filter(r => r.id !== id) })); db(client.from('fitness_routines').delete().eq('id', id)); },
    useStarter: (st) => { const m = meRef.current || {}; const id = BE.newId(); const exercises = st.exercises.map(e => ({ ex: e.ex, sets: e.sets, reps: e.reps, weight: null, unit: 'kg' })); patch(s => ({ routines: [...s.routines, { id, name: st.name, exercises, byUser: m.uid, byName: m.name }] })); db(client.from('fitness_routines').insert({ id, homespace_id: homespaceId, name: st.name, exercises, by_user: m.uid, by_name: m.name, pos: Date.now() })); },
    startRoutine: (id) => {
      const r = ref.current.routines.find(x => x.id === id); if (!r) return;
      const blocks = r.exercises.map(e => ({ ex: e.ex || e.exercise || '', unit: e.unit || 'kg', mode: 'simple', sets: e.sets == null ? '' : String(e.sets), reps: e.reps == null ? '' : String(e.reps), weight: e.weight == null ? '' : String(e.weight), rows: [{ weight: '', reps: '', drop: false }] }));
      patch({ wSession: { date: today(), blocks: blocks.length ? blocks : [emptyWBlock('kg')] }, wAddOpen: true, routineModal: false, exFocusKey: null });
    },
    saveSessionAsRoutine: () => {
      const s = ref.current, sess = s.wSession, m = meRef.current || {};
      const blocks = sess.blocks.filter(b => (b.ex || '').trim()); if (!blocks.length) return;
      const name = (window.prompt('Name this routine') || '').trim(); if (!name) return;
      const exercises = blocks.map(b => ({ ex: b.ex.trim(), sets: b.sets === '' ? null : Number(b.sets), reps: b.reps === '' ? null : Number(b.reps), weight: b.weight === '' ? null : Number(b.weight), unit: b.unit }));
      const id = BE.newId();
      patch(st => ({ routines: [...st.routines, { id, name, exercises, byUser: m.uid, byName: m.name }] }));
      db(client.from('fitness_routines').insert({ id, homespace_id: homespaceId, name, exercises, by_user: m.uid, by_name: m.name, pos: Date.now() }));
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
    toggleReaction: (logId, emoji) => {
      const s = ref.current, m = meRef.current || {}; if (!m.uid) return;
      const mine = s.reactions.find(r => r.logId === logId && r.userId === m.uid && r.emoji === emoji);
      patch(st => ({ reactOpen: null, reactions: mine ? st.reactions.filter(r => !(r.logId === logId && r.userId === m.uid && r.emoji === emoji)) : [...st.reactions, { logId, userId: m.uid, emoji, byName: m.name }] }));
      if (mine) db(client.from('fitness_reactions').delete().eq('log_id', logId).eq('user_id', m.uid).eq('emoji', emoji));
      else db(client.from('fitness_reactions').insert({ homespace_id: homespaceId, log_id: logId, user_id: m.uid, emoji, by_name: m.name }));
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
  const { primary, partner, members = [], me = null } = opts;
  const memById = {}; members.forEach(m => { memById[m.uid] = m; });
  const colorOf = (uid) => { const m = memById[uid]; if (!m) return '#9a9186'; return m.idx === 0 ? primary : m.idx === 1 ? partner : '#9a9186'; };
  const nameOf = (uid, fallback) => (memById[uid] && memById[uid].name) || fallback || 'Someone';
  const initialOf = (uid, fallback) => (nameOf(uid, fallback)[0] || '?').toUpperCase();
  const ts = (d) => { const p = String(d).split('-'); return Date.UTC(+p[0], (+p[1]) - 1, +p[2]); };

  const exercisesLogged = [...new Set(state.workouts.map(w => w.exercise))].sort();
  const ge = state.graphExercise && exercisesLogged.includes(state.graphExercise) ? state.graphExercise : (exercisesLogged[0] || '');
  // workout graph: per person, max weight per day for the selected exercise
  const wMetric = state.workoutMetric || 'weight';
  const wVal = (w) => wMetric === 'e1rm' ? e1rmOf(w) : maxW(w);
  const wSeriesMap = {};
  state.workouts.filter(w => w.exercise === ge && wVal(w) != null).forEach(w => {
    const k = w.byUser || 'x'; wSeriesMap[k] = wSeriesMap[k] || {};
    const day = w.date; const v = wVal(w);
    if (wSeriesMap[k][day] == null || v > wSeriesMap[k][day]) wSeriesMap[k][day] = v;
  });
  const wSeries = Object.keys(wSeriesMap).map(uid => ({ name: nameOf(uid), color: colorOf(uid), points: Object.keys(wSeriesMap[uid]).map(day => ({ t: ts(day), y: wSeriesMap[uid][day] })) }));

  // body graph: per person, chosen metric over time
  const metric = state.bodyMetric; const metricField = { weight: 'weight', fat: 'bodyFat', muscle: 'muscleMass' }[metric] || 'weight';
  const bSeriesMap = {};
  state.body.forEach(b => { const v = b[metricField]; if (v == null) return; const k = b.byUser || 'x'; bSeriesMap[k] = bSeriesMap[k] || []; bSeriesMap[k].push({ t: ts(b.date), y: Number(v) }); });
  const bSeries = Object.keys(bSeriesMap).map(uid => ({ name: nameOf(uid), color: colorOf(uid), points: bSeriesMap[uid] }));

  // PR = heaviest entry per person+exercise (earliest one on a tie)
  const bestKey = {};
  state.workouts.forEach(w => { const mw = maxW(w); if (mw == null) return; const k = (w.byUser || 'x') + '|' + w.exercise; const cur = bestKey[k]; if (!cur || mw > cur.w || (mw === cur.w && w.date < cur.date)) bestKey[k] = { id: w.id, w: mw, date: w.date }; });
  const prIds = new Set(Object.keys(bestKey).map(k => bestKey[k].id));
  const reactsByLog = {}; state.reactions.forEach(r => { (reactsByLog[r.logId] = reactsByLog[r.logId] || []).push(r); });
  const groupReacts = (logId) => { const rs = reactsByLog[logId] || []; const by = {}; rs.forEach(r => { by[r.emoji] = by[r.emoji] || { emoji: r.emoji, count: 0, mine: false, names: [] }; by[r.emoji].count++; if (me && r.userId === me.uid) by[r.emoji].mine = true; by[r.emoji].names.push(r.byName); }); return Object.keys(by).map(e => by[e]); };
  const workoutsByDate = state.workouts.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).map(w => ({ ...w, color: colorOf(w.byUser), initial: initialOf(w.byUser, w.byName), who: nameOf(w.byUser, w.byName), summary: setsText(w), isPR: prIds.has(w.id), reactions: groupReacts(w.id), mine: !!(me && w.byUser === me.uid), react: (emoji) => actions.toggleReaction(w.id, emoji), edit: () => actions.startEditWorkout(w.id), remove: () => actions.removeWorkout(w.id) }));
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

  // ── together-streak + consistency (calm, co-op) ──
  const DAY = 86400000;
  const todayUTC = (() => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); })();
  const datesBy = {}; members.forEach(m => { datesBy[m.uid] = new Set(); });
  state.workouts.forEach(w => { if (datesBy[w.byUser]) datesBy[w.byUser].add(w.date); });
  const dstr = (t) => new Date(t).toISOString().slice(0, 10);
  const weekStart = (t) => { const d = new Date(t); const dow = (d.getUTCDay() + 6) % 7; return t - dow * DAY; };
  const trainedInWeek = (uid, ws) => { const s = datesBy[uid]; if (!s) return false; for (let i = 0; i < 7; i++) if (s.has(dstr(ws + i * DAY))) return true; return false; };
  const activeM = members.filter(m => datesBy[m.uid] && datesBy[m.uid].size);
  const need = activeM.length >= 2 ? activeM : members.filter(m => datesBy[m.uid] && datesBy[m.uid].size);
  let streak = 0, started = false, cur = weekStart(todayUTC);
  for (let k = 0; k < 104 && need.length > 0; k++) { const both = need.every(m => trainedInWeek(m.uid, cur)); if (both) { streak++; started = true; } else if (started) break; cur -= 7 * DAY; }
  const thisWeekBoth = need.length > 0 && need.every(m => trainedInWeek(m.uid, weekStart(todayUTC)));
  const consistency = comparePeople.map(p => ({ uid: p.uid, name: p.name, color: p.color, initial: p.initial, days: Array.from({ length: 21 }, (_, i) => ({ active: !!(datesBy[p.uid] && datesBy[p.uid].has(dstr(todayUTC - (20 - i) * DAY))) })) }));

  return {
    s: state, a: actions, primary, partner, members, stop: (e) => e.stopPropagation(),
    exercisesLogged, graphExercise: ge, wSeries, bSeries, bodyMetric: metric,
    workouts: workoutsByDate, body: bodyByDate,
    workoutMetric: wMetric,
    lastFor: (ex) => { if (!me || !ex) return null; const mine = state.workouts.filter(w => w.byUser === me.uid && w.exercise === ex); return mine.length ? mine.reduce((a, w) => (w.date > a.date ? w : a), mine[0]) : null; },
    bestE1rm: (ex) => { const all = state.workouts.filter(w => w.exercise === (ex || ge)).map(e1rmOf).filter(x => x != null); return all.length ? round1(Math.max(...all)) : null; },
    canRepeat: !!(me && state.workouts.some(w => w.byUser === me.uid)),
    compare: { people: comparePeople, prRows, streak, thisWeekBoth, consistency },
    exSuggestions: (q) => {
      const t = (q || '').toLowerCase().trim();
      const lib = (state.exLib && state.exLib.length) ? state.exLib : EXERCISES.map(n => ({ name: n, sub: '' }));
      if (!t) {
        const mine = (me ? state.workouts.filter(w => w.byUser === me.uid) : []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
        const seen = new Set(), recents = [];
        mine.forEach(w => { const k = w.exercise.toLowerCase(); if (!seen.has(k)) { seen.add(k); recents.push({ name: w.exercise, sub: 'recent' }); } });
        const top = recents.slice(0, 6);
        const fill = lib.filter(x => !seen.has(x.name.toLowerCase())).slice(0, Math.max(0, 8 - top.length));
        return [...top, ...fill];
      }
      const matches = lib.filter(x => x.name.toLowerCase().includes(t));
      matches.sort((a, b) => (a.name.toLowerCase().startsWith(t) ? 0 : 1) - (b.name.toLowerCase().startsWith(t) ? 0 : 1));
      return matches.slice(0, 12);
    },
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
                      {sugg.map(o => <button key={o.name} onMouseDown={(e) => { e.preventDefault(); v.a.pickExercise(i, o.name); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '9px 11px', borderRadius: 9, fontSize: 14, fontWeight: 700, color: '#3a352f', cursor: 'pointer', fontFamily: 'inherit' }}><span>{o.name}</span>{o.sub && <span style={{ fontSize: 11, fontWeight: 700, color: o.sub === 'recent' ? '#a8794f' : '#b3a99c', textTransform: 'capitalize', flexShrink: 0 }}>{o.sub}</span>}</button>)}
                    </div>
                  )}
                  {(() => { const lf = v.lastFor(b.ex); return lf ? <div style={{ fontSize: 11.5, fontWeight: 700, color: '#b3a99c', margin: '4px 2px 0' }}>Last time: {setsText(lf)} · {shortDate(lf.date)}</div> : null; })()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <button onClick={() => v.a.setBlock(i, { mode: b.mode === 'simple' ? 'detail' : 'simple' })} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', color: '#a8794f', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                    {b.mode === 'simple' ? 'Per-set / drop set' : 'Simple'}
                  </button>
                  <UnitToggle b={b} i={i} />
                </div>
                {b.mode === 'simple' ? (
                  <Fragment>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 10, fontWeight: 800, color: '#aaa093', marginBottom: 3, textAlign: 'center' }}>SETS</div><input value={b.sets} onChange={(e) => v.a.setBlock(i, { sets: e.target.value })} onFocus={focusScroll} type="number" inputMode="numeric" placeholder="3" style={numIn} /></div>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 10, fontWeight: 800, color: '#aaa093', marginBottom: 3, textAlign: 'center' }}>REPS</div><input value={b.reps} onChange={(e) => v.a.setBlock(i, { reps: e.target.value })} onFocus={focusScroll} type="number" inputMode="numeric" placeholder="8" style={numIn} /></div>
                      <div style={{ flex: 1.2 }}><div style={{ fontSize: 10, fontWeight: 800, color: '#aaa093', marginBottom: 3, textAlign: 'center' }}>WEIGHT</div><input value={b.weight} onChange={(e) => v.a.setBlock(i, { weight: e.target.value })} onFocus={focusScroll} type="number" inputMode="decimal" placeholder="60" style={numIn} /></div>
                    </div>
                    {(() => { const pt = platesText(b.weight, b.unit); return pt ? <div style={{ fontSize: 11.5, fontWeight: 700, color: '#a8794f', margin: '-2px 2px 0' }}>🏋️ Per side: {pt}</div> : null; })()}
                  </Fragment>
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
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={v.a.addBlock} style={{ flex: 1, border: '1px dashed #cbb9a2', background: 'transparent', color: '#a8794f', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add exercise</button>
            <button onClick={v.a.saveSessionAsRoutine} title="Save as routine" style={{ flexShrink: 0, border: '1px solid #e6ded2', background: '#fff', color: '#7a7166', borderRadius: 13, padding: '12px 14px', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>☆ Save as routine</button>
          </div>
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

function RestTimer({ v, primary }) {
  const r = v.s.rest;
  const [, tick] = useState(0);
  const doneRef = useRef(false);
  useEffect(() => { if (!r) return; const id = setInterval(() => tick(t => t + 1), 250); return () => clearInterval(id); }, [r && r.endsAt]);
  if (!r) return null;
  const remMs = Math.max(0, r.endsAt - Date.now());
  const done = remMs <= 0; const rem = Math.ceil(remMs / 1000);
  if (done && !doneRef.current) { doneRef.current = true; if (navigator.vibrate) { try { navigator.vibrate([120, 70, 120]); } catch (e) {} } beep(); setTimeout(() => v.a.stopRest(), 4000); }
  if (!done) doneRef.current = false;
  const mm = Math.floor(rem / 60), ss = rem % 60;
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1500, background: done ? '#6f9c5a' : '#3a352f', color: '#fff', borderRadius: 999, boxShadow: '0 12px 30px rgba(58,53,47,.34)', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 8px 16px', fontFamily: 'inherit' }}>
      {done ? <span style={{ fontWeight: 800, fontSize: 14.5 }}>💪 Rest done!</span> : <Fragment>
        <span style={{ fontWeight: 800, fontSize: 17, fontVariantNumeric: 'tabular-nums', minWidth: 46 }}>{mm}:{String(ss).padStart(2, '0')}</span>
        <button onClick={() => v.a.addRest(30)} style={{ border: 'none', background: 'rgba(255,255,255,.18)', color: '#fff', borderRadius: 999, padding: '6px 11px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>+30s</button>
      </Fragment>}
      <button onClick={() => v.a.stopRest()} title="Stop" style={{ border: 'none', background: 'rgba(255,255,255,.18)', color: '#fff', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
    </div>
  );
}
function RoutinesModal({ v, primary }) {
  if (!v.s.routineModal) return null;
  const close = () => v.a.set({ routineModal: false });
  return (
    <Overlay onClose={close} z={1240}>
      <Sheet stop={v.stop} maxWidth={400}>
        <div style={{ padding: '20px 22px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><h2 style={modalTitle}>Routines</h2><button onClick={close} style={closeX}>×</button></div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <button onClick={v.a.newRoutine} style={{ border: '1px dashed #cbb9a2', background: 'transparent', color: '#a8794f', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>+ New routine</button>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#aaa093', letterSpacing: '.5px', textTransform: 'uppercase', margin: '2px 2px 0' }}>Start from a template</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{STARTERS.map(st => <button key={st.name} onClick={() => v.a.useStarter(st)} style={{ border: '1px solid #ece6db', background: '#fff', color: '#7a7166', borderRadius: 999, padding: '7px 13px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>+ {st.name}</button>)}</div>
          {v.s.routines.length > 0 && <div style={{ fontSize: 11, fontWeight: 800, color: '#aaa093', letterSpacing: '.5px', textTransform: 'uppercase', margin: '6px 2px 0' }}>Your routines</div>}
          {v.s.routines.map(r => (
            <div key={r.id} style={{ ...card, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#3a352f', fontFamily: "'Quicksand',sans-serif" }}>{r.name}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9a9186', marginTop: 1 }}>{r.exercises.length} exercise{r.exercises.length === 1 ? '' : 's'}</div>
              </div>
              <button onClick={() => v.a.startRoutine(r.id)} style={{ background: primary, color: '#fff', border: 'none', borderRadius: 10, padding: '7px 13px', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Start</button>
              <button onClick={() => v.a.editRoutine(r.id)} title="Edit" style={{ border: 'none', background: '#ece6db', color: '#857c70', width: 30, height: 30, borderRadius: 9, cursor: 'pointer', flexShrink: 0 }}>✎</button>
              <button onClick={() => { if (window.confirm('Delete routine “' + r.name + '”?')) v.a.deleteRoutine(r.id); }} title="Delete" style={{ border: 'none', background: 'none', color: '#cbb9a2', cursor: 'pointer', padding: 4, lineHeight: 0 }}><FI.Trash size={15} /></button>
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 22px 20px' }}><button onClick={close} style={{ ...cancelBtn, flex: 'none', width: '100%' }}>Done</button></div>
      </Sheet>
    </Overlay>
  );
}
function RoutineEditor({ v, primary }) {
  if (!v.s.routineEdit) return null;
  const re = v.s.routineEdit;
  const [focus, setFocus] = React.useState(null);
  const close = () => v.a.set({ routineEdit: null });
  return (
    <Overlay onClose={close} z={1260}>
      <Sheet stop={v.stop} maxWidth={400}>
        <div style={{ padding: '20px 22px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><h2 style={modalTitle}>{re.id ? 'Edit routine' : 'New routine'}</h2><button onClick={close} style={closeX}>×</button></div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <input value={re.name} onChange={(e) => v.a.setRoutineEdit({ name: e.target.value })} placeholder="Routine name — e.g. Push A" autoFocus style={{ ...fieldInput, fontFamily: "'Quicksand',sans-serif", fontSize: 16 }} />
          {re.rows.map((r, j) => {
            const sugg = v.exSuggestions(r.ex);
            return (
              <div key={j} style={{ border: '1px solid #ece6db', borderRadius: 14, padding: 10, background: '#fff', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
                {re.rows.length > 1 && <button onClick={() => v.a.routineRowRemove(j)} style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', border: 'none', background: '#f3ece1', color: '#b3a99c', fontSize: 13, cursor: 'pointer', zIndex: 2 }}>×</button>}
                <div style={{ position: 'relative' }}>
                  <input value={r.ex} onChange={(e) => v.a.routineRowSet(j, { ex: e.target.value })} onFocus={(e) => { setFocus(j); focusScroll(e); }} placeholder="Exercise" style={{ ...fieldInput, fontSize: 14.5, padding: '10px 30px 10px 12px' }} />
                  {focus === j && sugg.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #ece6db', borderRadius: 12, boxShadow: '0 10px 26px rgba(58,53,47,.16)', zIndex: 6, maxHeight: 180, overflowY: 'auto', padding: 5 }}>
                      {sugg.map(o => <button key={o.name} onMouseDown={(e) => { e.preventDefault(); setFocus(null); v.a.routineRowSet(j, { ex: o.name }); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '8px 10px', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#3a352f', cursor: 'pointer', fontFamily: 'inherit' }}><span>{o.name}</span>{o.sub && <span style={{ fontSize: 11, fontWeight: 700, color: o.sub === 'recent' ? '#a8794f' : '#b3a99c', textTransform: 'capitalize', flexShrink: 0 }}>{o.sub}</span>}</button>)}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 9.5, fontWeight: 800, color: '#aaa093', marginBottom: 2, textAlign: 'center' }}>SETS</div><input value={r.sets} onChange={(e) => v.a.routineRowSet(j, { sets: e.target.value })} type="number" placeholder="3" style={numIn} /></div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 9.5, fontWeight: 800, color: '#aaa093', marginBottom: 2, textAlign: 'center' }}>REPS</div><input value={r.reps} onChange={(e) => v.a.routineRowSet(j, { reps: e.target.value })} type="number" placeholder="8" style={numIn} /></div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 9.5, fontWeight: 800, color: '#aaa093', marginBottom: 2, textAlign: 'center' }}>WT</div><input value={r.weight} onChange={(e) => v.a.routineRowSet(j, { weight: e.target.value })} type="number" placeholder="—" style={numIn} /></div>
                  <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid #ece6db' }}>{UNITS.map(u => <button key={u} onClick={() => v.a.routineRowSet(j, { unit: u })} style={{ border: 'none', padding: '8px 8px', fontWeight: 800, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', background: r.unit === u ? primary : '#fff', color: r.unit === u ? '#fff' : '#9a9186' }}>{u}</button>)}</div>
                </div>
              </div>
            );
          })}
          <button onClick={v.a.routineRowAdd} style={{ border: '1px dashed #cbb9a2', background: 'transparent', color: '#a8794f', borderRadius: 12, padding: 11, fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add exercise</button>
        </div>
        <div style={{ padding: '14px 18px 20px', display: 'flex', gap: 10 }}><button onClick={close} style={cancelBtn}>Cancel</button><button onClick={v.a.saveRoutine} style={{ flex: 2, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>Save routine</button></div>
      </Sheet>
    </Overlay>
  );
}
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
  const c = v.compare;
  return (
    <Fragment>
      <div style={{ ...card, background: c.streak > 0 ? 'linear-gradient(135deg,#fbf3e6,#f3ece1)' : '#fff', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 34, lineHeight: 1 }}>{c.streak > 0 ? '🔥' : '🤝'}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: '#3a352f', fontFamily: "'Quicksand',sans-serif" }}>{c.streak > 0 ? c.streak + '-week streak together' : 'Start a streak together'}</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#9a9186', marginTop: 2 }}>{c.streak > 0 ? (c.thisWeekBoth ? 'Both trained this week — keep it alive ✨' : 'Both train once this week to keep it going') : 'Both train at least once this week to begin'}</div>
        </div>
      </div>
      <div style={card}>
        <span style={upper}>Last 3 weeks</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {c.consistency.map(p => (
            <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: p.color, color: '#fff', fontWeight: 800, fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{p.initial}</span>
              <div style={{ display: 'flex', gap: 3, flex: 1 }}>{p.days.map((d, i) => <span key={i} title={d.active ? 'trained' : ''} style={{ flex: 1, height: 14, borderRadius: 3, background: d.active ? p.color : '#efe9e0' }} />)}</div>
            </div>
          ))}
        </div>
      </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            <button onClick={() => v.a.startRest(90)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e6ded2', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', color: '#3a352f', fontWeight: 800, cursor: 'pointer' }}>⏱ Rest</button>
            {v.s.routines.map(r => <button key={r.id} onClick={() => v.a.startRoutine(r.id)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e6ded2', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', color: '#3a352f', fontWeight: 800, cursor: 'pointer' }}><span style={{ color: primary }}>▶</span>{r.name}</button>)}
            <button onClick={() => v.a.set({ routineModal: true })} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px dashed #cbb9a2', borderRadius: 999, padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', color: '#a8794f', fontWeight: 800, cursor: 'pointer' }}>☰ Routines</button>
          </div>
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
              <span style={upper}>Progress</span>
              {v.exercisesLogged.length > 0 && <div style={{ position: 'relative' }}><select value={v.graphExercise} onChange={(e) => v.a.set({ graphExercise: e.target.value })} style={selStyle}>{v.exercisesLogged.map(e => <option key={e} value={e}>{e}</option>)}</select><span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#b3a99c' }}><FI.Chevron size={12} /></span></div>}
            </div>
            {v.exercisesLogged.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 4, background: '#f2ece2', borderRadius: 9, padding: 3 }}>
                  {[{ id: 'weight', label: 'Top weight' }, { id: 'e1rm', label: 'Est. 1RM' }].map(o => <button key={o.id} onClick={() => v.a.set({ workoutMetric: o.id })} style={{ border: 'none', borderRadius: 7, padding: '5px 11px', fontFamily: 'inherit', fontWeight: 800, fontSize: 12, cursor: 'pointer', background: v.workoutMetric === o.id ? '#fff' : 'transparent', color: v.workoutMetric === o.id ? '#3a352f' : '#9a9186' }}>{o.label}</button>)}
                </div>
                {v.bestE1rm(v.graphExercise) != null && <span style={{ fontSize: 12, fontWeight: 800, color: '#6f7d52', background: '#eef1e6', padding: '4px 10px', borderRadius: 999 }}>Best 1RM ≈ {v.bestE1rm(v.graphExercise)}</span>}
              </div>
            )}
            <LineChart series={v.wSeries} />
            {legend(v.wSeries)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={upper}>{v.workouts.length} set{v.workouts.length === 1 ? '' : 's'}</span>
              {v.canRepeat && <button onClick={v.a.repeatLast} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e6ded2', borderRadius: 10, padding: '7px 12px', fontSize: 12.5, fontFamily: 'inherit', color: '#7a7166', fontWeight: 800, cursor: 'pointer' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>Repeat last</button>}
            </div>
            {v.workouts.map(w => (
              <div key={w.id} style={{ ...card, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div onClick={w.edit} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}><span style={{ fontSize: 15, fontWeight: 800, color: '#3a352f', fontFamily: "'Quicksand',sans-serif" }}>{w.exercise}</span>{w.isPR && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#a8822f', background: '#f6edd6', padding: '2px 7px', borderRadius: 999 }}>🏆 PR</span>}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#7a7166', marginTop: 2 }}>{w.summary}</div>
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#9a9186' }}><Avi color={w.color} initial={w.initial} />{shortDate(w.date)}</span>
                  <button onClick={(ev) => { ev.stopPropagation(); w.remove(); }} title="Delete" style={{ border: 'none', background: 'none', color: '#cbb9a2', cursor: 'pointer', padding: 4, lineHeight: 0 }}><FI.Trash size={16} /></button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {w.reactions.map(r => <button key={r.emoji} onClick={() => w.react(r.emoji)} title={r.names.join(', ')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid ' + (r.mine ? '#e7d3a3' : '#ece6db'), background: r.mine ? '#fdf8ee' : '#fff', borderRadius: 999, padding: '3px 9px', fontSize: 12.5, fontWeight: 800, color: '#7a7166', cursor: 'pointer', fontFamily: 'inherit' }}>{r.emoji} {r.count}</button>)}
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => v.a.set({ reactOpen: v.s.reactOpen === w.id ? null : w.id })} style={{ border: 'none', background: 'none', color: '#c3bbae', cursor: 'pointer', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', padding: '3px 6px' }}>{w.reactions.length ? '＋' : '☺ React'}</button>
                    {v.s.reactOpen === w.id && (
                      <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 4, background: '#fff', border: '1px solid #ece6db', borderRadius: 999, boxShadow: '0 8px 22px rgba(58,53,47,.18)', padding: '5px 7px', display: 'flex', gap: 3, zIndex: 8 }}>
                        {REACT_EMOJIS.map(e => <button key={e} onClick={() => w.react(e)} style={{ border: 'none', background: 'none', fontSize: 19, cursor: 'pointer', padding: '2px 3px', lineHeight: 1 }}>{e}</button>)}
                      </div>
                    )}
                  </div>
                </div>
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
  const v = buildView(state, actions, { primary, partner, members: sx.members, me: sx.me });
  return (
    <div className="app">
      <div className="app-shell"><Board v={v} isDesktop={isDesktop} primary={primary} partner={partner} /></div>
      <RestTimer v={v} primary={primary} />
      {v.s.prToast && <div style={{ position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 1500, background: '#3a352f', color: '#fff', fontWeight: 800, fontSize: 14, padding: '11px 18px', borderRadius: 999, boxShadow: '0 10px 30px rgba(58,53,47,.3)', animation: 'tog-pop .2s ease', maxWidth: '90vw', textAlign: 'center' }}>{v.s.prToast}</div>}
      <HomeButton href="../" />
      <AccountButton sx={sx} onOpen={() => setAccountOpen(true)} />
      {accountOpen && <AccountSheet sx={sx} onClose={() => setAccountOpen(false)} />}
      <AddWorkout v={v} primary={primary} /><EditWorkout v={v} primary={primary} /><AddBody v={v} primary={primary} /><RoutinesModal v={v} primary={primary} /><RoutineEditor v={v} primary={primary} />
      <TweaksPanel title="Tweaks"><TweakSection label="People"><TweakColor label="Primary" value={tweaks.primaryColor} onChange={(c) => setTweak('primaryColor', c)} options={['#c98a5c', '#d97757', '#cf6a52', '#b07d42']} /><TweakColor label="Partner" value={tweaks.partnerColor} onChange={(c) => setTweak('partnerColor', c)} options={['#8a9b6e', '#6f8050', '#5e827b', '#7e6f86']} /></TweakSection></TweaksPanel>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
