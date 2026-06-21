// session.jsx — auth + homespace bootstrap (window.useTogetherSession).
//
// One account can belong to MANY homespaces. Resolves the Supabase session,
// ensures a profile + at least one homespace (redeeming an ?invite= if present),
// tracks the ACTIVE homespace (switchable), and loads its members + your role.
// Names are per-homespace (members.display_name). Returns everything the apps
// need to gate on auth and scope data to the active space.

const HS_KEY = 'togetherkit.hs';

function useTogetherSession() {
  const BE = window.TogetherBackend;
  const { client } = BE;

  const [ready, setReady] = React.useState(false);
  const [session, setSession] = React.useState(null);
  const [booting, setBooting] = React.useState(false);
  const [homespaceId, setHomespaceIdRaw] = React.useState(null);
  const [homespace, setHomespace] = React.useState(null);
  const [members, setMembers] = React.useState([]);
  const [spaces, setSpaces] = React.useState([]);     // every homespace I'm in
  const [profile, setProfile] = React.useState(null);
  const [error, setError] = React.useState(null);

  const setHomespaceId = (id) => { try { if (id) localStorage.setItem(HS_KEY, id); } catch (e) {} setHomespaceIdRaw(id); };

  // track auth
  React.useEffect(() => {
    client.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = client.auth.onAuthStateChange((_e, s) => { setSession(s); setReady(true); });
    return () => data.subscription && data.subscription.unsubscribe();
  }, [client]);

  // bootstrap profile + active homespace when signed in
  React.useEffect(() => {
    if (!session) { setHomespaceIdRaw(null); setHomespace(null); setMembers([]); setSpaces([]); setProfile(null); return; }
    let alive = true;
    (async () => {
      setBooting(true); setError(null);
      try {
        const u = session.user;
        const md = u.user_metadata || {};
        const fallbackName = md.name || md.full_name || (u.email ? u.email.split('@')[0] : 'Me');
        const avatar = md.avatar_url || md.picture || null;

        const existing = await client.from('profiles').select('display_name,email').eq('id', u.id).maybeSingle();
        if (!existing.data) await client.from('profiles').insert({ id: u.id, display_name: fallbackName, avatar_url: avatar, email: u.email });
        else {
          const upd = {};
          if (!existing.data.display_name) { upd.display_name = fallbackName; upd.avatar_url = avatar; }
          if (!existing.data.email && u.email) upd.email = u.email;
          if (Object.keys(upd).length) await client.from('profiles').update(upd).eq('id', u.id);
        }

        // active homespace: invite link wins, then remembered, then first/own.
        const params = new URLSearchParams(location.search);
        let invite = params.get('invite');
        try { if (!invite) invite = localStorage.getItem('togetherkit.pendinginvite'); } catch (e) {}
        let hs = null;
        if (invite) {
          try { const { data } = await client.rpc('redeem_invite', { p_token: invite }); hs = data; } catch (e) {}
          try { localStorage.removeItem('togetherkit.pendinginvite'); } catch (e) {}
          if (params.get('invite')) { params.delete('invite'); const q = params.toString(); history.replaceState(null, '', location.pathname + (q ? '?' + q : '')); }
        }
        if (!hs) { try { hs = localStorage.getItem(HS_KEY); } catch (e) {} }
        if (hs) { const chk = await client.from('members').select('homespace_id').eq('homespace_id', hs).eq('user_id', session.user.id).maybeSingle(); if (!chk.data) hs = null; }
        if (!hs) { const { data } = await client.rpc('ensure_home'); hs = data; }
        if (!alive) return;
        setHomespaceId(hs);
      } catch (e) { if (alive) setError(e.message || String(e)); }
      finally { if (alive) setBooting(false); }
    })();
    return () => { alive = false; };
  }, [session, client]);

  // load all of my homespaces (account-level list)
  const reloadSpaces = React.useCallback(async () => {
    if (!session) return;
    const mine = await client.from('members').select('homespace_id,role,display_name').eq('user_id', session.user.id);
    const rows = mine.data || [];
    const ids = rows.map(r => r.homespace_id);
    let names = {};
    if (ids.length) { const hr = await client.from('homespaces').select('id,name,created_by').in('id', ids); (hr.data || []).forEach(h => { names[h.id] = h; }); }
    setSpaces(rows.map(r => ({ id: r.homespace_id, name: (names[r.homespace_id] && names[r.homespace_id].name) || 'Space', role: r.role, myName: r.display_name || '', ownerId: names[r.homespace_id] && names[r.homespace_id].created_by })).sort((a, b) => a.name.localeCompare(b.name)));
  }, [client, session]);

  // load active homespace + its members (live)
  React.useEffect(() => {
    if (!homespaceId || !session) return;
    let alive = true;
    const load = async () => {
      const hsRow = await client.from('homespaces').select('id,name,created_by,invites_enabled').eq('id', homespaceId).maybeSingle();
      const mem = await client.from('members').select('user_id,role,display_name,created_at').eq('homespace_id', homespaceId).order('created_at', { ascending: true });
      const ids = (mem.data || []).map(m => m.user_id);
      const profs = {};
      if (ids.length) { const pr = await client.from('profiles').select('id,display_name,avatar_url,email').in('id', ids); (pr.data || []).forEach(p => { profs[p.id] = p; }); }
      if (!alive) return;
      const list = (mem.data || []).map((m, i) => ({
        uid: m.user_id, role: m.role, idx: i,
        name: m.display_name || (profs[m.user_id] && profs[m.user_id].display_name) || 'Member',
        avatar: (profs[m.user_id] && profs[m.user_id].avatar_url) || null,
        email: (profs[m.user_id] && profs[m.user_id].email) || null,
      }));
      setHomespace(hsRow.data || { id: homespaceId, name: 'Our space' });
      setMembers(list);
      setProfile(profs[session.user.id] || null);
    };
    load(); reloadSpaces();
    const ch = client.channel('hs:' + homespaceId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: 'homespace_id=eq.' + homespaceId }, () => { load(); reloadSpaces(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homespaces', filter: 'id=eq.' + homespaceId }, () => { load(); reloadSpaces(); })
      .subscribe();
    return () => { alive = false; client.removeChannel(ch); };
  }, [homespaceId, session, client, reloadSpaces]);

  const meRow = session ? members.find(m => m.uid === session.user.id) : null;
  const ownerId = (homespace && homespace.created_by) || (members.find(m => m.role === 'owner') || {}).uid || null;
  const myRole = meRow ? meRow.role : null;

  const actions = React.useMemo(() => ({
    signInGoogle: () => BE.auth.signInGoogle(),
    // Robust sign-out: clear local session and force the gate back to sign-in
    // even if the server revoke call fails (e.g. an already-expired session).
    signOut: async () => {
      try { localStorage.removeItem(HS_KEY); } catch (e) {}
      try { await client.auth.signOut({ scope: 'local' }); } catch (e) { console.warn('[togetherkit] signOut', e); }
      setSession(null); setHomespaceIdRaw(null); setHomespace(null); setMembers([]); setSpaces([]); setProfile(null);
    },
    // rename YOUR name in the active homespace
    setMyName: async (name) => {
      const r = await client.rpc('set_member_name', { p_homespace: homespaceId, p_name: name });
      if (r.error) { console.warn('[togetherkit] setMyName', r.error.message); return r; }
      setMembers(ms => ms.map(m => m.uid === session.user.id ? { ...m, name } : m));
      setSpaces(ss => ss.map(s => s.id === homespaceId ? { ...s, myName: name } : s));
      return r;
    },
    // rename the active homespace (owner/admin only — enforced in the RPC)
    setSpaceName: async (name) => {
      const r = await client.rpc('rename_home', { p_homespace: homespaceId, p_name: name });
      if (r.error) { console.warn('[togetherkit] rename', r.error.message); return r; }
      setHomespace(h => (h ? { ...h, name } : h)); setSpaces(ss => ss.map(s => s.id === homespaceId ? { ...s, name } : s));
      return r;
    },
    createInvite: async () => {
      const token = 'inv-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      const r = await client.from('invites').insert({ token, homespace_id: homespaceId, created_by: session.user.id });
      if (r.error) throw r.error;
      return location.origin + location.pathname + '?invite=' + token;
    },
    setInvitesEnabled: async (on) => {
      const r = await client.rpc('set_invites', { p_homespace: homespaceId, p_on: on });
      if (r.error) { console.warn('[togetherkit] setInvites', r.error.message); throw r.error; }
      setHomespace(h => (h ? { ...h, invites_enabled: on } : h));
      return r;
    },
    switchHome: (id) => { if (id && id !== homespaceId) setHomespaceId(id); },
    createHome: async (name) => {
      const r = await client.rpc('create_home', { p_name: name || 'New space' });
      if (r.error) { console.warn('[togetherkit] createHome', r.error.message); throw r.error; }
      await reloadSpaces(); setHomespaceId(r.data); return r.data;
    },
    leaveHome: async (id) => {
      const r = await client.rpc('leave_home', { p_homespace: id });
      if (r.error) { console.warn('[togetherkit] leaveHome', r.error.message); throw r.error; }
      const remaining = (await client.from('members').select('homespace_id').eq('user_id', session.user.id)).data || [];
      await reloadSpaces();
      if (id === homespaceId) {
        if (remaining.length) setHomespaceId(remaining[0].homespace_id);
        else { const { data } = await client.rpc('ensure_home'); setHomespaceId(data); }
      }
    },
    setRole: async (uid, role) => { const r = await client.rpc('set_role', { p_homespace: homespaceId, p_user: uid, p_role: role }); if (r.error) { console.warn('[togetherkit] setRole', r.error.message); throw r.error; } },
    removeMember: async (uid) => { const r = await client.rpc('remove_member', { p_homespace: homespaceId, p_user: uid }); if (r.error) { console.warn('[togetherkit] removeMember', r.error.message); throw r.error; } },
    transferOwnership: async (uid) => { const r = await client.rpc('transfer_ownership', { p_homespace: homespaceId, p_user: uid }); if (r.error) { console.warn('[togetherkit] transferOwnership', r.error.message); throw r.error; } setHomespace(h => (h ? { ...h, created_by: uid } : h)); },
  }), [BE, client, session, homespaceId, reloadSpaces]);

  const myName = (meRow && meRow.name)
    || (profile && profile.display_name)
    || (session && session.user && (session.user.user_metadata || {}).name)
    || 'Me';
  const myAvatar = (meRow && meRow.avatar)
    || (profile && profile.avatar_url)
    || (session && session.user && (session.user.user_metadata || {}).avatar_url)
    || (session && session.user && (session.user.user_metadata || {}).picture)
    || null;
  const me = session ? { uid: session.user.id, name: myName, avatar: myAvatar, role: myRole, isOwner: myRole === 'owner', isAdmin: myRole === 'admin' || myRole === 'owner' } : null;

  return { ready, booting, error, session, user: session && session.user, me, ownerId, myRole, homespaceId, homespace, members, spaces, actions };
}

window.useTogetherSession = useTogetherSession;
