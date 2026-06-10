import { supabase } from './supabase';
import { getPortalSessionToken } from './session';
import { hasCallablePhone, normalizePhoneE164 } from './whatsapp';
import { createStaffPriceCheckRecord } from './priceChecks';
import { loadConvoPrefs, isConversationInboxActive } from './conversationPrefs';

const ADMIN_EMAILS = () => (process.env.REACT_APP_ADMIN_EMAIL || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

export function isLegacyAdminEmail(email) {
  const emails = ADMIN_EMAILS();
  return emails.length > 0 && emails.includes((email || '').toLowerCase());
}

export async function fetchUserPortalAdmin(userId) {
  if (!userId) return false;
  const { data } = await supabase
    .from('user_profiles')
    .select('is_portal_admin, role')
    .eq('user_id', userId)
    .maybeSingle();
  return !!(data?.is_portal_admin || data?.role === 'admin');
}

export async function fetchUserSalesRep(userId) {
  if (!userId) return false;
  const { data } = await supabase
    .from('user_profiles')
    .select('is_sales_rep, role')
    .eq('user_id', userId)
    .maybeSingle();
  return !!(data?.is_sales_rep || data?.role === 'sales_rep');
}

export async function resolveSalesRep(sessionUser) {
  if (!sessionUser?.id) return false;
  if (await fetchUserPortalAdmin(sessionUser.id)) return false;
  return fetchUserSalesRep(sessionUser.id);
}

export async function resolvePortalAdmin(sessionUser) {
  if (!sessionUser?.id) return false;
  if (isLegacyAdminEmail(sessionUser.email)) {
    await ensurePortalAdminFlag(sessionUser.id, sessionUser.email);
    return true;
  }
  return fetchUserPortalAdmin(sessionUser.id);
}

export async function resolveAuthRole(sessionUser) {
  if (!sessionUser?.id) return { isAdmin: false, isSalesRep: false, authState: 'portal' };
  const isAdmin = await resolvePortalAdmin(sessionUser);
  if (isAdmin) return { isAdmin: true, isSalesRep: false, authState: 'admin' };
  const isSalesRep = await resolveSalesRep(sessionUser);
  if (isSalesRep) return { isAdmin: false, isSalesRep: true, authState: 'sales_rep' };
  return { isAdmin: false, isSalesRep: false, authState: 'portal' };
}

export async function ensurePortalAdminFlag(userId, email) {
  if (!userId) return;
  if (!isLegacyAdminEmail(email)) {
    const isAdmin = await fetchUserPortalAdmin(userId);
    if (!isAdmin) return;
  }
  await supabase.from('user_profiles').upsert({
    user_id: userId,
    email,
    is_portal_admin: true,
    role: 'admin',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

export async function fetchPortalAdmins() {
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, username, name, company, role, status, profile_avatar_url, last_active_at, is_portal_admin')
    .eq('is_portal_admin', true);
  return data || [];
}

export async function fetchContactableUsers(currentUserId, { isAdmin = false, isSalesRep = false } = {}) {
  if (isAdmin) {
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id, username, name, company, role, status, profile_avatar_url, last_active_at, email, is_portal_admin, referred_by_user_id, referral_code_used, crm_tier, master_brand_ids, master_pricing_qualified, user_type')
      .eq('is_portal_admin', false)
      .eq('is_sales_rep', false)
      .neq('user_id', currentUserId)
      .order('last_active_at', { ascending: false, nullsFirst: false });
    return data || [];
  }
  if (isSalesRep) {
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id, username, name, company, role, status, profile_avatar_url, last_active_at, email, referred_by_user_id, referral_code_used, crm_tier, master_brand_ids, master_pricing_qualified, user_type')
      .eq('referred_by_user_id', currentUserId)
      .order('last_active_at', { ascending: false, nullsFirst: false });
    return data || [];
  }
  return fetchPortalAdmins();
}

export async function updateUserPresence(userId, status = 'online') {
  if (!userId) return;
  await supabase.from('user_profiles').upsert({
    user_id: userId,
    status,
    last_active_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

export async function logUserActivity(eventType, pageUrl, metadata = {}, userId = null) {
  const sessionToken = await getPortalSessionToken();
  try {
    await supabase.from('user_activity').insert({
      user_id: userId,
      session_token: sessionToken,
      event_type: eventType,
      page_url: pageUrl,
      metadata,
      created_at: new Date().toISOString(),
    });
  } catch (_) {}
}

export async function fetchOnlineUsers(isAdmin = false) {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  let query = supabase
    .from('user_profiles')
    .select('user_id, username, name, company, role, status, profile_avatar_url, last_active_at, is_portal_admin')
    .eq('status', 'online')
    .gte('last_active_at', since)
    .order('last_active_at', { ascending: false });

  if (!isAdmin) {
    query = query.eq('is_portal_admin', true);
  }

  const { data } = await query;
  return data || [];
}

export async function fetchConversations(userId, { isAdmin = false, isSalesRep = false } = {}) {
  let query = supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false });

  if (isAdmin || isSalesRep) {
    query = query.eq('is_group', false);
  } else {
    query = query.contains('participant_user_ids', [userId]);
  }

  const { data } = await query;
  let convos = data || [];
  if (!isAdmin && !isSalesRep) {
    convos = convos.filter(c => !c.is_group);
  }
  return convos;
}

export async function fetchMessages(conversationId) {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  return data || [];
}

export function isMessageHiddenForUser(msg, userId, { isPortalAdmin = false } = {}) {
  if (isPortalAdmin || !userId) return false;
  return (msg?.hidden_for_user_ids || []).includes(userId);
}

export function filterMessagesForCustomerView(messages, userId, sessionStart = null) {
  const sessionTs = sessionStart ? new Date(sessionStart).getTime() : null;
  return (messages || []).filter((msg) => {
    if (isMessageHiddenForUser(msg, userId)) return false;
    if (!sessionTs) return true;
    return new Date(msg.created_at).getTime() >= sessionTs;
  });
}

export function isSupportConversation(convo, profiles, customerUserId) {
  if (!convo || convo.is_group) return false;
  const otherId = (convo.participant_user_ids || []).find(id => id !== customerUserId);
  const p = profiles[otherId] || {};
  return !!(p.is_portal_admin || p.is_sales_rep);
}

export function isMessageHiddenFromCustomer(msg, customerUserId) {
  if (!customerUserId) return false;
  return (msg?.hidden_for_user_ids || []).includes(customerUserId);
}

export async function softDeleteMessage(messageId, scope = 'me') {
  const { data, error } = await supabase.rpc('soft_delete_message', {
    p_message_id: messageId,
    p_scope: scope,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: !!data };
}

export async function getOrCreateSupportConversation(customerId) {
  const admins = await fetchPortalAdmins();
  if (!admins.length) throw new Error('Support team is not available yet.');

  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .contains('participant_user_ids', [customerId])
    .eq('is_group', false);

  const adminIds = new Set(admins.map(a => a.user_id));
  const support = (existing || []).find(c =>
    c.participant_user_ids.length === 2 &&
    c.participant_user_ids.includes(customerId) &&
    adminIds.has(c.participant_user_ids.find(id => id !== customerId))
  );
  if (support) {
    await ensureSupportWelcome(support.id);
    return support;
  }

  const created = await getOrCreateDirectConversation(customerId, admins[0].user_id);
  await ensureSupportWelcome(created.id);
  return created;
}

export async function ensureSupportWelcome(conversationId) {
  if (!conversationId) return;
  try {
    await supabase.rpc('ensure_support_welcome_message', { p_conversation_id: conversationId });
  } catch (_) {}
}

export async function getOrCreateDirectConversation(userId, otherUserId) {
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .contains('participant_user_ids', [userId])
    .eq('is_group', false);

  const match = (existing || []).find(c =>
    c.participant_user_ids.length === 2 &&
    c.participant_user_ids.includes(userId) &&
    c.participant_user_ids.includes(otherUserId)
  );
  if (match) return match;

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      participant_user_ids: [userId, otherUserId],
      is_group: false,
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function sendMessage({ conversationId, fromUserId, toUserId, content, attachment = null, isGroup = false }) {
  const trimmed = content?.trim();
  const hasAttachment = !!(attachment?.url);
  if (!trimmed && !hasAttachment) return null;

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      from_user_id: fromUserId,
      to_user_id: isGroup ? null : toUserId,
      content: trimmed || (hasAttachment ? `📎 ${attachment.name}` : ''),
      attachment_url: attachment?.url || null,
      attachment_type: attachment?.type || null,
      attachment_name: attachment?.name || null,
      read_status: false,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase.from('conversations').update({
    last_message_at: new Date().toISOString(),
  }).eq('id', conversationId);

  await logUserActivity('message_send', `/chat/${conversationId}`, {
    to_user_id: toUserId,
    is_group: isGroup,
  }, fromUserId);
  return data;
}

export async function createGroupConversation(creatorId, groupName, participantIds = []) {
  const name = groupName?.trim();
  if (!name) throw new Error('Group name is required');

  const ids = [...new Set([creatorId, ...participantIds])];
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      participant_user_ids: ids,
      is_group: true,
      group_name: name,
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchBrandGroupChannels() {
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .eq('is_group', true)
    .not('brand_id', 'is', null)
    .order('group_name', { ascending: true });
  return data || [];
}

export async function getOrCreateBrandGroup(brandId, brandName, userId) {
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('is_group', true)
    .eq('brand_id', brandId)
    .maybeSingle();

  if (existing) {
    const joined = await joinGroupChat(existing.id);
    return joined || existing;
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      participant_user_ids: [userId],
      is_group: true,
      group_name: `${brandName} Channel`,
      brand_id: brandId,
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function joinGroupChat(conversationId) {
  const { data, error } = await supabase.rpc('join_group_chat', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  return data;
}

/** Add an admin or sales rep to an existing customer conversation. */
export async function joinStaffToConversation(conversationId, staffUserId) {
  const { data: convo, error: fetchErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();
  if (fetchErr || !convo) throw new Error('Conversation not found');

  const ids = [...new Set([...(convo.participant_user_ids || []), staffUserId])];
  const { data, error } = await supabase
    .from('conversations')
    .update({ participant_user_ids: ids })
    .eq('id', conversationId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCustomerAppointment(customerUserId, fields, { sendMessageFn } = {}) {
  const result = await saveProfile(customerUserId, null, fields);
  if (!result.ok) return result;

  if (sendMessageFn && fields.appointment_status === 'accepted' && fields.preferred_appointment_at) {
    const when = new Date(fields.preferred_appointment_at).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
    await sendMessageFn(`✅ Call confirmed for ${when}`);
  }
  if (sendMessageFn && fields.appointment_status === 'countered' && fields.appointment_counter_at) {
    const when = new Date(fields.appointment_counter_at).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
    await sendMessageFn(`📅 Counter proposal: ${when}${fields.appointment_notes ? `\n\n${fields.appointment_notes}` : ''}`);
  }
  return result;
}

export async function fetchStaffAvailability() {
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, name, support_availability, status, is_portal_admin, is_sales_rep')
    .or('is_portal_admin.eq.true,is_sales_rep.eq.true');
  const staff = (data || []).filter(p => p.is_portal_admin || p.is_sales_rep);
  const anyAvailable = staff.some(p => (p.support_availability || 'available') === 'available' && p.status === 'online');
  return { staff, anyAvailable };
}

export function getCustomerParticipantId(convo, profiles = {}) {
  return (convo?.participant_user_ids || []).find(id => {
    const p = profiles[id];
    if (p?.is_portal_admin || p?.is_sales_rep) return false;
    const role = p?.role || '';
    return role !== 'admin' && role !== 'sales_rep';
  });
}

export function getStaffChatDisplayName(profile) {
  if (!profile) return 'Customer';
  const name = profile.name || profile.company || profile.username || 'Customer';
  if (profile.username && profile.name && profile.username !== profile.name) {
    return `${name} (@${profile.username})`;
  }
  return name;
}

export function getChatDisplayName(profile, { viewerIsStaff = false } = {}) {
  if (!profile) return 'User';
  if (viewerIsStaff) return getStaffChatDisplayName(profile);
  if (profile.is_portal_admin || profile.is_sales_rep) {
    return profile.name || 'Trade Desk';
  }
  if (profile.show_username_in_chat && profile.username) {
    return profile.username;
  }
  return profile.username || profile.name || profile.company || 'User';
}

export function getConversationTitle(convo, profiles, currentUserId, { isAdmin = false, isSalesRep = false, customerChatLabel = 'Trade Desk' } = {}) {
  if (convo.is_group) {
    return convo.group_name || customerChatLabel;
  }
  if (isAdmin || isSalesRep) {
    const customerId = getCustomerParticipantId(convo, profiles);
    const p = profiles[customerId] || {};
    return getStaffChatDisplayName(p);
  }
  const otherId = (convo.participant_user_ids || []).find(id => id !== currentUserId);
  const p = profiles[otherId] || {};
  if (p.is_portal_admin || p.is_sales_rep) return customerChatLabel;
  return getChatDisplayName(p, { viewerIsStaff: false });
}

export function isGroupConversation(convo) {
  return !!convo?.is_group;
}

export async function markMessagesRead(conversationId, userId, { isAdmin = false, isSalesRep = false } = {}) {
  if (isAdmin || isSalesRep) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, from_user_id')
      .eq('conversation_id', conversationId)
      .eq('read_status', false);
    const { data: staff } = await supabase
      .from('user_profiles')
      .select('user_id')
      .or('is_portal_admin.eq.true,is_sales_rep.eq.true');
    const staffIds = new Set((staff || []).map(a => a.user_id));
    const customerMsgIds = (msgs || [])
      .filter(m => !staffIds.has(m.from_user_id))
      .map(m => m.id);
    if (!customerMsgIds.length) return;
    await supabase.from('messages').update({ read_status: true }).in('id', customerMsgIds);
    return;
  }
  await supabase
    .from('messages')
    .update({ read_status: true })
    .eq('conversation_id', conversationId)
    .eq('to_user_id', userId)
    .eq('read_status', false);
}

async function getStaffSenderIds() {
  const { data: staff } = await supabase
    .from('user_profiles')
    .select('user_id')
    .or('is_portal_admin.eq.true,is_sales_rep.eq.true');
  return new Set((staff || []).map(s => s.user_id));
}

async function countStaffInboxUnread(userId, { isAdmin = false, isSalesRep = false } = {}) {
  const hidden = new Set(loadConvoPrefs(userId).hidden || []);
  let convos = await fetchConversations(userId, { isAdmin, isSalesRep });
  convos = convos.filter(c => !hidden.has(c.id) && isConversationInboxActive(c));
  const ids = new Set();
  convos.forEach(c => (c.participant_user_ids || []).forEach(id => ids.add(id)));
  if (ids.size) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, is_portal_admin, is_sales_rep, role')
      .in('user_id', [...ids]);
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p; });
    convos = convos.filter(c => !!getCustomerParticipantId(c, profileMap));
  }
  const visibleIds = convos.map(c => c.id);
  if (!visibleIds.length) return 0;
  const staffIds = await getStaffSenderIds();
  const { data: msgs, error } = await supabase
    .from('messages')
    .select('id, from_user_id')
    .in('conversation_id', visibleIds)
    .eq('read_status', false);
  if (error) return 0;
  return (msgs || []).filter(m => !staffIds.has(m.from_user_id)).length;
}

export async function getUnreadCount(userId, { isAdmin = false, isSalesRep = false } = {}) {
  if (isAdmin || isSalesRep) {
    return countStaffInboxUnread(userId, { isAdmin, isSalesRep });
  }
  const hidden = new Set(loadConvoPrefs(userId).hidden || []);
  const convos = await fetchConversations(userId, { isAdmin: false, isSalesRep: false });
  const visibleIds = convos.filter(c => !hidden.has(c.id) && isConversationInboxActive(c)).map(c => c.id);
  if (!visibleIds.length) return 0;
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .in('conversation_id', visibleIds)
    .eq('to_user_id', userId)
    .eq('read_status', false);
  return count || 0;
}

export async function fetchAllProfiles() {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .order('last_active_at', { ascending: false, nullsFirst: false });
  return data || [];
}

export async function fetchRecentActivity(limit = 50) {
  const { data } = await supabase
    .from('user_activity')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export function subscribeToMessages(conversationId, onMessage, onUpdate = null) {
  const channel = supabase.channel(`messages:${conversationId}`);
  channel.on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`,
  }, payload => onMessage(payload.new));
  if (onUpdate) {
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    }, payload => onUpdate(payload.new));
  }
  channel.subscribe();
  return channel;
}

export function isProfileComplete(fields = {}) {
  return !!(fields.name?.trim() && fields.company?.trim() && hasCallablePhone(fields.phone));
}

export async function saveProfile(userId, email, fields) {
  const payload = {
    user_id: userId,
    email: email || null,
    updated_at: new Date().toISOString(),
  };
  if (fields.username !== undefined) payload.username = fields.username;
  if (fields.name !== undefined) payload.name = fields.name;
  if (fields.company !== undefined) payload.company = fields.company;
  if (fields.phone !== undefined) {
    payload.phone = fields.phone?.trim() ? normalizePhoneE164(fields.phone) : fields.phone;
  }
  if (fields.bio !== undefined) payload.bio = fields.bio;
  if (fields.profile_avatar_url !== undefined) payload.profile_avatar_url = fields.profile_avatar_url;
  if (fields.user_type !== undefined) payload.user_type = fields.user_type;
  if (fields.role !== undefined) payload.role = fields.role;
  if (fields.is_portal_admin !== undefined) payload.is_portal_admin = fields.is_portal_admin;
  if (fields.preferred_appointment_at !== undefined) payload.preferred_appointment_at = fields.preferred_appointment_at;
  if (fields.appointment_notes !== undefined) payload.appointment_notes = fields.appointment_notes;
  if (fields.appointment_status !== undefined) payload.appointment_status = fields.appointment_status;
  if (fields.appointment_counter_at !== undefined) payload.appointment_counter_at = fields.appointment_counter_at;
  if (fields.address !== undefined) payload.address = fields.address;
  if (fields.address_line2 !== undefined) payload.address_line2 = fields.address_line2;
  if (fields.city !== undefined) payload.city = fields.city;
  if (fields.state !== undefined) payload.state = fields.state;
  if (fields.zip !== undefined) payload.zip = fields.zip;
  if (fields.lat !== undefined) payload.lat = fields.lat;
  if (fields.lng !== undefined) payload.lng = fields.lng;
  if (fields.support_availability !== undefined) payload.support_availability = fields.support_availability;
  if (fields.show_username_in_chat !== undefined) payload.show_username_in_chat = fields.show_username_in_chat;

  const tryUpsert = async (body) => {
    const { error } = await supabase.from('user_profiles').upsert(body, { onConflict: 'user_id' });
    return error;
  };

  let body = { ...payload };
  let error = await tryUpsert(body);
  let attempts = 0;
  while (error && isMissingColumnError(error) && attempts < 10) {
    const missing = missingColumnFromError(error);
    if (missing && Object.prototype.hasOwnProperty.call(body, missing)) {
      delete body[missing];
    } else {
      delete body.preferred_appointment_at;
      delete body.appointment_notes;
      delete body.phone;
      delete body.bio;
      delete body.profile_avatar_url;
      delete body.username;
      delete body.show_username_in_chat;
    }
    error = await tryUpsert(body);
    attempts += 1;
  }

  return { ok: !error, error: error?.message || null };
}

function isMissingColumnError(error, column) {
  const msg = (error?.message || '').toLowerCase();
  const looksMissing =
    (msg.includes('column') && msg.includes('does not exist'))
    || msg.includes('schema cache')
    || msg.includes('could not find');
  if (!looksMissing) return false;
  if (!column) return true;
  return msg.includes(column.toLowerCase());
}

function missingColumnFromError(error) {
  const msg = error?.message || '';
  const quoted = msg.match(/could not find the '([^']+)' column/i);
  if (quoted) return quoted[1];
  const pg = msg.match(/column "([^"]+)" of relation/i);
  if (pg) return pg[1];
  return null;
}

export async function checkUsernameAvailable(username, currentUserId) {
  const clean = (username || '').trim().toLowerCase();
  if (!clean) return true;
  try {
    const { data, error } = await supabase.rpc('check_username_available', {
      p_username: clean,
      p_user_id: currentUserId || null,
    });
    if (error) {
      const { data: row } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('username', clean)
        .maybeSingle();
      if (!row) return true;
      return row.user_id === currentUserId;
    }
    return data === true;
  } catch (_) {
    return true;
  }
}

export async function confirmConversationContact(conversationId, adminUserId) {
  const { data, error } = await supabase
    .from('conversations')
    .update({
      contact_revealed: true,
      contact_confirmed_at: new Date().toISOString(),
      contact_confirmed_by: adminUserId,
    })
    .eq('id', conversationId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function sendStaffPriceCheck(staffUserId, {
  interests = [],
  userType,
  notes = '',
  accountName = '',
  targetRates = '',
  customerUserId = null,
  customerConversationId = null,
  source = 'catalog',
}) {
  const itemsList = interests.map(i => {
    const unit = i.orderUnitLabel || (i.orderMode === 'pallet' ? 'pallets' : 'cases');
    const skuPart = i.sku ? `${i.sku} · ` : '';
    return `• ${skuPart}${i.brandName} — ${i.productName}\n  ${i.flavor || '—'} · Qty ${i.qty || 1} ${unit}`;
  }).join('\n');

  const accountLine = accountName?.trim()
    ? `Account / store: ${accountName.trim()}`
    : null;
  const targetLine = targetRates?.trim()
    ? `Customer target rates / their quote:\n${targetRates.trim()}`
    : null;
  const sourceLine = source === 'chat'
    ? 'Source: customer chat'
    : 'Source: catalog price check';

  const text = [
    '📋 Internal price check (staff)',
    '',
    accountLine,
    sourceLine,
    '',
    itemsList || '(No line items)',
    '',
    `Preview pricing as: ${userType === 'distributor' ? 'Distributor' : 'Retailer'}`,
    targetLine,
    notes?.trim() ? `Notes: ${notes.trim()}` : '',
    '',
    'Team — please reply with best pricing or catalog guidance.',
  ].filter(Boolean).join('\n');

  const serialized = interests.map(i => ({
    key: i.key,
    sku: i.sku,
    productName: i.productName,
    brandName: i.brandName,
    brandId: i.brandId,
    flavor: i.flavor,
    qty: i.qty,
    orderMode: i.orderMode,
    orderUnitLabel: i.orderUnitLabel,
  }));

  let msg = null;
  let recordConversationId = customerConversationId || null;

  if (source === 'chat' && customerConversationId) {
    recordConversationId = customerConversationId;
  } else {
    const supportConvo = await getOrCreateSupportConversation(staffUserId);
    recordConversationId = supportConvo.id;
    const adminId = supportConvo.participant_user_ids.find(id => id !== staffUserId);
    msg = await sendMessage({
      conversationId: supportConvo.id,
      fromUserId: staffUserId,
      toUserId: adminId,
      content: text,
    });
  }

  const record = await createStaffPriceCheckRecord({
    staffUserId,
    interests: serialized,
    userType,
    notes,
    accountName,
    targetRates,
    customerUserId,
    conversationId: recordConversationId,
    messageId: msg?.id || null,
    source,
  });

  return {
    convo: { id: recordConversationId },
    saved: !!record.ok,
    error: record.ok ? null : record.error,
    row: record.row,
  };
}

export async function submitInterestToSupport(userId, { form, interests, userType, masterPricingInterest = false }) {
  const convo = await getOrCreateSupportConversation(userId);
  const itemsList = interests.map(i => {
    const unit = i.orderUnitLabel || (i.orderMode === 'pallet' ? 'pallets' : 'cases');
    return `• ${i.brandName} — ${i.productName}\n  ${i.flavor} · Qty ${i.qty || 1} ${unit}`;
  }).join('\n');
  const text = [
    'Quote request submitted',
    '',
    itemsList || '(No line items)',
    masterPricingInterest ? '\nAccount flagged for Master Distributor volume review (high-volume qualification).' : '',
    '',
    `Notes: ${form.notes || '—'}`,
    `Account type: ${userType}`,
  ].filter(Boolean).join('\n');
  const adminId = convo.participant_user_ids.find(id => id !== userId);
  await sendMessage({
    conversationId: convo.id,
    fromUserId: userId,
    toUserId: adminId,
    content: text,
  });
  return convo;
}

export function redactProfileContacts(profile, { contactRevealed, isSelf, viewerIsStaff = false, subjectIsStaff = false } = {}) {
  if (!profile) return profile;
  if (isSelf) return profile;
  // Staff always see customer contact details in chat.
  if (viewerIsStaff && !subjectIsStaff) return profile;
  // Customers never see staff personal email or phone.
  if (subjectIsStaff) {
    const { email, phone, ...rest } = profile;
    return { ...rest, email: null, phone: null };
  }
  if (!contactRevealed) {
    const { email, phone, ...rest } = profile;
    return { ...rest, email: null, phone: null };
  }
  // Peer customers: phone/WhatsApp only — no email.
  const { email, ...rest } = profile;
  return { ...rest, email: null };
}

export function profileIsStaff(profile) {
  return !!(profile?.is_portal_admin || profile?.is_sales_rep);
}
