const orderKey = (userId) => `ga-brand-order-${userId || 'guest'}`;

export function loadUserBrandOrder(userId) {
  try {
    const raw = localStorage.getItem(orderKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : null;
  } catch {
    return null;
  }
}

export function saveUserBrandOrder(userId, brandIds) {
  try {
    localStorage.setItem(orderKey(userId), JSON.stringify(brandIds));
  } catch (_) {}
}

/** Apply saved order; unknown brands append at end. */
export function applyBrandOrder(allBrands, userId) {
  const saved = loadUserBrandOrder(userId);
  if (!saved?.length) return allBrands;
  const byId = Object.fromEntries(allBrands.map(b => [b.id, b]));
  const ordered = saved.map(id => byId[id]).filter(Boolean);
  const rest = allBrands.filter(b => !saved.includes(b.id));
  return [...ordered, ...rest];
}
