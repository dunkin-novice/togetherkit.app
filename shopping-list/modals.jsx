// modals.jsx — Add / Bulk / Detail / Image / Bug overlays for Together.
// All read from the view model (v); attached to window.TogetherModals.

const { Icons: MIcons } = window;

// Shared dimmed overlay. `z` lets stacking match the source (image 1100, add/bulk
// 1200, bug 1300).
function Overlay({ onClose, z = 1200, padded = true, children }) {
  return (
    <div onClick={onClose}
         style={{ position: 'fixed', inset: 0, zIndex: z, background: 'rgba(58,53,47,.42)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: padded ? 24 : 24, animation: 'tog-fade .15s ease' }}>
      {children}
    </div>
  );
}

function Sheet({ stop, maxWidth, children, style }) {
  return (
    <div onClick={stop}
         style={{ width: '100%', maxWidth, background: '#f6f4ef', borderRadius: 26, boxShadow: '0 30px 70px rgba(58,53,47,.32)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column', animation: 'tog-pop .18s ease', ...style }}>
      {children}
    </div>
  );
}

const closeX = { flexShrink: 0, width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#ece6db', color: '#857c70', fontSize: 17, cursor: 'pointer', lineHeight: 1 };
const upper = { fontSize: 11, fontWeight: 800, color: '#aaa093', letterSpacing: '.6px', textTransform: 'uppercase' };
const fieldInput = { border: '1px solid #ece6db', background: '#fff', borderRadius: 13, padding: '13px 15px', fontSize: 15, fontFamily: 'inherit', color: '#3a352f', outline: 'none', fontWeight: 600 };

// ── Grocery autocomplete ─────────────────────────────────────────────────────
// Self-contained dropdown under the "Item name" input. Queries the keyless,
// CORS-open Open Food Facts search API as the user types (≥2 chars, debounced
// ~300ms), aborts stale requests, and on select fills the name + (when present)
// the product photo via v.applyGrocerySuggestion. Purely additive — typing any
// free-text item and adding it normally still works.
function GroceryAutocomplete({ v }) {
  const [results, setResults] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const ctrlRef = React.useRef(null);
  const timerRef = React.useRef(null);
  const boxRef = React.useRef(null);
  const q = (v.draftName || '').trim();

  React.useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (ctrlRef.current) { ctrlRef.current.abort(); ctrlRef.current = null; }
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(() => {
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      const url = 'https://world.openfoodfacts.org/cgi/search.pl?search_terms='
        + encodeURIComponent(q)
        + '&search_simple=1&action=process&json=1&page_size=8'
        + '&fields=product_name,brands,image_small_url,code';
      fetch(url, { signal: ctrl.signal })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (ctrl.signal.aborted) return;
          const list = ((d && d.products) || [])
            .filter(p => p && p.product_name && p.product_name.trim())
            .slice(0, 8);
          setResults(list);
          setOpen(list.length > 0);
        })
        .catch(() => { /* network/abort/parse error → show nothing, free-text still works */ });
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [q]);

  React.useEffect(() => () => { if (ctrlRef.current) ctrlRef.current.abort(); }, []);

  const pick = (p) => {
    if (ctrlRef.current) { ctrlRef.current.abort(); ctrlRef.current = null; }
    v.applyGrocerySuggestion(p.product_name.trim(), p.image_small_url || null);
    setResults([]); setOpen(false);
  };

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        value={v.draftName}
        onChange={v.setName}
        onFocus={() => { if (results.length) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        placeholder="Item name"
        autoComplete="off"
        style={fieldInput}
      />
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, zIndex: 5, background: '#fff', border: '1px solid #ece6db', borderRadius: 14, boxShadow: '0 12px 30px rgba(58,53,47,.16)', overflow: 'hidden', maxHeight: 264, overflowY: 'auto' }}>
          {results.map((p, i) => (
            <button
              key={(p.code || '') + i}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: i < results.length - 1 ? '1px solid #f4efe7' : 'none', padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
              {p.image_small_url
                ? <img src={p.image_small_url} alt="" loading="lazy" style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'cover', background: '#f5f0e8', flexShrink: 0 }} />
                : <span style={{ width: 36, height: 36, borderRadius: 9, background: '#f5f0e8', color: '#c3b29a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MIcons.Image size={16} stroke={2} /></span>}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#3a352f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.product_name}</span>
                {p.brands && <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9a9186', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.brands}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add Item ─────────────────────────────────────────────────────────────────
function AddModal({ v }) {
  if (!v.addOpen) return null;
  return (
    <Overlay onClose={v.closeAdd}>
      <Sheet stop={v.stopProp} maxWidth={380}>
        <div style={{ padding: '22px 22px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <h2 style={modalTitle}>Add Item</h2>
          <button onClick={v.closeAdd} style={closeX}>×</button>
        </div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <GroceryAutocomplete v={v} />
          <div style={{ display: 'flex', gap: 9 }}>
            <input type="number" min="1" value={v.draftQty} onChange={v.setQtyInput} style={{ width: 80, border: '1px solid #ece6db', background: '#fff', borderRadius: 12, padding: 12, fontSize: 15, fontFamily: 'inherit', fontWeight: 800, color: '#3a352f', outline: 'none', textAlign: 'center' }} />
            <input value={v.draftUnit} onChange={v.setUnit} list="together-units" placeholder="unit" style={{ flex: 1, border: '1px solid #ece6db', background: '#fff', borderRadius: 12, padding: '12px 13px', fontSize: 14, fontFamily: 'inherit', color: '#3a352f', fontWeight: 700, outline: 'none' }} />
          </div>
          <select value={v.draftLabel} onChange={v.setLabel} style={selectStyle}>
            {v.labelOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {v.hasDraftImage ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#fff', border: '1px solid #ece6db', borderRadius: 13, padding: '9px 11px' }}>
              <img src={v.draftImage} alt="" style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#7a7166' }}>Photo attached</span>
              <button onClick={v.removeDraftPhoto} style={{ background: '#f5f0e8', border: 'none', color: '#b07a6e', width: 30, height: 30, borderRadius: 9, fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px dashed #d9cbb7', borderRadius: 13, padding: 12, color: '#a8794f', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
              <MIcons.Camera size={16} stroke={2} /> Add photo <span style={{ color: '#c3b29a', fontWeight: 600 }}>· optional</span>
              <input type="file" accept="image/*" onChange={v.onDraftPhoto} style={{ display: 'none' }} />
            </label>
          )}
          <button onClick={v.toggleDraftImportant} style={v.draftImportantRowStyle}>
            <MIcons.Star size={18} filled={v.draftImportant} color={v.draftImportant ? undefined : '#b9ad97'} />
            <span style={{ flex: 1, textAlign: 'left' }}>Mark as important</span>
          </button>
        </div>
        <div style={{ padding: '16px 22px 22px', display: 'flex', gap: 10 }}>
          <button onClick={v.closeAdd} style={cancelBtn}>Cancel</button>
          <button onClick={v.saveAdd} style={v.saveAddBtnStyle}>Save Item</button>
        </div>
      </Sheet>
    </Overlay>
  );
}

// ── Bulk Add ───────────────────────────────────────────────────────────────
function BulkModal({ v }) {
  if (!v.bulkOpen) return null;
  return (
    <Overlay onClose={v.closeBulk}>
      <Sheet stop={v.stopProp} maxWidth={480}>
        <div style={{ padding: '22px 22px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ ...modalTitle, marginBottom: 4 }}>Bulk Add</h2>
            <p style={{ margin: 0, fontSize: 14, color: '#9a9186', fontWeight: 600 }}>Paste your list — one item per line.</p>
          </div>
          <button onClick={v.closeBulk} style={closeX}>×</button>
        </div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          <button onClick={v.toggleBulkTemplate} style={{ alignSelf: 'flex-start', background: '#f3ece1', color: '#a8794f', border: 'none', borderRadius: 11, padding: '8px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{v.bulkTemplateLabel}</button>
          {v.bulkTemplateShown && (
            <div style={{ background: '#fff', border: '1px solid #ece6db', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#3a352f', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{'Milk 2 bottles\nEggs 12 pcs\nBanana 1 kg\n\nAvocado,4,pcs\nDish Soap,1,bottle\n\nChicken Breast/500/g\n\nRice–5–kg'}</div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0ebe2' }}>
                <div style={{ ...upper, marginBottom: 8 }}>Supported separators</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['Space', 'Comma ,', 'Double dot ..', 'Dash –', 'Slash /'].map(s => (
                    <span key={s} style={{ fontSize: 12, fontWeight: 700, color: '#7a7166', background: '#f5f0e8', padding: '5px 10px', borderRadius: 8 }}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
          <textarea value={v.bulkText} onChange={v.setBulkText} placeholder={'Milk 2 bottles\nEggs 12 pcs\nBanana 1 kg'} style={{ width: '100%', minHeight: 118, resize: 'vertical', border: '1px solid #ece6db', background: '#fff', borderRadius: 14, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', fontWeight: 600, color: '#3a352f', outline: 'none', lineHeight: 1.7 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, fontWeight: 700, color: '#857c70' }}>
            <span>Add to</span>
            <select value={v.bulkLabelId} onChange={v.setBulkLabel} style={{ ...selectStyle, padding: '8px 11px', borderRadius: 10, fontSize: 13 }}>
              {v.labelOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          {v.hasBulkRows && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={upper}>Preview</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#6f7d52', background: '#eef1e6', padding: '3px 10px', borderRadius: 999 }}>{v.bulkPreviewLabel}</span>
              </div>
              {v.bulkRows.map((r, i) => (
                <div key={i} style={r.rowStyle}>
                  {r.valid ? (
                    <React.Fragment>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#e7ede0', color: '#6f7d52', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>✓</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, color: '#3a352f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: '#857c70', background: '#f1ece3', padding: '3px 10px', borderRadius: 8, flexShrink: 0 }}>{r.qtyUnit}</span>
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#f2d6cf', color: '#b05a4a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>!</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#a85a4a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#c08a7e' }}>Couldn't read this line</div>
                      </div>
                      <button onClick={r.remove} style={{ background: '#fff', border: 'none', color: '#b05a4a', width: 30, height: 30, borderRadius: 9, fontSize: 15, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>×</button>
                    </React.Fragment>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '16px 22px 22px', display: 'flex', gap: 10 }}>
          <button onClick={v.closeBulk} style={cancelBtn}>Cancel</button>
          <button onClick={v.saveBulk} style={v.bulkSaveBtnStyle}>{v.bulkSaveLabel}</button>
        </div>
      </Sheet>
    </Overlay>
  );
}

// ── Item detail / edit ───────────────────────────────────────────────────────
function DetailModal({ v }) {
  if (!v.detailOpen) return null;
  const Row = ({ label, children, last }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 2px', borderBottom: last ? 'none' : '1px solid #ece6db' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#a89e90' }}>{label}</span>
      {children}
    </div>
  );
  return (
    <Overlay onClose={v.closeDetail} z={1000}>
      <Sheet stop={v.stopProp} maxWidth={380} style={{ maxHeight: '88vh' }}>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '22px 22px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            {v.detailViewing
              ? <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, margin: 0, color: '#3a352f', lineHeight: 1.15 }}>{v.detailName}</h2>
              : <input value={v.editName} onChange={v.setEditName} style={{ flex: 1, border: '1px solid #ece6db', background: '#fff', borderRadius: 12, padding: '11px 13px', fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#3a352f', outline: 'none' }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button onClick={v.toggleDetailImportant} title="Mark important" style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', lineHeight: 0 }}>
                <MIcons.Star size={22} filled={v.detailImportant} />
              </button>
              <button onClick={v.closeDetail} style={{ ...closeX, flexShrink: 0 }}>×</button>
            </div>
          </div>

          {v.detailHasImage && (
            <button onClick={v.openImgFromDetail} style={{ display: 'block', width: '100%', marginTop: 16, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}>
              <img src={v.detailImage} alt={v.detailName} style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 16, display: 'block' }} />
            </button>
          )}

          {v.detailViewing && (
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Row label="Quantity"><span style={{ fontSize: 15, fontWeight: 800, color: '#3a352f' }}>{v.detailQtyUnit}</span></Row>
              <Row label="Label"><span style={v.detailLabelStyle}>{v.detailLabelName}</span></Row>
              <Row label="Added by"><span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 700, color: '#3a352f' }}><span style={v.detailAvatarStyle}>{v.detailByInitial}</span>{v.detailByName}</span></Row>
              <Row label="Created"><span style={{ fontSize: 14, fontWeight: 700, color: '#3a352f' }}>{v.detailDateText}</span></Row>
              <Row label="Status" last><span style={v.detailStatusStyle}>{v.detailStatusLabel}</span></Row>
            </div>
          )}

          {v.detailEditing && (
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 9 }}>
                <input type="number" min="1" value={v.editQty} onChange={v.setEditQty} style={{ width: 80, border: '1px solid #ece6db', background: '#fff', borderRadius: 12, padding: 12, fontSize: 15, fontFamily: 'inherit', fontWeight: 800, color: '#3a352f', outline: 'none', textAlign: 'center' }} />
                <input value={v.editUnit} onChange={v.setEditUnit} list="together-units" placeholder="unit" style={{ flex: 1, border: '1px solid #ece6db', background: '#fff', borderRadius: 12, padding: '12px 13px', fontSize: 14, fontFamily: 'inherit', fontWeight: 700, color: '#3a352f', outline: 'none' }} />
              </div>
              <select value={v.editLabel} onChange={v.setEditLabel} style={selectStyle}>
                {v.labelOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div style={{ padding: '14px 22px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={v.toggleDetailDone} style={v.detailDoneBtnStyle}>{v.detailDoneLabel}</button>
          <div style={{ display: 'flex', gap: 10 }}>
            {v.detailViewing && <button onClick={v.startEdit} style={{ flex: 1, background: '#fff', color: '#7a7166', border: '1px solid #e6ded2', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>}
            {v.detailEditing && <button onClick={v.saveEdit} style={{ flex: 1, background: 'var(--partner)', color: '#fff', border: 'none', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>}
            <button onClick={v.deleteDetail} style={{ flex: 1, background: '#f6ece9', color: '#b07a6e', border: 'none', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
          </div>
        </div>
      </Sheet>
    </Overlay>
  );
}

// ── Image viewer ───────────────────────────────────────────────────────────
function ImageModal({ v }) {
  if (!v.imageOpen) return null;
  return (
    <div onClick={v.closeImage} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(40,36,32,.78)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'tog-fade .15s ease' }}>
      <div onClick={v.stopProp} style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, animation: 'tog-pop .18s ease' }}>
        <img src={v.imageSrc} alt={v.imageName} style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.4)' }} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#fff' }}>{v.imageName}</span>
        <button onClick={v.closeImage} style={{ background: 'rgba(255,255,255,.16)', color: '#fff', border: '1px solid rgba(255,255,255,.3)', borderRadius: 13, padding: '11px 26px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
      </div>
    </div>
  );
}

// ── Bug report ───────────────────────────────────────────────────────────────
function BugModal({ v }) {
  if (!v.bugOpen) return null;
  return (
    <Overlay onClose={v.closeBug} z={1300}>
      <Sheet stop={v.stopProp} maxWidth={400} style={{ maxHeight: '90vh' }}>
        {v.bugFormVisible && (
          <div className="tog-scroll" style={{ overflowY: 'auto', padding: '24px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 style={{ ...modalTitle, marginBottom: 4 }}>Report a Problem</h2>
                <p style={{ margin: 0, fontSize: 14, color: '#9a9186', fontWeight: 600 }}>Help us improve Together.</p>
              </div>
              <button onClick={v.closeBug} style={closeX}>×</button>
            </div>
            <div style={{ marginTop: 18 }}>
              <span style={upper}>Screenshot</span>
              {v.bugHasImage ? (
                <div style={{ position: 'relative', marginTop: 8 }}>
                  <img src={v.bugImage} alt="" style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 14, display: 'block' }} />
                  <button onClick={v.removeBugPhoto} style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(40,36,32,.6)', color: '#fff', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>
              ) : (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 14, padding: '12px 14px', border: '1px solid #ece6db' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: '#eef1e6', color: '#8a9b6e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MIcons.Image size={20} stroke={2} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: '#3a352f' }}>Current screen attached</div>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: '#a8794f', cursor: 'pointer' }}>Upload a different image
                      <input type="file" accept="image/*" onChange={v.onBugPhoto} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: 16 }}>
              <span style={upper}>What happened?</span>
              <textarea value={v.bugText} onChange={v.setBugText} placeholder="Tell us what went wrong…" style={{ marginTop: 8, width: '100%', minHeight: 96, resize: 'vertical', background: '#fff', borderRadius: 14, padding: '13px 14px', fontSize: 14.5, fontFamily: 'inherit', fontWeight: 600, color: '#3a352f', outline: 'none', lineHeight: 1.5, border: '1px solid #ece6db' }} />
            </div>
            <div style={{ marginTop: 14 }}>
              <span style={upper}>Email <span style={{ color: '#c3b29a' }}>· optional</span></span>
              <input value={v.bugEmail} onChange={v.setBugEmail} type="email" placeholder="you@example.com" style={{ marginTop: 8, width: '100%', background: '#fff', borderRadius: 13, padding: '12px 14px', fontSize: 14.5, fontFamily: 'inherit', fontWeight: 600, color: '#3a352f', outline: 'none', border: '1px solid #ece6db' }} />
            </div>
            <p style={{ margin: '14px 0 0', fontSize: 12, color: '#b3a99c', fontWeight: 600, lineHeight: 1.5, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}>♥</span> We'll attach a few technical details automatically so we can fix it faster.
            </p>
            <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
              <button onClick={v.closeBug} style={cancelBtn}>Cancel</button>
              <button onClick={v.sendBug} style={v.sendBtnStyle}>Send Report</button>
            </div>
          </div>
        )}
        {v.bugSent && (
          <div style={{ padding: '38px 28px 30px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 62, height: 62, borderRadius: '50%', background: '#f6e0dc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>❤️</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 25, fontWeight: 700, margin: 0, color: '#3a352f' }}>Thanks</h2>
            <p style={{ margin: 0, fontSize: 14.5, color: '#9a9186', fontWeight: 600, lineHeight: 1.55, maxWidth: 260 }}>Your report has been sent. We'll take a look as soon as possible.</p>
            <button onClick={v.closeBug} style={{ marginTop: 6, width: '100%', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
          </div>
        )}
      </Sheet>
    </Overlay>
  );
}

const modalTitle = { fontFamily: 'var(--font-display)', fontSize: 23, fontWeight: 700, margin: 0, color: '#3a352f' };
const cancelBtn = { flex: 1, background: '#fff', color: '#7a7166', border: '1px solid #e6ded2', borderRadius: 14, padding: 13, fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' };
const selectStyle = { border: '1px solid #ece6db', background: '#fff', borderRadius: 12, padding: '12px 13px', fontSize: 14, fontFamily: 'inherit', color: '#3a352f', fontWeight: 700, outline: 'none', cursor: 'pointer' };

Object.assign(window, {
  TogetherModals: { AddModal, BulkModal, DetailModal, ImageModal, BugModal },
});
