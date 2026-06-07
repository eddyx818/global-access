import { supabase } from './supabase';

export const QUOTE_STATUSES = [
  { id: 'new', label: 'New', color: '#C9A84C' },
  { id: 'in_review', label: 'In review', color: '#7B6CF6' },
  { id: 'quoted', label: 'Quoted', color: '#4CAF7D' },
  { id: 'closed', label: 'Closed', color: '#AAA' },
];

export function quoteStatusMeta(status) {
  return QUOTE_STATUSES.find(s => s.id === status) || QUOTE_STATUSES[0];
}

export async function fetchLatestInquiryForUser(userId) {
  if (!userId) return null;
  const { data } = await supabase
    .from('inquiries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function updateInquiryQuoteStatus(inquiryId, status) {
  const { data, error } = await supabase.rpc('update_inquiry_quote_status', {
    p_inquiry_id: inquiryId,
    p_status: status,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: !!data };
}

export async function fetchRecentInquiries(limit = 50) {
  const { data } = await supabase
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

/** interests column may be JSONB or a legacy JSON string */
export function parseInquiryInterests(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}
