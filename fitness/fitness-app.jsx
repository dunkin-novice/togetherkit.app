// fitness-app.jsx — Together "Shared Fitness".
// Two logs in one shared space: Workouts (exercise sets — searchable exercise,
// weight + unit + reps + date) and Body (weight + collapsible fat/muscle stats).
// Each tab has a line graph; entries are colour-coded per person. Reuses the kit.

const { useState, useRef, useMemo, useEffect, Fragment } = React;
const FI = window.Icons;

const UNITS = ['kg', 'lb'];
const REACT_EMOJIS = ['👏', '🔥', '💪', '❤️', '😮', '👑'];
const MUSCLE_GROUP = { chest: 'Chest', lats: 'Back', 'middle back': 'Back', 'lower back': 'Back', traps: 'Back', neck: 'Back', quadriceps: 'Legs', hamstrings: 'Legs', glutes: 'Legs', calves: 'Legs', adductors: 'Legs', abductors: 'Legs', shoulders: 'Shoulders', biceps: 'Arms', triceps: 'Arms', forearms: 'Arms', abdominals: 'Core' };
const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];
// Time-based activities (cardio + sport). MET per intensity tier (Compendium-based) → used for calorie estimates.
const ACTIVITIES = [
  { name: 'Running', cat: 'Cardio' }, { name: 'Cycling', cat: 'Cardio' }, { name: 'Rowing Machine', cat: 'Cardio' }, { name: 'Elliptical', cat: 'Cardio' }, { name: 'Swimming', cat: 'Cardio' }, { name: 'Walking', cat: 'Cardio' }, { name: 'Jump Rope', cat: 'Cardio' }, { name: 'Yoga', cat: 'Cardio' }, { name: 'HIIT', cat: 'Cardio' }, { name: 'Stair Climber', cat: 'Cardio' },
  { name: 'Badminton', cat: 'Sport' }, { name: 'Football', cat: 'Sport' }, { name: 'Basketball', cat: 'Sport' }, { name: 'Tennis', cat: 'Sport' }, { name: 'Table Tennis', cat: 'Sport' }, { name: 'Volleyball', cat: 'Sport' },
];
const ACTIVITY_CAT = {}; ACTIVITIES.forEach(a => { ACTIVITY_CAT[a.name] = a.cat; });
const ACTIVITY_MET = { Running: { low: 8.3, moderate: 9.8, high: 11.8 }, Cycling: { low: 4, moderate: 8, high: 10 }, 'Rowing Machine': { low: 5, moderate: 7, high: 8.5 }, Elliptical: { low: 4, moderate: 5, high: 7 }, Swimming: { low: 6, moderate: 7, high: 8.3 }, Walking: { low: 2.8, moderate: 3.5, high: 4.3 }, 'Jump Rope': { low: 8.8, moderate: 11.8, high: 12.3 }, Yoga: { low: 2.5, moderate: 3, high: 4 }, HIIT: { low: 6, moderate: 8, high: 10 }, 'Stair Climber': { low: 4, moderate: 7, high: 9 }, Badminton: { low: 4.5, moderate: 5.5, high: 7 }, Football: { low: 7, moderate: 8, high: 10 }, Basketball: { low: 6, moderate: 6.5, high: 8 }, Tennis: { low: 5, moderate: 6, high: 8 }, 'Table Tennis': { low: 4, moderate: 4.5, high: 6 }, Volleyball: { low: 3, moderate: 4, high: 6 } };
const metFor = (name, intensity) => { const m = ACTIVITY_MET[name]; if (!m) return 6; return m[intensity] || m.moderate || 6; };
const INTENSITY = [{ k: 'low', l: 'Low', d: 'Casual / easy pace' }, { k: 'moderate', l: 'Moderate', d: 'Steady, breaking a sweat' }, { k: 'high', l: 'High', d: 'Hard / competitive' }];
const intensityDesc = (k) => (INTENSITY.find(i => i.k === k) || INTENSITY[1]).d;
const PRESET_GROUP = { 'Bench Press': 'Chest', 'Incline Bench Press': 'Chest', 'Dumbbell Press': 'Chest', 'Chest Fly': 'Chest', 'Push-up': 'Chest', 'Cable Crossover': 'Chest', 'Deadlift': 'Back', 'Romanian Deadlift': 'Legs', 'Pull-up': 'Back', 'Lat Pulldown': 'Back', 'Barbell Row': 'Back', 'Seated Row': 'Back', 'Face Pull': 'Back', 'Squat': 'Legs', 'Front Squat': 'Legs', 'Leg Press': 'Legs', 'Lunge': 'Legs', 'Leg Curl': 'Legs', 'Leg Extension': 'Legs', 'Calf Raise': 'Legs', 'Hip Thrust': 'Legs', 'Glute Bridge': 'Legs', 'Overhead Press': 'Shoulders', 'Lateral Raise': 'Shoulders', 'Front Raise': 'Shoulders', 'Arnold Press': 'Shoulders', 'Shrug': 'Shoulders', 'Bicep Curl': 'Arms', 'Hammer Curl': 'Arms', 'Preacher Curl': 'Arms', 'Tricep Extension': 'Arms', 'Tricep Pushdown': 'Arms', 'Dip': 'Arms', 'Plank': 'Core', 'Crunch': 'Core', 'Leg Raise': 'Core', 'Russian Twist': 'Core', 'Cable Crunch': 'Core' };
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
  { name: 'Chest Day', exercises: [{ ex: 'Bench Press', sets: 4, reps: 8 }, { ex: 'Incline Bench Press', sets: 3, reps: 10 }, { ex: 'Chest Fly', sets: 3, reps: 12 }, { ex: 'Dip', sets: 3, reps: 10 }, { ex: 'Push-up', sets: 3, reps: 15 }] },
  { name: 'Back Day', exercises: [{ ex: 'Deadlift', sets: 3, reps: 5 }, { ex: 'Pull-up', sets: 4, reps: 8 }, { ex: 'Barbell Row', sets: 4, reps: 8 }, { ex: 'Lat Pulldown', sets: 3, reps: 12 }, { ex: 'Seated Row', sets: 3, reps: 12 }] },
  { name: 'Leg Day', exercises: [{ ex: 'Squat', sets: 4, reps: 6 }, { ex: 'Romanian Deadlift', sets: 3, reps: 8 }, { ex: 'Leg Press', sets: 3, reps: 10 }, { ex: 'Lunge', sets: 3, reps: 10 }, { ex: 'Leg Curl', sets: 3, reps: 12 }, { ex: 'Calf Raise', sets: 4, reps: 15 }] },
  { name: 'Shoulder Day', exercises: [{ ex: 'Overhead Press', sets: 4, reps: 8 }, { ex: 'Lateral Raise', sets: 4, reps: 15 }, { ex: 'Front Raise', sets: 3, reps: 12 }, { ex: 'Arnold Press', sets: 3, reps: 10 }, { ex: 'Shrug', sets: 3, reps: 15 }] },
  { name: 'Arm Day', exercises: [{ ex: 'Bicep Curl', sets: 4, reps: 12 }, { ex: 'Hammer Curl', sets: 3, reps: 12 }, { ex: 'Preacher Curl', sets: 3, reps: 12 }, { ex: 'Tricep Pushdown', sets: 4, reps: 12 }, { ex: 'Tricep Extension', sets: 3, reps: 12 }] },
  { name: 'Core Day', exercises: [{ ex: 'Plank', sets: 3, reps: 1 }, { ex: 'Crunch', sets: 3, reps: 20 }, { ex: 'Leg Raise', sets: 3, reps: 15 }, { ex: 'Russian Twist', sets: 3, reps: 20 }, { ex: 'Cable Crunch', sets: 3, reps: 15 }] },
  { name: 'Full Body', exercises: [{ ex: 'Squat', sets: 3, reps: 8 }, { ex: 'Bench Press', sets: 3, reps: 8 }, { ex: 'Barbell Row', sets: 3, reps: 8 }, { ex: 'Overhead Press', sets: 3, reps: 10 }, { ex: 'Deadlift', sets: 1, reps: 5 }] },
  { name: 'Upper', exercises: [{ ex: 'Bench Press', sets: 4, reps: 6 }, { ex: 'Barbell Row', sets: 4, reps: 6 }, { ex: 'Overhead Press', sets: 3, reps: 8 }, { ex: 'Lat Pulldown', sets: 3, reps: 10 }, { ex: 'Bicep Curl', sets: 3, reps: 12 }, { ex: 'Tricep Pushdown', sets: 3, reps: 12 }] },
  { name: 'Lower', exercises: [{ ex: 'Squat', sets: 4, reps: 6 }, { ex: 'Romanian Deadlift', sets: 3, reps: 8 }, { ex: 'Leg Press', sets: 3, reps: 10 }, { ex: 'Leg Curl', sets: 3, reps: 12 }, { ex: 'Calf Raise', sets: 4, reps: 15 }] },
  { name: 'Push', exercises: [{ ex: 'Bench Press', sets: 4, reps: 6 }, { ex: 'Overhead Press', sets: 3, reps: 8 }, { ex: 'Incline Bench Press', sets: 3, reps: 10 }, { ex: 'Lateral Raise', sets: 3, reps: 15 }, { ex: 'Tricep Pushdown', sets: 3, reps: 12 }] },
  { name: 'Pull', exercises: [{ ex: 'Deadlift', sets: 3, reps: 5 }, { ex: 'Pull-up', sets: 3, reps: 8 }, { ex: 'Barbell Row', sets: 3, reps: 8 }, { ex: 'Lat Pulldown', sets: 3, reps: 12 }, { ex: 'Bicep Curl', sets: 3, reps: 12 }] },
  { name: 'Legs', exercises: [{ ex: 'Squat', sets: 4, reps: 6 }, { ex: 'Leg Press', sets: 3, reps: 10 }, { ex: 'Lunge', sets: 3, reps: 10 }, { ex: 'Leg Curl', sets: 3, reps: 12 }, { ex: 'Calf Raise', sets: 4, reps: 15 }] },
];
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const shortDate = (s) => { if (!s) return ''; const p = String(s).split('-'); return p.length === 3 ? (Number(p[1]) + '/' + Number(p[2])) : s; };

const rowToW = (r) => ({ id: r.id, exercise: r.exercise, weight: r.weight, unit: r.unit || 'kg', reps: r.reps, sets: r.sets, setsDetail: r.sets_detail || null, kind: r.kind || 'lifting', durationMin: r.duration_min, intensity: r.intensity || null, date: r.log_date, byUser: r.by_user, byName: r.by_name });
const rowToB = (r) => ({ id: r.id, date: r.log_date, weight: r.weight, unit: r.unit || 'kg', bodyFat: r.body_fat, muscleMass: r.muscle_mass, fatMass: r.fat_mass, photo: r.photo || null, byUser: r.by_user, byName: r.by_name });
const rowToRoutine = (r) => ({ id: r.id, name: r.name, exercises: Array.isArray(r.exercises) ? r.exercises : [], byUser: r.by_user, byName: r.by_name });
const emptyRRow = (unit) => ({ ex: '', sets: '', reps: '', weight: '', unit: unit || 'kg' });
// heaviest weight in an entry (handles per-set detail / drop sets)
const maxW = (w) => { if (w.setsDetail && w.setsDetail.length) { const ws = w.setsDetail.map(s => Number(s.weight)).filter(x => !isNaN(x)); return ws.length ? Math.max(...ws) : null; } return w.weight != null ? Number(w.weight) : null; };
const emptyWBlock = (unit) => ({ ex: '', unit: unit || 'kg', kind: 'lifting', mode: 'simple', sets: '', reps: '', weight: '', duration: '', intensity: 'moderate', rows: [{ weight: '', reps: '', drop: false }] });
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
  if (w.kind === 'cardio') { const p = []; if (w.durationMin != null) p.push(w.durationMin + ' min'); if (w.intensity) p.push(w.intensity); return p.join(' · ') || 'logged'; }
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
    routineModal: false, routineEdit: null, reactOpen: null, rest: null, sessionOpen: null,
    wAddOpen: false, wSession: { date: today(), blocks: [emptyWBlock('kg')] }, exFocusKey: null,
    wEditId: null, wEdit: null, prToast: null,
    bAddOpen: false, bDraft: { weight: '', unit: 'kg', bodyFat: '', muscleMass: '', fatMass: '', photo: null, date: today(), advanced: false },
    photoCompare: false,
    graphExercise: '', bodyMetric: 'weight', workoutMetric: 'weight', exLib: [], fitGoal: 3,
    fitProfiles: {}, fpEditOpen: false, fpDraft: { height_cm: '', weight_kg: '', birth_year: '', sex: '', stats_visible: true },
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
      const [w, b, rt, rx, hg, fpr] = await Promise.all([
        client.from('fitness_logs').select('*').eq('homespace_id', homespaceId).order('log_date', { ascending: true }),
        client.from('body_logs').select('*').eq('homespace_id', homespaceId).order('log_date', { ascending: true }),
        client.from('fitness_routines').select('*').eq('homespace_id', homespaceId).order('pos', { ascending: true }),
        client.from('fitness_reactions').select('*').eq('homespace_id', homespaceId),
        client.from('homespaces').select('fit_goal').eq('id', homespaceId).maybeSingle(),
        client.from('fitness_profiles').select('*'),
      ]);
      if (!alive) return;
      const fp = {}; (fpr.data || []).forEach(p => { fp[p.user_id] = p; });
      patch(s => ({ workouts: (w.data || []).map(rowToW), body: (b.data || []).map(rowToB), routines: (rt.data || []).map(rowToRoutine), reactions: (rx.data || []).map(r => ({ logId: r.log_id, userId: r.user_id, emoji: r.emoji, byName: r.by_name })), fitGoal: (hg.data && hg.data.fit_goal) || 3, fitProfiles: fp, syncing: false, graphExercise: s.graphExercise || ((w.data || []).slice(-1)[0] || {}).exercise || '' }));
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
    setGoal: (n) => { const g = Math.max(1, Math.min(14, n)); patch({ fitGoal: g }); db(client.from('homespaces').update({ fit_goal: g }).eq('id', homespaceId)); },
    openFpEdit: () => { const m = meRef.current || {}; const p = (ref.current.fitProfiles || {})[m.uid] || {}; patch({ fpEditOpen: true, fpDraft: { height_cm: p.height_cm == null ? '' : String(p.height_cm), weight_kg: p.weight_kg == null ? '' : String(p.weight_kg), birth_year: p.birth_year == null ? '' : String(p.birth_year), sex: p.sex || '', stats_visible: p.stats_visible == null ? true : !!p.stats_visible } }); },
    setFpDraft: (p) => patch(s => ({ fpDraft: { ...s.fpDraft, ...p } })),
    saveFpProfile: () => {
      const m = meRef.current || {}; if (!m.uid) return;
      const d = ref.current.fpDraft, num = (v) => v === '' || v == null ? null : Number(v);
      const row = { user_id: m.uid, height_cm: num(d.height_cm), weight_kg: num(d.weight_kg), birth_year: num(d.birth_year), sex: d.sex || null, stats_visible: !!d.stats_visible, updated_at: new Date().toISOString() };
      patch(s => ({ fpEditOpen: false, fitProfiles: { ...s.fitProfiles, [m.uid]: row } }));
      db(client.from('fitness_profiles').upsert(row));
    },
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
        // auto-detect a time-based activity (cardio/sport) and switch the block to Time mode
        if (ACTIVITY_CAT[name]) { nb.kind = 'cardio'; if (last && last.kind === 'cardio' && b.duration === '') { nb.duration = last.durationMin == null ? '' : String(last.durationMin); nb.intensity = last.intensity || b.intensity; } }
        else { nb.kind = 'lifting'; if (last && last.kind !== 'cardio' && b.mode === 'simple' && b.weight === '' && b.reps === '' && b.sets === '') { nb.weight = last.weight == null ? '' : String(last.weight); nb.reps = last.reps == null ? '' : String(last.reps); nb.sets = last.sets == null ? '' : String(last.sets); nb.unit = last.unit || b.unit; } }
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
        if (b.kind === 'cardio') {
          return { id: BE.newId(), exercise: ex, kind: 'cardio', durationMin: b.duration === '' ? null : Number(b.duration), intensity: b.intensity || 'moderate', weight: null, unit: b.unit, reps: null, sets: null, setsDetail: null, date: sess.date, byUser: m.uid, byName: m.name };
        }
        if (b.mode === 'detail') {
          const rs = b.rows.filter(r => r.weight !== '' || r.reps !== '').map(r => ({ weight: r.weight === '' ? null : Number(r.weight), reps: r.reps === '' ? null : Number(r.reps), drop: !!r.drop }));
          const ws = rs.map(r => r.weight).filter(x => x != null);
          return { id: BE.newId(), exercise: ex, kind: 'lifting', weight: ws.length ? Math.max(...ws) : null, unit: b.unit, reps: rs[0] ? rs[0].reps : null, sets: rs.length || null, setsDetail: rs.length ? rs : null, date: sess.date, byUser: m.uid, byName: m.name };
        }
        return { id: BE.newId(), exercise: ex, kind: 'lifting', weight: b.weight === '' ? null : Number(b.weight), unit: b.unit, reps: b.reps === '' ? null : Number(b.reps), sets: b.sets === '' ? null : Number(b.sets), setsDetail: null, date: sess.date, byUser: m.uid, byName: m.name };
      });
      // detect new personal records (heaviest ever for me on that exercise)
      const myPrev = {}; s.workouts.filter(w => w.byUser === m.uid).forEach(w => { const mw = maxW(w); if (mw == null) return; if (myPrev[w.exercise] == null || mw > myPrev[w.exercise]) myPrev[w.exercise] = mw; });
      const prHits = [];
      rows.forEach(w => { const mw = maxW(w); if (mw != null && (myPrev[w.exercise] == null || mw > myPrev[w.exercise])) { prHits.push(w.exercise + ' ' + mw + w.unit); myPrev[w.exercise] = mw; } });
      const toast = prHits.length ? ('🏆 New PR! ' + prHits.join(' · ')) : null;
      patch(st => ({ workouts: [...st.workouts, ...rows].sort((a, b) => (a.date < b.date ? -1 : 1)), wAddOpen: false, exFocusKey: null, prToast: toast, graphExercise: st.graphExercise || rows[0].exercise, wSession: { date: today(), blocks: [emptyWBlock((sess.blocks.slice(-1)[0] || {}).unit)] } }));
      if (toast) setTimeout(() => patch({ prToast: null }), 4000);
      rows.forEach(w => db(client.from('fitness_logs').insert({ id: w.id, homespace_id: homespaceId, exercise: w.exercise, kind: w.kind || 'lifting', duration_min: w.durationMin == null ? null : w.durationMin, intensity: w.intensity || null, weight: w.weight, unit: w.unit, reps: w.reps, sets: w.sets, sets_detail: w.setsDetail, log_date: w.date, by_user: w.byUser, by_name: w.byName, pos: Date.now() })));
    },
    repeatLast: () => {
      const s = ref.current, m = meRef.current || { uid: null };
      const mine = s.workouts.filter(w => w.byUser === m.uid);
      if (!mine.length) return;
      const lastDate = mine.reduce((a, w) => (w.date > a ? w.date : a), mine[0].date);
      const blocks = mine.filter(w => w.date === lastDate).map(w => w.kind === 'cardio'
        ? { ...emptyWBlock(w.unit), ex: w.exercise, kind: 'cardio', duration: w.durationMin == null ? '' : String(w.durationMin), intensity: w.intensity || 'moderate' }
        : (w.setsDetail && w.setsDetail.length)
          ? { ...emptyWBlock(w.unit), ex: w.exercise, unit: w.unit, mode: 'detail', rows: w.setsDetail.map(r => ({ weight: r.weight == null ? '' : String(r.weight), reps: r.reps == null ? '' : String(r.reps), drop: !!r.drop })) }
          : { ...emptyWBlock(w.unit), ex: w.exercise, unit: w.unit, mode: 'simple', sets: w.sets == null ? '' : String(w.sets), reps: w.reps == null ? '' : String(w.reps), weight: w.weight == null ? '' : String(w.weight) });
      patch({ wSession: { date: today(), blocks: blocks.length ? blocks : [emptyWBlock('kg')] }, wAddOpen: true, exFocusKey: null });
    },
    duplicateWorkout: (id) => {
      const s = ref.current, m = meRef.current || { uid: null, name: 'Me' };
      const w = s.workouts.find(x => x.id === id); if (!w) return;
      const nw = { id: BE.newId(), exercise: w.exercise, weight: w.weight, unit: w.unit, reps: w.reps, sets: w.sets, setsDetail: w.setsDetail, byUser: m.uid, byName: m.name, date: today() };
      patch(st => ({ workouts: [...st.workouts, nw] }));
      db(client.from('fitness_logs').insert({ id: nw.id, homespace_id: homespaceId, exercise: nw.exercise, weight: nw.weight, unit: nw.unit, reps: nw.reps, sets: nw.sets, sets_detail: nw.setsDetail, log_date: nw.date, by_user: m.uid, by_name: m.name, pos: Date.now() }));
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
    saveSessionAsRoutine: async () => {
      const s = ref.current, sess = s.wSession, m = meRef.current || {};
      const blocks = sess.blocks.filter(b => (b.ex || '').trim()); if (!blocks.length) return;
      const name = ((await window.TogetherUI.prompt({ title: 'Save as routine', placeholder: 'Name this routine', confirmLabel: 'Save' })) || '').trim(); if (!name) return;
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
      const num = (v) => v === '' ? null : Number(v);
      if (d.weight === '' && d.bodyFat === '' && d.muscleMass === '' && d.fatMass === '' && !d.photo) return;
      const e = { id: BE.newId(), date: d.date, weight: num(d.weight), unit: d.unit, bodyFat: num(d.bodyFat), muscleMass: num(d.muscleMass), fatMass: num(d.fatMass), photo: d.photo || null, byUser: m.uid, byName: m.name };
      patch(st => ({ body: [...st.body, e].sort((a, b) => (a.date < b.date ? -1 : 1)), bAddOpen: false, bDraft: { weight: '', unit: d.unit, bodyFat: '', muscleMass: '', fatMass: '', photo: null, date: today(), advanced: false } }));
      db(client.from('body_logs').insert({ id: e.id, homespace_id: homespaceId, log_date: e.date, weight: e.weight, unit: e.unit, body_fat: e.bodyFat, muscle_mass: e.muscleMass, fat_mass: e.fatMass, photo: e.photo, by_user: e.byUser, by_name: e.byName }));
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
  const wVal = (w) => { if (wMetric === 'e1rm') return e1rmOf(w); if (wMetric === 'volume') { const mw = maxW(w); return mw == null ? null : mw * (Number(w.reps) || 1) * (w.sets || (w.setsDetail ? w.setsDetail.length : 1) || 1); } return maxW(w); };
  const wSeriesMap = {};
  state.workouts.filter(w => w.exercise === ge && wVal(w) != null).forEach(w => {
    const k = w.byUser || 'x'; wSeriesMap[k] = wSeriesMap[k] || {};
    const day = w.date; const v = wVal(w);
    if (wMetric === 'volume') wSeriesMap[k][day] = (wSeriesMap[k][day] || 0) + v;
    else if (wSeriesMap[k][day] == null || v > wSeriesMap[k][day]) wSeriesMap[k][day] = v;
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
  const workoutsByDate = state.workouts.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).map(w => ({ ...w, color: colorOf(w.byUser), initial: initialOf(w.byUser, w.byName), who: nameOf(w.byUser, w.byName), summary: setsText(w), isPR: prIds.has(w.id), reactions: groupReacts(w.id), mine: !!(me && w.byUser === me.uid), react: (emoji) => actions.toggleReaction(w.id, emoji), edit: () => actions.startEditWorkout(w.id), duplicate: () => actions.duplicateWorkout(w.id), remove: () => actions.removeWorkout(w.id) }));
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
  const wkStart = weekStart(todayUTC);
  const weekDays = comparePeople.map(p => { let n = 0; for (let i = 0; i < 7; i++) if (datesBy[p.uid] && datesBy[p.uid].has(dstr(wkStart + i * DAY))) n++; return { uid: p.uid, name: p.name, color: p.color, initial: p.initial, days: n }; });
  const consistency = comparePeople.map(p => ({ uid: p.uid, name: p.name, color: p.color, initial: p.initial, days: Array.from({ length: 21 }, (_, i) => ({ active: !!(datesBy[p.uid] && datesBy[p.uid].has(dstr(todayUTC - (20 - i) * DAY))) })) }));
  // weekly muscle-group focus (uses the bundled library's muscle data)
  const exMuscles = {}; (state.exLib || []).forEach(x => { exMuscles[x.name.toLowerCase()] = x.muscles || []; });
  const groupOf = (name) => { const ms = exMuscles[(name || '').toLowerCase()]; if (ms && ms.length) { const g = MUSCLE_GROUP[ms[0]]; if (g) return g; } return PRESET_GROUP[name] || null; };
  const mw2 = {}; MUSCLE_GROUPS.forEach(g => { mw2[g] = {}; });
  state.workouts.forEach(w => { if (ts(w.date) < weekAgo) return; const g = groupOf(w.exercise); if (!g) return; const sets = w.sets || (w.setsDetail ? w.setsDetail.length : 1) || 1; mw2[g][w.byUser] = (mw2[g][w.byUser] || 0) + sets; });
  const muscleFocus = MUSCLE_GROUPS.map(g => ({ group: g, perPerson: comparePeople.map(p => ({ uid: p.uid, color: p.color, sets: mw2[g][p.uid] || 0 })), total: comparePeople.reduce((a, p) => a + (mw2[g][p.uid] || 0), 0) })).filter(x => x.total > 0);

  // ── sessions: group each person's sets on a day into one "Chest Day"-style card ──
  const exMusclesV = {}; (state.exLib || []).forEach(x => { exMusclesV[x.name.toLowerCase()] = x.muscles || []; });
  const groupOfV = (name) => { if (ACTIVITY_CAT[name]) return ACTIVITY_CAT[name]; const ms = exMusclesV[(name || '').toLowerCase()]; if (ms && ms.length) { const g = MUSCLE_GROUP[ms[0]]; if (g) return g; } return PRESET_GROUP[name] || null; };
  const itemVol = (w) => { if (w.setsDetail && w.setsDetail.length) return w.setsDetail.reduce((a, r) => a + ((Number(r.weight) || 0) * (Number(r.reps) || 0)), 0); const mw = maxW(w); return (mw || 0) * (Number(w.reps) || 0) * (w.sets || 1); };
  const sessMap = {};
  workoutsByDate.forEach(w => { const k = (w.byUser || 'x') + '|' + w.date; (sessMap[k] = sessMap[k] || { key: k, byUser: w.byUser, date: w.date, color: w.color, initial: w.initial, who: w.who, mine: w.mine, items: [] }).items.push(w); });
  const sessions = Object.keys(sessMap).map(k => sessMap[k]).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).map(s => {
    const counts = {}; s.items.forEach(w => { const g = groupOfV(w.exercise); if (g) counts[g] = (counts[g] || 0) + 1; });
    const groups = Object.keys(counts).sort((a, b) => counts[b] - counts[a]); const total = s.items.length;
    let title;
    const dayName = { Legs: 'Leg', Shoulders: 'Shoulder', Arms: 'Arm' };
    if (!groups.length) title = 'Workout';
    else if (groups.length === 1 || counts[groups[0]] / total >= 0.6) title = (dayName[groups[0]] || groups[0]) + ' Day';
    else if (groups.length <= 3) title = groups.slice(0, 2).join(' & ');
    else title = 'Full Body';
    const isPR = s.items.some(w => w.isPR);
    return { ...s, title, isPR, count: s.items.length, volume: Math.round(s.items.reduce((a, w) => a + itemVol(w), 0)), preview: s.items.map(w => w.exercise).join(' · ') };
  });
  return {
    s: state, a: actions, primary, partner, members, stop: (e) => e.stopPropagation(),
    exercisesLogged, graphExercise: ge, wSeries, bSeries, bodyMetric: metric,
    workouts: workoutsByDate, body: bodyByDate, sessions,
    myProfile: me ? (state.fitProfiles[me.uid] || null) : null,
    workoutMetric: wMetric,
    lastFor: (ex) => { if (!me || !ex) return null; const mine = state.workouts.filter(w => w.byUser === me.uid && w.exercise === ex); return mine.length ? mine.reduce((a, w) => (w.date > a.date ? w : a), mine[0]) : null; },
    bestE1rm: (ex) => { const all = state.workouts.filter(w => w.exercise === (ex || ge)).map(e1rmOf).filter(x => x != null); return all.length ? round1(Math.max(...all)) : null; },
    canRepeat: !!(me && state.workouts.some(w => w.byUser === me.uid)),
    compare: { people: comparePeople, prRows, streak, thisWeekBoth, consistency, muscleFocus, weekDays, goal: state.fitGoal },
    exSuggestions: (q) => {
      const t = (q || '').toLowerCase().trim();
      const acts = ACTIVITIES.map(a => ({ name: a.name, sub: a.cat.toLowerCase(), kind: 'cardio' }));
      const lib = acts.concat((state.exLib && state.exLib.length) ? state.exLib : EXERCISES.map(n => ({ name: n, sub: '' })));
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
        <div style={{ padding: '20px 22px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><h2 style={modalTitle}>Log a workout</h2><button onClick={close} aria-label="Close" style={closeX}>×</button></div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sess.blocks.map((b, i) => {
            const sugg = v.exSuggestions(b.ex);
            return (
              <div key={i} style={{ border: '1px solid #ece6db', borderRadius: 16, padding: 12, background: '#fff', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
                {sess.blocks.length > 1 && <button onClick={() => v.a.removeBlock(i)} title="Remove" aria-label="Remove exercise" style={{ position: 'absolute', top: 6, right: 6, width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#f3ece1', color: '#b3a99c', fontSize: 14, cursor: 'pointer', lineHeight: 1, zIndex: 2 }}>×</button>}
                <div style={{ position: 'relative' }}>
                  <input value={b.ex} onChange={(e) => v.a.setBlock(i, { ex: e.target.value })} onFocus={(e) => { v.a.set({ exFocusKey: i }); focusScroll(e); }} placeholder="Search exercise…" style={{ ...fieldInput, fontFamily: "'Quicksand',sans-serif", fontSize: 15.5, paddingRight: 34 }} />
                  {v.s.exFocusKey === i && sugg.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 5, background: '#fff', border: '1px solid #ece6db', borderRadius: 13, boxShadow: '0 10px 26px rgba(58,53,47,.16)', zIndex: 6, maxHeight: 200, overflowY: 'auto', padding: 5 }}>
                      {sugg.map(o => <button key={o.name} onMouseDown={(e) => { e.preventDefault(); v.a.pickExercise(i, o.name); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '9px 11px', borderRadius: 9, fontSize: 14, fontWeight: 700, color: '#3a352f', cursor: 'pointer', fontFamily: 'inherit' }}><span>{o.name}</span>{o.sub && <span style={{ fontSize: 11, fontWeight: 700, color: o.sub === 'recent' ? '#a8794f' : '#b3a99c', textTransform: 'capitalize', flexShrink: 0 }}>{o.sub}</span>}</button>)}
                    </div>
                  )}
                  {(() => { const lf = v.lastFor(b.ex); return lf ? <div style={{ fontSize: 11.5, fontWeight: 700, color: '#b3a99c', margin: '4px 2px 0' }}>Last time: {setsText(lf)} · {shortDate(lf.date)}</div> : null; })()}
                </div>
                <div style={{ display: 'flex', gap: 5, background: '#f3ece1', borderRadius: 10, padding: 3 }}>
                  {[{ k: 'lifting', l: '🏋️ Reps' }, { k: 'cardio', l: '⏱ Time' }].map(o => { const on = b.kind === o.k || (o.k === 'lifting' && b.kind !== 'cardio'); return <button key={o.k} onClick={() => v.a.setBlock(i, { kind: o.k })} style={{ flex: 1, border: 'none', borderRadius: 8, padding: '7px 4px', fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', background: on ? '#fff' : 'transparent', color: on ? '#3a352f' : '#9a9186' }}>{o.l}</button>; })}
                </div>
                {b.kind === 'cardio' ? (
                  <Fragment>
                    <div><div style={{ fontSize: 10, fontWeight: 800, color: '#aaa093', marginBottom: 3, textAlign: 'center' }}>MINUTES</div><input value={b.duration} onChange={(e) => v.a.setBlock(i, { duration: e.target.value })} onFocus={focusScroll} type="number" inputMode="numeric" placeholder="30" style={numIn} /></div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#aaa093', marginBottom: 4, textTransform: 'uppercase' }}>Intensity</div>
                      <div style={{ display: 'flex', gap: 5 }}>{INTENSITY.map(it => <button key={it.k} onClick={() => v.a.setBlock(i, { intensity: it.k })} style={{ flex: 1, border: '1px solid ' + (b.intensity === it.k ? primary : '#ece6db'), background: b.intensity === it.k ? primary : '#fff', color: b.intensity === it.k ? '#fff' : '#9a9186', borderRadius: 10, padding: '9px 4px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>{it.l}</button>)}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#b3a99c', margin: '5px 2px 0' }}>{intensityDesc(b.intensity)}</div>
                    </div>
                  </Fragment>
                ) : (
                <Fragment>
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
                      <div style={{ flex: 1.7 }}><div style={{ fontSize: 10, fontWeight: 800, color: '#aaa093', marginBottom: 3, textAlign: 'center' }}>WEIGHT</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <button onClick={() => { const st = b.unit === 'lb' ? 5 : 2.5; v.a.setBlock(i, { weight: String(Math.max(0, Math.round(((Number(b.weight) || 0) - st) * 100) / 100)) }); }} aria-label="Decrease weight" style={{ border: '1px solid #ece6db', background: '#fff', color: '#7a7166', width: 34, height: 40, borderRadius: 9, fontSize: 16, fontWeight: 800, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>−</button>
                          <input value={b.weight} onChange={(e) => v.a.setBlock(i, { weight: e.target.value })} onFocus={focusScroll} type="number" inputMode="decimal" placeholder="60" style={{ ...numIn, flex: 1, padding: '10px 2px', minWidth: 0 }} />
                          <button onClick={() => { const st = b.unit === 'lb' ? 5 : 2.5; v.a.setBlock(i, { weight: String(Math.round(((Number(b.weight) || 0) + st) * 100) / 100) }); }} aria-label="Increase weight" style={{ border: '1px solid #ece6db', background: '#fff', color: '#7a7166', width: 34, height: 40, borderRadius: 9, fontSize: 16, fontWeight: 800, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>+</button>
                        </div>
                      </div>
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
                        <button onClick={() => v.a.setRow(i, j, { drop: !r.drop })} title="Drop set" aria-label={r.drop ? 'Unmark drop set' : 'Mark as drop set'} aria-pressed={!!r.drop} style={{ border: 'none', borderRadius: 8, padding: '10px 9px', fontWeight: 800, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', background: r.drop ? '#cf6a52' : '#f3ece1', color: r.drop ? '#fff' : '#a89e90', flexShrink: 0, minHeight: 38 }}>drop</button>
                        {b.rows.length > 1 && <button onClick={() => v.a.removeRow(i, j)} aria-label="Remove set" style={{ border: 'none', background: 'none', color: '#cbb9a2', fontSize: 16, cursor: 'pointer', padding: '8px 6px', lineHeight: 1, flexShrink: 0 }}>×</button>}
                      </div>
                    ))}
                    <button onClick={() => v.a.addRow(i)} style={{ alignSelf: 'flex-start', border: '1px dashed #d9cbb7', background: 'none', color: '#a8794f', borderRadius: 9, padding: '6px 12px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add set</button>
                  </div>
                )}
                </Fragment>
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
        <div style={{ padding: '20px 22px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><h2 style={modalTitle}>Edit set</h2><button onClick={close} aria-label="Close" style={closeX}>×</button></div>
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
function FpEditModal({ v, primary }) {
  if (!v.s.fpEditOpen) return null;
  const d = v.s.fpDraft;
  const lab = { fontSize: 10.5, fontWeight: 800, color: '#aaa093', marginBottom: 4, textTransform: 'uppercase' };
  return (
    <Overlay onClose={() => v.a.set({ fpEditOpen: false })}>
      <Sheet stop={v.stop} maxWidth={400}>
        <div style={{ padding: '22px 22px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><h2 style={modalTitle}>My stats</h2><button onClick={() => v.a.set({ fpEditOpen: false })} aria-label="Close" style={closeX}>×</button></div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><div style={lab}>Height (cm)</div><input value={d.height_cm} onChange={(e) => v.a.setFpDraft({ height_cm: e.target.value })} type="number" inputMode="numeric" placeholder="170" style={fieldInput} /></div>
            <div style={{ flex: 1 }}><div style={lab}>Weight (kg)</div><input value={d.weight_kg} onChange={(e) => v.a.setFpDraft({ weight_kg: e.target.value })} type="number" inputMode="decimal" placeholder="65" style={fieldInput} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><div style={lab}>Birth year</div><input value={d.birth_year} onChange={(e) => v.a.setFpDraft({ birth_year: e.target.value })} type="number" inputMode="numeric" placeholder="1995" style={fieldInput} /></div>
            <div style={{ flex: 1.4 }}><div style={lab}>Sex</div>
              <div style={{ display: 'flex', gap: 5 }}>{[{ k: 'male', l: 'Male' }, { k: 'female', l: 'Female' }, { k: '', l: '—' }].map(o => <button key={o.k} onClick={() => v.a.setFpDraft({ sex: o.k })} style={{ flex: 1, border: '1px solid ' + (d.sex === o.k ? primary : '#ece6db'), background: d.sex === o.k ? primary : '#fff', color: d.sex === o.k ? '#fff' : '#9a9186', borderRadius: 11, padding: '11px 4px', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{o.l}</button>)}</div>
            </div>
          </div>
          <button onClick={() => v.a.setFpDraft({ stats_visible: !d.stats_visible })} role="switch" aria-checked={d.stats_visible} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#fff', border: '1px solid #ece6db', borderRadius: 13, padding: '13px 15px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <span><div style={{ fontSize: 14, fontWeight: 800, color: '#3a352f' }}>Show my stats to others</div><div style={{ fontSize: 12, fontWeight: 600, color: '#9a9186', marginTop: 2 }}>Let others in this space see your height/weight/age/sex.</div></span>
            <span style={{ flexShrink: 0, width: 46, height: 27, borderRadius: 999, background: d.stats_visible ? '#6f9c5a' : '#d8cfc0', position: 'relative', transition: 'background .15s' }}><span style={{ position: 'absolute', top: 3, left: d.stats_visible ? 22 : 3, width: 21, height: 21, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} /></span>
          </button>
        </div>
        <div style={{ padding: '16px 22px 22px', display: 'flex', gap: 10 }}>
          <button onClick={() => v.a.set({ fpEditOpen: false })} style={cancelBtn}>Cancel</button>
          <button onClick={v.a.saveFpProfile} style={{ flex: 1.4, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
        </div>
      </Sheet>
    </Overlay>
  );
}
function AddBody({ v, primary }) {
  if (!v.s.bAddOpen) return null;
  const d = v.s.bDraft;
  const onPhoto = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const S = 520, ratio = Math.min(1, S / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = img.width * ratio; c.height = img.height * ratio; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); v.a.setBDraft({ photo: c.toDataURL('image/jpeg', 0.82) }); }; img.src = r.result; }; r.readAsDataURL(f); };
  return (
    <Overlay onClose={() => v.a.set({ bAddOpen: false })}>
      <Sheet stop={v.stop} maxWidth={380}>
        <div style={{ padding: '22px 22px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><h2 style={modalTitle}>Log body stats</h2><button onClick={() => v.a.set({ bAddOpen: false })} aria-label="Close" style={closeX}>×</button></div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', border: '1px solid #ece6db', background: '#fff', borderRadius: 14, padding: 10 }}>
            <span style={{ width: 52, height: 52, borderRadius: 11, background: '#f2ece2', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{d.photo ? <img src={d.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📷'}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#7a7166' }}>{d.photo ? 'Photo added — tap to change' : 'Add a progress photo (optional)'}</span>
            <input type="file" accept="image/*" onChange={onPhoto} style={{ display: 'none' }} />
          </label>
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
  useEffect(() => { if (!r) return; const id = setInterval(() => tick(t => t + 1), 250); return () => clearInterval(id); }, [r && r.endsAt]);
  const remMs = r ? Math.max(0, r.endsAt - Date.now()) : 0;
  const done = !!r && remMs <= 0;
  // fire the "done" chime + auto-dismiss exactly once, cleaned up if a new timer starts
  useEffect(() => {
    if (!done) return;
    if (navigator.vibrate) { try { navigator.vibrate([120, 70, 120]); } catch (e) {} }
    beep();
    const id = setTimeout(() => v.a.stopRest(), 4000);
    return () => clearTimeout(id);
  }, [done, r && r.endsAt]);
  if (!r) return null;
  const rem = Math.ceil(remMs / 1000);
  const mm = Math.floor(rem / 60), ss = rem % 60;
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1500, background: done ? '#6f9c5a' : '#3a352f', color: '#fff', borderRadius: 999, boxShadow: '0 12px 30px rgba(58,53,47,.34)', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 8px 16px', fontFamily: 'inherit' }}>
      {done ? <span style={{ fontWeight: 800, fontSize: 14.5 }}>💪 Rest done!</span> : <Fragment>
        <span style={{ fontWeight: 800, fontSize: 17, fontVariantNumeric: 'tabular-nums', minWidth: 46 }}>{mm}:{String(ss).padStart(2, '0')}</span>
        <button onClick={() => v.a.addRest(30)} aria-label="Add 30 seconds to rest timer" style={{ border: 'none', background: 'rgba(255,255,255,.18)', color: '#fff', borderRadius: 999, padding: '9px 13px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>+30s</button>
      </Fragment>}
      <button onClick={() => v.a.stopRest()} title="Stop" aria-label="Stop rest timer" style={{ border: 'none', background: 'rgba(255,255,255,.18)', color: '#fff', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', fontSize: 15, lineHeight: 1, flexShrink: 0 }}>×</button>
    </div>
  );
}
function RoutinesModal({ v, primary }) {
  if (!v.s.routineModal) return null;
  const close = () => v.a.set({ routineModal: false });
  return (
    <Overlay onClose={close} z={1240}>
      <Sheet stop={v.stop} maxWidth={400}>
        <div style={{ padding: '20px 22px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><h2 style={modalTitle}>Routines</h2><button onClick={close} aria-label="Close" style={closeX}>×</button></div>
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
              <button onClick={() => v.a.editRoutine(r.id)} title="Edit" aria-label="Edit routine" style={{ border: 'none', background: '#ece6db', color: '#857c70', width: 38, height: 38, borderRadius: 9, cursor: 'pointer', flexShrink: 0 }}>✎</button>
              <button onClick={async () => { if (await window.TogetherUI.confirm({ title: 'Delete routine “' + r.name + '”?', confirmLabel: 'Delete', danger: true })) v.a.deleteRoutine(r.id); }} title="Delete" aria-label="Delete routine" style={{ border: 'none', background: 'none', color: '#cbb9a2', cursor: 'pointer', padding: 8, lineHeight: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FI.Trash size={15} /></button>
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
        <div style={{ padding: '20px 22px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><h2 style={modalTitle}>{re.id ? 'Edit routine' : 'New routine'}</h2><button onClick={close} aria-label="Close" style={closeX}>×</button></div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <input value={re.name} onChange={(e) => v.a.setRoutineEdit({ name: e.target.value })} placeholder="Routine name — e.g. Push A" autoFocus style={{ ...fieldInput, fontFamily: "'Quicksand',sans-serif", fontSize: 16 }} />
          {re.rows.map((r, j) => {
            const sugg = v.exSuggestions(r.ex);
            return (
              <div key={j} style={{ border: '1px solid #ece6db', borderRadius: 14, padding: 10, background: '#fff', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
                {re.rows.length > 1 && <button onClick={() => v.a.routineRowRemove(j)} aria-label="Remove exercise" style={{ position: 'absolute', top: 5, right: 5, width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#f3ece1', color: '#b3a99c', fontSize: 13, cursor: 'pointer', zIndex: 2 }}>×</button>}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <span style={upper}>Weekly goal</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <button onClick={() => v.a.setGoal(c.goal - 1)} aria-label="Decrease weekly goal" style={{ border: '1px solid #ece6db', background: '#fff', color: '#7a7166', width: 40, height: 40, borderRadius: 9, fontSize: 15, fontWeight: 800, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>−</button>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#3a352f', minWidth: 64, textAlign: 'center' }}>{c.goal}× / week</span>
            <button onClick={() => v.a.setGoal(c.goal + 1)} aria-label="Increase weekly goal" style={{ border: '1px solid #ece6db', background: '#fff', color: '#7a7166', width: 40, height: 40, borderRadius: 9, fontSize: 15, fontWeight: 800, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>+</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {(c.weekDays || []).map(p => { const done = p.days >= c.goal; return (
            <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: p.color, color: '#fff', fontWeight: 800, fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{p.initial}</span>
              <div style={{ flex: 1, height: 12, borderRadius: 6, background: '#efe9e0', overflow: 'hidden' }}><span style={{ display: 'block', width: Math.min(100, p.days / c.goal * 100) + '%', height: '100%', background: p.color }} /></div>
              <span style={{ fontSize: 12, fontWeight: 800, color: done ? '#6f9c5a' : '#9a9186', width: 36, textAlign: 'right' }}>{done ? '✓ ' : ''}{p.days}/{c.goal}</span>
            </div>
          ); })}
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
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>{people.map(p => <Big key={p.uid} p={p} />)}</div>
      </div>
      {c.muscleFocus && c.muscleFocus.length > 0 && (() => { const max = Math.max(...c.muscleFocus.map(x => x.total)); return (
        <div style={card}>
          <span style={upper}>This week's muscle focus</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 10 }}>
            {c.muscleFocus.map(m => (
              <div key={m.group} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 62, fontSize: 12.5, fontWeight: 800, color: '#3a352f', flexShrink: 0 }}>{m.group}</span>
                <div style={{ flex: 1, display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: '#efe9e0' }}>{m.perPerson.filter(p => p.sets > 0).map(p => <span key={p.uid} title={p.sets + ' sets'} style={{ width: (p.sets / max * 100) + '%', background: p.color }} />)}</div>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#9a9186', width: 18, textAlign: 'right' }}>{m.total}</span>
              </div>
            ))}
          </div>
        </div>
      ); })()}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <span style={upper}>Personal records — heaviest 🏆</span>
        {rows.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#b3a99c', fontWeight: 600, fontSize: 14, padding: '24px 10px' }}>Log some sets to compare PRs.</div>}
        {rows.map(r => (
          <div key={r.exercise} style={{ ...card, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 800, color: '#3a352f' }}>{r.exercise}</span>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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

function PhotoCompare({ v }) {
  const photos = v.body.filter(b => b.photo).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const [li, setLi] = useState(0);
  const [ri, setRi] = useState(Math.max(0, photos.length - 1));
  const close = () => v.a.set({ photoCompare: false });
  if (!photos.length) { return <Overlay onClose={close} z={1260}><Sheet stop={v.stop} maxWidth={420}><div style={{ padding: 30, textAlign: 'center', color: '#b3a99c', fontWeight: 600 }}>No progress photos yet.</div></Sheet></Overlay>; }
  const L = photos[Math.min(li, photos.length - 1)], R = photos[Math.min(ri, photos.length - 1)];
  const Side = ({ p, idx, set }) => (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ width: '100%', aspectRatio: '3/4', background: '#f2ece2', borderRadius: 12, overflow: 'hidden' }}><img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
      <div style={{ position: 'relative' }}>
        <select value={idx} onChange={(e) => set(Number(e.target.value))} style={{ ...selStyle, width: '100%' }}>{photos.map((x, i) => <option key={x.id} value={i}>{shortDate(x.date)}{x.byName ? ' · ' + x.byName : ''}{x.weight != null ? ' · ' + x.weight + x.unit : ''}</option>)}</select>
        <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#b3a99c' }}><FI.Chevron size={12} /></span>
      </div>
    </div>
  );
  return (
    <Overlay onClose={close} z={1260}>
      <Sheet stop={v.stop} maxWidth={440}>
        <div style={{ padding: '20px 22px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><h2 style={modalTitle}>Progress photos</h2><button onClick={close} aria-label="Close" style={closeX}>×</button></div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px 8px', display: 'flex', gap: 10 }}><Side p={L} idx={li} set={setLi} /><Side p={R} idx={ri} set={setRi} /></div>
        <div style={{ padding: '12px 22px 20px' }}><button onClick={close} style={{ ...cancelBtn, flex: 'none', width: '100%' }}>Done</button></div>
      </Sheet>
    </Overlay>
  );
}
function SessionsView({ v }) {
  const sessions = v.sessions || [];
  const open = v.s.sessionOpen ? sessions.find(s => s.key === v.s.sessionOpen) : null;
  return (
    <Fragment>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sessions.map(s => (
          <div key={s.key} onClick={() => v.a.set({ sessionOpen: s.key })} style={{ ...card, padding: '14px 16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#3a352f', fontFamily: "'Quicksand',sans-serif" }}>{s.title}</span>
                  {s.isPR && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#a8822f', background: '#f6edd6', padding: '2px 7px', borderRadius: 999 }}>🏆 PR</span>}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#9a9186', marginTop: 2 }}>{s.count} exercise{s.count === 1 ? '' : 's'}{s.volume > 0 ? ' · ' + s.volume.toLocaleString() + ' vol' : ''}</div>
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#9a9186', flexShrink: 0 }}><Avi color={s.color} initial={s.initial} />{shortDate(s.date)}</span>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#b3a99c', marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.preview}</div>
          </div>
        ))}
        {!v.s.syncing && sessions.length === 0 && <div style={{ textAlign: 'center', padding: '34px 10px', color: '#b3a99c', fontWeight: 600, fontSize: 14 }}>No workouts yet — log a few sets and they’ll group into days here.</div>}
      </div>
      {open && (
        <Overlay onClose={() => v.a.set({ sessionOpen: null })}>
          <Sheet stop={v.stop} maxWidth={420}>
            <div style={{ padding: '20px 22px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div><h2 style={modalTitle}>{open.title}</h2><div style={{ fontSize: 12.5, fontWeight: 700, color: '#9a9186', marginTop: 3 }}>{open.who} · {shortDate(open.date)} · {open.count} exercise{open.count === 1 ? '' : 's'}{open.volume > 0 ? ' · ' + open.volume.toLocaleString() + ' vol' : ''}</div></div>
              <button onClick={() => v.a.set({ sessionOpen: null })} aria-label="Close" style={closeX}>×</button>
            </div>
            <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {open.items.map(w => (
                <div key={w.id} style={{ background: '#fff', border: '1px solid #f0ebe2', borderRadius: 13, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}><span style={{ fontSize: 14.5, fontWeight: 800, color: '#3a352f' }}>{w.exercise}</span>{w.isPR && <span style={{ fontSize: 10, fontWeight: 800, color: '#a8822f', background: '#f6edd6', padding: '2px 6px', borderRadius: 999 }}>🏆</span>}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#7a7166', marginTop: 2 }}>{w.summary}</div>
                  </div>
                </div>
              ))}
            </div>
          </Sheet>
        </Overlay>
      )}
    </Fragment>
  );
}
function Board({ v, isDesktop, primary, partner }) {
  const tab = v.s.tab;
  const addBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: isDesktop ? '12px 22px' : 14, fontWeight: 800, fontSize: isDesktop ? 14.5 : 15, cursor: 'pointer', fontFamily: 'inherit', width: isDesktop ? 'auto' : '100%' };
  const TabBtn = ({ id, label }) => <button onClick={() => v.a.set({ tab: id })} style={{ flex: 1, padding: '9px 4px', borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, whiteSpace: 'nowrap', background: tab === id ? '#fff' : 'transparent', color: tab === id ? '#3a352f' : '#9a9186', boxShadow: tab === id ? '0 1px 2px rgba(58,53,47,.06)' : 'none' }}>{label}</button>;
  const legend = (series) => series.length > 1 && <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>{series.map((s, i) => <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#7a7166' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />{s.name}</span>)}</div>;

  return (
    <div style={{ padding: isDesktop ? '38px 44px 46px' : '28px 18px 40px', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 640, margin: '0 auto' }}>
      {isDesktop
        ? <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}><Brand titleSize={34} subSize={15} dot={20} />{tab !== 'compare' && <button onClick={() => v.a.set(tab === 'body' ? { bAddOpen: true } : { wAddOpen: true })} style={addBtn}><FI.Plus size={17} />{tab === 'body' ? 'Log body stats' : 'Log a set'}</button>}</div>
        : <Fragment><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}><Brand titleSize={30} subSize={13.5} dot={18} /></div></Fragment>}

      <div style={{ display: 'flex', gap: 4, background: '#ece6db', borderRadius: 13, padding: 4 }}><TabBtn id="workouts" label="🏋️ Log" /><TabBtn id="sessions" label="📅 Days" /><TabBtn id="body" label="📊 Body" /><TabBtn id="compare" label="🏆 Compare" /></div>
      {!isDesktop && tab !== 'compare' && <button onClick={() => v.a.set(tab === 'body' ? { bAddOpen: true } : { wAddOpen: true })} style={addBtn}><FI.Plus size={16} />{tab === 'body' ? 'Log body stats' : 'Log a set'}</button>}

      {tab === 'sessions' ? <SessionsView v={v} /> : tab === 'compare' ? <CompareSection v={v} /> : tab === 'workouts' ? (
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
                  {[{ id: 'weight', label: 'Weight' }, { id: 'e1rm', label: '1RM' }, { id: 'volume', label: 'Volume' }].map(o => <button key={o.id} onClick={() => v.a.set({ workoutMetric: o.id })} style={{ border: 'none', borderRadius: 7, padding: '5px 10px', fontFamily: 'inherit', fontWeight: 800, fontSize: 12, cursor: 'pointer', background: v.workoutMetric === o.id ? '#fff' : 'transparent', color: v.workoutMetric === o.id ? '#3a352f' : '#9a9186' }}>{o.label}</button>)}
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
                  <button onClick={(ev) => { ev.stopPropagation(); w.duplicate(); }} title="Duplicate to today" aria-label="Duplicate to today" style={{ border: 'none', background: 'none', color: '#cbb9a2', cursor: 'pointer', padding: 8, lineHeight: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button>
                  <button onClick={(ev) => { ev.stopPropagation(); w.remove(); }} title="Delete" aria-label="Delete workout" style={{ border: 'none', background: 'none', color: '#cbb9a2', cursor: 'pointer', padding: 8, lineHeight: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FI.Trash size={16} /></button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {w.reactions.map(r => <button key={r.emoji} onClick={() => w.react(r.emoji)} title={r.names.join(', ')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid ' + (r.mine ? '#e7d3a3' : '#ece6db'), background: r.mine ? '#fdf8ee' : '#fff', borderRadius: 999, padding: '3px 9px', fontSize: 12.5, fontWeight: 800, color: '#7a7166', cursor: 'pointer', fontFamily: 'inherit' }}>{r.emoji} {r.count}</button>)}
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => v.a.set({ reactOpen: v.s.reactOpen === w.id ? null : w.id })} aria-label="Add reaction" style={{ border: 'none', background: 'none', color: '#c3bbae', cursor: 'pointer', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', padding: '6px 9px' }}>{w.reactions.length ? '＋' : '☺ React'}</button>
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
          {(() => { const p = v.myProfile || {}; const age = p.birth_year ? (new Date().getFullYear() - p.birth_year) : null; const sexL = { male: 'Male', female: 'Female' }[p.sex] || '—'; const St = ({ label, val }) => <div style={{ minWidth: 56 }}><div style={{ fontSize: 10.5, fontWeight: 800, color: '#aaa093', letterSpacing: '.4px', textTransform: 'uppercase' }}>{label}</div><div style={{ fontSize: 16, fontWeight: 800, color: '#3a352f', marginTop: 1 }}>{val}</div></div>; return (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={upper}>My stats</span>
                <button onClick={v.a.openFpEdit} style={{ border: '1px solid #e6ded2', background: '#fff', color: '#7a7166', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 800, cursor: 'pointer' }}>{v.myProfile ? 'Edit' : '+ Add'}</button>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 11, flexWrap: 'wrap' }}>
                <St label="Height" val={p.height_cm ? p.height_cm + ' cm' : '—'} />
                <St label="Weight" val={p.weight_kg ? p.weight_kg + ' kg' : '—'} />
                <St label="Age" val={age || '—'} />
                <St label="Sex" val={sexL} />
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: '#9a9186', fontWeight: 700 }}>{p.stats_visible === false ? '🙈 Hidden from others in this space' : '👀 Visible to your space'}</div>
            </div>
          ); })()}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
              <span style={upper}>Trend</span>
              <div style={{ position: 'relative' }}><select value={v.bodyMetric} onChange={(e) => v.a.set({ bodyMetric: e.target.value })} style={selStyle}><option value="weight">Weight</option><option value="fat">Body fat %</option><option value="muscle">Muscle mass</option></select><span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#b3a99c' }}><FI.Chevron size={12} /></span></div>
            </div>
            <LineChart series={v.bSeries} />
            {legend(v.bSeries)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={upper}>{v.body.length} entr{v.body.length === 1 ? 'y' : 'ies'}</span>
              {v.body.some(b => b.photo) && <button onClick={() => v.a.set({ photoCompare: true })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e6ded2', borderRadius: 10, padding: '7px 12px', fontSize: 12.5, fontFamily: 'inherit', color: '#7a7166', fontWeight: 800, cursor: 'pointer' }}>📷 Compare photos</button>}
            </div>
            {v.body.map(b => (
              <div key={b.id} style={{ ...card, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                {b.photo && <img src={b.photo} alt="" style={{ width: 40, height: 40, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#3a352f' }}>{b.weight != null ? b.weight + ' ' + b.unit : '—'}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#7a7166', marginTop: 2 }}>{[b.bodyFat != null ? 'fat ' + b.bodyFat + '%' : null, b.muscleMass != null ? 'muscle ' + b.muscleMass : null].filter(Boolean).join(' · ') || ' '}</div>
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#9a9186' }}><Avi color={b.color} initial={b.initial} />{shortDate(b.date)}</span>
                <button onClick={b.remove} title="Delete" aria-label="Delete body entry" style={{ border: 'none', background: 'none', color: '#cbb9a2', cursor: 'pointer', padding: 8, lineHeight: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FI.Trash size={16} /></button>
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
      <AddWorkout v={v} primary={primary} /><EditWorkout v={v} primary={primary} /><AddBody v={v} primary={primary} /><FpEditModal v={v} primary={primary} /><RoutinesModal v={v} primary={primary} /><RoutineEditor v={v} primary={primary} />{v.s.photoCompare && <PhotoCompare v={v} />}
      <TweaksPanel title="Tweaks"><TweakSection label="People"><TweakColor label="Primary" value={tweaks.primaryColor} onChange={(c) => setTweak('primaryColor', c)} options={['#c98a5c', '#d97757', '#cf6a52', '#b07d42']} /><TweakColor label="Partner" value={tweaks.partnerColor} onChange={(c) => setTweak('partnerColor', c)} options={['#8a9b6e', '#6f8050', '#5e827b', '#7e6f86']} /></TweakSection></TweaksPanel>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
