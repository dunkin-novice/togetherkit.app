// account.jsx — sign-in screen + account menu (window.TogetherAccount).
// The account menu is where names are edited, the partner is invited, and you
// sign out. Member colors (primary for the first member, partner for the second)
// are derived here and reused for avatars across the app.

const memberColorByIndex = (idx) => idx === 0 ? 'var(--primary)' : idx === 1 ? 'var(--partner)' : '#b3a99c';

function Avatar({ name, idx, size = 26, src }) {
  // Show the Google profile photo when we have one; fall back to a colored
  // initial. `referrerPolicy` is required or Google may refuse to serve the image.
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

// Full-screen sign-in gate
function SignIn({ onGoogle }) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const go = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await onGoogle();
      if (r && r.error) { setErr(r.error.message); setBusy(false); }
      // on success the page redirects to Google, so we leave `busy` true
    } catch (e) { setErr((e && e.message) || String(e)); setBusy(false); }
  };
  return (
    <div className="app" style={{ alignItems: 'center' }}>
      <div className="app-shell" style={{ maxWidth: 420 }}>
        <div style={{ padding: '54px 30px 44px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}><window.Icons.Logo size={24} /></div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, margin: 0, color: '#3a352f', letterSpacing: '.3px' }}>Together</h1>
          <p style={{ margin: '0 0 22px', fontSize: 15, color: '#9a9186', fontWeight: 600, maxWidth: 280, lineHeight: 1.45 }}>A little app made for two in love. Sign in, then invite your soulmate to your homespace.</p>
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

// A small splash while auth/homespace resolves
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

// Top-left home button → back to the Together hub. Sits on the very left,
// with the account button beside it.
function HomeButton({ href = '../' }) {
  return (
    <a href={href} title="Together home"
      style={{ position: 'fixed', top: 24, left: 24, zIndex: 900, width: 46, height: 46, borderRadius: '50%', border: '1px solid #ecd9c4', background: '#fffaf3', color: '#b07d42', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textDecoration: 'none', boxShadow: '0 2px 4px rgba(58,53,47,.08),0 8px 20px rgba(58,53,47,.12)' }}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" /></svg>
    </a>
  );
}

// Account button → opens the account sheet. Sits just right of the home button.
function AccountButton({ sx, onOpen }) {
  const meIdx = Math.max(0, sx.members.findIndex(m => sx.me && m.uid === sx.me.uid));
  return (
    <button onClick={onOpen} title="Account & invite"
      style={{ position: 'fixed', top: 24, left: 80, zIndex: 900, width: 46, height: 46, padding: 0, borderRadius: '50%', border: '1px solid #ecd9c4', background: '#fffaf3', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(58,53,47,.08),0 8px 20px rgba(58,53,47,.12)' }}>
      <Avatar name={sx.me ? sx.me.name : '?'} idx={meIdx} size={32} src={sx.me && sx.me.avatar} />
    </button>
  );
}

const aUpper = { fontSize: 11, fontWeight: 800, color: '#aaa093', letterSpacing: '.6px', textTransform: 'uppercase' };
const aInput = { width: '100%', border: '1px solid #ece6db', background: '#fff', borderRadius: 12, padding: '12px 13px', fontSize: 15, fontFamily: 'inherit', fontWeight: 700, color: '#3a352f', outline: 'none' };

function AccountSheet({ sx, onClose }) {
  const [name, setName] = React.useState(sx.me ? sx.me.name : '');
  const [space, setSpace] = React.useState(sx.homespace ? sx.homespace.name : '');
  const [inviteUrl, setInviteUrl] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [making, setMaking] = React.useState(false);
  const [nameSaved, setNameSaved] = React.useState(false);
  const [spaceSaved, setSpaceSaved] = React.useState(false);
  const stop = (e) => e.stopPropagation();

  const nameDirty = !!name.trim() && name.trim() !== (sx.me && sx.me.name);
  const saveName = () => { if (!nameDirty) return; sx.actions.setMyName(name.trim()); setNameSaved(true); setTimeout(() => setNameSaved(false), 1800); };
  const spaceDirty = !!space.trim() && space.trim() !== (sx.homespace && sx.homespace.name);
  const saveSpace = () => { if (!spaceDirty) return; sx.actions.setSpaceName(space.trim()); setSpaceSaved(true); setTimeout(() => setSpaceSaved(false), 1800); };

  const invite = async () => {
    setMaking(true);
    try {
      const url = await sx.actions.createInvite();
      setInviteUrl(url);
      if (navigator.share) { try { await navigator.share({ title: 'Join my Together list', url }); } catch (e) {} }
      else { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (e) {} }
    } catch (e) { /* surfaced via console */ }
    setMaking(false);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(58,53,47,.42)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'tog-fade .15s ease' }}>
      <div onClick={stop} style={{ width: '100%', maxWidth: 380, background: '#f6f4ef', borderRadius: 26, boxShadow: '0 30px 70px rgba(58,53,47,.32)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column', animation: 'tog-pop .18s ease' }}>
        <div style={{ padding: '22px 22px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 23, fontWeight: 700, margin: 0, color: '#3a352f' }}>Account</h2>
          <button onClick={onClose} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#ece6db', color: '#857c70', fontSize: 17, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div className="tog-scroll" style={{ overflowY: 'auto', padding: '0 22px 4px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={aUpper}>Your name</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={name} onChange={(e) => { setName(e.target.value); setNameSaved(false); }} onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }} style={{ ...aInput, flex: 1 }} placeholder="Your name" />
              <button onClick={saveName} disabled={!nameDirty && !nameSaved}
                style={{ flexShrink: 0, background: nameSaved ? 'var(--partner)' : (nameDirty ? 'var(--primary)' : '#ece6db'), color: (nameDirty || nameSaved) ? '#fff' : '#b3a99c', border: 'none', borderRadius: 12, padding: '0 18px', fontWeight: 800, fontSize: 14, cursor: nameDirty ? 'pointer' : 'default', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                {nameSaved ? 'Saved ✓' : 'Save'}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={aUpper}>Space name</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={space} onChange={(e) => { setSpace(e.target.value); setSpaceSaved(false); }} onKeyDown={(e) => { if (e.key === 'Enter') saveSpace(); }} style={{ ...aInput, flex: 1 }} placeholder="Our space" />
              <button onClick={saveSpace} disabled={!spaceDirty && !spaceSaved}
                style={{ flexShrink: 0, background: spaceSaved ? 'var(--partner)' : (spaceDirty ? 'var(--primary)' : '#ece6db'), color: (spaceDirty || spaceSaved) ? '#fff' : '#b3a99c', border: 'none', borderRadius: 12, padding: '0 18px', fontWeight: 800, fontSize: 14, cursor: spaceDirty ? 'pointer' : 'default', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                {spaceSaved ? 'Saved ✓' : 'Save'}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span style={aUpper}>Members</span>
            {sx.members.map(m => (
              <div key={m.uid} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={m.name} idx={m.idx} size={28} src={m.avatar} />
                <span style={{ fontSize: 14.5, fontWeight: 700, color: '#3a352f' }}>{m.name}</span>
                {sx.me && m.uid === sx.me.uid && <span style={{ fontSize: 11, fontWeight: 800, color: '#a8794f', background: '#f4e8dd', padding: '2px 8px', borderRadius: 999 }}>You</span>}
              </div>
            ))}
            {sx.members.length < 2 && <span style={{ fontSize: 13, color: '#b3a99c', fontWeight: 600 }}>Just you so far — invite your partner below.</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #f0ebe2', paddingTop: 16 }}>
            <span style={aUpper}>Invite your partner</span>
            <button onClick={invite} disabled={making}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--partner)', color: '#fff', border: 'none', borderRadius: 13, padding: '13px', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>
              <window.Icons.Share size={16} /> {making ? 'Creating link…' : (navigator.share ? 'Share invite link' : (copied ? 'Link copied!' : 'Copy invite link'))}
            </button>
            {inviteUrl && <div style={{ fontSize: 12, fontWeight: 600, color: '#9a9186', wordBreak: 'break-all', background: '#fff', border: '1px solid #ece6db', borderRadius: 10, padding: '9px 11px' }}>{inviteUrl}</div>}
          </div>
        </div>
        <div style={{ padding: '14px 22px 22px' }}>
          <button onClick={() => sx.actions.signOut()} style={{ width: '100%', background: '#fff', color: '#7a7166', border: '1px solid #e6ded2', borderRadius: 13, padding: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
        </div>
      </div>
    </div>
  );
}

window.TogetherAccount = { SignIn, Splash, HomeButton, AccountButton, AccountSheet, Avatar, memberColorByIndex };
