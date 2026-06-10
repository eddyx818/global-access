const prefsKey = (userId) => `ga-convo-prefs-${userId}`;

/** Inbox only shows threads with activity in this window (messages stay in the database). */
export const INBOX_RETENTION_HOURS = 48;
const INBOX_RETENTION_MS = INBOX_RETENTION_HOURS * 60 * 60 * 1000;

export function getConversationActivityAt(convo) {
  return convo?.last_message_at || convo?.created_at || null;
}

export function isConversationInboxActive(convo, nowMs = Date.now()) {
  const at = getConversationActivityAt(convo);
  if (!at) return true;
  return nowMs - new Date(at).getTime() <= INBOX_RETENTION_MS;
}

export function loadConvoPrefs(userId) {
  try {
    const raw = localStorage.getItem(prefsKey(userId));
    if (!raw) return { pinned: [], hidden: [], sessions: {} };
    const parsed = JSON.parse(raw);
    return {
      pinned: Array.isArray(parsed.pinned) ? parsed.pinned : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
      sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
    };
  } catch {
    return { pinned: [], hidden: [], sessions: {} };
  }
}

export function ensureConversationVisible(userId, conversationId) {
  const prefs = loadConvoPrefs(userId);
  if (!prefs.hidden.includes(conversationId)) return prefs;
  prefs.hidden = prefs.hidden.filter(id => id !== conversationId);
  saveConvoPrefs(userId, prefs);
  return prefs;
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

export function unhideConversation(userId, conversationId) {
  const prefs = loadConvoPrefs(userId);
  prefs.hidden = prefs.hidden.filter(id => id !== conversationId);
  saveConvoPrefs(userId, prefs);
  return prefs;
}

/** Customer "fresh start" — only show messages after this timestamp in the thread. */
export function startConversationSession(userId, conversationId) {
  const prefs = loadConvoPrefs(userId);
  if (!prefs.sessions) prefs.sessions = {};
  prefs.sessions[conversationId] = new Date().toISOString();
  saveConvoPrefs(userId, prefs);
  return prefs;
}

export function getConversationSessionStart(userId, conversationId) {
  const prefs = loadConvoPrefs(userId);
  return prefs.sessions?.[conversationId] || null;
}

export function clearConversationSession(userId, conversationId) {
  const prefs = loadConvoPrefs(userId);
  if (!prefs.sessions?.[conversationId]) return prefs;
  const sessions = { ...prefs.sessions };
  delete sessions[conversationId];
  prefs.sessions = sessions;
  saveConvoPrefs(userId, prefs);
  return prefs;
}

/** Max visible Trade Desk threads a customer can keep in their inbox. */
export const MAX_CUSTOMER_SUPPORT_CHATS = 3;

export function filterAndSortConversations(conversations, userId) {
  const prefs = loadConvoPrefs(userId);
  const visible = (conversations || []).filter(
    c => !prefs.hidden.includes(c.id) && isConversationInboxActive(c),
  );
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

/** One Trade Desk row in the customer inbox — keep the most recently active support thread. */
export function dedupeCustomerSupportInbox(conversations, profiles, customerUserId) {
  const support = [];
  const other = [];
  for (const convo of conversations || []) {
    const otherId = (convo.participant_user_ids || []).find(id => id !== customerUserId);
    const p = profiles[otherId] || {};
    if (p.is_portal_admin || p.is_sales_rep) support.push(convo);
    else other.push(convo);
  }
  if (support.length <= 1) return conversations || [];
  support.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
  return [support[0], ...other];
}
