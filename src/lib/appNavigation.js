const KEY = 'ga-app-nav';

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
    sessionStorage.setItem(KEY, JSON.stringify({ ...prev, ...state, ts: Date.now() }));
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
  if (view === 'quotes') return 'inbox';
  if (view === 'inbox') return 'quotes';
  return view || 'home';
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
    adminTab: saved.adminTab || 'overview',
  };
}
