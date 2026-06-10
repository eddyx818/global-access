const KEY = 'ga-app-nav';

const ADMIN_TABS = new Set([
  'overview', 'profile', 'messages', 'community', 'contacts', 'pages', 'clicks',
  'requests', 'inquiries', 'content', 'users', 'map', 'brands', 'marketing',
]);

export function loadAppNavigation() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export function saveAppNavigation(state) {
  try {
    const prev = loadAppNavigation() || {};
    const next = { ...prev, ...state, ts: Date.now() };
    if (next.view) next.view = normalizePortalView(next.view);
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch (_) {}
}

export function saveAppNavigationPartial(partial) {
  saveAppNavigation(partial);
}

export function clearAppNavigation() {
  try {
    sessionStorage.removeItem(KEY);
  } catch (_) {}
}

/** Map legacy route names to current portal views. */
export function normalizePortalView(view) {
  if (view === 'inbox') return 'quotes';
  return view || 'home';
}

export function normalizeAdminTab(tab) {
  return ADMIN_TABS.has(tab) ? tab : 'overview';
}

/** Restore portal / admin-preview navigation after resume or bfcache. */
export function readSavedPortalNav(userId) {
  const saved = loadAppNavigation();
  if (!saved || saved.userId !== userId) return null;
  return {
    adminMode: saved.adminMode === 'portal' ? 'portal' : 'dashboard',
    repMode: saved.repMode === 'portal' ? 'portal' : 'dashboard',
    view: normalizePortalView(saved.view),
    activeBrand: saved.activeBrand || null,
    adminTab: normalizeAdminTab(saved.adminTab),
  };
}
