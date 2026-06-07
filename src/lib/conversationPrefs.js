const prefsKey = (userId) => `ga-convo-prefs-${userId}`;

export function loadConvoPrefs(userId) {
  try {
    const raw = localStorage.getItem(prefsKey(userId));
    if (!raw) return { pinned: [], hidden: [] };
    const parsed = JSON.parse(raw);
    return {
      pinned: Array.isArray(parsed.pinned) ? parsed.pinned : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
    };
  } catch {
    return { pinned: [], hidden: [] };
  }
}

function saveConvoPrefs(userId, prefs) {
  try {
    localStorage.setItem(prefsKey(userId), JSON.stringify(prefs));
  } catch (_) {}
}

export function pinConversation(userId, conversationId) {
  const prefs = loadConvoPrefs(userId);
  if (!prefs.pinned.includes(conversationId)) {
    prefs.pinned = [conversationId, ...prefs.pinned.filter(id => id !== conversationId)];
  }
  saveConvoPrefs(userId, prefs);
  return prefs;
}

export function unpinConversation(userId, conversationId) {
  const prefs = loadConvoPrefs(userId);
  prefs.pinned = prefs.pinned.filter(id => id !== conversationId);
  saveConvoPrefs(userId, prefs);
  return prefs;
}

export function hideConversation(userId, conversationId) {
  const prefs = loadConvoPrefs(userId);
  if (!prefs.hidden.includes(conversationId)) {
    prefs.hidden = [...prefs.hidden, conversationId];
  }
  prefs.pinned = prefs.pinned.filter(id => id !== conversationId);
  saveConvoPrefs(userId, prefs);
  return prefs;
}

export function filterAndSortConversations(conversations, userId) {
  const prefs = loadConvoPrefs(userId);
  const visible = (conversations || []).filter(c => !prefs.hidden.includes(c.id));
  const pinnedSet = new Set(prefs.pinned);
  return [...visible].sort((a, b) => {
    const aPin = pinnedSet.has(a.id) ? 0 : 1;
    const bPin = pinnedSet.has(b.id) ? 0 : 1;
    if (aPin !== bPin) return aPin - bPin;
    const aPinIdx = prefs.pinned.indexOf(a.id);
    const bPinIdx = prefs.pinned.indexOf(b.id);
    if (aPinIdx !== -1 && bPinIdx !== -1 && aPinIdx !== bPinIdx) return aPinIdx - bPinIdx;
    return new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0);
  });
}
