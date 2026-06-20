// reorder.jsx — shared hold-and-drag vertical reordering (window.TogetherReorder).
//
// useReorder(ids, onCommit, opts) → { order, dragId, bind }
//   ids       : array of item ids in current display order
//   onCommit  : (newOrderIds) => void  — fired once on drop
//   opts.enabled (default true), opts.holdMs (default 240)
//   order     : ids in live order (reflects the drag in progress) — render with this
//   bind(id)  : spread on each row WRAPPER (ref + pointer handlers + lifted style)
//
// Behaviour: press-and-hold a row (~240ms, no movement) to "pick it up", then
// drag up/down to reposition; release to commit. A quick move before the hold
// fires cancels it, so horizontal swipe / scroll still work on the same rows.

function useReorder(ids, onCommit, opts) {
  opts = opts || {};
  const enabled = opts.enabled !== false;
  const holdMs = opts.holdMs || 240;
  const { useState, useRef, useEffect } = React;
  const [order, setOrder] = useState(ids);
  const [dragId, setDragId] = useState(null);
  const els = useRef({});       // id -> DOM node
  const starts = useRef({});    // id -> {x,y}
  const drag = useRef(null);    // { id, rects:[{id,top,h}] }
  const hold = useRef(null);
  const justDragged = useRef(false);  // suppress the click right after a drop
  const orderRef = useRef(order); orderRef.current = order;
  const idsKey = ids.join('|');

  useEffect(() => { if (!drag.current) { orderRef.current = ids; setOrder(ids); } }, [idsKey]);

  const clearHold = () => { if (hold.current) { clearTimeout(hold.current); hold.current = null; } };
  const measure = () => orderRef.current.map(i => { const el = els.current[i]; if (!el) return null; const r = el.getBoundingClientRect(); return { id: i, top: r.top, h: r.height }; }).filter(Boolean);

  const reorderTo = (clientY) => {
    const d = drag.current; if (!d) return;
    let idx = d.rects.findIndex(r => clientY < r.top + r.h / 2);
    if (idx === -1) idx = d.rects.length - 1;
    const cur = orderRef.current.slice();
    const from = cur.indexOf(d.id); if (from < 0) return;
    const target = Math.max(0, Math.min(cur.length - 1, idx));
    cur.splice(from, 1); cur.splice(target, 0, d.id);
    if (cur.join('|') !== orderRef.current.join('|')) { orderRef.current = cur; setOrder(cur); }
  };

  const endDrag = (commit) => { const had = !!drag.current; drag.current = null; setDragId(null); if (had) { justDragged.current = true; setTimeout(() => { justDragged.current = false; }, 400); if (commit && onCommit) onCommit(orderRef.current.slice()); } };

  if (!enabled) return { order: ids, dragId: null, bind: () => ({}) };

  const bind = (id) => ({
    ref: (el) => { if (el) els.current[id] = el; else { delete els.current[id]; } },
    onClickCapture: (e) => { if (justDragged.current) { e.preventDefault(); e.stopPropagation(); justDragged.current = false; } },
    onPointerDown: (e) => {
      if (e.target.closest('button, input, textarea, select, label')) return;
      starts.current[id] = { x: e.clientX, y: e.clientY };
      clearHold();
      const el = els.current[id], pid = e.pointerId;
      hold.current = setTimeout(() => {
        hold.current = null;
        drag.current = { id, rects: measure() };
        try { el && el.setPointerCapture && el.setPointerCapture(pid); } catch (_) {}
        setDragId(id);
        if (navigator.vibrate) { try { navigator.vibrate(8); } catch (_) {} }
      }, holdMs);
    },
    onPointerMove: (e) => {
      if (drag.current && drag.current.id === id) { e.preventDefault(); reorderTo(e.clientY); return; }
      const s = starts.current[id];
      if (s && hold.current && (Math.abs(e.clientX - s.x) > 6 || Math.abs(e.clientY - s.y) > 6)) clearHold();
    },
    onPointerUp: () => { clearHold(); endDrag(true); },
    onPointerCancel: () => { clearHold(); endDrag(true); },
    style: dragId === id
      ? { position: 'relative', zIndex: 6, boxShadow: '0 14px 34px rgba(58,53,47,.24)', borderRadius: 18, opacity: 0.98, transition: 'none', touchAction: 'none' }
      : { transition: dragId ? 'transform .16s ease' : 'none', touchAction: 'pan-y' },
  });

  return { order, dragId, bind };
}

window.TogetherReorder = { useReorder };
