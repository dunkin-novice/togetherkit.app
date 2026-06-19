// view.jsx — pure derivation of display values from state (port of renderVals).
// Given (state, actions, { primary, partner, showDate }) it returns the view
// model the components render: filtered/sorted items, chips, counts, modal data,
// and the inline style objects that give Together its look.

function buildTogetherView(state, actions, opts) {
  const { primary, partner, showDate, members = [], me = null } = opts;

  // Resolve who added an item to a name + avatar colour. Colour follows the
  // member's slot in the homespace (first = primary, second = partner).
  const memberByUid = {};
  members.forEach(m => { memberByUid[m.uid] = m; });
  const slotColor = (idx) => idx === 0 ? primary : idx === 1 ? partner : '#9a9186';
  const resolveBy = (byUser, byName) => {
    const m = byUser && memberByUid[byUser];
    if (m) return { name: m.name, color: slotColor(m.idx) };
    return { name: byName || 'Someone', color: '#9a9186' };
  };
  const D = window.TogetherData;
  const { TONES, toneOf } = D;

  const labelById = {};
  state.labels.forEach(l => { labelById[l.id] = l; });

  const avBase = { borderRadius: '50%', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
  const baseChip = { padding: '3px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block' };
  const mkStatus = (done) => ({ padding: '5px 12px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 800, letterSpacing: '.4px', whiteSpace: 'nowrap', display: 'inline-block', ...(done ? { background: '#e7ede0', color: '#6f7d52' } : { background: '#f6ebdc', color: '#b07d42' }) });

  const af = state.activeFilter;
  const sf = state.statusFilter;
  const sortMode = state.sortMode;

  const byLabel = state.items.filter(it => af === 'all' || it.labelId === af);
  const statusCounts = {
    all: byLabel.length,
    tobuy: byLabel.filter(i => !i.done).length,
    done: byLabel.filter(i => i.done).length,
    important: byLabel.filter(i => i.important).length,
  };

  let visibleSrc = byLabel.filter(it => {
    if (sf === 'tobuy') return !it.done;
    if (sf === 'done') return it.done;
    if (sf === 'important') return it.important;
    return true;
  });

  const rankOf = (it) => it.important && !it.done ? 0 : (!it.done ? 1 : (it.important && it.done ? 2 : 3));
  const indexed = visibleSrc.map((it, i) => ({ it, i }));
  if (sortMode === 'smart') indexed.sort((a, b) => (rankOf(a.it) - rankOf(b.it)) || (a.i - b.i));
  else if (sortMode === 'az') indexed.sort((a, b) => a.it.name.localeCompare(b.it.name));
  else if (sortMode === 'new') indexed.sort((a, b) => (b.it.pos || 0) - (a.it.pos || 0));
  const visible = indexed.map(x => x.it);

  const items = visible.map(it => {
    const u = resolveBy(it.byUser, it.byName);
    const done = it.done;
    const important = it.important;
    const label = labelById[it.labelId];
    const t = toneOf(label);
    return {
      id: it.id,
      name: it.name,
      qtyUnit: it.qty + ' ' + it.unit,
      byName: u.name,
      byInitial: (u.name[0] || '?'),
      dateText: it.date,
      hasImage: !!it.image,
      important, notImportant: !important,
      labelName: label ? label.name : '—',
      labelStyle: { ...baseChip, background: t.bg, color: t.fg },
      statusLabel: done ? 'Done' : 'To Buy',
      avatarStyle:   { ...avBase, width: '20px', height: '20px', fontSize: '10px', background: u.color },
      avatarStyleLg: { ...avBase, width: '26px', height: '26px', fontSize: '12px', background: u.color },
      statusStyle: mkStatus(done),
      nameStyle:     { fontSize: '16px', fontWeight: 700, letterSpacing: '.1px', color: done ? '#bdb5a9' : '#3a352f', textDecoration: done ? 'line-through' : 'none' },
      nameStyleDesk: { fontSize: '15.5px', fontWeight: 700, color: done ? '#bdb5a9' : '#3a352f', textDecoration: done ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
      cardStyleMobile: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: '#fff', borderRadius: '18px', cursor: 'pointer', border: important ? '1.5px solid #e7d3a3' : '1px solid transparent', boxShadow: '0 1px 2px rgba(58,53,47,.05),0 6px 16px rgba(58,53,47,.035)' },
      rowStyleDesk: { display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) 84px 128px 168px 132px 30px', gap: '14px', alignItems: 'center', padding: '15px 6px', borderBottom: '1px solid #f4efe7', cursor: 'pointer', background: important ? '#fdf8ee' : 'transparent' },
      checkStyle: { width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0, transition: 'all .15s', border: done ? ('2px solid ' + partner) : '2px solid #dcd4c6', background: done ? partner : '#fff' },
      checkMarkStyle: { fontSize: '14px', fontWeight: 900, color: '#fff', lineHeight: 1, opacity: done ? 1 : 0 },
      toggle: (e) => { e.stopPropagation(); actions.toggle(it.id); },
      remove: (e) => { e.stopPropagation(); actions.remove(it.id); },
      deleteSelf: () => actions.remove(it.id),
      starToggle: (e) => { e.stopPropagation(); actions.toggleImportant(it.id); },
      open: () => actions.set({ detailId: it.id, editing: false }),
      openImg: (e) => { e.stopPropagation(); actions.set({ imageId: it.id }); },
    };
  });

  const toBuy = byLabel.filter(i => !i.done).length;

  const countFor = (id) => id === 'all' ? state.items.length : state.items.filter(i => i.labelId === id).length;
  const mkFilter = (id, name, fg, showDot) => {
    const active = af === id;
    return {
      id, name, showDot, count: countFor(id),
      select: () => actions.set({ activeFilter: id }),
      chipStyle: active
        ? { display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '999px', border: '1px solid ' + fg, background: fg, color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
        : { display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '999px', border: '1px solid #ece6db', background: '#fff', color: '#7a7166', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
      dotStyle: { width: '8px', height: '8px', borderRadius: '50%', background: active ? 'rgba(255,255,255,.85)' : fg, flexShrink: 0 },
      countStyle: active
        ? { fontSize: '11px', fontWeight: 800, background: 'rgba(255,255,255,.25)', color: '#fff', borderRadius: '999px', padding: '1px 7px', minWidth: '18px', textAlign: 'center' }
        : { fontSize: '11px', fontWeight: 800, background: '#f1ece3', color: '#a89e90', borderRadius: '999px', padding: '1px 7px', minWidth: '18px', textAlign: 'center' },
    };
  };
  const filters = [mkFilter('all', 'All Items', '#3a352f', false)]
    .concat(state.labels.map(l => mkFilter(l.id, l.name, toneOf(l).fg, true)));

  const mkStatusChip = (id, name, count, isStar) => {
    const active = sf === id;
    const accent = isStar ? '#d99a2b' : '#6f665b';
    return {
      id, name, count, star: isStar,
      select: () => actions.set({ statusFilter: id }),
      chipStyle: active
        ? { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '999px', border: '1px solid ' + accent, background: accent, color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
        : { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '999px', border: '1px solid #ece6db', background: '#fff', color: isStar ? '#a8822f' : '#7a7166', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
      countStyle: active
        ? { fontSize: '11px', fontWeight: 800, background: 'rgba(255,255,255,.25)', color: '#fff', borderRadius: '999px', padding: '1px 7px', minWidth: '18px', textAlign: 'center' }
        : { fontSize: '11px', fontWeight: 800, background: '#f1ece3', color: '#a89e90', borderRadius: '999px', padding: '1px 7px', minWidth: '18px', textAlign: 'center' },
    };
  };
  const statusFilters = [
    mkStatusChip('all', 'All', statusCounts.all, false),
    mkStatusChip('tobuy', 'To Buy', statusCounts.tobuy, false),
    mkStatusChip('done', 'Done', statusCounts.done, false),
    mkStatusChip('important', 'Important', statusCounts.important, true),
  ];

  const labelOptions = state.labels.map(l => ({ id: l.id, name: l.name }));
  // Every label is editable — defaults and custom alike can be renamed/deleted.
  const manageLabels = state.labels.map(l => {
    const t = toneOf(l);
    return { id: l.id, name: l.name, custom: l.custom, dotStyle: { width: '12px', height: '12px', borderRadius: '50%', background: t.fg, flexShrink: 0 }, rename: (e) => actions.renameLabel(l.id, e.target.value), remove: () => actions.deleteLabel(l.id) };
  });
  const newTone = TONES[state.labels.length % TONES.length];

  const activeName = af === 'all' ? '' : (labelById[af] ? labelById[af].name : '');
  const sfName = { all: '', tobuy: 'To buy', done: 'Done', important: 'Important' }[sf];
  let listHeading = af === 'all' ? 'Your list' : activeName;
  if (sf !== 'all') listHeading = (af === 'all' ? sfName : (activeName + ' · ' + sfName));

  // detail
  const detail = state.items.find(i => i.id === state.detailId) || null;
  let detailVals = {};
  if (detail) {
    const u = resolveBy(detail.byUser, detail.byName);
    const label = labelById[detail.labelId];
    const t = toneOf(label);
    detailVals = {
      detailName: detail.name,
      detailQtyUnit: detail.qty + ' ' + detail.unit,
      detailLabelName: label ? label.name : '—',
      detailLabelStyle: { ...baseChip, background: t.bg, color: t.fg },
      detailByName: u.name,
      detailByInitial: (u.name[0] || '?'),
      detailAvatarStyle: { ...avBase, width: '22px', height: '22px', fontSize: '11px', background: u.color },
      detailDateText: detail.date,
      detailStatusLabel: detail.done ? 'Done' : 'To Buy',
      detailStatusStyle: mkStatus(detail.done),
      detailHasImage: !!detail.image,
      detailImage: detail.image,
      detailImportant: detail.important,
      detailNotImportant: !detail.important,
      detailDoneLabel: detail.done ? 'Mark as To Buy' : 'Mark as Done',
      detailDoneBtnStyle: detail.done
        ? { background: '#f3ece1', color: '#a8794f', border: 'none', borderRadius: '14px', padding: '13px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }
        : { background: partner, color: '#fff', border: 'none', borderRadius: '14px', padding: '13px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' },
    };
  }

  const imageItem = state.items.find(i => i.id === state.imageId) || null;

  // bulk preview
  const bulkLines = state.bulkText.split('\n');
  const bulkRows = [];
  bulkLines.forEach((line, i) => {
    if (!line.trim()) return;
    const p = D.parseBulkLine(line);
    const valid = !!(p && p.valid);
    bulkRows.push({
      valid, invalid: !valid,
      name: valid ? p.name : line.trim(),
      qtyUnit: valid ? (p.qty + ' ' + p.unit) : '',
      rowStyle: valid
        ? { display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 13px', background: '#fff', border: '1px solid #ece6db', borderRadius: '12px' }
        : { display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 13px', background: '#fbeeea', border: '1px solid #eccfc7', borderRadius: '12px' },
      remove: () => actions.removeBulkLine(i),
    });
  });
  const bulkValidCount = bulkRows.filter(r => r.valid).length;
  const bulkTargetId = state.bulkLabel || (af !== 'all' ? af : (state.labels[0] && state.labels[0].id));

  return {
    items, showDate, filters, statusFilters, labelOptions, manageLabels,
    unitSuggestions: D.UNIT_SUGGESTIONS,
    hasLabels: manageLabels.length > 0,
    isEmpty: visible.length === 0,
    emptyText: (af === 'all' && sf === 'all') ? 'Nothing here yet. Add the first thing you need.' : 'Nothing matches these filters.',
    listHeading,
    toBuyLabel: toBuy + ' to buy',
    sortMode,
    sortOptions: [{ id: 'smart', name: 'Smart order' }, { id: 'az', name: 'Name A–Z' }, { id: 'new', name: 'Newest' }],
    setSortMode: (e) => actions.set({ sortMode: e.target.value }),

    labelsOpen: state.labelsOpen,
    toggleLabels: () => actions.set(s => ({ labelsOpen: !s.labelsOpen })),
    newLabelChipStyle: { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '999px', border: '1px dashed #cbb9a2', background: state.labelsOpen ? '#f3ece1' : 'transparent', color: '#a8794f', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' },
    newLabelName: state.newLabelName,
    setNewLabelName: (e) => actions.set({ newLabelName: e.target.value }),
    addLabel: () => actions.addLabel(),
    onNewLabelKey: (e) => { if (e.key === 'Enter') actions.addLabel(); },
    newDotStyle: { width: '12px', height: '12px', borderRadius: '50%', background: newTone.fg, flexShrink: 0 },

    draftName: state.draftName,
    draftQty: state.draftQty,
    draftUnit: state.draftUnit,
    draftLabel: state.draftLabel,
    draftImage: state.draftImage,
    hasDraftImage: !!state.draftImage,
    noDraftImage: !state.draftImage,
    draftImportant: state.draftImportant,
    notDraftImportant: !state.draftImportant,
    setName: (e) => actions.set({ draftName: e.target.value }),
    setLabel: (e) => actions.set({ draftLabel: e.target.value }),
    setUnit: (e) => actions.set({ draftUnit: e.target.value }),
    setQtyInput: (e) => { const v = parseInt(e.target.value, 10); actions.set({ draftQty: isNaN(v) || v < 1 ? 1 : v }); },
    onDraftPhoto: actions.onDraftPhoto,
    removeDraftPhoto: () => actions.set({ draftImage: null }),
    toggleDraftImportant: () => actions.set(s => ({ draftImportant: !s.draftImportant })),
    draftImportantRowStyle: { display: 'flex', alignItems: 'center', gap: '9px', padding: '11px 13px', borderRadius: '13px', border: '1px solid ' + (state.draftImportant ? '#e7d3a3' : '#ece6db'), background: state.draftImportant ? '#fdf8ee' : '#fff', color: state.draftImportant ? '#a8822f' : '#7a7166', fontWeight: 800, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' },

    addItemBtnStyle: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', background: primary, color: '#fff', border: 'none', borderRadius: '15px', padding: '14px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' },
    bulkBtnStyle: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', background: '#fff', color: '#a8794f', border: '1px solid #ecd9c4', borderRadius: '15px', padding: '14px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' },
    addItemBtnDeskStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', background: primary, color: '#fff', border: 'none', borderRadius: '14px', padding: '12px 22px', fontWeight: 800, fontSize: '14.5px', cursor: 'pointer', fontFamily: 'inherit' },
    bulkBtnDeskStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', background: '#fff', color: '#a8794f', border: '1px solid #ecd9c4', borderRadius: '14px', padding: '12px 22px', fontWeight: 800, fontSize: '14.5px', cursor: 'pointer', fontFamily: 'inherit' },


    // add modal
    addOpen: state.addOpen,
    openAdd: () => actions.set({ addOpen: true }),
    closeAdd: () => actions.set({ addOpen: false }),
    saveAdd: () => { if (!(state.draftName || '').trim()) return; actions.addItem(); },
    saveAddBtnStyle: { flex: 2, background: primary, color: '#fff', border: 'none', borderRadius: '14px', padding: '13px', fontWeight: 800, fontSize: '14.5px', cursor: 'pointer', fontFamily: 'inherit' },

    // bulk modal
    bulkOpen: state.bulkOpen,
    openBulk: () => actions.set({ bulkOpen: true, bulkText: '', bulkTemplateShown: false, bulkLabel: (af !== 'all' ? af : (state.labels[0] && state.labels[0].id)) }),
    closeBulk: () => actions.set({ bulkOpen: false, bulkText: '', bulkTemplateShown: false }),
    bulkText: state.bulkText,
    setBulkText: (e) => actions.set({ bulkText: e.target.value }),
    bulkTemplateShown: state.bulkTemplateShown,
    toggleBulkTemplate: () => actions.set(s => ({ bulkTemplateShown: !s.bulkTemplateShown })),
    bulkTemplateLabel: state.bulkTemplateShown ? 'Hide template' : 'Show template',
    bulkRows,
    hasBulkRows: bulkRows.length > 0,
    bulkValidCount,
    bulkPreviewLabel: bulkValidCount + (bulkValidCount === 1 ? ' item ready' : ' items ready'),
    bulkLabelId: bulkTargetId,
    setBulkLabel: (e) => actions.set({ bulkLabel: e.target.value }),
    saveBulk: () => actions.saveBulk(),
    bulkSaveLabel: bulkValidCount > 0 ? ('Add ' + bulkValidCount + (bulkValidCount === 1 ? ' item' : ' items')) : 'Add items',
    bulkSaveBtnStyle: { flex: 2, background: bulkValidCount > 0 ? primary : '#d9cfc0', color: '#fff', border: 'none', borderRadius: '14px', padding: '13px', fontWeight: 800, fontSize: '14.5px', cursor: bulkValidCount > 0 ? 'pointer' : 'default', fontFamily: 'inherit' },

    // detail modal
    detailOpen: !!detail,
    detailViewing: !!detail && !state.editing,
    detailEditing: !!detail && state.editing,
    closeDetail: () => actions.set({ detailId: null, editing: false }),
    stopProp: (e) => e.stopPropagation(),
    startEdit: () => actions.startEdit(),
    saveEdit: () => actions.saveEdit(),
    deleteDetail: () => { const id = state.detailId; actions.set({ detailId: null, editing: false }); actions.remove(id); },
    toggleDetailDone: () => {
      const it = state.items.find(i => i.id === state.detailId);
      actions.toggle(state.detailId);
      // Marking an item done auto-dismisses the detail popup; un-completing keeps it open.
      if (it && !it.done) actions.set({ detailId: null, editing: false });
    },
    toggleDetailImportant: () => actions.toggleImportant(state.detailId),
    openImgFromDetail: () => actions.set({ imageId: state.detailId }),
    editName: state.edit.name,
    editQty: state.edit.qty,
    editUnit: state.edit.unit,
    editLabel: state.edit.labelId,
    setEditName: (e) => actions.set(s => ({ edit: { ...s.edit, name: e.target.value } })),
    setEditUnit: (e) => actions.set(s => ({ edit: { ...s.edit, unit: e.target.value } })),
    setEditLabel: (e) => actions.set(s => ({ edit: { ...s.edit, labelId: e.target.value } })),
    setEditQty: (e) => { const v = parseInt(e.target.value, 10); actions.set(s => ({ edit: { ...s.edit, qty: isNaN(v) || v < 1 ? 1 : v } })); },
    ...detailVals,

    // image viewer
    imageOpen: !!imageItem,
    imageName: imageItem ? imageItem.name : '',
    imageSrc: imageItem ? imageItem.image : null,
    closeImage: () => actions.set({ imageId: null }),

    // bug report
    bugOpen: state.bugOpen,
    bugFormVisible: state.bugOpen && !state.bugSent,
    bugSent: state.bugSent,
    bugText: state.bugText,
    bugEmail: state.bugEmail,
    bugImage: state.bugImage,
    bugHasImage: !!state.bugImage,
    bugNoImage: !state.bugImage,
    openBug: () => actions.set({ bugOpen: true, bugSent: false }),
    closeBug: () => actions.set({ bugOpen: false, bugSent: false, bugText: '', bugEmail: '', bugImage: null }),
    setBugText: (e) => actions.set({ bugText: e.target.value }),
    setBugEmail: (e) => actions.set({ bugEmail: e.target.value }),
    onBugPhoto: actions.onBugPhoto,
    removeBugPhoto: () => actions.set({ bugImage: null }),
    sendBug: () => actions.sendBug(),
    sendBtnStyle: { flex: 2, background: primary, color: '#fff', border: 'none', borderRadius: '14px', padding: '13px', fontWeight: 800, fontSize: '14.5px', cursor: 'pointer', fontFamily: 'inherit' },
  };
}

window.buildTogetherView = buildTogetherView;
