import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase, trackEvent, getSessionId } from './lib/supabase';
import { isPortalCodeVerified, setPortalCodeVerified, linkPortalSessionToUser, getPortalReferral } from './lib/session';
import { getRememberLogin, getSavedLogin } from './lib/loginPrefs';
import { updateUserPresence, ensurePortalAdminFlag, isProfileComplete, isLegacyAdminEmail } from './lib/community';
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
import MobileBottomNav from './components/MobileBottomNav';
import InstallAppBanner from './components/InstallAppBanner';
import { usePwaInstall } from './hooks/usePwaInstall';
import useVisualViewportInset from './hooks/useVisualViewportInset';
import useMobileTabSwipe from './hooks/useMobileTabSwipe';
import { getNotificationPermission } from './lib/notificationPrefs';
import { subscribeToPushNotifications } from './lib/pushNotifications';
import { canAccessPortal } from './lib/authGate';
import { isHoneypotClean, isValidPhone, getPhoneValidationError } from './lib/accessRequestGate';
import { validatePersonName, validateCompanyName } from './lib/nameValidation';
import { hasCallablePhone, normalizePhoneE164 } from './lib/whatsapp';
import { getSupportWhatsAppLink, hasSupportWhatsApp } from './lib/supportContact';
import { shouldShowCatalogPrices, PHONE_PLACEHOLDER } from './lib/catalogPricing';
import { COPY } from './lib/portalCopy';
import { useTheme } from './context/ThemeContext';
import {
  clearAppNavigation,
  loadAppNavigation,
  readSavedPortalNav,
  saveAppNavigation,
} from './lib/appNavigation';
import StaffQuotesView from './components/StaffQuotesView';
import CustomerQuotesView from './components/CustomerQuotesView';
import StaffPriceCheckView from './components/StaffPriceCheckView';
import { fetchRecentInquiries } from './lib/inquiries';
import { fetchRecentPriceChecks, countNewPriceChecks } from './lib/priceChecks';
import { isSessionResumable, clearAppSession } from './lib/appSession';

const AUTH_INIT_TIMEOUT_MS = 10000;
const PROFILE_FETCH_TIMEOUT_MS = 8000;
const GUEST_AUTH_TIMEOUT_MS = 8000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('auth_timeout')), ms);
    }),
  ]);
}

function resolveAuthFromProfile(sessionUser, profile) {
  const isAdmin = isLegacyAdminEmail(sessionUser.email)
    || !!(profile?.is_portal_admin || profile?.role === 'admin');
  const isSalesRep = !isAdmin && !!(profile?.is_sales_rep || profile?.role === 'sales_rep');
  let authState = 'portal';
  if (isAdmin) authState = 'admin';
  else if (isSalesRep) authState = 'sales_rep';
  return { isAdmin, isSalesRep, authState };
}

export default function App() {
  const { t, isNight } = useTheme();
  const canResumeNavRef = useRef(isSessionResumable());
  const sessionApplyPromises = useRef(new Map());
  const authInitHandledRef = useRef(false);
  const homeScrollRef = useRef(0);
  const brandScrollRef = useRef({});
  const mainContentRef = useRef(null);
  const [authState, setAuthState] = useState('loading');
  const [adminMode, setAdminMode] = useState('dashboard');
  const [repMode, setRepMode] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState('retailer'); // 'distributor' | 'retailer'
  const [view, setView] = useState('home');
  const [activeBrand, setActiveBrand] = useState(null);
  const [interests, setInterests] = useState([]);
  const [masterPricingQualified, setMasterPricingQualified] = useState(false);
  const [masterPricingInterest, setMasterPricingInterest] = useState(false);
  const [form, setForm] = useState({
    name: '', company: '', phone: '', email: '', notes: '',
    contactRequested: true, readyToOrder: false, pricingQuestions: false,
  });
  const [lastSubmittedReadyToOrder, setLastSubmittedReadyToOrder] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [loginInitialMode, setLoginInitialMode] = useState(null);
  const [signupPromptError, setSignupPromptError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [profileGate, setProfileGate] = useState(null);
  const [isPortalAdmin, setIsPortalAdmin] = useState(false);
  const [isSalesRep, setIsSalesRep] = useState(false);
  const [staffProfile, setStaffProfile] = useState(null);
  const { getMergedBrands, loadContent, bgColor, globalStyles, navigation } = useBrandContent();
  useEffect(() => {
    if (authState === 'admin' && adminMode === 'portal') {
      loadContent();
    }
    if (authState === 'sales_rep' && repMode === 'portal') {
      loadContent();
    }
  }, [authState, adminMode, repMode, loadContent]);

  const { canInstall, showIosHint, isInstalled, install } = usePwaInstall();
  const [quotesNewCount, setQuotesNewCount] = useState(0);
  const [priceCheckNewCount, setPriceCheckNewCount] = useState(0);
  const isStaffPortalUser = isPortalAdmin || isSalesRep;
  const isAdminPortalPreview = authState === 'admin' && adminMode === 'portal';
  const isRepCatalog = authState === 'sales_rep' && repMode === 'portal';
  const isStaffCatalogPortal = isAdminPortalPreview || isRepCatalog;
  const isStaffPriceCheck = isStaffCatalogPortal;
  const showCustomerShopping = !isStaffPortalUser || isStaffCatalogPortal;
  const showCustomerList = showCustomerShopping && !isStaffCatalogPortal;
  const showStaffTools = isStaffPortalUser && !isStaffCatalogPortal;

  /** Legacy saved `inbox` / `chat` routes — map to quotes or my_quotes. */
  const resolvedView = view === 'inbox'
    ? (isStaffPortalUser ? 'quotes' : 'my_quotes')
    : view === 'chat'
      ? (isStaffPortalUser ? 'quotes' : 'my_quotes')
      : view;

  const inPortalView = authState === 'portal' || authState === 'browse'
    || (authState === 'admin' && adminMode === 'portal')
    || (authState === 'sales_rep' && repMode === 'portal');
  const isMobileDevice = isMobile || /Android|iPhone|iPad|iPod|Mobile/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');
  // Phone/PWA layout: use UA detection, not only viewport width (landscape can exceed 768px)
  const mobileShell = isMobileDevice && inPortalView;
  const showInstallPrompt = isMobileDevice && !isInstalled;
  const showInstallBanner = showInstallPrompt && inPortalView;
  const showMobileNav = mobileShell && !!user;
  const keyboardInset = useVisualViewportInset(mobileShell);
  const keyboardOpen = keyboardInset > 40;
  const showMobileBottomNav = showMobileNav && !keyboardOpen;
  const portalTopChrome = showInstallBanner || authState === 'browse';
  const isPortalCustomer = authState === 'portal' && !!user && !isStaffPortalUser;
  const showCatalogPrices = shouldShowCatalogPrices();

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
    if (profileGate && profileComplete) {
      const gate = profileGate;
      setProfileGate(null);
      setShowProfile(false);
      if (gate === 'quote') {
        doSubmit();
      }
    }
  };

  const saveBrandScroll = () => {
    const scrollEl = mainContentRef.current;
    if (scrollEl && activeBrand) {
      brandScrollRef.current[activeBrand] = scrollEl.scrollTop;
    }
  };

  const restoreScroll = (top) => {
    requestAnimationFrame(() => {
      const scrollEl = mainContentRef.current;
      if (scrollEl) scrollEl.scrollTo({ top, behavior: 'auto' });
    });
  };

  const navigateHome = () => {
    setShowProfile(false);
    setProfileGate(null);
    const scrollEl = mainContentRef.current;
    if (view === 'brand' && activeBrand && scrollEl) {
      brandScrollRef.current[activeBrand] = scrollEl.scrollTop;
    }
    const wasAlreadyHome = view === 'home';
    setActiveBrand(null);
    setView('home');
    window.history.replaceState({ view: 'home' }, '', window.location.pathname);
    requestAnimationFrame(() => {
      const el = mainContentRef.current;
      if (!el) return;
      if (wasAlreadyHome) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        el.scrollTo({ top: homeScrollRef.current, behavior: 'auto' });
      }
    });
  };

  const navigateList = () => {
    setShowProfile(false);
    setProfileGate(null);
    if (view === 'brand') saveBrandScroll();
    if (isProfileComplete(form)) {
      setForm(f => ({
        ...f,
        notes: '',
        readyToOrder: false,
        pricingQuestions: false,
      }));
    }
    setView('interest');
  };

  const openAdminDashboard = () => {
    setShowProfile(false);
    setProfileGate(null);
    setAdminMode('dashboard');
    setView('home');
    setActiveBrand(null);
  };

  const openRepDashboard = () => {
    setShowProfile(false);
    setProfileGate(null);
    setRepMode('dashboard');
    setView('home');
    setActiveBrand(null);
  };

  const navigateQuotes = () => {
    setShowProfile(false);
    setProfileGate(null);
    setView('quotes');
  };

  const navigatePriceChecks = () => {
    setShowProfile(false);
    setProfileGate(null);
    setView('price_checks');
  };

  const navigateMyQuotes = () => {
    setShowProfile(false);
    setProfileGate(null);
    setView('my_quotes');
  };

  const navigateProfile = () => {
    setProfileGate(null);
    openProfile();
  };

  const mobileTabActiveId = resolvedView === 'brand' ? 'home' : resolvedView;
  const mobileBottomTabs = useMemo(() => [
    { id: 'home', onSelect: navigateHome },
    showCustomerList && { id: 'interest', onSelect: navigateList },
    isStaffPortalUser && { id: 'quotes', onSelect: navigateQuotes },
    isStaffCatalogPortal && { id: 'price_checks', onSelect: navigatePriceChecks },
    isPortalCustomer && { id: 'my_quotes', onSelect: navigateMyQuotes },
    isPortalCustomer && { id: 'profile', onSelect: navigateProfile },
  ].filter(Boolean), [
    showCustomerList, isStaffPortalUser, isStaffCatalogPortal, isPortalCustomer,
    navigateHome, navigateList, navigateQuotes, navigatePriceChecks, navigateMyQuotes, navigateProfile,
  ]);

  const goAdjacentMobileTab = useCallback((direction) => {
    const idx = mobileBottomTabs.findIndex(t => t.id === mobileTabActiveId);
    if (idx < 0) return;
    const next = idx + direction;
    if (next >= 0 && next < mobileBottomTabs.length) {
      mobileBottomTabs[next].onSelect();
    }
  }, [mobileBottomTabs, mobileTabActiveId]);

  useMobileTabSwipe({
    enabled: showMobileBottomNav && resolvedView !== 'thanks' && mobileBottomTabs.length > 1,
    tabs: mobileBottomTabs,
    activeTabId: mobileTabActiveId,
    containerRef: mainContentRef,
  });

  const mobileContentPad = showMobileBottomNav
    ? { paddingBottom: 'var(--ga-bottom-nav-height)' }
    : {};

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!isStaffPortalUser || !inPortalView) return;
    Promise.all([fetchRecentInquiries(50), fetchRecentPriceChecks(50)]).then(([quotes, priceChecksResult]) => {
      setQuotesNewCount(quotes.filter(i => (i.quote_status || 'new') === 'new').length);
      const priceChecks = priceChecksResult?.rows ?? [];
      setPriceCheckNewCount(countNewPriceChecks(priceChecks));
    });
  }, [isStaffPortalUser, inPortalView]);

  // Recover orphaned views (desktop width with mobile routes, brand without id, etc.)
  useEffect(() => {
    if (!user || !inPortalView) return;

    if (view === 'chat') {
      setView(isStaffPortalUser ? 'quotes' : (user ? 'my_quotes' : 'home'));
      return;
    }

    if (view === 'profile' && isStaffPortalUser && mobileShell) {
      setView('home');
      return;
    }

    if (view === 'profile' && !mobileShell) {
      setShowProfile(true);
      setView(activeBrand ? 'brand' : 'home');
      return;
    }

    if (view === 'quotes' && !isStaffPortalUser) {
      setView('home');
    }

    if (view === 'quotes' && isStaffPortalUser && !isStaffCatalogPortal) {
      setView('home');
    }

    if (view === 'my_quotes' && (!user || isStaffPortalUser)) {
      setView('home');
    }

    if (view === 'price_checks' && !isStaffCatalogPortal) {
      setView('home');
    }

    if (view === 'thanks' && isStaffPortalUser) {
      setView(isStaffPriceCheck ? 'price_checks' : 'home');
    }

    if (view === 'inbox') {
      setView(isStaffPortalUser ? 'quotes' : 'my_quotes');
    }

    if (view === 'interest' && !showCustomerList) {
      setView('home');
    }

    if (view === 'brand' && !activeBrand) {
      setView('home');
    }
  }, [view, mobileShell, user, inPortalView, activeBrand, showCustomerList, isStaffPortalUser, isStaffCatalogPortal, isStaffPriceCheck]);

  const mobileNavHeight = portalTopChrome
    ? 'var(--ga-nav-bar)'
    : 'var(--ga-nav-height)';
  const mobileBottomOffset = showMobileBottomNav ? ' - var(--ga-bottom-nav-height)' : '';
  const mobilePageShellStyle = {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    height: mobileShell
      ? `calc(100dvh - ${mobileNavHeight}${mobileBottomOffset})`
      : undefined,
  };

  useEffect(() => {
    if (!user?.id || !inPortalView || !isMobileDevice) return;
    if (getNotificationPermission() !== 'granted') return;
    subscribeToPushNotifications(user.id);
  }, [user?.id, inPortalView, isMobileDevice]);

  // Handle direct hash URL links (e.g. global-access.vercel.app/#goldwhip)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (!hash || hash === 'admin') return;
    if (canResumeNavRef.current) {
      const saved = loadAppNavigation();
      if (saved?.view === 'brand' && saved?.activeBrand) return;
    }
    setActiveBrand(hash);
    setView('brand');
  }, []);

  // Persist navigation while app stays open (background OK — cleared on full close)
  useEffect(() => {
    if (!canResumeNavRef.current) return;
    if (!user?.id || authState === 'loading' || authState === 'gate' || authState === 'login') return;
    saveAppNavigation({
      userId: user.id,
      authState,
      adminMode,
      repMode,
      view,
      activeBrand,
    });
  }, [user?.id, authState, adminMode, repMode, view, activeBrand]);

  useEffect(() => {
    const onPageShow = () => {
      if (!canResumeNavRef.current || !user?.id) return;
      const saved = readSavedPortalNav(user.id);
      if (!saved) return;
      if (isPortalAdmin) setAdminMode(saved.adminMode);
      if (isSalesRep) setRepMode(saved.repMode || 'dashboard');
      const inPortal = authState === 'portal' || authState === 'browse'
        || (isPortalAdmin && saved.adminMode === 'portal')
        || (isSalesRep && saved.repMode === 'portal');
      if (inPortal && saved.view) {
        setView(saved.view);
        if (saved.view === 'brand' && saved.activeBrand) {
          setActiveBrand(saved.activeBrand);
        } else {
          setActiveBrand(null);
        }
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [user?.id, authState, isPortalAdmin, isSalesRep]);

  const resetEntryNavigation = () => {
    setView('home');
    setActiveBrand(null);
    setAdminMode('dashboard');
    setRepMode('dashboard');
    setShowProfile(false);
    setProfileGate(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState({ view: 'home' }, '', window.location.pathname);
    }
  };

  const applySessionUser = async (sessionUser, { restoreNav = canResumeNavRef.current } = {}) => {
    const userId = sessionUser.id;
    const pending = sessionApplyPromises.current.get(userId);
    if (pending) return pending;

    const promise = (async () => {
      try {
        let profile = null;
        try {
          const { data } = await withTimeout(
            supabase.from('user_profiles')
              .select('admin_authorized, admin_authorized_at, is_portal_admin, is_sales_rep, role, user_type, name, company, phone, username, bio, profile_avatar_url, master_pricing_qualified, master_pricing_interest, rep_code')
              .eq('user_id', sessionUser.id)
              .maybeSingle(),
            PROFILE_FETCH_TIMEOUT_MS,
          );
          profile = data;
        } catch (_) {}

        if (!canAccessPortal(sessionUser, profile)) {
          await supabase.auth.signOut();
          setAuthState('login');
          return;
        }

        const legacyAdmin = isLegacyAdminEmail(sessionUser.email);
        const { isAdmin, isSalesRep: salesRep, authState: nextAuth } = resolveAuthFromProfile(sessionUser, profile);
        const resolvedAuthState = legacyAdmin && nextAuth === 'portal' ? 'admin' : nextAuth;
        const savedNav = restoreNav ? readSavedPortalNav(sessionUser.id) : null;

        setUser(sessionUser);
        setIsPortalAdmin(isAdmin || legacyAdmin);
        setIsSalesRep(salesRep);
        setAuthState(resolvedAuthState);
        authInitHandledRef.current = true;

        if (isAdmin || legacyAdmin) {
          setAdminMode(savedNav?.adminMode || 'dashboard');
          setForm(f => ({
            ...f,
            name: f.name || 'Global Access',
            company: f.company || 'Global Access',
            email: sessionUser.email,
          }));
        }

        if (salesRep) {
          setRepMode(savedNav?.repMode === 'portal' ? 'portal' : 'dashboard');
        } else {
          setRepMode('dashboard');
        }

        const inPortalShell = resolvedAuthState === 'portal' || resolvedAuthState === 'browse'
          || ((isAdmin || legacyAdmin) && (savedNav?.adminMode === 'portal'))
          || (salesRep && (savedNav?.repMode === 'portal'));

        if (savedNav && inPortalShell) {
          const nextView = savedNav.view;
          setView(nextView);
          if (nextView === 'brand' && savedNav.activeBrand) {
            setActiveBrand(savedNav.activeBrand);
            window.history.replaceState(
              { view: 'brand', brandId: savedNav.activeBrand },
              '',
              `#${savedNav.activeBrand}`,
            );
          } else {
            setActiveBrand(null);
          }
        } else if (!restoreNav) {
          resetEntryNavigation();
        }

        if (profile?.user_type) setUserType(profile.user_type);
        if (salesRep) setStaffProfile(profile);
        else setStaffProfile(null);
        if (profile && !salesRep && !isAdmin && !legacyAdmin) {
          setForm(f => ({
            ...f,
            name: profile.name || f.name,
            company: profile.company || f.company,
            phone: profile.phone || f.phone,
            email: sessionUser.email || f.email,
          }));
        } else if (profile && salesRep) {
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

        if (isLegacyAdminEmail(sessionUser.email)) {
          ensurePortalAdminFlag(sessionUser.id, sessionUser.email).catch(() => {});
        }
        linkPortalSessionToUser(sessionUser.id).catch(() => {});
        updateUserPresence(sessionUser.id, 'online').catch(() => {});
      } finally {
        sessionApplyPromises.current.delete(userId);
      }
    })();

    sessionApplyPromises.current.set(userId, promise);
    return promise;
  };

  useEffect(() => {
    let cancelled = false;

    const resolveGuestAuthState = async () => {
      const verified = await isPortalCodeVerified();
      const wantsAdmin = new URLSearchParams(window.location.search).get('admin') === '1'
        || window.location.hash === '#admin';
      return wantsAdmin ? 'login' : (verified ? 'browse' : 'gate');
    };

    const finishGuestAuth = async () => {
      if (cancelled || authInitHandledRef.current) return;
      try {
        const guestState = await withTimeout(resolveGuestAuthState(), GUEST_AUTH_TIMEOUT_MS);
        if (!cancelled && !authInitHandledRef.current) {
          setAuthState(guestState);
        }
      } catch (_) {
        if (!cancelled && !authInitHandledRef.current) setAuthState('gate');
      }
    };

    const finishIfStillLoading = () => {
      finishGuestAuth();
    };

    const timeoutId = setTimeout(() => {
      finishIfStillLoading();
    }, AUTH_INIT_TIMEOUT_MS);

    const init = async () => {
      try {
        const resumeNav = canResumeNavRef.current;
        const rememberLogin = getRememberLogin();

        if (!resumeNav) {
          clearAppNavigation();
          resetEntryNavigation();
        }

        if (!resumeNav && !rememberLogin) {
          try {
            await withTimeout(supabase.auth.signOut(), 5000);
          } catch (_) {}
          setUser(null);
          setIsPortalAdmin(false);
          setIsSalesRep(false);
          setStaffProfile(null);
          await finishGuestAuth();
          return;
        }

        let session = null;
        try {
          const { data: { session: activeSession } } = await withTimeout(
            supabase.auth.getSession(),
            AUTH_INIT_TIMEOUT_MS,
          );
          session = activeSession;
        } catch (_) {}

        if (!session?.user && rememberLogin) {
          const saved = getSavedLogin();
          if (saved) {
            try {
              const { data, error } = await withTimeout(
                supabase.auth.signInWithPassword({
                  email: saved.email,
                  password: saved.password,
                }),
                AUTH_INIT_TIMEOUT_MS,
              );
              if (!error && data?.user) {
                session = { user: data.user };
              }
            } catch (_) {}
          }
        }

        if (session?.user) {
          await withTimeout(
            applySessionUser(session.user, { restoreNav: resumeNav }),
            AUTH_INIT_TIMEOUT_MS,
          );
          return;
        }

        await finishGuestAuth();
      } catch (_) {
        await finishGuestAuth();
      } finally {
        clearTimeout(timeoutId);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED') return;
      if (event === 'INITIAL_SESSION') {
        if (session?.user && !authInitHandledRef.current) {
          try {
            await withTimeout(
              applySessionUser(session.user, { restoreNav: canResumeNavRef.current }),
              AUTH_INIT_TIMEOUT_MS,
            );
          } catch (_) {
            await finishGuestAuth();
          }
        }
        return;
      }
      if (session?.user) {
        await applySessionUser(session.user, { restoreNav: canResumeNavRef.current });
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
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
    const canTrack = authState === 'portal' || authState === 'browse'
      || (authState === 'admin' && adminMode === 'portal')
      || (authState === 'sales_rep' && repMode === 'portal');
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
  }, [view, activeBrand, authState, adminMode, repMode]);

  useEffect(() => {
    if (showStaffTools) setInterests([]);
  }, [showStaffTools]);

  const toggleInterest = (sku, productName, brandName, flavor, qty = 1, orderMode = 'master_case', brandId = null, orderUnitLabel = null) => {
    if (!showCustomerShopping) return;
    const key = `${sku}__${flavor}`;
    const bid = brandId || activeBrand;
    trackEvent('click', bid ? `brand:${bid}` : view, { element: `interest:${sku}:${flavor}`, user_id: user?.id });
    setInterests(prev => (
      prev.find(i => i.key === key)
        ? prev.filter(i => i.key !== key)
        : [...prev, { key, sku, productName, brandName, brandId: bid, flavor, qty, orderMode, orderUnitLabel }]
    ));
  };

  const updateInterestLine = (key, { qty, orderMode, orderUnitLabel } = {}) => {
    setInterests(prev => prev.map(i => {
      if (i.key !== key) return i;
      return {
        ...i,
        ...(qty != null ? { qty } : {}),
        ...(orderMode != null ? { orderMode } : {}),
        ...(orderUnitLabel != null ? { orderUnitLabel } : {}),
      };
    }));
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
    const scrollEl = mainContentRef.current;
    if (scrollEl) homeScrollRef.current = scrollEl.scrollTop;
    trackEvent('click', 'home', { element: `brand_card:${brandId}`, user_id: user?.id });
    window.history.pushState({ view: 'brand', brandId }, '', `#${brandId}`);
    setActiveBrand(brandId);
    setView('brand');
    restoreScroll(brandScrollRef.current[brandId] || 0);
  };

  const goHome = () => {
    saveBrandScroll();
    window.history.pushState({ view: 'home' }, '', window.location.pathname);
    setView('home');
    setActiveBrand(null);
    restoreScroll(homeScrollRef.current);
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
    setRepMode('dashboard');
    setView('home');
    setActiveBrand(null);
    setShowProfile(false);
    setProfileGate(null);
    clearAppSession();
  };

  const handleLoggedIn = async (sessionUser) => {
    await applySessionUser(sessionUser);
  };

  const handleSubmitAttempt = () => {
    if (!showCustomerShopping) return;
    setSubmitError('');
    if (isStaffPriceCheck) {
      if (!interests.length) return;
      setView('price_checks');
      return;
    }
    if (authState === 'browse') {
      setSignupPromptError('');
      setShowSignupPrompt(true);
      return;
    }
    if (user && !isPortalAdmin && !isSalesRep && !isProfileComplete(form)) {
      setProfileGate('quote');
      if (mobileShell) setView('profile');
      else setShowProfile(true);
      return;
    }
    doSubmit();
  };

  const doSubmit = async () => {
    if (!showCustomerShopping) return;
    if (isStaffPriceCheck) return;
    const nameCheck = validatePersonName(form.name, { label: 'Name' });
    if (!nameCheck.ok) {
      const msg = nameCheck.error;
      setSubmitError(msg);
      if (showSignupPrompt) setSignupPromptError(msg);
      return;
    }
    const companyCheck = validateCompanyName(form.company);
    if (!companyCheck.ok) {
      const msg = companyCheck.error;
      setSubmitError(msg);
      if (showSignupPrompt) setSignupPromptError(msg);
      return;
    }
    if (!hasCallablePhone(form.phone)) {
      const msg = getPhoneValidationError(form.phone)
        || 'Please enter your name, company, and a real mobile number.';
      setSubmitError(msg);
      if (showSignupPrompt) setSignupPromptError(msg);
      return;
    }
    setSignupPromptError('');
    setSubmitError('');
    const sessionId = await getSessionId();
    const { error: insertErr } = await supabase.from('inquiries').insert({
      session_id: sessionId,
      user_id: user?.id || null,
      name: nameCheck.value,
      company: companyCheck.value,
      phone: normalizePhoneE164(form.phone),
      email: form.email,
      notes: form.notes,
      interests,
      master_pricing_interest: masterPricingInterest,
      contact_requested: form.contactRequested !== false,
      ready_to_order: !!form.readyToOrder,
      pricing_questions: !!form.pricingQuestions,
      user_type: userType,
      quote_status: 'new',
      created_at: new Date().toISOString(),
    });
    if (insertErr) {
      const msg = insertErr.message || 'Could not submit your quote. Please try again.';
      setSubmitError(msg);
      if (showSignupPrompt) setSignupPromptError(msg);
      return;
    }
    setShowSignupPrompt(false);
    setLastSubmittedReadyToOrder(!!form.readyToOrder);
    setView('thanks');
  };

  const openAccessRequest = () => {
    setLoginInitialMode('request');
    setAuthState('login');
  };

  const handleRequestAccess = async (data) => {
    if (!isHoneypotClean(data)) return;
    if (!isValidPhone(data.phone)) return;
    const referral = await getPortalReferral();
    const email = (data.email || '').trim().toLowerCase();
    const { error: insertErr } = await supabase.from('access_requests').insert({
      name: data.name,
      company: data.company,
      email,
      phone: data.phone,
      account_type: data.account_type,
      store_type: data.store_type,
      address: data.address,
      address_line1: data.address_line1 || null,
      address_line2: data.address_line2 || null,
      city: data.city || null,
      state: data.state || null,
      zip: data.zip || null,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      location_count: data.location_count,
      has_retail: data.has_retail,
      retail_count: data.retail_count,
      referred_by_user_id: data.referred_by_user_id || referral?.referral_rep_id || null,
      referral_code_used: data.referral_code_used || referral?.referral_code || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    if (insertErr) {
      if (/duplicate|unique/i.test(insertErr.message || '')) {
        throw new Error('We already have a pending request for this email.');
      }
      throw new Error(insertErr.message || 'Could not submit your request.');
    }
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
        initialMode={loginInitialMode}
        onInitialModeConsumed={() => setLoginInitialMode(null)}
        onCodeVerified={async () => { await setPortalCodeVerified(true); setLoginInitialMode(null); setAuthState('browse'); }}
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
        initialMode={loginInitialMode}
        onInitialModeConsumed={() => setLoginInitialMode(null)}
        onCodeVerified={async () => { await setPortalCodeVerified(true); setLoginInitialMode(null); setAuthState('browse'); }}
        onLoggedIn={(u) => { setLoginInitialMode(null); handleLoggedIn(u); }}
        onAdminEntry={() => setAuthState('login')}
        onRequestAccess={handleRequestAccess}
      />
    </>
  );
  if (authState === 'sales_rep' && repMode === 'dashboard') {
    return (
      <StaffDashboard
        user={user}
        profile={staffProfile}
        onLogout={handleLogout}
        onViewCatalog={() => setRepMode('portal')}
      />
    );
  }

  return (
    <>
    {authState === 'admin' && adminMode === 'dashboard' ? (
      <AdminDashboard
        user={user}
        onLogout={handleLogout}
        onViewPortal={() => setAdminMode('portal')}
      />
    ) : (
    <div className="app-viewport app-no-select" style={{ background: isNight ? t.bg : (bgColor || t.bg), fontFamily: getFontFamily(globalStyles.font_family), color: isNight ? t.text : (globalStyles.primary_color || t.text), transition: 'background 0.35s ease, color 0.35s ease', display: mobileShell ? 'flex' : undefined, flexDirection: mobileShell ? 'column' : undefined, minHeight: '100dvh' }}>
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
        <div className="app-top-chrome app-safe-top-chrome" style={{ '--app-chrome-pad-top': '10px', background: t.browseBannerBg, borderBottom: `0.5px solid ${t.browseBannerBorder}`, paddingLeft: '1.25rem', paddingRight: '1.25rem', paddingBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, color: t.browseBannerText }}>Browsing as guest — sign up or log in to submit an inquiry</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setAuthState('login')} style={{ background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Sign in</button>
            <button onClick={openAccessRequest} style={{ background: 'none', border: `0.5px solid ${t.browseBannerText}`, borderRadius: 6, padding: '6px 14px', fontSize: 12, color: t.browseBannerText, cursor: 'pointer', fontFamily: 'inherit' }}>Request access</button>
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
        onProfile={isPortalCustomer && !showMobileNav ? openProfile : null}
        onList={navigateList}
        onMyQuotes={isPortalCustomer ? navigateMyQuotes : null}
        isMobile={isMobile || isMobileDevice}
        hideMobileActions={showMobileNav}
        includeSafeAreaTop={isMobileDevice && !portalTopChrome}
        showCustomerList={showCustomerList}
        onQuotes={isStaffPortalUser ? navigateQuotes : null}
        onPriceChecks={isStaffCatalogPortal ? navigatePriceChecks : null}
        quotesNewCount={quotesNewCount}
        priceCheckNewCount={priceCheckNewCount}
        priceCheckDraftCount={isStaffCatalogPortal ? interests.length : 0}
        homeLabel={isStaffCatalogPortal ? 'Catalog' : 'Home'}
        isAdmin={isPortalAdmin && adminMode === 'portal'}
        onAdminClick={openAdminDashboard}
        onStaffHomeClick={isRepCatalog ? openRepDashboard : null}
      />
      {showProfile && !mobileShell && (
        <ProfileModal
          user={user}
          form={form}
          setForm={setForm}
          userType={userType}
          setUserType={setUserType}
          isStaff={isStaffPortalUser}
          onClose={closeProfile}
          profileGate={profileGate}
          onSaved={handleProfileSaved}
          pwa={{ canInstall, showIosHint, isInstalled, install, isMobileDevice }}
        />
      )}

      <div ref={mainContentRef} className="app-main-content" style={{ ...mobileContentPad, flex: mobileShell ? 1 : undefined, display: mobileShell ? 'flex' : undefined, flexDirection: mobileShell ? 'column' : undefined, minHeight: mobileShell ? 0 : undefined }}>

      {/* Signup prompt overlay */}
      {showSignupPrompt && (
        <div style={{ position: 'fixed', inset: 0, background: t.overlay, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: t.bgElevated, borderRadius: 20, padding: '2rem', maxWidth: 420, width: '100%', boxShadow: `0 24px 64px ${t.shadow}` }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, letterSpacing: '0.06em', color: t.text, marginBottom: 6 }}>{COPY.requestQuote}</div>
            <p style={{ fontSize: 14, color: t.textMuted, lineHeight: 1.65, marginBottom: '1.5rem' }}>Tell us what you need — we follow up on WhatsApp and post pricing in {COPY.myQuotes}.</p>
            {[['name','Your name *'],['company','Company / Store *'],['phone','Phone / WhatsApp *'],['email','Email']].map(([field, label]) => (
              <div key={field} style={{ marginBottom: '0.875rem' }}>
                <label style={{ fontSize: 11, color: t.textFaint, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>
                <input value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: '100%', background: t.inputBg, border: t.borderHairline, borderRadius: 8, padding: '11px 12px', color: t.text, fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} autoCapitalize={field === 'email' ? 'none' : 'words'} inputMode={field === 'phone' ? 'tel' : field === 'email' ? 'email' : 'text'} placeholder={field === 'phone' ? PHONE_PLACEHOLDER : undefined} />
              </div>
            ))}
            {signupPromptError && (
              <div style={{ fontSize: 13, color: t.error || '#c44', marginBottom: '0.875rem', lineHeight: 1.45 }}>{signupPromptError}</div>
            )}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ fontSize: 11, color: t.textFaint, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Notes (optional)</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Questions, timeline, or extra info..." style={{ width: '100%', background: t.inputBg, border: t.borderHairline, borderRadius: 8, padding: '10px 12px', color: t.text, fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', height: 70, resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: '1.25rem' }}>
              <button onClick={() => { setShowSignupPrompt(false); setSignupPromptError(''); }} style={{ flex: 1, background: 'none', border: t.borderHairline, borderRadius: 10, padding: '12px', fontSize: 13, color: t.textFaint, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={doSubmit} style={{ flex: 2, background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer', fontFamily: 'inherit' }}>{COPY.requestQuote}</button>
            </div>
          </div>
        </div>
      )}

      {(showMobileNav || resolvedView === 'home') && (
        <div
          className={`portal-home-view${resolvedView === 'home' ? ' portal-home-view--active' : ''}`}
          style={{ display: resolvedView === 'home' ? 'block' : 'none' }}
          aria-hidden={resolvedView !== 'home'}
        >
          <HomeView
            visible={resolvedView === 'home'}
            onBrandClick={goToBrand}
            isMobile={isMobile}
            userId={user?.id}
            userType={userType}
            masterPricingQualified={masterPricingQualified}
            isStaff={isStaffPortalUser}
            showPricingPreview={isStaffCatalogPortal}
            onUserTypeChange={setUserType}
            isPortalUser={authState === 'portal' && !!user && !isStaffPortalUser}
            companyName={authState === 'portal' ? form.company : ''}
            onMessageUs={isPortalCustomer ? navigateMyQuotes : null}
            onBrowseSignUp={authState === 'browse' ? openAccessRequest : null}
            onBrowseSignIn={authState === 'browse' ? () => setAuthState('login') : null}
          />
        </div>
      )}
      {resolvedView === 'my_quotes' && isPortalCustomer && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <CustomerQuotesView userId={user?.id} isMobile={isMobile || isMobileDevice} />
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
            isStaff={isStaffPortalUser}
            variant="page"
            onClose={closeProfile}
            profileGate={profileGate}
            onSaved={handleProfileSaved}
            pwa={{ canInstall, showIosHint, isInstalled, install, isMobileDevice }}
          />
        </div>
      )}
      {activeBrand && (showMobileNav || view === 'brand') && (
        <div
          className={`portal-brand-view${view === 'brand' ? ' portal-brand-view--active' : ''}`}
          style={showMobileNav ? { display: view === 'brand' ? 'block' : 'none' } : undefined}
          aria-hidden={view !== 'brand'}
        >
        <BrandView
          brand={getMergedBrands().find(b => b.id === activeBrand)}
          userType={userType}
          user={user}
          userEmail={form.email}
          onBack={goHome}
          toggleInterest={toggleInterest}
          updateInterestLine={updateInterestLine}
          isInterested={isInterested}
          interests={interests}
          onSubmit={handleSubmitAttempt}
          isMobile={isMobile || isMobileDevice}
          hasBottomNav={showMobileNav}
          enableQuoteFlow={showCustomerShopping}
          staffPriceCheck={isStaffPriceCheck}
          masterPricingQualified={masterPricingQualified}
          pricingVisible={authState !== 'browse'}
          showCatalogPrices={showCatalogPrices}
          onSignIn={authState === 'browse' ? () => setAuthState('login') : null}
          onRequestAccess={authState === 'browse' ? openAccessRequest : null}
        />
        </div>
      )}
      {view === 'interest' && showCustomerList && (
        <InterestView
          interests={interests}
          toggleInterest={toggleInterest}
          form={form}
          setForm={setForm}
          onSubmit={handleSubmitAttempt}
          submitError={submitError}
          onBack={() => {
            if (activeBrand) {
              setView('brand');
              restoreScroll(brandScrollRef.current[activeBrand] || 0);
            } else {
              setView('home');
            }
          }}
          isMobile={isMobile}
          profileSaved={isProfileComplete(form)}
          staffPriceCheck={isStaffPriceCheck}
        />
      )}
      {resolvedView === 'quotes' && isStaffPortalUser && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <StaffQuotesView
            isMobile={isMobile || isMobileDevice}
            onCountsChange={setQuotesNewCount}
            staffUserId={user?.id}
            staffProfile={{
              name: staffProfile?.name || form.name,
              company: staffProfile?.company || form.company,
              phone: staffProfile?.phone || form.phone,
            }}
          />
        </div>
      )}
      {view === 'price_checks' && isStaffCatalogPortal && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <StaffPriceCheckView
            isMobile={isMobile || isMobileDevice}
            staffUserId={user?.id}
            isPortalAdmin={isPortalAdmin}
            interests={interests}
            toggleInterest={toggleInterest}
            userType={userType}
            onUserTypeChange={setUserType}
            onCountsChange={setPriceCheckNewCount}
            onSubmitted={() => {
              setInterests([]);
              setForm(f => ({ ...f, notes: '' }));
            }}
          />
        </div>
      )}
      {view === 'thanks' && (
        <ThanksView
          onBack={goHome}
          onViewMyQuotes={user ? navigateMyQuotes : null}
          onWhatsApp={hasSupportWhatsApp() ? getSupportWhatsAppLink('Hi, I just submitted a quote request.') : null}
          staffPriceCheck={isStaffPriceCheck}
          readyToOrder={lastSubmittedReadyToOrder}
          backLabel={isStaffCatalogPortal ? COPY.catalog : COPY.home}
        />
      )}
      </div>

      {showMobileBottomNav && (
        <MobileBottomNav
          activeView={resolvedView}
          onHome={navigateHome}
          onList={navigateList}
          onQuotes={navigateQuotes}
          onPriceChecks={navigatePriceChecks}
          onMyQuotes={navigateMyQuotes}
          onProfile={navigateProfile}
          listCount={interests.length}
          quotesCount={quotesNewCount}
          priceCheckCount={priceCheckNewCount}
          priceCheckDraftCount={interests.length}
          showList={showCustomerList}
          listLabel={COPY.myList}
          showQuotes={isStaffPortalUser}
          showMyQuotes={isPortalCustomer}
          showPriceChecks={isStaffCatalogPortal}
          showProfile={isPortalCustomer}
          showChat={false}
          homeLabel={isStaffCatalogPortal ? 'Catalog' : 'Home'}
          onAdjacentTab={mobileBottomTabs.length > 1 ? goAdjacentMobileTab : null}
        />
      )}
    </div>
    )}
    </>
  );
}
