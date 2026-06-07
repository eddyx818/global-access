import { supabase } from './supabase';
import { parseInquiryInterests } from './inquiries';

export const PRICE_CHECK_STATUSES = [
  { id: 'new', label: 'New', color: '#C9A84C' },
  { id: 'in_review', label: 'In review', color: '#7B6CF6' },
  { id: 'approved', label: 'Approved', color: '#4CAF7D' },
  { id: 'closed', label: 'Closed', color: '#AAA' },
];

export function priceCheckStatusMeta(status) {
  const normalized = status === 'answered' ? 'approved' : status;
  return PRICE_CHECK_STATUSES.find(s => s.id === normalized) || PRICE_CHECK_STATUSES[0];
}

export function isPriceCheckEditable(status) {
  const s = status === 'answered' ? 'approved' : (status || 'new');
  return s !== 'approved' && s !== 'closed';
}

export function parsePriceCheckInterests(raw) {
  return parseInquiryInterests(raw);
}

export function serializePriceCheckInterests(interests = []) {
  return (interests || []).map(i => ({
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
}

export function countNewPriceChecks(rows = []) {
  return rows.filter(c => {
    const s = c.status === 'answered' ? 'approved' : (c.status || 'new');
    return s === 'new';
  }).length;
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
  accountName = '',
  targetRates = '',
  customerUserId = null,
  conversationId = null,
  messageId = null,
  source = 'catalog',
}) {
  try {
    const { data, error } = await supabase
      .from('staff_price_checks')
      .insert({
        staff_user_id: staffUserId,
        interests: interests || [],
        user_type: userType || 'retailer',
        notes: notes?.trim() || null,
        account_name: accountName?.trim() || null,
        target_rates: targetRates?.trim() || null,
        customer_user_id: customerUserId,
        conversation_id: conversationId,
        message_id: messageId,
        source: source || 'catalog',
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
  const normalized = status === 'answered' ? 'approved' : status;
  const { data, error } = await supabase.rpc('update_staff_price_check_status', {
    p_check_id: checkId,
    p_status: normalized,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: !!data };
}

export async function updatePriceCheckFields(checkId, fields) {
  const { data, error } = await supabase.rpc('update_staff_price_check', {
    p_check_id: checkId,
    p_account_name: fields.accountName ?? null,
    p_user_type: fields.userType ?? null,
    p_notes: fields.notes ?? null,
    p_target_rates: fields.targetRates ?? null,
    p_interests: fields.interests != null ? fields.interests : null,
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
