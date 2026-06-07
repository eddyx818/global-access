import { supabase } from './supabase';
import { parseInquiryInterests } from './inquiries';

export const PRICE_CHECK_STATUSES = [
  { id: 'new', label: 'New', color: '#C9A84C' },
  { id: 'in_review', label: 'In review', color: '#7B6CF6' },
  { id: 'answered', label: 'Answered', color: '#4CAF7D' },
  { id: 'closed', label: 'Closed', color: '#AAA' },
];

export function priceCheckStatusMeta(status) {
  return PRICE_CHECK_STATUSES.find(s => s.id === status) || PRICE_CHECK_STATUSES[0];
}

export function parsePriceCheckInterests(raw) {
  return parseInquiryInterests(raw);
}

export async function fetchRecentPriceChecks(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('staff_price_checks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return data || [];
  } catch (_) {
    return [];
  }
}

export async function createStaffPriceCheckRecord({
  staffUserId,
  interests,
  userType,
  notes = '',
  conversationId = null,
  messageId = null,
}) {
  try {
    const { data, error } = await supabase
      .from('staff_price_checks')
      .insert({
        staff_user_id: staffUserId,
        interests,
        user_type: userType || 'retailer',
        notes: notes?.trim() || null,
        conversation_id: conversationId,
        message_id: messageId,
        status: 'new',
      })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: data };
  } catch (err) {
    return { ok: false, error: err?.message || 'Could not save price check.' };
  }
}

export async function updatePriceCheckStatus(checkId, status) {
  const { data, error } = await supabase.rpc('update_staff_price_check_status', {
    p_check_id: checkId,
    p_status: status,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: !!data };
}

export async function deletePriceCheck(checkId) {
  if (!checkId) return { ok: false, error: 'Not found.' };
  const { error } = await supabase.from('staff_price_checks').delete().eq('id', checkId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
