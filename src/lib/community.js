import { supabase } from './supabase';
import { getPortalSessionToken } from './session';

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

export async function resolvePortalAdmin(sessionUser) {
  if (!sessionUser?.id) return false;
  if (isLegacyAdminEmail(sessionUser.email)) {
    await ensurePortalAdminFlag(sessionUser.id, sessionUser.email);
    return true;
  }
  return fetchUserPortalAdmin(sessionUser.id);
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

export async function fetchContactableUsers(currentUserId, isAdmin) {
  if (isAdmin) {
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id, username, name, company, role, status, profile_avatar_url, last_active_at, email, is_portal_admin')
      .eq('is_portal_admin', false)
      .neq('user_id', currentUserId)
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

export async function fetchConversations(userId, { isAdmin = false } = {}) {
  let query = supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false });

  if (!isAdmin) {
    query = query.contains('participant_user_ids', [userId]);
  } else {
    query = query.eq('is_group', false);
  }

  const { data } = await query;
  let convos = data || [];
  if (!isAdmin) {
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
  if (support) return support;

  return getOrCreateDirectConversation(customerId, admins[0].user_id);
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

export function getCustomerParticipantId(convo, profiles = {}) {
  return (convo?.participant_user_ids || []).find(id => !profiles[id]?.is_portal_admin);
}

export function getConversationTitle(convo, profiles, currentUserId, { isAdmin = false } = {}) {
  if (convo.is_group) {
    return convo.group_name || 'Group chat';
  }
  if (isAdmin) {
    const customerId = getCustomerParticipantId(convo, profiles);
    const p = profiles[customerId] || {};
    return p.name || p.company || p.username || 'Customer';
  }
  const otherId = convo.participant_user_ids.find(id => id !== currentUserId);
  const p = profiles[otherId] || {};
  if (p.is_portal_admin) return 'Global Access';
  return p.username || p.name || p.company || 'User';
}

export function isGroupConversation(convo) {
  return !!convo?.is_group;
}

export async function markMessagesRead(conversationId, userId, { isAdmin = false } = {}) {
  if (isAdmin) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, from_user_id')
      .eq('conversation_id', conversationId)
      .eq('read_status', false);
    const { data: admins } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('is_portal_admin', true);
    const adminIds = new Set((admins || []).map(a => a.user_id));
    const customerMsgIds = (msgs || [])
      .filter(m => !adminIds.has(m.from_user_id))
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

export async function getUnreadCount(userId, { isAdmin = false } = {}) {
  if (isAdmin) {
    const { data, error } = await supabase.rpc('get_admin_unread_count');
    if (error) return 0;
    return data || 0;
  }
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
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

export function subscribeToMessages(conversationId, onMessage) {
  return supabase
    .channel(`messages:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    }, payload => onMessage(payload.new))
    .subscribe();
}

export function isProfileComplete(fields = {}) {
  return !!(fields.name?.trim() && fields.company?.trim() && fields.phone?.trim());
}

export async function saveProfile(userId, email, fields) {
  const payload = {
    user_id: userId,
    email,
    updated_at: new Date().toISOString(),
  };
  if (fields.username !== undefined) payload.username = fields.username;
  if (fields.name !== undefined) payload.name = fields.name;
  if (fields.company !== undefined) payload.company = fields.company;
  if (fields.phone !== undefined) payload.phone = fields.phone;
  if (fields.bio !== undefined) payload.bio = fields.bio;
  if (fields.profile_avatar_url !== undefined) payload.profile_avatar_url = fields.profile_avatar_url;
  if (fields.user_type !== undefined) payload.user_type = fields.user_type;
  if (fields.role !== undefined) payload.role = fields.role;
  if (fields.is_portal_admin !== undefined) payload.is_portal_admin = fields.is_portal_admin;
  if (fields.preferred_appointment_at !== undefined) payload.preferred_appointment_at = fields.preferred_appointment_at;
  if (fields.appointment_notes !== undefined) payload.appointment_notes = fields.appointment_notes;

  const { error } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'user_id' });
  return !error;
}

export async function checkUsernameAvailable(username, currentUserId) {
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('username', username.toLowerCase())
    .maybeSingle();
  if (!data) return true;
  return data.user_id === currentUserId;
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

export async function submitInterestToSupport(userId, { form, interests, userType, masterPricingInterest = false }) {
  const convo = await getOrCreateSupportConversation(userId);
  const itemsList = interests.map(i =>
    `• ${i.brandName} — ${i.productName}\n  ${i.flavor} · Qty ${i.qty || 1} ${i.orderMode === 'pallet' ? 'pallet(s)' : 'case(s)'}`
  ).join('\n');
  const text = [
    'New interest list submitted',
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

export function redactProfileContacts(profile, { contactRevealed, isSelf }) {
  if (!profile) return profile;
  if (contactRevealed || isSelf) return profile;
  const { email, phone, ...rest } = profile;
  return { ...rest, email: null, phone: null };
}
