// wishlist-app.jsx — Together "Wishlist".
// A shared list of things you want from anywhere. Paste a product link and it
// best-effort auto-fills title/image/price (via the free togetherkit-unfurl
// Worker); where a shop blocks that, add a photo + details yourself. Same kit
// as the other apps. Helpers namespaced (WI / WAvatar / WSwipeRow).

const { useState, useRef, useMemo, useEffect, Fragment } = React;
const WI = window.Icons;
const UNFURL = 'https://togetherkit-unfurl.kitikornr.workers.dev';

const rowToWish = (r) => ({ id: r.id, url: r.url || '', title: r.title || '', image: r.image || null, price: r.price || '', currency: r.currency || '', site: r.site || '', note: r.note || '', forWho: r.for_who || '', byUser: r.by_user, byName: r.by_name, date: r.date, got: !!r.got, important: !!r.important, pos: Number(r.pos) || 0 });
const wishToRow = (w, hs) => ({ id: w.id, homespace_id: hs, url: w.url || null, title: w.title, image: w.image || null, price: w.price || null, currency: w.currency || null, site: w.site || null, note: w.note || null, for_who: w.forWho || null, by_user: w.byUser, by_name: w.byName, date: w.date, got: !!w.got, important: !!w.important, pos: w.pos || 0 });

const priceNum = (p) => { const n = parseFloat(String(p || '').replace(/[^0-9.]/g, '')); return isNaN(n) ? null : n; };
const priceText = (w) => { if (!w.price) return ''; const sym = { THB: '฿', USD: '$', EUR: '€', GBP: '£', JPY: '¥' }[w.currency] || (w.currency ? w.currency + ' ' : ''); return sym + w.price; };

async function unfurl(url) {
  try {
    const r = await fetch(UNFURL + '/?url=' + encodeURIComponent(url));
    if (!r.ok) return null;
    const d = await r.json();
    if (d && !d.error) return d;
  } catch (e) {}
  return null;
}

// Split a blob of pasted text into clean http(s) URLs (newlines, commas or
// spaces all work), bare domains get https://, deduped, capped.
function parseUrls(text) {
  const raw = (text || '').split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  const seen = new Set(); const out = [];
  for (let u of raw) {
    if (!/^https?:\/\//i.test(u)) { if (/^[\w-]+(\.[\w-]+)+/.test(u)) u = 'https://' + u; else continue; }
    if (!seen.has(u)) { seen.add(u); out.push(u); }
  }
  return out.slice(0, 40);
}
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return 'link'; } }
async function mapLimit(arr, limit, fn) { let i = 0; const run = async () => { while (i < arr.length) { const idx = i++; await fn(arr[idx], idx); } }; await Promise.all(Array.from({ length: Math.min(limit, arr.length || 1) }, run)); }

function useWishStore(homespaceId, me) {
  const BE = window.TogetherBackend; const { client } = BE;
  const [state, setState] = useState(() => ({
    items: [], syncing: true, statusFilter: 'all', sortMode: 'new',
    addOpen: false, fetching: false,
    bulkOpen: false, bulkText: '', bulkBusy: 0,
    draft: { url: '', title: '', image: null, price: '', currency: '', site: '', note: '', forWho: '', important: false },
    detailId: null, editing: false, edit: { title: '', price: '', note: '', forWho: '', url: '' },
    bugOpen: false, bugSent: false, bugText: '',
  }));
  const patch = (p) => setState(s => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
  const ref = useRef(state); ref.current = state;
  const meRef = useRef(me); meRef.current = me;
  const db = (p) => { Promise.resolve(p).then(r => { if (r && r.error) console.warn('[togetherkit/wishlist] sync', r.error.message); }, e => console.warn('[togetherkit/wishlist] sync', e)); };

  useEffect(() => {
    if (!homespaceId) return; let alive = true; patch({ syncing: true });
    const refetch = async () => { const r = await client.from('wishlist').select('*').eq('homespace_id', homespaceId).order('pos', { ascending: false }); if (!alive) return; patch({ items: (r.data || []).map(rowToWish), syncing: false }); };
    refetch();
    const ch = client.channel('wishlist:' + homespaceId).on('postgres_changes', { event: '*', schema: 'public', table: 'wishlist', filter: 'homespace_id=eq.' + homespaceId }, refetch).subscribe();
    return () => { alive = false; client.removeChannel(ch); };
  }, [client, homespaceId]);

  const actions = useMemo(() => ({
    set: patch,
    setDraft: (p) => patch(s => ({ draft: { ...s.draft, ...p } })),
    autofill: async (url) => {
      const u = (url || '').trim(); if (!/^https?:\/\//i.test(u)) return;
      patch({ fetching: true });
      const d = await unfurl(u);
      patch(s => ({ fetching: false, draft: { ...s.draft, title: s.draft.title || (d && d.title) || '', image: s.draft.image || (d && d.image) || null, price: s.draft.price || (d && d.price) || '', currency: s.draft.currency || (d && d.currency) || '', site: (d && d.site) || s.draft.site } }));
    },
    addItem: () => {
      const s = ref.current, d = s.draft, m = meRef.current || { uid: null, name: 'Me' };
      const title = (d.title || '').trim() || (d.site ? d.site + ' item' : 'Wishlist item');
      if (!(d.title || '').trim() && !(d.url || '').trim() && !d.image) return;
      const w = { id: BE.newId(), url: d.url, title, image: d.image, price: d.price, currency: d.currency, site: d.site, note: d.note, forWho: d.forWho, byUser: m.uid, byName: m.name, date: 'Today', got: false, important: d.important, pos: Date.now() };
      patch(st => ({ items: [w, ...st.items], addOpen: false, draft: { url: '', title: '', image: null, price: '', currency: '', site: '', note: '', forWho: '', important: false } }));
      db(client.from('wishlist').insert(wishToRow(w, homespaceId)));
    },
    bulkAdd: async () => {
      const s = ref.current, m = meRef.current || { uid: null, name: 'Me' };
      const urls = parseUrls(s.bulkText); if (!urls.length) return;
      const base = Date.now();
      const rows = urls.map((url, i) => ({ id: BE.newId(), url, title: hostOf(url), image: null, price: '', currency: '', site: hostOf(url), note: '', forWho: '', byUser: m.uid, byName: m.name, date: 'Today', got: false, important: false, pos: base - i }));
      // 1) insert all immediately (fill now) so they show right away
      patch(st => ({ items: [...rows, ...st.items], bulkOpen: false, bulkText: '', bulkBusy: rows.length }));
      db(client.from('wishlist').insert(rows.map(w => wishToRow(w, homespaceId))));
      // 2) enrich each in the background (fill later) — patch title/image/price as they land
      await mapLimit(rows, 4, async (w) => {
        const d = await unfurl(w.url);
        if (d && (d.title || d.image || d.price)) {
          const upd = { title: (d.title || w.title), image: d.image || null, price: d.price || '', currency: d.currency || '', site: d.site || w.site };
          patch(st => ({ items: st.items.map(x => x.id === w.id ? { ...x, ...upd } : x) }));
          db(client.from('wishlist').update({ title: upd.title, image: upd.image || null, price: upd.price || null, currency: upd.currency || null, site: upd.site || null, updated_at: new Date().toISOString() }).eq('id', w.id));
        }
        patch(st => ({ bulkBusy: Math.max(0, st.bulkBusy - 1) }));
      });
    },
    remove: (id) => { patch(s => ({ items: s.items.filter(i => i.id !== id) })); db(client.from('wishlist').delete().eq('id', id)); },
    toggleGot: (id) => { const it = ref.current.items.find(x => x.id === id); if (!it) return; patch(s => ({ items: s.items.map(x => x.id === id ? { ...x, got: !x.got } : x) })); db(client.from('wishlist').update({ got: !it.got, updated_at: new Date().toISOString() }).eq('id', id)); },
    toggleImportant: (id) => { const it = ref.current.items.find(x => x.id === id); if (!it) return; patch(s => ({ items: s.items.map(x => x.id === id ? { ...x, important: !x.important } : x) })); db(client.from('wishlist').update({ important: !it.important, updated_at: new Date().toISOString() }).eq('id', id)); },
    startEdit: () => { const it = ref.current.items.find(x => x.id === ref.current.detailId); if (!it) return; patch({ editing: true, edit: { title: it.title, price: it.price, note: it.note, forWho: it.forWho, url: it.url } }); },
    duplicateItem: () => { const it = ref.current.items.find(x => x.id === ref.current.detailId); if (!it) return; patch({ detailId: null, editing: false, addOpen: true, draft: { url: it.url || '', title: it.title || '', image: it.image || null, price: it.price || '', currency: it.currency || '', site: it.site || '', note: it.note || '', forWho: it.forWho || '', important: it.important } }); },
    setEdit: (p) => patch(s => ({ edit: { ...s.edit, ...p } })),
    saveEdit: () => { const s = ref.current, e = s.edit, title = (e.title || '').trim(); if (!title) return; patch(st => ({ editing: false, items: st.items.map(i => i.id === st.detailId ? { ...i, title, price: e.price, note: e.note, forWho: e.forWho, url: e.url } : i) })); db(client.from('wishlist').update({ title, price: e.price || null, note: e.note || null, for_who: e.forWho || null, url: e.url || null, updated_at: new Date().toISOString() }).eq('id', s.detailId)); },
    deleteDetail: () => { const id = ref.current.detailId; patch({ detailId: null, editing: false }); patch(s => ({ items: s.items.filter(i => i.id !== id) })); db(client.from('wishlist').delete().eq('id', id)); },
    sendBug: () => { try { console.info('[Together] Bug', { feature: 'wishlist' }); } catch (e) {} patch({ bugSent: true }); },
  }), [client, homespaceId, BE]);
  return [state, actions];
}

/* ── style fragments ──────────────────────────────────────────────────────── */
const upper = { fontSize: 11, fontWeight: 800, color: '#aaa093', letterSpacing: '.6px', textTransform: 'uppercase' };
const closeX = { flexShrink: 0, width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#ece6db', color: '#857c70', fontSize: 17, cursor: 'pointer', lineHeight: 1 };
const fieldInput = { border: '1px solid #ece6db', background: '#fff', borderRadius: 13, padding: '13px 15px', fontSize: 15, fontFamily: 'inherit', color: '#3a352f', outline: 'none', fontWeight: 700, width: '100%' };
const cancelBtn = { flex: 1, background: '#fff', color: '#7a7166', border: '1px solid #e6ded2', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' };
const modalTitle = { fontFamily: "'Quicksand',sans-serif", fontSize: 23, fontWeight: 700, margin: 0, color: '#3a352f' };
const priceBadge = { fontSize: 13, fontWeight: 800, color: '#6f7d52', background: '#eef1e6', padding: '2px 9px', borderRadius: 8 };
function WAvatar({ color, initial, size = 20 }) { return <span style={{ width: size, height: size, borderRadius: '50%', background: color, color: '#fff', fontWeight: 800, fontSize: size * 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initial}</span>; }
function Overlay({ onClose, z = 1200, children }) { return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: z, background: 'rgba(58,53,47,.42)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, animation: 'tog-fade .15s ease' }}>{children}</div>; }
function Sheet({ stop, maxWidth, children, style }) { return <div onClick={stop} style={{ width: '100%', maxWidth, background: '#f6f4ef', borderRadius: 26, boxShadow: '0 24px 60px rgba(58,53,47,.34)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column', animation: 'tog-pop .18s ease', ...style }}>{children}</div>; }
function Thumb({ src, size = 64 }) { return <span style={{ width: size, height: size, borderRadius: 13, background: '#f2ece2', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9bfae' }}>{src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} /> : <WI.Heart size={Math.round(size * 0.42)} />}</span>; }

function WSwipeRow({ onDelete, onComplete, completeLabel = 'Got it', completeColor = '#6f9c5a', radius = 18, children }) {
  const [dx, setDx] = useState(0); const [dragging, setDragging] = useState(false); const [removing, setRemoving] = useState(false);
  const st = useRef(null); const dxRef = useRef(0); const movedRef = useRef(false); const THRESHOLD = 88, MAX = 128;
  const applyDx = (n) => { dxRef.current = n; setDx(n); };
  const down = (e) => { if (removing) return; if (e.target.closest('button, a, input, select, label, textarea')) return; st.current = { x: e.clientX, y: e.clientY, active: false }; movedRef.current = false; };
  const move = (e) => { if (!st.current || removing) return; const dX = e.clientX - st.current.x, dY = e.clientY - st.current.y; if (!st.current.active) { if (Math.abs(dX) > 8 && Math.abs(dX) > Math.abs(dY)) { st.current.active = true; setDragging(true); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} } else if (Math.abs(dY) > 10) { st.current = null; return; } } if (st.current && st.current.active) { const next = Math.max(-MAX, Math.min(onComplete ? MAX : 0, dX)); applyDx(next); if (Math.abs(next) > 6) movedRef.current = true; } };
  const finish = () => { if (!st.current) { setDragging(false); return; } const active = st.current.active; st.current = null; setDragging(false); if (!active) return; if (dxRef.current <= -THRESHOLD) { setRemoving(true); window.setTimeout(() => onDelete && onDelete(), 200); } else if (onComplete && dxRef.current >= THRESHOLD) { applyDx(0); onComplete(); } else applyDx(0); };
  return (
    <div style={{ position: 'relative' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: radius, background: '#c4604c', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingRight: 22, color: '#fff', fontWeight: 800, fontSize: 14, opacity: (dx < 0 || removing) ? 1 : 0 }}><WI.Trash size={17} /> Delete</div>
      {onComplete && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: radius, background: completeColor, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, paddingLeft: 22, color: '#fff', fontWeight: 800, fontSize: 14, opacity: dx > 0 ? 1 : 0 }}><WI.Check size={16} color="#fff" /> {completeLabel}</div>}
      <div onPointerDown={down} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onClickCapture={(e) => { if (movedRef.current) { e.preventDefault(); e.stopPropagation(); movedRef.current = false; } }} style={{ position: 'relative', transform: removing ? 'translateX(-110%)' : ('translateX(' + dx + 'px)'), transition: dragging ? 'none' : 'transform .2s cubic-bezier(.3,.7,.4,1), opacity .2s ease', opacity: removing ? 0 : 1, touchAction: 'pan-y' }}>{children}</div>
    </div>
  );
}

function WishCard({ w, partner }) {
  return (
    <div onClick={w.open} style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: 14, background: '#fff', borderRadius: 18, cursor: 'pointer', border: w.important ? '1.5px solid #e7d3a3' : '1px solid transparent', boxShadow: '0 1px 2px rgba(58,53,47,.05),0 6px 16px rgba(58,53,47,.035)', opacity: w.got ? 0.66 : 1 }}>
      <Thumb src={w.image} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15.5, fontWeight: 800, color: '#3a352f', textDecoration: w.got ? 'line-through' : 'none', fontFamily: "'Quicksand',sans-serif" }}>{w.title}</span>
          {w.priceText && <span style={priceBadge}>{w.priceText}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
          {w.site && <span style={{ fontSize: 12, fontWeight: 700, color: '#9a9186', background: '#f2ece2', padding: '2px 8px', borderRadius: 7 }}>{w.site}</span>}
          {w.forWho && <span style={{ fontSize: 12, fontWeight: 700, color: '#7e6f86', background: '#efe8f1', padding: '2px 8px', borderRadius: 7 }}>for {w.forWho}</span>}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#9a9186', fontSize: 12, fontWeight: 600 }}><WAvatar color={w.byColor} initial={w.byInitial} size={18} />{w.byName}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {w.url && <a href={w.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Open link" style={{ color: '#a8794f', lineHeight: 0 }}><WI.External size={18} /></a>}
        <button onClick={w.star} title="Important" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', lineHeight: 0 }}><WI.Star size={18} filled={w.important} /></button>
      </div>
    </div>
  );
}

function AddModal({ v, primary }) {
  if (!v.s.addOpen) return null;
  const d = v.s.draft;
  const onIconFile = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const S = 320, c = document.createElement('canvas'); const ratio = Math.min(1, S / Math.max(img.width, img.height)); c.width = img.width * ratio; c.height = img.height * ratio; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); v.a.setDraft({ image: c.toDataURL('image/jpeg', 0.82) }); }; img.src = r.result; }; r.readAsDataURL(f); };
  return (
    <Overlay onClose={() => v.a.set({ addOpen: false })}>
      <Sheet stop={v.stop} maxWidth={400}>
        <div style={{ padding: '22px 22px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><h2 style={modalTitle}>Add to wishlist</h2><button onClick={() => v.a.set({ addOpen: false })} style={closeX}>×</button></div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={d.url} onChange={(e) => v.a.setDraft({ url: e.target.value })} onBlur={(e) => v.a.autofill(e.target.value)} onPaste={(e) => { const t = (e.clipboardData || window.clipboardData).getData('text'); if (t) window.setTimeout(() => v.a.autofill(t), 50); }} placeholder="Paste a product link (any shop)" style={{ ...fieldInput, fontWeight: 600, fontSize: 14 }} autoFocus />
              <button onClick={() => v.a.autofill(d.url)} disabled={v.s.fetching || !/^https?:\/\//i.test(d.url || '')} style={{ flexShrink: 0, background: /^https?:\/\//i.test(d.url || '') ? primary : '#d9cfc0', color: '#fff', border: 'none', borderRadius: 12, padding: '0 16px', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>{v.s.fetching ? '…' : 'Fetch'}</button>
            </div>
            <p style={{ margin: '6px 2px 0', fontSize: 11.5, color: '#b3a99c', fontWeight: 600 }}>We’ll auto-fill where the shop allows. Otherwise just add a photo &amp; details below.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <label style={{ cursor: 'pointer', flexShrink: 0 }} title="Add a photo"><Thumb src={d.image} size={72} /><input type="file" accept="image/*" onChange={onIconFile} style={{ display: 'none' }} /></label>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={d.title} onChange={(e) => v.a.setDraft({ title: e.target.value })} placeholder="What is it?" style={{ ...fieldInput, fontFamily: "'Quicksand',sans-serif", fontSize: 16, padding: '11px 13px' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={d.price} onChange={(e) => v.a.setDraft({ price: e.target.value })} placeholder="Price" style={{ ...fieldInput, padding: '11px 13px', fontSize: 14, width: '50%' }} />
                <input value={d.forWho} onChange={(e) => v.a.setDraft({ forWho: e.target.value })} placeholder="For who?" style={{ ...fieldInput, padding: '11px 13px', fontSize: 14, width: '50%', fontWeight: 600 }} />
              </div>
            </div>
          </div>
          <textarea value={d.note} onChange={(e) => v.a.setDraft({ note: e.target.value })} placeholder="Note · size, colour, why…" style={{ width: '100%', minHeight: 70, resize: 'vertical', border: '1px solid #ece6db', background: '#fff', borderRadius: 14, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', fontWeight: 600, color: '#3a352f', outline: 'none', lineHeight: 1.5 }} />
          <button onClick={() => v.a.setDraft({ important: !d.important })} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', borderRadius: 13, border: '1px solid ' + (d.important ? '#e7d3a3' : '#ece6db'), background: d.important ? '#fdf8ee' : '#fff', color: d.important ? '#a8822f' : '#7a7166', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}><WI.Star size={18} filled={d.important} color={d.important ? undefined : '#b9ad97'} /><span style={{ flex: 1, textAlign: 'left' }}>Mark as important</span></button>
        </div>
        <div style={{ padding: '14px 22px 22px', display: 'flex', gap: 10 }}><button onClick={() => v.a.set({ addOpen: false })} style={cancelBtn}>Cancel</button><button onClick={v.a.addItem} style={{ flex: 2, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button></div>
      </Sheet>
    </Overlay>
  );
}

function BulkModal({ v, primary }) {
  if (!v.s.bulkOpen) return null;
  const urls = parseUrls(v.s.bulkText);
  const ph = 'Paste links — one per line (or comma-separated)\n\nhttps://www.amazon.com/...\nhttps://shopee.co.th/...\nhttps://www.lazada.co.th/...';
  return (
    <Overlay onClose={() => v.a.set({ bulkOpen: false })}>
      <Sheet stop={v.stop} maxWidth={400}>
        <div style={{ padding: '22px 22px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}><h2 style={modalTitle}>Bulk add links</h2><button onClick={() => v.a.set({ bulkOpen: false })} style={closeX}>×</button></div>
        <div style={{ padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea value={v.s.bulkText} onChange={(e) => v.a.set({ bulkText: e.target.value })} placeholder={ph} autoFocus style={{ width: '100%', minHeight: 168, resize: 'vertical', border: '1px solid #ece6db', background: '#fff', borderRadius: 14, padding: '13px 14px', fontSize: 13.5, fontFamily: 'inherit', fontWeight: 600, color: '#3a352f', outline: 'none', lineHeight: 1.6 }} />
          <p style={{ margin: '0 2px', fontSize: 11.5, color: '#b3a99c', fontWeight: 600 }}>We add them now and pull the photo/title/price for each in the background — whatever the shop allows. Edit anything later.</p>
        </div>
        <div style={{ padding: '14px 22px 22px', display: 'flex', gap: 10 }}>
          <button onClick={() => v.a.set({ bulkOpen: false })} style={cancelBtn}>Cancel</button>
          <button onClick={v.a.bulkAdd} disabled={!urls.length} style={{ flex: 2, background: urls.length ? primary : '#d9cfc0', color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: urls.length ? 'pointer' : 'default', fontFamily: 'inherit' }}>{urls.length ? ('Add ' + urls.length + ' item' + (urls.length === 1 ? '' : 's')) : 'Add'}</button>
        </div>
      </Sheet>
    </Overlay>
  );
}
function DetailModal({ v, primary, partner }) {
  const w = v.detail; if (!w) return null;
  const editing = v.s.editing, e = v.s.edit;
  return (
    <Overlay onClose={() => v.a.set({ detailId: null, editing: false })} z={1000}>
      <Sheet stop={v.stop} maxWidth={400} style={{ maxHeight: '92vh' }}>
        <div className="tog-scroll" style={{ overflowY: 'auto' }}>
          {w.image && !editing && <div style={{ width: '100%', height: 200, background: '#f2ece2', overflow: 'hidden' }}><img src={w.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
          <div style={{ padding: '18px 22px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              {!editing ? <h2 style={{ fontFamily: "'Quicksand',sans-serif", fontSize: 22, fontWeight: 700, margin: 0, color: '#3a352f', lineHeight: 1.15, textDecoration: w.got ? 'line-through' : 'none' }}>{w.title}</h2> : <input value={e.title} onChange={(ev) => v.a.setEdit({ title: ev.target.value })} style={{ flex: 1, ...fieldInput, fontFamily: "'Quicksand',sans-serif", fontSize: 17, padding: '10px 12px' }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}><button onClick={v.a.duplicateItem} title="Duplicate" style={{ border: 'none', background: '#ece6db', color: '#7a7166', width: 30, height: 30, borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button><button onClick={() => v.a.toggleImportant(w.id)} title="Important" style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', lineHeight: 0 }}><WI.Star size={22} filled={w.important} /></button><button onClick={() => v.a.set({ detailId: null, editing: false })} style={closeX}>×</button></div>
            </div>
            {!editing ? (
              <Fragment>
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {w.priceText && <span style={priceBadge}>{w.priceText}</span>}
                  {w.site && <span style={{ fontSize: 12.5, fontWeight: 700, color: '#9a9186', background: '#f2ece2', padding: '3px 9px', borderRadius: 8 }}>{w.site}</span>}
                  {w.forWho && <span style={{ fontSize: 12.5, fontWeight: 700, color: '#7e6f86', background: '#efe8f1', padding: '3px 9px', borderRadius: 8 }}>for {w.forWho}</span>}
                </div>
                {w.note && <p style={{ margin: '14px 0 0', fontSize: 14.5, fontWeight: 600, color: '#4a443c', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{w.note}</p>}
                {w.url && <a href={w.url} target="_blank" rel="noopener noreferrer" style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7, color: '#a8794f', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}><WI.External size={16} />Open the link</a>}
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: '#9a9186' }}><WAvatar color={w.byColor} initial={w.byInitial} size={20} />{w.byName} · {w.date}</div>
              </Fragment>
            ) : (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8 }}><input value={e.price} onChange={(ev) => v.a.setEdit({ price: ev.target.value })} placeholder="Price" style={{ ...fieldInput, padding: '11px 13px', fontSize: 14, width: '50%' }} /><input value={e.forWho} onChange={(ev) => v.a.setEdit({ forWho: ev.target.value })} placeholder="For who?" style={{ ...fieldInput, padding: '11px 13px', fontSize: 14, width: '50%', fontWeight: 600 }} /></div>
                <input value={e.url} onChange={(ev) => v.a.setEdit({ url: ev.target.value })} placeholder="Link" style={{ ...fieldInput, padding: '11px 13px', fontSize: 13, fontWeight: 600 }} />
                <textarea value={e.note} onChange={(ev) => v.a.setEdit({ note: ev.target.value })} placeholder="Note" style={{ width: '100%', minHeight: 80, resize: 'vertical', border: '1px solid #ece6db', background: '#fff', borderRadius: 14, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', fontWeight: 600, color: '#3a352f', outline: 'none', lineHeight: 1.5 }} />
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: '12px 22px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => v.a.toggleGot(w.id)} style={{ background: w.got ? '#f3ece1' : partner, color: w.got ? '#a8794f' : '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>{w.got ? 'Move back to wishlist' : 'Mark as got it 🎁'}</button>
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

function BugModal({ v, primary }) {
  if (!v.s.bugOpen) return null; const s = v.s;
  return (<Overlay onClose={() => v.a.set({ bugOpen: false, bugSent: false })} z={1400}><Sheet stop={v.stop} maxWidth={380}>{!s.bugSent ? (
    <div style={{ padding: '24px 22px' }}><div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}><h2 style={{ ...modalTitle, marginBottom: 4 }}>Report a Problem</h2><button onClick={() => v.a.set({ bugOpen: false })} style={closeX}>×</button></div><textarea value={s.bugText} onChange={(e) => v.a.set({ bugText: e.target.value })} placeholder="Tell us what went wrong…" style={{ marginTop: 16, width: '100%', minHeight: 92, resize: 'vertical', background: '#fff', borderRadius: 14, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', fontWeight: 600, color: '#3a352f', outline: 'none', lineHeight: 1.5, border: '1px solid #ece6db' }} /><div style={{ marginTop: 18, display: 'flex', gap: 10 }}><button onClick={() => v.a.set({ bugOpen: false })} style={cancelBtn}>Cancel</button><button onClick={v.a.sendBug} style={{ flex: 2, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>Send Report</button></div></div>
  ) : (<div style={{ padding: '38px 28px 30px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}><h2 style={{ fontFamily: "'Quicksand',sans-serif", fontSize: 25, fontWeight: 700, margin: 0, color: '#3a352f' }}>Thanks ♥</h2><button onClick={() => v.a.set({ bugOpen: false, bugSent: false, bugText: '' })} style={{ marginTop: 6, width: '100%', background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button></div>)}</Sheet></Overlay>);
}

/* ── view-model ───────────────────────────────────────────────────────────── */
function buildView(state, actions, opts) {
  const { primary, partner, members = [] } = opts;
  const memberByUid = {}; members.forEach(m => { memberByUid[m.uid] = m; });
  const slotColor = (idx) => idx === 0 ? primary : idx === 1 ? partner : '#9a9186';
  const resolveBy = (uid, byName) => { const m = memberByUid[uid]; return m ? { name: m.name, color: slotColor(m.idx) } : { name: byName || 'Someone', color: '#9a9186' }; };
  const sf = state.statusFilter, sortMode = state.sortMode;
  const counts = { all: state.items.length, want: state.items.filter(i => !i.got).length, got: state.items.filter(i => i.got).length, important: state.items.filter(i => i.important).length };
  let vis = state.items.filter(i => sf === 'want' ? !i.got : sf === 'got' ? i.got : sf === 'important' ? i.important : true);
  const idx = vis.map((i, n) => ({ i, n }));
  if (sortMode === 'priceLow') idx.sort((a, b) => (priceNum(a.i.price) ?? 1e15) - (priceNum(b.i.price) ?? 1e15));
  else if (sortMode === 'priceHigh') idx.sort((a, b) => (priceNum(b.i.price) ?? -1) - (priceNum(a.i.price) ?? -1));
  else if (sortMode === 'smart') idx.sort((a, b) => (Number(b.i.important) - Number(a.i.important)) || (Number(a.i.got) - Number(b.i.got)) || (b.i.pos - a.i.pos));
  else idx.sort((a, b) => (b.i.pos || 0) - (a.i.pos || 0));
  vis = idx.map(x => x.i);
  const decorate = (w) => { const u = resolveBy(w.byUser, w.byName); return { id: w.id, title: w.title, image: w.image, url: w.url, site: w.site, forWho: w.forWho, note: w.note, got: w.got, important: w.important, date: w.date, priceText: priceText(w), byName: u.name, byColor: u.color, byInitial: (u.name[0] || '?').toUpperCase(), open: () => actions.set({ detailId: w.id, editing: false }), star: (e) => { e.stopPropagation(); actions.toggleImportant(w.id); }, gotSelf: () => actions.toggleGot(w.id), deleteSelf: () => actions.remove(w.id) }; };
  const mkStatus = (id, name, count, isStar) => { const active = sf === id, accent = isStar ? '#d99a2b' : '#6f665b'; return { id, name, count, star: isStar, select: () => actions.set({ statusFilter: id }), chipStyle: active ? { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: '1px solid ' + accent, background: accent, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' } : { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: '1px solid #ece6db', background: '#fff', color: isStar ? '#a8822f' : '#7a7166', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }, countStyle: active ? { fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,.25)', color: '#fff', borderRadius: 999, padding: '1px 7px', minWidth: 18, textAlign: 'center' } : { fontSize: 11, fontWeight: 800, background: '#f1ece3', color: '#a89e90', borderRadius: 999, padding: '1px 7px', minWidth: 18, textAlign: 'center' } }; };
  return {
    s: state, a: actions, primary, partner, members, stop: (e) => e.stopPropagation(),
    items: vis.map(decorate), isEmpty: vis.length === 0,
    emptyText: sf === 'all' ? 'Nothing here yet — paste a link or add something you want.' : 'Nothing matches this filter.',
    statusFilters: [mkStatus('all', 'All', counts.all, false), mkStatus('want', 'Want', counts.want, false), mkStatus('got', 'Got', counts.got, false), mkStatus('important', 'Important', counts.important, true)],
    sortMode, sortOptions: [{ id: 'new', name: 'Newest' }, { id: 'smart', name: 'Smart order' }, { id: 'priceLow', name: 'Price ↑' }, { id: 'priceHigh', name: 'Price ↓' }], setSortMode: (e) => actions.set({ sortMode: e.target.value }),
    count: counts.all, detail: state.items.find(i => i.id === state.detailId) ? decorate(state.items.find(i => i.id === state.detailId)) : null,
  };
}

/* ── board + shell ────────────────────────────────────────────────────────── */
function Brand({ titleSize, subSize, dot }) {
  return (<a href="../" title="Back to Together" style={{ display: 'flex', flexDirection: 'column', gap: 5, textDecoration: 'none', color: 'inherit' }}><div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}><WI.Logo size={dot} /></div><h1 style={{ fontFamily: "'Quicksand',sans-serif", fontSize: titleSize, fontWeight: 700, margin: 0, color: '#3a352f', letterSpacing: '.3px' }}>Wishlist</h1><p style={{ margin: 0, fontSize: subSize, color: '#9a9186', fontWeight: 600 }}>Things we want · Together</p></a>);
}
function useIsDesktop(bp = 720) { const get = () => typeof window !== 'undefined' && window.innerWidth >= bp; const [d, setD] = useState(get); useEffect(() => { const on = () => setD(get()); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []); return d; }
function Board({ v, isDesktop, primary, partner }) {
  const addBtn = isDesktop ? { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: primary, color: '#fff', border: 'none', borderRadius: 14, padding: '12px 22px', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' } : { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: primary, color: '#fff', border: 'none', borderRadius: 15, padding: 14, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' };
  const bulkBtn = isDesktop ? { display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#7a7166', border: '1px solid #e6ded2', borderRadius: 14, padding: '12px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' } : { flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#7a7166', border: '1px solid #e6ded2', borderRadius: 15, padding: '14px 18px', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' };
  return (
    <div style={{ padding: isDesktop ? '38px 44px 46px' : '28px 18px 40px', display: 'flex', flexDirection: 'column', gap: isDesktop ? 22 : 18 }}>
      {isDesktop ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}><Brand titleSize={34} subSize={15} dot={20} /><div style={{ display: 'flex', gap: 9 }}><button onClick={() => v.a.set({ bulkOpen: true, bulkText: '' })} style={bulkBtn}>Bulk</button><button onClick={() => v.a.set({ addOpen: true })} style={addBtn}><WI.Plus size={17} />Add</button></div></div>
      ) : (
        <Fragment><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}><Brand titleSize={30} subSize={13.5} dot={18} /></div><div style={{ display: 'flex', gap: 9 }}><button onClick={() => v.a.set({ addOpen: true })} style={addBtn}><WI.Plus size={16} />Add</button><button onClick={() => v.a.set({ bulkOpen: true, bulkText: '' })} style={bulkBtn}>Bulk</button></div></Fragment>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>{v.statusFilters.map(s => (<button key={s.id} onClick={s.select} style={s.chipStyle}>{s.star && <WI.Star size={13} filled color="currentColor" />}{s.name}<span style={s.countStyle}>{s.count}</span></button>))}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <span style={upper}>{v.count} item{v.count === 1 ? '' : 's'}{v.s.bulkBusy > 0 ? ' · fetching ' + v.s.bulkBusy + '…' : ''}</span>
        <div style={{ position: 'relative' }}><select value={v.sortMode} onChange={v.setSortMode} style={{ background: '#fff', border: '1px solid #ece6db', borderRadius: 9, padding: '5px 22px 5px 9px', fontSize: 12, fontFamily: 'inherit', color: '#7a7166', fontWeight: 700, outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}>{v.sortOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select><span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#b3a99c' }}><WI.Chevron size={12} /></span></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 12 }}>
        {v.items.map(w => (<WSwipeRow key={w.id} onDelete={w.deleteSelf} onComplete={w.gotSelf} completeLabel={w.got ? 'Undo' : 'Got it'}><WishCard w={w} partner={partner} /></WSwipeRow>))}
      </div>
      {v.s.syncing ? <div style={{ textAlign: 'center', padding: '40px', color: '#b3a99c', fontWeight: 600 }}>Syncing…</div> : (v.isEmpty && <div style={{ textAlign: 'center', padding: '40px 20px', color: '#b3a99c', fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{v.emptyText}</div>)}
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
  const [state, actions] = useWishStore(sx.homespaceId, sx.me);
  const v = buildView(state, actions, { primary, partner, members: sx.members });
  return (
    <div className="app">
      <div className="app-shell"><Board v={v} isDesktop={isDesktop} primary={primary} partner={partner} /></div>
      <HomeButton href="../" />
      <AccountButton sx={sx} onOpen={() => setAccountOpen(true)} />
      {accountOpen && <AccountSheet sx={sx} onClose={() => setAccountOpen(false)} />}
      <button onClick={() => v.a.set({ bugOpen: true, bugSent: false })} title="Report a problem" style={{ position: 'fixed', top: 24, right: 24, zIndex: 900, width: 46, height: 46, borderRadius: '50%', border: '1px solid #ecd9c4', background: '#fffaf3', color: '#b07d42', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(58,53,47,.08),0 8px 20px rgba(58,53,47,.12)' }}><WI.Bug size={21} /></button>
      <AddModal v={v} primary={primary} /><BulkModal v={v} primary={primary} /><DetailModal v={v} primary={primary} partner={partner} /><BugModal v={v} primary={primary} />
      <TweaksPanel title="Tweaks"><TweakSection label="People"><TweakColor label="Primary" value={tweaks.primaryColor} onChange={(c) => setTweak('primaryColor', c)} options={['#c98a5c', '#d97757', '#cf6a52', '#b07d42']} /><TweakColor label="Partner" value={tweaks.partnerColor} onChange={(c) => setTweak('partnerColor', c)} options={['#8a9b6e', '#6f8050', '#5e827b', '#7e6f86']} /></TweakSection></TweaksPanel>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
