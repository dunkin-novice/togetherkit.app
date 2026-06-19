// session.jsx — auth + homespace bootstrap (window.useTogetherSession).
//
// Resolves the Supabase session, ensures the user has a profile and a homespace
// (redeeming an ?invite=token link if present, else their own), and loads the
// homespace + its members for display. Returns everything the app needs to gate
// on auth and scope data to the shared space.

const HS_KEY = 'togetherkit.hs';

function useTogetherSession() {
  const BE = window.TogetherBackend;
  const { client } = BE;

  const [ready, setReady] = React.useState(false);   // auth state resolved
  const [session, setSession] = React.useState(null);
  const [booting, setBooting] = React.useState(false);
  const [homespaceId, setHomespaceId] = React.useState(null);
  const [homespace, setHomespace] = React.useState(null);
  const [members, setMembers] = React.useState([]);
  const [profile, setProfile] = React.useState(null);
  const [error, setError] = React.useState(null);

  // track auth
  React.useEffect(() => {
    client.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = client.auth.onAuthStateChange((_e, s) => { setSession(s); setReady(true); });
    return () => data.subscription && data.subscription.unsubscribe();
  }, [client]);

  // bootstrap profile + homespace when signed in
  React.useEffect(() => {
    if (!session) { setHomespaceId(null); setHomespace(null); setMembers([]); setProfile(null); return; }
    let alive = true;
    (async () => {
      setBooting(true); setError(null);
      try {
        const u = session.user;
        const md = u.user_metadata || {};
        const fallbackName = md.name || md.full_name || (u.email ? u.email.split('@')[0] : 'Me');
        const avatar = md.avatar_url || md.picture || null;

        // create profile on first sign-in; never clobber a name the user edited.
        // Email is captured/backfilled so the partner can be invited to calendar events.
        const existing = await client.from('profiles').select('display_name,email').eq('id', u.id).maybeSingle();
        if (!existing.data) await client.from('profiles').insert({ id: u.id, display_name: fallbackName, avatar_url: avatar, email: u.email });
        else {
          const upd = {};
          if (!existing.data.display_name) { upd.display_name = fallbackName; upd.avatar_url = avatar; }
          if (!existing.data.email && u.email) upd.email = u.email;
          if (Object.keys(upd).length) await client.from('profiles').update(upd).eq('id', u.id);
        }

        // homespace: invite link wins, then remembered, then own. The invite may
        // arrive in the URL or, after a Google round-trip, from local storage.
        const params = new URLSearchParams(location.search);
        let invite = params.get('invite');
        try { if (!invite) invite = localStorage.getItem('togetherkit.pendinginvite'); } catch (e) {}
        let hs = null;
        if (invite) {
          try { const { data } = await client.rpc('redeem_invite', { p_token: invite }); hs = data; } catch (e) {}
          try { localStorage.removeItem('togetherkit.pendinginvite'); } catch (e) {}
          if (params.get('invite')) {
            params.delete('invite');
            const q = params.toString();
            history.replaceState(null, '', location.pathname + (q ? '?' + q : ''));
          }
        }
        if (!hs) { try { hs = localStorage.getItem(HS_KEY); } catch (e) {} }
        if (hs) { // make sure we're actually a member of the remembered space
          const chk = await client.from('members').select('homespace_id').eq('homespace_id', hs).maybeSingle();
          if (!chk.data) hs = null;
        }
        if (!hs) { const { data } = await client.rpc('ensure_home'); hs = data; }
        if (!alive) return;
        try { localStorage.setItem(HS_KEY, hs); } catch (e) {}
        setHomespaceId(hs);
      } catch (e) {
        if (alive) setError(e.message || String(e));
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => { alive = false; };
  }, [session, client]);

  // load homespace + members (+ keep live)
  React.useEffect(() => {
    if (!homespaceId || !session) return;
    let alive = true;
    const load = async () => {
      const hsRow = await client.from('homespaces').select('id,name').eq('id', homespaceId).maybeSingle();
      const mem = await client.from('members').select('user_id,role,created_at').eq('homespace_id', homespaceId).order('created_at', { ascending: true });
      const ids = (mem.data || []).map(m => m.user_id);
      const profs = {};
      if (ids.length) {
        const pr = await client.from('profiles').select('id,display_name,avatar_url,email').in('id', ids);
        (pr.data || []).forEach(p => { profs[p.id] = p; });
      }
      if (!alive) return;
      const list = (mem.data || []).map((m, i) => ({
        uid: m.user_id, role: m.role, idx: i,
        name: (profs[m.user_id] && profs[m.user_id].display_name) || 'Member',
        avatar: (profs[m.user_id] && profs[m.user_id].avatar_url) || null,
        email: (profs[m.user_id] && profs[m.user_id].email) || null,
      }));
      setHomespace(hsRow.data || { id: homespaceId, name: 'Our space' });
      setMembers(list);
      setProfile(profs[session.user.id] || null);
    };
    load();
    const ch = client.channel('hs:' + homespaceId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: 'homespace_id=eq.' + homespaceId }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homespaces', filter: 'id=eq.' + homespaceId }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .subscribe();
    return () => { alive = false; client.removeChannel(ch); };
  }, [homespaceId, session, client]);

  const actions = React.useMemo(() => ({
    signInGoogle: () => BE.auth.signInGoogle(),
    signOut: async () => { try { localStorage.removeItem(HS_KEY); } catch (e) {} await BE.auth.signOut(); },
    // Update + reflect locally right away. We can't rely on a realtime event for
    // profiles/homespaces (those tables aren't in the realtime publication), so
    // the optimistic state update is what makes the rename actually show.
    setMyName: async (name) => {
      const r = await client.from('profiles').update({ display_name: name }).eq('id', session.user.id);
      if (r.error) { console.warn('[togetherkit] setMyName failed:', r.error.message); return r; }
      setProfile(p => (p ? { ...p, display_name: name } : { id: session.user.id, display_name: name }));
      setMembers(ms => ms.map(m => m.uid === session.user.id ? { ...m, name } : m));
      return r;
    },
    setSpaceName: async (name) => {
      const r = await client.from('homespaces').update({ name }).eq('id', homespaceId);
      if (r.error) { console.warn('[togetherkit] setSpaceName failed:', r.error.message); return r; }
      setHomespace(h => (h ? { ...h, name } : { id: homespaceId, name }));
      return r;
    },
    createInvite: async () => {
      const token = 'inv-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      const r = await client.from('invites').insert({ token, homespace_id: homespaceId, created_by: session.user.id });
      if (r.error) throw r.error;
      return location.origin + location.pathname + '?invite=' + token;
    },
  }), [BE, client, session, homespaceId]);

  const myName = (profile && profile.display_name)
    || (session && (members.find(m => m.uid === session.user.id) || {}).name)
    || 'Me';
  // Prefer the stored profile photo, then the member row, then the live Google
  // metadata (covers the first render before profiles/members have loaded).
  const myAvatar = (profile && profile.avatar_url)
    || (session && (members.find(m => m.uid === session.user.id) || {}).avatar)
    || (session && session.user && (session.user.user_metadata || {}).avatar_url)
    || (session && session.user && (session.user.user_metadata || {}).picture)
    || null;
  const me = session ? { uid: session.user.id, name: myName, avatar: myAvatar } : null;

  return { ready, booting, error, session, user: session && session.user, me, homespaceId, homespace, members, actions };
}

window.useTogetherSession = useTogetherSession;
