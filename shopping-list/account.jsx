// account.jsx — sign-in screen + account menu (window.TogetherAccount).
// The account menu is where names are edited, the partner is invited, and you
// sign out. Member colors (primary for the first member, partner for the second)
// are derived here and reused for avatars across the app.

const memberColorByIndex = (idx) => idx === 0 ? 'var(--primary)' : idx === 1 ? 'var(--partner)' : '#b3a99c';

function Avatar({ name, idx, size = 26 }) {
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
  return (
    <div className="app" style={{ alignItems: 'center' }}>
      <div className="app-shell" style={{ maxWidth: 420 }}>
        <div style={{ padding: '54px 30px 44px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}><window.Icons.Logo size={24} /></div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, margin: 0, color: '#3a352f', letterSpacing: '.3px' }}>Together</h1>
          <p style={{ margin: '0 0 22px', fontSize: 15, color: '#9a9186', fontWeight: 600, maxWidth: 280, lineHeight: 1.45 }}>A shared shopping list for two. Sign in, then invite your soulmate to your homespace.</p>
          <button onClick={onGoogle}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', maxWidth: 300, background: '#fff', color: '#3a352f', border: '1px solid #e6ded2', borderRadius: 14, padding: '14px', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(58,53,47,.05),0 6px 16px rgba(58,53,47,.05)' }}>
            <GoogleMark /> Sign in with Google
          </button>
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

// Top-left account button → opens the account sheet
function AccountButton({ sx, onOpen }) {
  const meIdx = Math.max(0, sx.members.findIndex(m => sx.me && m.uid === sx.me.uid));
  return (
    <button onClick={onOpen} title="Account & invite"
      style={{ position: 'fixed', top: 24, left: 24, zIndex: 900, height: 46, padding: '0 14px 0 8px', borderRadius: 999, border: '1px solid #ecd9c4', background: '#fffaf3', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', boxShadow: '0 2px 4px rgba(58,53,47,.08),0 8px 20px rgba(58,53,47,.12)' }}>
      <Avatar name={sx.me ? sx.me.name : '?'} idx={meIdx} size={30} />
      <span style={{ fontWeight: 800, fontSize: 13.5, color: '#3a352f', maxWidth: 110, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sx.me ? sx.me.name : ''}</span>
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
  const stop = (e) => e.stopPropagation();

  const saveName = () => { const n = name.trim(); if (n && n !== (sx.me && sx.me.name)) sx.actions.setMyName(n); };
  const saveSpace = () => { const n = space.trim(); if (n && n !== (sx.homespace && sx.homespace.name)) sx.actions.setSpaceName(n); };

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
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} style={aInput} placeholder="Your name" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={aUpper}>Space name</span>
            <input value={space} onChange={(e) => setSpace(e.target.value)} onBlur={saveSpace} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} style={aInput} placeholder="Our space" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span style={aUpper}>Members</span>
            {sx.members.map(m => (
              <div key={m.uid} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={m.name} idx={m.idx} size={28} />
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

window.TogetherAccount = { SignIn, Splash, AccountButton, AccountSheet, Avatar, memberColorByIndex };
