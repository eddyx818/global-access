import React, { useState, useEffect } from 'react';
import { supabase, trackEvent, getSessionId } from './lib/supabase';
import { isPortalCodeVerified, setPortalCodeVerified, linkPortalSessionToUser, getPortalReferral } from './lib/session';
import { getSavedLogin } from './lib/loginPrefs';
import { updateUserPresence, resolveAuthRole, ensurePortalAdminFlag, submitInterestToSupport, isProfileComplete } from './lib/community';
import { useBrandContent } from './lib/content';
import { getFontFamily } from './lib/design';
import LoginScreen from './components/LoginScreen';
import Nav from './components/Nav';
import HomeView from './components/HomeView';
import BrandView from './components/BrandView';
import { InterestView, ThanksView } from './components/InterestView';
import AdminDashboard from './components/AdminDashboard';
import StaffDashboard from './components/StaffDashboard';
import ProfileModal from './components/ProfileModal';
import ChatSidebar from './components/messaging/ChatSidebar';
import MobileBottomNav from './components/MobileBottomNav';
import InstallAppBanner from './components/InstallAppBanner';
import { useUnreadCount } from './hooks/useUnreadCount';
import { useMessageAlerts } from './hooks/useMessageAlerts';
import { usePwaInstall } from './hooks/usePwaInstall';
import { getNotificationPermission } from './lib/notificationPrefs';
import { subscribeToPushNotifications } from './lib/pushNotifications';
import { useTheme } from './context/ThemeContext';

export default function App() {
  const { t, isNight } = useTheme();
  const [authState, setAuthState] = useState('loading');
  const [adminMode, setAdminMode] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState('retailer'); // 'distributor' | 'retailer'
  const [view, setView] = useState('home');
  const [activeBrand, setActiveBrand] = useState(null);
  const [interests, setInterests] = useState([]);
  const [masterPricingQualified, setMasterPricingQualified] = useState(false);
  const [masterPricingInterest, setMasterPricingInterest] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', phone: '', email: '', notes: '' });
  const [isMobile, setIsMobile] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileGate, setProfileGate] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [openSupportOnLoad, setOpenSupportOnLoad] = useState(0);
  const [isPortalAdmin, setIsPortalAdmin] = useState(false);
  const [isSalesRep, setIsSalesRep] = useState(false);
  const [staffProfile, setStaffProfile] = useState(null);
  const { getMergedBrands, bgColor, globalStyles, navigation } = useBrandContent();
  const { unread: chatUnread, refresh: refreshUnread } = useUnreadCount(user?.id, {
    isAdmin: isPortalAdmin,
    isSalesRep,
    enabled: !!user?.id,
  });
  const { canInstall, showIosHint, isInstalled, install } = usePwaInstall();

  const inPortalView = authState === 'portal' || authState === 'browse' || (authState === 'admin' && adminMode === 'portal');
  const isMobileDevice = isMobile || /Android|iPhone|iPad|iPod|Mobile/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');
  // Phone/PWA layout: use UA detection, not only viewport width (landscape can exceed 768px)
  const mobileShell = isMobileDevice && inPortalView;
  const showInstallPrompt = isMobileDevice && !isInstalled;
  const showInstallBanner = showInstallPrompt && inPortalView;
  const showMobileNav = mobileShell && !!user;
  const chatLabel = isPortalAdmin ? 'Messages' : 'Support';

  const openChat = () => {
    if (user && !isPortalAdmin && !isProfileComplete(form)) {
      setProfileGate('chat');
      if (mobileShell) setView('profile');
      else setShowProfile(true);
      return;
    }
    setShowProfile(false);
    setProfileGate(null);
    if (mobileShell) setView('chat');
    else setChatOpen(true);
  };

  const closeChat = () => {
    setChatOpen(false);
    if (view === 'chat') setView(activeBrand ? 'brand' : 'home');
  };

  const closeProfile = () => {
    setProfileGate(null);
    setShowProfile(false);
    if (view === 'profile') setView('home');
  };

  const openProfile = () => {
    if (mobileShell) setView('profile');
    else setShowProfile(true);
  };

  const handleProfileSaved = ({ profileComplete } = {}) => {
    if (profileGate === 'chat' && profileComplete) {
      setProfileGate(null);
      setShowProfile(false);
      setOpenSupportOnLoad(n => n + 1);
      if (mobileShell) setView('chat');
      else setChatOpen(true);
    }
  };

  const navigateHome = () => {
    setShowProfile(false);
    setProfileGate(null);
    goHome();
  };

  const navigateList = () => {
    setShowProfile(false);
    setProfileGate(null);
    if (isProfileComplete(form)) {
      setForm(f => ({ ...f, notes: '' }));
    }
    setView('interest');
  };

  const navigateProfile = () => {
    setProfileGate(null);
    openProfile();
  };

  const chatActive = (mobileShell && view === 'chat') || chatOpen;

  useMessageAlerts({
    userId: user?.id,
    isAdmin: isPortalAdmin,
    isSalesRep,
    enabled: !!user?.id && inPortalView,
    unread: chatUnread,
    onOpenChat: openChat,
  });

  const mobileContentPad = showMobileNav
    ? { paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }
    : {};

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Recover orphaned views (desktop width with mobile routes, brand without id, etc.)
  useEffect(() => {
    if (!user || !inPortalView) return;

    if (view === 'chat') {
      if (!mobileShell) {
        setChatOpen(true);
        setView(activeBrand ? 'brand' : 'home');
      }
      return;
    }

    if (view === 'profile') {
      if (!mobileShell) {
        setShowProfile(true);
        setView(activeBrand ? 'brand' : 'home');
      }
      return;
    }

    if (view === 'brand' && !activeBrand) {
      setView('home');
    }
  }, [view, mobileShell, user, inPortalView, activeBrand]);

  const mobilePageShellStyle = {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    // Explicit height for mobile browsers that don't flex-fill reliably
    height: mobileShell ? 'calc(100dvh - 48px - 56px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))' : undefined,
  };

  const requireProfileForChat = () => {
    setProfileGate('chat');
    if (mobileShell) setView('profile');
    else setShowProfile(true);
  };

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event) => {
      if (event.data?.type === 'OPEN_CHAT') openChat();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user?.id || !inPortalView || !isMobileDevice) return;
    if (getNotificationPermission() !== 'granted') return;
    subscribeToPushNotifications(user.id);
  }, [user?.id, inPortalView, isMobileDevice]);

  // Handle direct hash URL links (e.g. global-access.vercel.app/#goldwhip)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && hash.length > 0) {
      setActiveBrand(hash);
      setView('brand');
    }
  }, []);

  const applySessionUser = async (sessionUser) => {
    const { isAdmin, isSalesRep: salesRep, authState: nextAuth } = await resolveAuthRole(sessionUser);
    setUser(sessionUser);
    setIsPortalAdmin(isAdmin);
    setIsSalesRep(salesRep);
    setAuthState(nextAuth);
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
        .select('user_type, name, company, phone, username, bio, profile_avatar_url, master_pricing_qualified, master_pricing_interest, rep_code, is_sales_rep')
        .eq('user_id', sessionUser.id)
        .maybeSingle();
      if (profile?.user_type) setUserType(profile.user_type);
      if (salesRep) setStaffProfile(profile);
      else setStaffProfile(null);
      if (profile && !salesRep && !isAdmin) {
        setForm(f => ({
          ...f,
          name: profile.name || f.name,
          company: profile.company || f.company,
          phone: profile.phone || f.phone,
          email: sessionUser.email || f.email,
        }));
      }
      setMasterPricingQualified(!!profile?.master_pricing_qualified);
      setMasterPricingInterest(!!profile?.master_pricing_interest);
    } catch (_) {}
    await linkPortalSessionToUser(sessionUser.id);
    await updateUserPresence(sessionUser.id, 'online');
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await applySessionUser(session.user);
        return;
      }

      const saved = getSavedLogin();
      if (saved) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: saved.email,
          password: saved.password,
        });
        if (!error && data?.user) {
          await applySessionUser(data.user);
          return;
        }
      }

      const verified = await isPortalCodeVerified();
      const wantsAdmin = new URLSearchParams(window.location.search).get('admin') === '1'
        || window.location.hash === '#admin';
      setAuthState(wantsAdmin ? 'login' : (verified ? 'browse' : 'gate'));
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (session?.user) {
        await applySessionUser(session.user);
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
    setInterests(prev => (
      prev.find(i => i.key === key)
        ? prev.filter(i => i.key !== key)
        : [...prev, { key, sku, productName, brandName, brandId: bid, flavor, qty, orderMode }]
    ));
  };

  const setMasterPricingInterestFlag = async (value) => {
    if (!user?.id) return;
    setMasterPricingInterest(value);
    await supabase.from('user_profiles').update({
      master_pricing_interest: value,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);
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
    setUser(null);
    setIsPortalAdmin(false);
    setIsSalesRep(false);
    setStaffProfile(null);
    const verified = await isPortalCodeVerified();
    setAuthState(verified ? 'login' : 'gate');
    setInterests([]);
    setMasterPricingQualified(false);
    setMasterPricingInterest(false);
    setAdminMode('dashboard');
    setView('home');
    setActiveBrand(null);
    setChatOpen(false);
    setShowProfile(false);
    setProfileGate(null);
  };

  const handleLoggedIn = async (sessionUser) => {
    await applySessionUser(sessionUser);
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
      master_pricing_interest: masterPricingInterest,
      user_type: userType,
      created_at: new Date().toISOString(),
    });
    if (user?.id) {
      try {
        await submitInterestToSupport(user.id, { form, interests, userType, masterPricingInterest });
      } catch (_) {}
    }
    setShowSignupPrompt(false);
    setView('thanks');
  };

  const handleRequestAccess = async (data) => {
    const referral = await getPortalReferral();
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
      referred_by_user_id: referral?.referral_rep_id || null,
      referral_code_used: referral?.referral_code || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  };

  if (authState === 'loading') return (
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: `2px solid ${t.border}`, borderTopColor: t.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (authState === 'gate') return (
    <>
      {showInstallPrompt && (
        <InstallAppBanner canInstall={canInstall} showIosHint={showIosHint} onInstall={install} />
      )}
      <LoginScreen
        showLogin={false}
        onCodeVerified={async () => { await setPortalCodeVerified(true); setAuthState('browse'); }}
        onLoggedIn={handleLoggedIn}
        onAdminEntry={() => setAuthState('login')}
        onRequestAccess={handleRequestAccess}
      />
    </>
  );
  if (authState === 'login') return (
    <>
      {showInstallPrompt && (
        <InstallAppBanner canInstall={canInstall} showIosHint={showIosHint} onInstall={install} />
      )}
      <LoginScreen
        showLogin={true}
        onCodeVerified={async () => { await setPortalCodeVerified(true); setAuthState('browse'); }}
        onLoggedIn={handleLoggedIn}
        onAdminEntry={() => setAuthState('login')}
        onRequestAccess={handleRequestAccess}
      />
    </>
  );
  if (authState === 'sales_rep') {
    return <StaffDashboard user={user} profile={staffProfile} onLogout={handleLogout} />;
  }
  if (authState === 'admin' && adminMode === 'dashboard') return <AdminDashboard user={user} onLogout={handleLogout} onViewPortal={() => setAdminMode('portal')} />;

  return (
    <div className="app-viewport" style={{ background: isNight ? t.bg : (bgColor || t.bg), fontFamily: getFontFamily(globalStyles.font_family), color: isNight ? t.text : (globalStyles.primary_color || t.text), transition: 'background 0.35s ease, color 0.35s ease', display: mobileShell ? 'flex' : undefined, flexDirection: mobileShell ? 'column' : undefined, minHeight: '100dvh' }}>
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

      {/* Install app banner */}
      {showInstallBanner && (
        <InstallAppBanner
          canInstall={canInstall}
          showIosHint={showIosHint}
          onInstall={install}
        />
      )}

      {/* Browse banner */}
      {authState === 'browse' && (
        <div style={{ background: t.browseBannerBg, borderBottom: `0.5px solid ${t.browseBannerBorder}`, padding: '10px 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, color: t.browseBannerText }}>Browsing as guest — sign up or log in to submit an inquiry</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setAuthState('login')} style={{ background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Sign in</button>
            <button onClick={() => setShowSignupPrompt(true)} style={{ background: 'none', border: `0.5px solid ${t.browseBannerText}`, borderRadius: 6, padding: '6px 14px', fontSize: 12, color: t.browseBannerText, cursor: 'pointer', fontFamily: 'inherit' }}>Request access</button>
          </div>
        </div>
      )}

      <Nav
        interests={interests}
        view={view}
        setView={setView}
        onLogout={authState === 'browse' ? null : handleLogout}
        navigation={navigation}
        globalStyles={globalStyles}
        onNavClick={handleNavClick}
        onHome={navigateHome}
        onProfile={user && !showMobileNav ? openProfile : null}
        onChat={user && !showMobileNav ? openChat : null}
        chatLabel={chatLabel}
        isMobile={isMobile || isMobileDevice}
        hideMobileActions={showMobileNav}
        unread={chatUnread}
      />
      {user && !mobileShell && (
        <ChatSidebar
          user={user}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          isAdmin={isPortalAdmin}
          onUnreadChange={refreshUnread}
          profileComplete={isProfileComplete(form)}
          onRequireProfile={requireProfileForChat}
          openSupportOnLoad={openSupportOnLoad}
        />
      )}
      {showProfile && !mobileShell && (
        <ProfileModal
          user={user}
          form={form}
          setForm={setForm}
          userType={userType}
          setUserType={setUserType}
          onClose={closeProfile}
          profileGate={profileGate}
          onSaved={handleProfileSaved}
          pwa={{ canInstall, showIosHint, isInstalled, install, isMobileDevice }}
        />
      )}

      <div className="app-main-content" style={{ ...mobileContentPad, flex: mobileShell ? 1 : undefined, display: mobileShell ? 'flex' : undefined, flexDirection: mobileShell ? 'column' : undefined, minHeight: mobileShell ? 0 : undefined }}>

      {/* Signup prompt overlay */}
      {showSignupPrompt && (
        <div style={{ position: 'fixed', inset: 0, background: t.overlay, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: t.bgElevated, borderRadius: 20, padding: '2rem', maxWidth: 420, width: '100%', boxShadow: `0 24px 64px ${t.shadow}` }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, letterSpacing: '0.04em', color: t.text, marginBottom: 6 }}>Ready to connect?</div>
            <p style={{ fontSize: 14, color: t.textMuted, lineHeight: 1.6, marginBottom: '1.5rem' }}>Submit your interest list here. We will follow up via Support chat or email — direct contact is shared after we confirm your inquiry.</p>
            {[['name','Your name *'],['company','Company / Store *'],['phone','Phone / WhatsApp'],['email','Email']].map(([field, label]) => (
              <div key={field} style={{ marginBottom: '0.875rem' }}>
                <label style={{ fontSize: 11, color: t.textFaint, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>
                <input value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: '100%', background: t.inputBg, border: t.borderHairline, borderRadius: 8, padding: '11px 12px', color: t.text, fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} autoCapitalize={field === 'email' ? 'none' : 'words'} />
              </div>
            ))}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontSize: 11, color: t.textFaint, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Notes (optional)</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Questions, timeline, or extra info..." style={{ width: '100%', background: t.inputBg, border: t.borderHairline, borderRadius: 8, padding: '10px 12px', color: t.text, fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', height: 70, resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: '1.25rem' }}>
              <button onClick={() => setShowSignupPrompt(false)} style={{ flex: 1, background: 'none', border: t.borderHairline, borderRadius: 10, padding: '12px', fontSize: 13, color: t.textFaint, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={doSubmit} style={{ flex: 2, background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Submit inquiry</button>
            </div>
          </div>
        </div>
      )}

      {view === 'home' && (
        <HomeView
          onBrandClick={goToBrand}
          isMobile={isMobile}
          userType={userType}
          masterPricingQualified={masterPricingQualified}
          masterPricingInterest={masterPricingInterest}
          onSetMasterPricingInterest={user?.id && userType === 'distributor' ? setMasterPricingInterestFlag : null}
        />
      )}
      {view === 'chat' && mobileShell && user && (
        <div style={mobilePageShellStyle}>
          <ChatSidebar
            user={user}
            open
            variant="page"
            onClose={closeChat}
            isAdmin={isPortalAdmin}
            onUnreadChange={refreshUnread}
            profileComplete={isProfileComplete(form)}
            onRequireProfile={requireProfileForChat}
            openSupportOnLoad={openSupportOnLoad}
          />
        </div>
      )}
      {view === 'profile' && mobileShell && user && (
        <div style={mobilePageShellStyle}>
          <ProfileModal
            user={user}
            form={form}
            setForm={setForm}
            userType={userType}
            setUserType={setUserType}
            variant="page"
            onClose={closeProfile}
            profileGate={profileGate}
            onSaved={handleProfileSaved}
            pwa={{ canInstall, showIosHint, isInstalled, install, isMobileDevice }}
          />
        </div>
      )}
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
          masterPricingQualified={masterPricingQualified}
          pricingVisible={authState !== 'browse'}
          onSignIn={authState === 'browse' ? () => setAuthState('login') : null}
          onRequestAccess={authState === 'browse' ? () => setShowSignupPrompt(true) : null}
        />
      )}
      {view === 'interest' && (
        <InterestView
          interests={interests}
          toggleInterest={toggleInterest}
          form={form}
          setForm={setForm}
          onSubmit={handleSubmitAttempt}
          onBack={() => setView(activeBrand ? 'brand' : 'home')}
          isMobile={isMobile}
          profileSaved={isProfileComplete(form)}
        />
      )}
      {view === 'thanks' && (
        <ThanksView
          onBack={goHome}
          onOpenSupport={user ? openChat : null}
        />
      )}
      </div>

      {showMobileNav && (
        <MobileBottomNav
          activeView={view}
          onHome={navigateHome}
          onList={navigateList}
          onChat={openChat}
          onProfile={navigateProfile}
          listCount={interests.length}
          unread={chatUnread}
          chatLabel={chatLabel}
          showList
        />
      )}
    </div>
  );
}
