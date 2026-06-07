import React, { useState, useEffect } from 'react';
import { supabase, trackEvent, getSessionId } from './lib/supabase';
import { isPortalCodeVerified, setPortalCodeVerified, linkPortalSessionToUser, clearPortalSession } from './lib/session';
import { updateUserPresence, resolvePortalAdmin, ensurePortalAdminFlag, submitInterestToSupport } from './lib/community';
import { useBrandContent } from './lib/content';
import { getFontFamily } from './lib/design';
import LoginScreen from './components/LoginScreen';
import Nav from './components/Nav';
import HomeView from './components/HomeView';
import BrandView from './components/BrandView';
import { InterestView, ThanksView } from './components/InterestView';
import AdminDashboard from './components/AdminDashboard';
import ProfileModal from './components/ProfileModal';
import ChatSidebar from './components/messaging/ChatSidebar';

export default function App() {
  const [authState, setAuthState] = useState('loading');
  const [adminMode, setAdminMode] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState('retailer'); // 'distributor' | 'retailer'
  const [view, setView] = useState('home');
  const [activeBrand, setActiveBrand] = useState(null);
  const [interests, setInterests] = useState([]);
  const [masterPricingBrands, setMasterPricingBrands] = useState({});
  const [form, setForm] = useState({ name: '', company: '', phone: '', email: '', notes: '' });
  const [isMobile, setIsMobile] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [isPortalAdmin, setIsPortalAdmin] = useState(false);
  const { getMergedBrands, bgColor, globalStyles, navigation } = useBrandContent();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Handle direct hash URL links (e.g. globalaccess.shop/#goldwhip)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && hash.length > 0) {
      setActiveBrand(hash);
      setView('brand');
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const isAdmin = await resolvePortalAdmin(session.user);
        setUser(session.user);
        setIsPortalAdmin(isAdmin);
        setAuthState(isAdmin ? 'admin' : 'portal');
        if (isAdmin) {
          setForm(f => ({ ...f, name: f.name || 'Global Access', company: f.company || 'Global Access', email: session.user.email }));
          await ensurePortalAdminFlag(session.user.id, session.user.email);
        }
        try {
          const { data: profile } = await supabase.from('user_profiles').select('user_type, name, company, phone, username, bio, profile_avatar_url').eq('user_id', session.user.id).single();
          if (profile?.user_type) setUserType(profile.user_type);
          if (profile?.name) setForm(f => ({ ...f, name: profile.name, company: profile.company || f.company, phone: profile.phone || f.phone }));
        } catch (_) {}
        await linkPortalSessionToUser(session.user.id);
        await updateUserPresence(session.user.id, 'online');
      } else {
        const verified = await isPortalCodeVerified();
        const wantsAdmin = new URLSearchParams(window.location.search).get('admin') === '1'
          || window.location.hash === '#admin';
        setAuthState(wantsAdmin ? 'login' : (verified ? 'browse' : 'gate'));
      }
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (session?.user) {
        const isAdmin = await resolvePortalAdmin(session.user);
        setUser(session.user);
        setIsPortalAdmin(isAdmin);
        setAuthState(isAdmin ? 'admin' : 'portal');
        if (isAdmin) await ensurePortalAdminFlag(session.user.id, session.user.email);
        await linkPortalSessionToUser(session.user.id);
        await updateUserPresence(session.user.id, 'online');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id || authState === 'gate' || authState === 'loading') return;
    const tick = () => updateUserPresence(user.id, 'online');
    tick();
    const interval = setInterval(tick, 60000);
    const onHide = () => updateUserPresence(user.id, 'away');
    const onUnload = () => updateUserPresence(user.id, 'offline');
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) onHide();
      else tick();
    });
    window.addEventListener('beforeunload', onUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', onUnload);
      updateUserPresence(user.id, 'offline');
    };
  }, [user?.id, authState]);

  useEffect(() => {
    const canTrack = authState === 'portal' || authState === 'browse' || (authState === 'admin' && adminMode === 'portal');
    if (!canTrack) return;
    const page = activeBrand ? `brand:${activeBrand}` : view;
    const userId = user?.id;
    trackEvent('page_view', page, { user_id: userId });
    const enterTime = Date.now();
    return () => {
      const seconds = Math.round((Date.now() - enterTime) / 1000);
      if (seconds > 2) trackEvent('time_on_page', page, { value: seconds, user_id: userId });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, activeBrand, authState, adminMode]);

  const toggleInterest = (sku, productName, brandName, flavor, qty = 1, orderMode = 'master_case', brandId = null) => {
    const key = `${sku}__${flavor}`;
    const bid = brandId || activeBrand;
    trackEvent('click', bid ? `brand:${bid}` : view, { element: `interest:${sku}:${flavor}`, user_id: user?.id });
    setInterests(prev => {
      if (prev.find(i => i.key === key)) return prev.filter(i => i.key !== key);
      return [...prev, {
        key,
        sku,
        productName,
        brandName,
        brandId: bid,
        flavor,
        qty,
        orderMode,
        wantsMasterPricing: !!(bid && masterPricingBrands[bid]),
      }];
    });
  };

  const toggleMasterPricing = (brandId, brandName) => {
    if (!brandId) return;
    const enabling = !masterPricingBrands[brandId];
    trackEvent('click', `brand:${brandId}`, { element: 'master_pricing_toggle', enabled: enabling, user_id: user?.id });
    setMasterPricingBrands(prev => {
      const next = { ...prev };
      if (enabling) next[brandId] = brandName;
      else delete next[brandId];
      return next;
    });
    setInterests(prev => prev.map(i => (
      i.brandId === brandId ? { ...i, wantsMasterPricing: enabling } : i
    )));
  };

  const isInterested = (sku, flavor) => interests.some(i => i.key === `${sku}__${flavor}`);

  // Browser back/forward button support
  useEffect(() => {
    const handlePop = (e) => {
      const state = e.state;
      if (!state) { setView('home'); setActiveBrand(null); return; }
      if (state.view === 'brand') { setActiveBrand(state.brandId); setView('brand'); }
      else { setView('home'); setActiveBrand(null); }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const goToBrand = (brandId) => {
    trackEvent('click', 'home', { element: `brand_card:${brandId}`, user_id: user?.id });
    window.history.pushState({ view: 'brand', brandId }, '', `#${brandId}`);
    setActiveBrand(brandId);
    setView('brand');
    window.scrollTo(0, 0);
  };

  const goHome = () => {
    window.history.pushState({ view: 'home' }, '', window.location.pathname);
    setView('home');
    setActiveBrand(null);
  };

  const handleNavClick = (item) => {
    if (item.url?.startsWith('#')) {
      goToBrand(item.url.replace('#', ''));
    } else if (item.url?.startsWith('http')) {
      window.open(item.url, '_blank');
    } else {
      goHome();
    }
  };

  const handleLogout = async () => {
    if (user?.id) await updateUserPresence(user.id, 'offline');
    await supabase.auth.signOut();
    await clearPortalSession();
    setUser(null);
    setIsPortalAdmin(false);
    setAuthState('gate');
    setInterests([]);
    setMasterPricingBrands({});
    setAdminMode('dashboard');
  };

  const handleLoggedIn = async (sessionUser) => {
    const isAdmin = await resolvePortalAdmin(sessionUser);
    setUser(sessionUser);
    setIsPortalAdmin(isAdmin);
    setAuthState(isAdmin ? 'admin' : 'portal');
    if (isAdmin) {
      setAdminMode('dashboard');
      setForm(f => ({
        ...f,
        name: f.name || 'Global Access',
        company: f.company || 'Global Access',
        email: sessionUser.email,
      }));
      await ensurePortalAdminFlag(sessionUser.id, sessionUser.email);
    }
    try {
      const { data: profile } = await supabase.from('user_profiles')
        .select('user_type, name, company, phone, username, bio, profile_avatar_url')
        .eq('user_id', sessionUser.id)
        .single();
      if (profile?.user_type) setUserType(profile.user_type);
      if (profile?.name) {
        setForm(f => ({
          ...f,
          name: profile.name,
          company: profile.company || f.company,
          phone: profile.phone || f.phone,
        }));
      }
    } catch (_) {}
    await linkPortalSessionToUser(sessionUser.id);
    await updateUserPresence(sessionUser.id, 'online');
  };

  const handleSubmitAttempt = () => {
    if (authState === 'browse') { setShowSignupPrompt(true); return; }
    doSubmit();
  };

  const doSubmit = async () => {
    const sessionId = await getSessionId();
    await supabase.from('inquiries').insert({
      session_id: sessionId,
      user_id: user?.id || null,
      name: form.name,
      company: form.company,
      phone: form.phone,
      email: form.email,
      notes: form.notes,
      interests,
      master_pricing_brands: Object.entries(masterPricingBrands).map(([brand_id, brand_name]) => ({ brand_id, brand_name })),
      user_type: userType,
      created_at: new Date().toISOString(),
    });
    if (user?.id) {
      try {
        await submitInterestToSupport(user.id, { form, interests, userType, masterPricingBrands });
      } catch (_) {}
    }
    setShowSignupPrompt(false);
    setView('thanks');
  };

  const handleRequestAccess = async (data) => {
    await supabase.from('access_requests').insert({
      name: data.name,
      company: data.company,
      email: data.email,
      phone: data.phone,
      account_type: data.account_type,
      store_type: data.store_type,
      address: data.address,
      location_count: data.location_count,
      has_retail: data.has_retail,
      retail_count: data.retail_count,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  };

  if (authState === 'loading') return (
    <div style={{ minHeight: '100vh', background: '#F5F2ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #E0DDD8', borderTopColor: '#C9A84C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (authState === 'gate') return (
    <LoginScreen
      showLogin={false}
      onCodeVerified={async () => { await setPortalCodeVerified(true); setAuthState('browse'); }}
      onLoggedIn={handleLoggedIn}
      onAdminEntry={() => setAuthState('login')}
      onRequestAccess={handleRequestAccess}
    />
  );
  if (authState === 'login') return (
    <LoginScreen
      showLogin={true}
      onCodeVerified={async () => { await setPortalCodeVerified(true); setAuthState('browse'); }}
      onLoggedIn={handleLoggedIn}
      onAdminEntry={() => setAuthState('login')}
      onRequestAccess={handleRequestAccess}
    />
  );
  if (authState === 'admin' && adminMode === 'dashboard') return <AdminDashboard user={user} onLogout={handleLogout} onViewPortal={() => setAdminMode('portal')} />;

  return (
    <div style={{ minHeight: '100vh', background: bgColor || '#F5F2ED', fontFamily: getFontFamily(globalStyles.font_family), color: globalStyles.primary_color || '#1A1A1A', transition: 'background 0.5s ease' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Bebas+Neue&display=swap" rel="stylesheet" />

      {/* Admin bar */}
      {authState === 'admin' && adminMode === 'portal' && (
        <div style={{ background: '#1A1A1A', padding: '8px 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#888' }}>Admin preview mode</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={userType} onChange={e => setUserType(e.target.value)} style={{ background: '#2A2A2A', border: '0.5px solid #3A3A3A', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#FFF', cursor: 'pointer', fontFamily: 'inherit' }}>
              <option value="retailer">View as Retailer</option>
              <option value="distributor">View as Distributor</option>
            </select>
            <button onClick={() => setAdminMode('dashboard')} style={{ background: '#C9A84C', color: '#1A1A1A', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>← Dashboard</button>
          </div>
        </div>
      )}

      {/* Browse banner */}
      {authState === 'browse' && (
        <div style={{ background: '#FDF6E3', borderBottom: '0.5px solid #FCD34D', padding: '10px 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#92400E' }}>Browsing as guest — sign up or log in to submit an inquiry</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setAuthState('login')} style={{ background: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Sign in</button>
            <button onClick={() => setShowSignupPrompt(true)} style={{ background: 'none', border: '0.5px solid #92400E', borderRadius: 6, padding: '6px 14px', fontSize: 12, color: '#92400E', cursor: 'pointer', fontFamily: 'inherit' }}>Request access</button>
          </div>
        </div>
      )}

      <Nav interests={interests} view={view} setView={setView} onLogout={authState === 'browse' ? null : handleLogout} navigation={navigation} globalStyles={globalStyles} onNavClick={handleNavClick} onProfile={user ? () => setShowProfile(true) : null} onChat={user ? () => setChatOpen(true) : null} chatLabel={authState === 'admin' ? 'Messages' : 'Support'} />
      {user && <ChatSidebar user={user} open={chatOpen} onClose={() => setChatOpen(false)} isAdmin={isPortalAdmin} />}
      {showProfile && <ProfileModal user={user} form={form} setForm={setForm} userType={userType} setUserType={setUserType} onClose={() => setShowProfile(false)} />}

      {/* Signup prompt overlay */}
      {showSignupPrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: '#FFF', borderRadius: 20, padding: '2rem', maxWidth: 420, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, letterSpacing: '0.04em', color: '#1A1A1A', marginBottom: 6 }}>Ready to connect?</div>
            <p style={{ fontSize: 14, color: '#888', lineHeight: 1.6, marginBottom: '1.5rem' }}>Submit your interest list here. We will follow up via Support chat or email — direct contact is shared after we confirm your inquiry.</p>
            {[['name','Your name *'],['company','Company / Store *'],['phone','Phone / WhatsApp'],['email','Email']].map(([field, label]) => (
              <div key={field} style={{ marginBottom: '0.875rem' }}>
                <label style={{ fontSize: 11, color: '#AAA', display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>
                <input value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: '100%', background: '#F8F6F3', border: '0.5px solid #E0DDD8', borderRadius: 8, padding: '11px 12px', color: '#1A1A1A', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} autoCapitalize={field === 'email' ? 'none' : 'words'} />
              </div>
            ))}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontSize: 11, color: '#AAA', display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Notes (optional)</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Questions, timeline, or extra info..." style={{ width: '100%', background: '#F8F6F3', border: '0.5px solid #E0DDD8', borderRadius: 8, padding: '10px 12px', color: '#1A1A1A', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', height: 70, resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: '1.25rem' }}>
              <button onClick={() => setShowSignupPrompt(false)} style={{ flex: 1, background: 'none', border: '0.5px solid #E0DDD8', borderRadius: 10, padding: '12px', fontSize: 13, color: '#AAA', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={doSubmit} style={{ flex: 2, background: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Submit inquiry</button>
            </div>
          </div>
        </div>
      )}

      {view === 'home' && <HomeView onBrandClick={goToBrand} isMobile={isMobile} />}
      {view === 'brand' && activeBrand && (
        <BrandView
          brand={getMergedBrands().find(b => b.id === activeBrand)}
          userType={userType}
          onBack={goHome}
          toggleInterest={toggleInterest}
          isInterested={isInterested}
          interests={interests}
          onSubmit={handleSubmitAttempt}
          isMobile={isMobile}
          masterPricingOn={!!masterPricingBrands[activeBrand]}
          onToggleMasterPricing={toggleMasterPricing}
        />
      )}
      {view === 'interest' && (
        <InterestView
          interests={interests}
          masterPricingBrands={masterPricingBrands}
          toggleInterest={toggleInterest}
          form={form}
          setForm={setForm}
          onSubmit={handleSubmitAttempt}
          onBack={() => setView(activeBrand ? 'brand' : 'home')}
          isMobile={isMobile}
        />
      )}
      {view === 'thanks' && (
        <ThanksView
          onBack={goHome}
          onOpenSupport={user ? () => { setChatOpen(true); } : null}
        />
      )}
    </div>
  );
}
