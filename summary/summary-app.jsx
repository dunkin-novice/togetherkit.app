// summary-app.jsx — Together "Summary".
// One progress table across every list: Feature · Count · Done · On the list · %Done.
// Reuses the shared modules (icons / supabase / session / account).

const { useState, useEffect } = React;
const SI = window.Icons;

function pct(done, count) { return count > 0 ? Math.round((done / count) * 100) : 0; }

function Bar({ value, muted }) {
  if (muted) return <span style={{ color: '#c3bbae', fontWeight: 700 }}>—</span>;
  const c = value >= 100 ? '#6f9c5a' : value >= 50 ? '#c98a5c' : '#cf8f6a';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 92 }}>
      <span style={{ flex: 1, height: 7, borderRadius: 99, background: '#ece6db', overflow: 'hidden', minWidth: 48 }}>
        <span style={{ display: 'block', width: value + '%', height: '100%', background: c, borderRadius: 99, transition: 'width .3s ease' }} />
      </span>
      <span style={{ fontWeight: 800, fontSize: 12.5, color: '#7a7166', width: 34, textAlign: 'right' }}>{value}%</span>
    </span>
  );
}

function App() {
  const sx = window.useTogetherSession();
  const { SignIn, Splash, HomeButton, AccountButton, AccountSheet } = window.TogetherAccount;
  const [accountOpen, setAccountOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!sx.homespaceId) return;
    let alive = true;
    const c = window.TogetherBackend.client; const hs = sx.homespaceId;
    (async () => {
      try {
        const [items, ideas, notes, lists, citems] = await Promise.all([
          c.from('items').select('done').eq('homespace_id', hs),
          c.from('ideas').select('scheduled').eq('homespace_id', hs),
          c.from('notes').select('id').eq('homespace_id', hs),
          c.from('custom_lists').select('id,name,emoji,icon_image,archived').eq('homespace_id', hs),
          c.from('custom_items').select('list_id,done').eq('homespace_id', hs),
        ]);
        if (!alive) return;
        const I = items.data || [], D = ideas.data || [], N = notes.data || [], L = (lists.data || []).filter(l => !l.archived), CI = citems.data || [];
        const out = [
          { key: 'shopping', name: 'Shopping List', emoji: '🛒', href: '../shopping-list/', count: I.length, done: I.filter(x => x.done).length, doneWord: 'Done' },
          { key: 'dates', name: 'Date Ideas', emoji: '💞', href: '../date-ideas/', count: D.length, done: D.filter(x => x.scheduled).length, doneWord: 'Scheduled' },
          { key: 'notes', name: 'Shared Notes', emoji: '📝', href: '../notes/', count: N.length, done: null, doneWord: '—' },
        ];
        L.forEach(l => {
          const mine = CI.filter(x => x.list_id === l.id);
          out.push({ key: l.id, name: l.name, emoji: l.emoji || '📋', iconImage: l.icon_image, href: '../list/?id=' + encodeURIComponent(l.id), count: mine.length, done: mine.filter(x => x.done).length, doneWord: 'Done' });
        });
        setRows(out);
      } catch (e) { if (alive) setErr(String(e && e.message || e)); }
    })();
    return () => { alive = false; };
  }, [sx.homespaceId]);

  if (!sx.ready) return <Splash text="…" />;
  if (!sx.session) return <SignIn onGoogle={sx.actions.signInGoogle} />;
  if (!sx.homespaceId) return <Splash text={sx.error ? ('Error: ' + sx.error) : 'Setting up…'} />;

  const tot = (rows || []).reduce((a, r) => ({ count: a.count + r.count, done: a.done + (r.done || 0), tracked: a.tracked + (r.done == null ? 0 : r.count) }), { count: 0, done: 0, tracked: 0 });
  const totPct = pct(tot.done, tot.tracked);
  const th = { textAlign: 'left', padding: '0 10px 10px', fontSize: 11, fontWeight: 800, color: '#aaa093', letterSpacing: '.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' };
  const td = { padding: '13px 10px', borderTop: '1px solid #f0ebe2', fontSize: 14, fontWeight: 700, color: '#4a443c', verticalAlign: 'middle' };
  const numTd = { ...td, textAlign: 'center', fontVariantNumeric: 'tabular-nums' };

  return (
    <div className="app">
      <div className="app-shell">
        <div style={{ padding: '34px 22px 44px', maxWidth: 760, margin: '0 auto' }}>
          <a href="../" title="Back to Together" style={{ display: 'flex', flexDirection: 'column', gap: 5, textDecoration: 'none', color: 'inherit', marginBottom: 22 }}>
            <SI.Logo size={18} />
            <h1 style={{ fontFamily: "'Quicksand',sans-serif", fontSize: 30, fontWeight: 700, margin: '4px 0 0', color: '#3a352f' }}>Summary</h1>
            <p style={{ margin: 0, fontSize: 13.5, color: '#9a9186', fontWeight: 600 }}>Progress across all our lists</p>
          </a>

          {err && <div style={{ padding: 20, color: '#b07a6e', fontWeight: 700 }}>Couldn’t load: {err}</div>}
          {!rows && !err && <div style={{ padding: '40px 10px', color: '#b3a99c', fontWeight: 600 }}>Loading…</div>}

          {rows && (
            <div style={{ background: '#fff', borderRadius: 20, padding: '18px 14px 8px', boxShadow: '0 1px 2px rgba(58,53,47,.05),0 10px 26px rgba(58,53,47,.05)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
                <thead>
                  <tr>
                    <th style={th}>Features list</th>
                    <th style={{ ...th, textAlign: 'center' }}>Count</th>
                    <th style={{ ...th, textAlign: 'center' }}>Done</th>
                    <th style={{ ...th, textAlign: 'center' }}>On the list</th>
                    <th style={{ ...th, minWidth: 130 }}>% Done</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const muted = r.done == null;
                    const onList = muted ? r.count : (r.count - r.done);
                    return (
                      <tr key={r.key}>
                        <td style={td}>
                          <a href={r.href} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#3a352f' }}>
                            <span style={{ width: 30, height: 30, borderRadius: 9, background: '#f4e8dd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, overflow: 'hidden', flexShrink: 0 }}>{r.iconImage ? <img src={r.iconImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : r.emoji}</span>
                            <span style={{ fontWeight: 800 }}>{r.name}</span>
                          </a>
                        </td>
                        <td style={numTd}>{r.count}</td>
                        <td style={numTd}>{muted ? <span style={{ color: '#c3bbae' }}>—</span> : r.done}</td>
                        <td style={numTd}>{onList}</td>
                        <td style={td}><Bar value={pct(r.done, r.count)} muted={muted} /></td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td style={{ ...td, fontWeight: 800, color: '#3a352f' }}>Total</td>
                    <td style={{ ...numTd, fontWeight: 800 }}>{tot.count}</td>
                    <td style={{ ...numTd, fontWeight: 800 }}>{tot.done}</td>
                    <td style={{ ...numTd, fontWeight: 800 }}>{tot.count - tot.done}</td>
                    <td style={td}><Bar value={totPct} muted={tot.tracked === 0} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p style={{ margin: '14px 4px 0', fontSize: 12, color: '#b3a99c', fontWeight: 600 }}>“Done” means checked off (lists), or scheduled (date ideas). Notes have no done state.</p>
        </div>
      </div>
      <HomeButton href="../" />
      <AccountButton sx={sx} onOpen={() => setAccountOpen(true)} />
      {accountOpen && <AccountSheet sx={sx} onClose={() => setAccountOpen(false)} />}
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
