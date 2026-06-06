import { supabase } from './supabase';
import { getPortalSessionToken } from './session';

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

export async function fetchOnlineUsers() {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, username, name, company, role, status, profile_avatar_url, last_active_at')
    .eq('status', 'online')
    .gte('last_active_at', since)
    .order('last_active_at', { ascending: false });
  return data || [];
}

export async function fetchConversations(userId) {
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .contains('participant_user_ids', [userId])
    .order('last_message_at', { ascending: false });
  return data || [];
}

export async function fetchMessages(conversationId) {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  return data || [];
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

export async function sendMessage({ conversationId, fromUserId, toUserId, content, isGroup = false }) {
  const trimmed = content?.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      from_user_id: fromUserId,
      to_user_id: isGroup ? null : toUserId,
      content: trimmed,
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

export function getConversationTitle(convo, profiles, currentUserId) {
  if (convo.is_group) {
    return convo.group_name || 'Group chat';
  }
  const otherId = convo.participant_user_ids.find(id => id !== currentUserId);
  const p = profiles[otherId] || {};
  return p.username || p.name || 'User';
}

export function isGroupConversation(convo) {
  return !!convo?.is_group;
}

export async function markMessagesRead(conversationId, userId) {
  await supabase
    .from('messages')
    .update({ read_status: true })
    .eq('conversation_id', conversationId)
    .eq('to_user_id', userId)
    .eq('read_status', false);
}

export async function getUnreadCount(userId) {
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
