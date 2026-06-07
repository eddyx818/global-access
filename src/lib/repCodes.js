import { supabase } from './supabase';
import { ACCESS_CODE } from './data';

export function normalizeRepCode(code) {
  return (code || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}

export function generateRepCodeFromName(name, userId) {
  const base = (name || 'rep')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 12) || 'rep';
  const suffix = (userId || '').replace(/-/g, '').slice(0, 4) || Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

export async function validateAccessCode(rawCode) {
  const code = normalizeRepCode(rawCode);
  if (!code) return { valid: false };

  if (code === ACCESS_CODE.toLowerCase()) {
    return { valid: true, type: 'global', repUserId: null, repName: null, code };
  }

  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, name, company, rep_code, is_sales_rep, is_portal_admin')
    .eq('rep_code', code)
    .maybeSingle();

  if (data && (data.is_sales_rep || data.is_portal_admin)) {
    return {
      valid: true,
      type: 'rep',
      repUserId: data.user_id,
      repName: data.name || data.company || 'Sales',
      code,
    };
  }

  return { valid: false };
}

export async function fetchRepRoster() {
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, name, company, email, rep_code, is_sales_rep, is_portal_admin')
    .not('rep_code', 'is', null)
    .order('name', { ascending: true });
  return data || [];
}
