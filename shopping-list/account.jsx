// account.jsx — sign-in screen + account menu (window.TogetherAccount).
// The account menu has two sides: "This space" (homespace profile — rename the
// space, your name here, members & roles, invite) and "Your spaces" (account
// profile — every homespace you're in, your role + name in each, switch/leave).
// Member colors (primary for the first member, partner for the second) are
// derived here and reused for avatars across the app.

const memberColorByIndex = (idx) => idx === 0 ? 'var(--primary)' : idx === 1 ? 'var(--partner)' : '#b3a99c';

function Avatar({ name, idx, size = 26, src }) {
  if (src) {
    return (
      <img src={src} alt={name || ''} referrerPolicy="no-referrer"
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, display: 'block', background: memberColorByIndex(idx) }} />
    );
  }
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: memberColorByIndex(idx), color: '#fff', fontWeight: 800, fontSize: Math.round(size * 0.42), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {(name && name[0]) ? name[0].toUpperCase() : '?'}
    </span>
  );
}

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.6 5.1A20 20 0 0 0 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C39.9 41 44 36 44 24c0-1.2-.1-2.3-.4-3.5z"/>
  </svg>
);

function SignIn({ onGoogle }) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const go = async () => {
    setBusy(true); setErr(null);
    try { const r = await onGoogle(); if (r && r.error) { setErr(r.error.message); setBusy(false); } }
    catch (e) { setErr((e && e.message) || String(e)); setBusy(false); }
  };
  return (
    <div className="app" style={{ alignItems: 'center' }}>
      <div className="app-shell" style={{ maxWidth: 420 }}>
        <div style={{ padding: '54px 30px 44px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}><window.Icons.Logo size={24} /></div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, margin: 0, color: '#3a352f', letterSpacing: '.3px' }}>Together</h1>
          <p style={{ margin: '0 0 22px', fontSize: 15, color: '#9a9186', fontWeight: 600, maxWidth: 290, lineHeight: 1.45 }}>A little home for your shared lists. Sign in, then invite the people you want to share with.</p>
          <button onClick={go} disabled={busy}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', maxWidth: 300, background: '#fff', color: '#3a352f', border: '1px solid #e6ded2', borderRadius: 14, padding: '14px', fontWeight: 800, fontSize: 15, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(58,53,47,.05),0 6px 16px rgba(58,53,47,.05)' }}>
            <GoogleMark /> {busy ? 'Opening Google…' : 'Sign in with Google'}
          </button>
          {err && (
            <p style={{ margin: '4px 0 0', fontSize: 12.5, fontWeight: 700, color: '#a85a4a', maxWidth: 300, lineHeight: 1.45 }}>
              Couldn’t start Google sign-in{/provider is not enabled|Unsupported provider/i.test(err) ? ' — Google isn’t switched on yet.' : ': ' + err}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Splash({ text = 'Loading…' }) {
  return (
    <div className="app" style={{ alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, color: '#9a9186' }}>
        <window.Icons.Logo size={22} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: '#3a352f' }}>Together</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{text}</span>
      </div>
    </div>
  );
}

function HomeButton({ href = '../' }) {
  return (
    <a href={href} title="Together home"
      style={{ position: 'fixed', top: 24, left: 24, zIndex: 900, width: 46, height: 46, borderRadius: '50%', border: '1px solid #ecd9c4', background: '#fffaf3', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textDecoration: 'none', boxShadow: '0 2px 4px rgba(58,53,47,.08),0 8px 20px rgba(58,53,47,.12)' }}>
      <window.Icons.Logo size={18} />
    </a>
  );
}

function AccountButton({ sx, onOpen }) {
  const meIdx = Math.max(0, sx.members.findIndex(m => sx.me && m.uid === sx.me.uid));
  return (
    <button onClick={onOpen} title="Account & spaces"
      style={{ position: 'fixed', top: 24, left: 80, zIndex: 900, width: 46, height: 46, padding: 0, borderRadius: '50%', border: '1px solid #ecd9c4', background: '#fffaf3', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(58,53,47,.08),0 8px 20px rgba(58,53,47,.12)' }}>
      <Avatar name={sx.me ? sx.me.name : '?'} idx={meIdx} size={32} src={sx.me && sx.me.avatar} />
    </button>
  );
}

const aUpper = { fontSize: 11, fontWeight: 800, color: '#aaa093', letterSpacing: '.6px', textTransform: 'uppercase' };
const aInput = { width: '100%', border: '1px solid #ece6db', background: '#fff', borderRadius: 12, padding: '12px 13px', fontSize: 15, fontFamily: 'inherit', fontWeight: 700, color: '#3a352f', outline: 'none' };
const pill = (bg, fg) => ({ fontSize: 11, fontWeight: 800, color: fg, background: bg, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' });
const miniBtn = { background: '#fff', color: '#7a7166', border: '1px solid #e6ded2', borderRadius: 9, padding: '5px 9px', fontWeight: 800, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const miniDanger = { background: '#f6ece9', color: '#b07a6e', border: 'none', borderRadius: 9, padding: '5px 9px', fontWeight: 800, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
const RoleBadge = ({ role }) => role === 'owner' ? <span style={pill('#eef1e6', '#6f7d52')}>Owner</span> : role === 'admin' ? <span style={pill('#e7eef0', '#5d7480')}>Admin</span> : null;

function AccountSheet({ sx, onClose }) {
  const [tab, setTab] = React.useState('space');
  const [name, setName] = React.useState(sx.me ? sx.me.name : '');
  const [space, setSpace] = React.useState(sx.homespace ? sx.homespace.name : '');
  const [inviteUrl, setInviteUrl] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [making, setMaking] = React.useState(false);
  const [nameSaved, setNameSaved] = React.useState(false);
  const [spaceSaved, setSpaceSaved] = React.useState(false);
  const stop = (e) => e.stopPropagation();

  const iAmOwner = !!(sx.me && sx.me.isOwner);
  const canRename = !!(sx.me && sx.me.isAdmin); // owner or admin
  const invitesOn = !(sx.homespace && sx.homespace.invites_enabled === false);

  const nameDirty = !!name.trim() && name.trim() !== (sx.me && sx.me.name);
  const saveName = () => { if (!nameDirty) return; sx.actions.setMyName(name.trim()); setNameSaved(true); setTimeout(() => setNameSaved(false), 1800); };
  const spaceDirty = !!space.trim() && space.trim() !== (sx.homespace && sx.homespace.name);
  const saveSpace = () => { if (!spaceDirty || !canRename) return; sx.actions.setSpaceName(space.trim()); setSpaceSaved(true); setTimeout(() => setSpaceSaved(false), 1800); };

  const invite = async () => {
    setMaking(true);
    try {
      const url = await sx.actions.createInvite();
      setInviteUrl(url);
      if (navigator.share) { try { await navigator.share({ title: 'Join my Together space', url }); } catch (e) {} }
      else { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (e) {} }
    } catch (e) {}
    setMaking(false);
  };
  const newSpace = async () => { const nm = window.prompt('Name your new space'); if (nm && nm.trim()) { try { await sx.actions.createHome(nm.trim()); onClose(); } catch (e) {} } };
  const leave = (s) => { if (window.confirm('Leave “' + s.name + '”? You lose access to its lists (they stay for everyone else).')) sx.actions.leaveHome(s.id).catch(() => {}); };

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{ flex: 1, padding: '9px 8px', borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 13, background: tab === id ? '#fff' : 'transparent', color: tab === id ? '#3a352f' : '#9a9186', boxShadow: tab === id ? '0 1px 2px rgba(58,53,47,.06)' : 'none' }}>{label}</button>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(58,53,47,.42)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'tog-fade .15s ease' }}>
      <div onClick={stop} style={{ width: '100%', maxWidth: 392, background: '#f6f4ef', borderRadius: 26, boxShadow: '0 30px 70px rgba(58,53,47,.32)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column', animation: 'tog-pop .18s ease' }}>
        <div style={{ padding: '22px 22px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 23, fontWeight: 700, margin: 0, color: '#3a352f' }}>Account</h2>
          <button onClick={onClose} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#ece6db', color: '#857c70', fontSize: 17, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '0 22px 14px' }}>
          <div style={{ display: 'flex', gap: 4, background: '#ece6db', borderRadius: 13, padding: 4 }}>
            <TabBtn id="space" label="This space" />
            <TabBtn id="spaces" label={'Your spaces' + (sx.spaces && sx.spaces.length > 1 ? ' · ' + sx.spaces.length : '')} />
          </div>
        </div>

        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px 4px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tab === 'space' ? (
            <React.Fragment>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <span style={aUpper}>Space name {canRename ? '' : '(owner/admin only)'}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={space} onChange={(e) => { setSpace(e.target.value); setSpaceSaved(false); }} onKeyDown={(e) => { if (e.key === 'Enter') saveSpace(); }} disabled={!canRename} style={{ ...aInput, flex: 1, opacity: canRename ? 1 : 0.6 }} placeholder="Our space" />
                  {canRename && <button onClick={saveSpace} disabled={!spaceDirty && !spaceSaved} style={{ flexShrink: 0, background: spaceSaved ? 'var(--partner)' : (spaceDirty ? 'var(--primary)' : '#ece6db'), color: (spaceDirty || spaceSaved) ? '#fff' : '#b3a99c', border: 'none', borderRadius: 12, padding: '0 18px', fontWeight: 800, fontSize: 14, cursor: spaceDirty ? 'pointer' : 'default', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{spaceSaved ? 'Saved ✓' : 'Save'}</button>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <span style={aUpper}>Your name here</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={name} onChange={(e) => { setName(e.target.value); setNameSaved(false); }} onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }} style={{ ...aInput, flex: 1 }} placeholder="Your name" />
                  <button onClick={saveName} disabled={!nameDirty && !nameSaved} style={{ flexShrink: 0, background: nameSaved ? 'var(--partner)' : (nameDirty ? 'var(--primary)' : '#ece6db'), color: (nameDirty || nameSaved) ? '#fff' : '#b3a99c', border: 'none', borderRadius: 12, padding: '0 18px', fontWeight: 800, fontSize: 14, cursor: nameDirty ? 'pointer' : 'default', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{nameSaved ? 'Saved ✓' : 'Save'}</button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                <span style={aUpper}>Members</span>
                {sx.members.map(m => {
                  const isMe = sx.me && m.uid === sx.me.uid;
                  const canRemove = !isMe && (iAmOwner ? m.role !== 'owner' : (sx.me && sx.me.isAdmin && m.role === 'member'));
                  const showOwnerCtl = iAmOwner && !isMe && m.role !== 'owner';
                  return (
                    <div key={m.uid} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                        <Avatar name={m.name} idx={m.idx} size={28} src={m.avatar} />
                        <span style={{ fontSize: 14.5, fontWeight: 700, color: '#3a352f' }}>{m.name}</span>
                        <RoleBadge role={m.role} />
                        {isMe && <span style={pill('#f4e8dd', '#a8794f')}>You</span>}
                      </div>
                      {(showOwnerCtl || canRemove) && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 37 }}>
                          {showOwnerCtl && <button onClick={() => sx.actions.setRole(m.uid, m.role === 'admin' ? 'member' : 'admin').catch(() => {})} style={miniBtn}>{m.role === 'admin' ? 'Remove admin' : 'Make admin'}</button>}
                          {showOwnerCtl && <button onClick={() => { if (window.confirm('Make ' + m.name + ' the owner? You become an admin and lose owner rights.')) sx.actions.transferOwnership(m.uid).catch(() => {}); }} style={miniBtn}>Make owner</button>}
                          {canRemove && <button onClick={() => { if (window.confirm('Remove ' + m.name + ' from this space? They lose access (the lists stay).')) sx.actions.removeMember(m.uid).catch(() => {}); }} style={miniDanger}>Remove</button>}
                        </div>
                      )}
                    </div>
                  );
                })}
                {sx.members.length < 2 && <span style={{ fontSize: 13, color: '#b3a99c', fontWeight: 600 }}>Just you so far — invite someone below.</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #f0ebe2', paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={aUpper}>Invite to this space</span>
                  {canRename && (
                    <button onClick={() => sx.actions.setInvitesEnabled(!invitesOn).catch(() => {})} role="switch" aria-checked={invitesOn} title={invitesOn ? 'Turn invite link off' : 'Turn invite link on'} style={{ width: 44, height: 26, borderRadius: 999, background: invitesOn ? 'var(--partner)' : '#ddd5c8', position: 'relative', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'background .15s', padding: 0 }}>
                      <span style={{ position: 'absolute', top: 3, left: invitesOn ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
                    </button>
                  )}
                </div>
                {invitesOn ? (
                  <React.Fragment>
                    <button onClick={invite} disabled={making} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--partner)', color: '#fff', border: 'none', borderRadius: 13, padding: '13px', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <window.Icons.Share size={16} /> {making ? 'Creating link…' : (navigator.share ? 'Share invite link' : (copied ? 'Link copied!' : 'Copy invite link'))}
                    </button>
                    {inviteUrl && <div style={{ fontSize: 12, fontWeight: 600, color: '#9a9186', wordBreak: 'break-all', background: '#fff', border: '1px solid #ece6db', borderRadius: 10, padding: '9px 11px' }}>{inviteUrl}</div>}
                  </React.Fragment>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#9a9186', background: '#fff', border: '1px solid #ece6db', borderRadius: 12, padding: '12px 13px', lineHeight: 1.45 }}>
                    The invite link is <b>off</b> — existing links won’t work either.{canRename ? ' Flip the switch to let new people join.' : ' Ask the owner to turn it on.'}
                  </div>
                )}
              </div>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <span style={aUpper}>Your spaces</span>
                {(sx.spaces || []).map(s => {
                  const active = s.id === sx.homespaceId;
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: active ? '#fff' : 'transparent', border: '1px solid ' + (active ? '#e7d3a3' : '#ece6db'), borderRadius: 14, padding: '11px 13px' }}>
                      <button onClick={() => { sx.actions.switchHome(s.id); onClose(); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', padding: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: '#3a352f' }}>{s.name}</span>
                          <RoleBadge role={s.role} />
                          {active && <span style={pill('#f4e8dd', '#a8794f')}>Current</span>}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#9a9186' }}>You here: {s.myName || '—'}</span>
                      </button>
                      {s.role !== 'owner' && <button onClick={() => leave(s)} style={miniDanger}>Leave</button>}
                    </div>
                  );
                })}
                <button onClick={newSpace} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'transparent', color: '#a8794f', border: '1px dashed #cbb9a2', borderRadius: 13, padding: '12px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>+ New space</button>
              </div>
            </React.Fragment>
          )}
        </div>

        <div style={{ padding: '14px 22px 22px' }}>
          <button onClick={() => sx.actions.signOut()} style={{ width: '100%', background: '#fff', color: '#7a7166', border: '1px solid #e6ded2', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
        </div>
      </div>
    </div>
  );
}

window.TogetherAccount = { SignIn, Splash, HomeButton, AccountButton, AccountSheet, Avatar, memberColorByIndex };
