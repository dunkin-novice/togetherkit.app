// components.jsx — presentational pieces for Together. Each reads from the view
// model (v) built by buildTogetherView and renders the look from the design.
// Attached to window so index.html can compose them.

const { Icons } = window;

// ── shared chip renderers ───────────────────────────────────────────────────
function LabelFilters({ v }) {
  return (
    <React.Fragment>
      {v.filters.map(f => (
        <button key={f.id} onClick={f.select} style={f.chipStyle}>
          {f.showDot && <span style={f.dotStyle} />}
          {f.name}
          <span style={f.countStyle}>{f.count}</span>
        </button>
      ))}
      <button onClick={v.toggleLabels} style={v.newLabelChipStyle}>+ New Label</button>
    </React.Fragment>
  );
}

function StatusFilters({ v }) {
  return (
    <React.Fragment>
      {v.statusFilters.map(s => (
        <button key={s.id} onClick={s.select} style={s.chipStyle}>
          {s.star && <Icons.Star size={13} filled color="currentColor" />}
          {s.name}
          <span style={s.countStyle}>{s.count}</span>
        </button>
      ))}
    </React.Fragment>
  );
}

// ── Labels editor panel ─────────────────────────────────────────────────────
function LabelsPanel({ v, maxWidth }) {
  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '16px', boxShadow: '0 1px 2px rgba(58,53,47,.05),0 8px 22px rgba(58,53,47,.05)', display: 'flex', flexDirection: 'column', gap: 14, maxWidth }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: '#3a352f' }}>Labels</span>
        <button onClick={v.toggleLabels} style={{ background: 'none', border: 'none', color: '#a8794f', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={uppercaseLabel}>Default</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {v.defaultChips.map((d, i) => <span key={i} style={d.style}>{d.name}</span>)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={uppercaseLabel}>Your labels</span>
        {v.hasCustom ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {v.customLabels.map(cl => (
              <div key={cl.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={cl.dotStyle} />
                <input value={cl.name} onChange={cl.rename} style={labelInput} />
                <button onClick={cl.remove} style={{ background: '#f6ece9', border: 'none', color: '#b07a6e', width: 34, height: 34, borderRadius: 10, fontSize: 16, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 13, color: '#b3a99c', fontWeight: 600 }}>No custom labels yet — add one below.</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid #f0ebe2', paddingTop: 14 }}>
        <span style={v.newDotStyle} />
        <input value={v.newLabelName} onChange={v.setNewLabelName} onKeyDown={v.onNewLabelKey} placeholder="New label name…" style={labelInput} />
        <button onClick={v.addLabel} style={{ background: 'var(--partner)', color: '#fff', border: 'none', borderRadius: 11, padding: '10px 16px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Add</button>
      </div>
    </div>
  );
}

// ── Brand header ────────────────────────────────────────────────────────────
function Brand({ titleSize, subSize, dot }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}><Icons.Logo size={dot} /></div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: titleSize, fontWeight: 700, margin: 0, color: '#3a352f', letterSpacing: '.3px' }}>Together</h1>
      <p style={{ margin: 0, fontSize: subSize, color: '#9a9186', fontWeight: 600 }}>Shared shopping list for us</p>
    </div>
  );
}

// ── Item — mobile card ──────────────────────────────────────────────────────
function ItemCard({ item, showDate }) {
  return (
    <div onClick={item.open} style={item.cardStyleMobile}>
      <button onClick={item.toggle} style={item.checkStyle}><span style={item.checkMarkStyle}>✓</span></button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={item.nameStyle}>{item.name}</span>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: '#a89e90' }}>{item.qtyUnit}</span>
          {item.hasImage && (
            <button onClick={item.openImg} title="View photo" style={thumbBtn}><Icons.Camera size={13} /></button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
          <span style={item.labelStyle}>{item.labelName}</span>
          {item.important && <span style={importantTag}>Important</span>}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#9a9186', fontSize: 12, fontWeight: 600 }}>
            <span style={item.avatarStyle}>{item.byInitial}</span>{item.byName}
            {showDate && <span style={{ color: '#c3bbae' }}>· {item.dateText}</span>}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
        <button onClick={item.starToggle} title="Mark important" style={iconBtn}>
          <Icons.Star size={19} filled={item.important} />
        </button>
        <span style={item.statusStyle}>{item.statusLabel}</span>
      </div>
    </div>
  );
}

// ── Item — desktop table row ────────────────────────────────────────────────
function ItemRow({ item, showDate }) {
  return (
    <div onClick={item.open} style={item.rowStyleDesk}>
      <button onClick={item.toggle} style={item.checkStyle}><span style={item.checkMarkStyle}>✓</span></button>
      <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <span style={item.nameStyleDesk}>{item.name}</span>
        {item.hasImage && (
          <button onClick={item.openImg} title="View photo" style={thumbBtn}><Icons.Camera size={13} /></button>
        )}
      </span>
      <span style={{ fontWeight: 800, color: '#857c70', fontSize: 13.5 }}>{item.qtyUnit}</span>
      <span><span style={item.labelStyle}>{item.labelName}</span></span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#7a7166', fontSize: 13, fontWeight: 600, minWidth: 0 }}>
        <span style={item.avatarStyleLg}>{item.byInitial}</span>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.byName}{showDate && <span style={{ color: '#b8b0a3' }}> · {item.dateText}</span>}
        </span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <button onClick={item.starToggle} title="Mark important" style={{ ...iconBtn, flexShrink: 0 }}>
          <Icons.Star size={18} filled={item.important} />
        </button>
        <span style={item.statusStyle}>{item.statusLabel}</span>
      </span>
      <button onClick={item.remove} style={{ background: 'none', border: 'none', color: '#cfc7ba', fontSize: 18, cursor: 'pointer', padding: 2, lineHeight: 1 }}>×</button>
    </div>
  );
}

function EmptyState({ text, pad }) {
  return <div style={{ textAlign: 'center', padding: pad, color: '#b3a99c', fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{text}</div>;
}

// ── Swipe-to-delete wrapper ─────────────────────────────────────────────────
// Wraps a list item. Dragging left (touch or mouse) slides the item to reveal a
// red "Delete" affordance; releasing past the threshold removes the item, a tap
// passes through to open the detail, and a vertical drag yields to scrolling.
function SwipeRow({ onDelete, radius = 0, frontBg, children }) {
  const [dx, setDx] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const st = React.useRef(null);     // { x, y, active } during a gesture
  const dxRef = React.useRef(0);     // live offset — read at release (state may lag)
  const movedRef = React.useRef(false);
  const applyDx = (n) => { dxRef.current = n; setDx(n); };
  const THRESHOLD = 88;              // px past which release deletes
  const MAX = 128;                  // furthest the item slides while dragging

  const onPointerDown = (e) => {
    if (removing) return;
    // Don't hijack taps on the interactive controls inside the row.
    if (e.target.closest('button, a, input, select, label')) return;
    st.current = { x: e.clientX, y: e.clientY, active: false };
    movedRef.current = false;
  };
  const onPointerMove = (e) => {
    if (!st.current || removing) return;
    const dX = e.clientX - st.current.x;
    const dY = e.clientY - st.current.y;
    if (!st.current.active) {
      if (Math.abs(dX) > 8 && Math.abs(dX) > Math.abs(dY)) {
        st.current.active = true;
        setDragging(true);
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
      } else if (Math.abs(dY) > 10) {
        st.current = null;            // vertical intent → let the page scroll
        return;
      }
    }
    if (st.current && st.current.active) {
      const next = Math.max(-MAX, Math.min(0, dX));
      applyDx(next);
      if (next < -6) movedRef.current = true;
    }
  };
  const finish = () => {
    if (!st.current) { setDragging(false); return; }
    const active = st.current.active;
    st.current = null;
    setDragging(false);
    if (!active) return;
    if (dxRef.current <= -THRESHOLD) {
      setRemoving(true);
      window.setTimeout(() => onDelete && onDelete(), 200);
    } else {
      applyDx(0);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: radius, background: '#c4604c', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingRight: 22, color: '#fff', fontWeight: 800, fontSize: 14, opacity: (dx < 0 || removing) ? 1 : 0 }}>
        <Icons.Trash size={17} /> Delete
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={(e) => { if (movedRef.current) { e.preventDefault(); e.stopPropagation(); movedRef.current = false; } }}
        style={{
          position: 'relative',
          background: frontBg,
          transform: removing ? 'translateX(-110%)' : `translateX(${dx}px)`,
          transition: dragging ? 'none' : 'transform .2s cubic-bezier(.3,.7,.4,1), opacity .2s ease',
          opacity: removing ? 0 : 1,
          touchAction: 'pan-y',
        }}>
        {children}
      </div>
    </div>
  );
}

// shared inline style fragments
const uppercaseLabel = { fontSize: 11, fontWeight: 800, color: '#aaa093', letterSpacing: '.6px', textTransform: 'uppercase' };
const labelInput = { flex: 1, border: 'none', background: '#f5f0e8', borderRadius: 11, padding: '10px 13px', fontSize: 14, fontFamily: 'inherit', fontWeight: 700, color: '#3a352f', outline: 'none' };
const thumbBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: '#f3ece1', color: '#b59a7d', width: 24, height: 24, borderRadius: 8, cursor: 'pointer', flexShrink: 0, padding: 0 };
const iconBtn = { border: 'none', background: 'none', padding: 2, cursor: 'pointer', lineHeight: 0 };
const importantTag = { fontSize: 11, fontWeight: 800, color: '#a8822f', background: '#f6edd6', padding: '3px 9px', borderRadius: 8 };

Object.assign(window, {
  TogetherUI: { LabelFilters, StatusFilters, LabelsPanel, Brand, ItemCard, ItemRow, EmptyState, SwipeRow, uppercaseLabel },
});
