import { supabase } from './supabase';
import { fetchRepRoster } from './repCodes';

function isCustomerProfile(p) {
  return !p.is_portal_admin && !p.is_sales_rep;
}

function resolveRepId(row, repsByCode) {
  if (row.referred_by_user_id) return row.referred_by_user_id;
  const code = (row.referral_code_used || '').toLowerCase();
  return repsByCode[code]?.user_id || null;
}

function buildLeaderboardFromRows(reps, profiles, requests) {
  const repsByCode = {};
  reps.forEach(r => {
    if (r.rep_code) repsByCode[r.rep_code.toLowerCase()] = r;
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const stats = {};
  reps.forEach(r => {
    stats[r.user_id] = {
      rep_user_id: r.user_id,
      rep_name: r.name || r.company || r.email || 'Rep',
      rep_code: r.rep_code,
      signups_total: 0,
      signups_this_month: 0,
      signups_this_week: 0,
      pending_requests: 0,
    };
  });

  profiles.filter(isCustomerProfile).forEach(p => {
    const repId = resolveRepId(p, repsByCode);
    if (!repId || !stats[repId]) return;
    const created = p.created_at ? new Date(p.created_at) : null;
    stats[repId].signups_total += 1;
    if (created && created >= monthStart) stats[repId].signups_this_month += 1;
    if (created && created >= weekStart) stats[repId].signups_this_week += 1;
  });

  (requests || []).filter(r => r.status === 'pending').forEach(req => {
    const repId = resolveRepId(req, repsByCode);
    if (repId && stats[repId]) stats[repId].pending_requests += 1;
  });

  return Object.values(stats).sort((a, b) => {
    if (b.signups_total !== a.signups_total) return b.signups_total - a.signups_total;
    return (a.rep_name || '').localeCompare(b.rep_name || '');
  });
}

/** Admin-only fallback when RPC migration has not been run yet. */
async function fetchReferralLeaderboardAdminFallback() {
  const reps = await fetchRepRoster();
  const [{ data: profiles }, { data: requests }] = await Promise.all([
    supabase.from('user_profiles').select('user_id, referred_by_user_id, referral_code_used, is_portal_admin, is_sales_rep, created_at'),
    supabase.from('access_requests').select('referred_by_user_id, referral_code_used, status'),
  ]);
  return buildLeaderboardFromRows(reps, profiles || [], requests || []);
}

export async function fetchReferralLeaderboard({ isAdmin = false } = {}) {
  const { data, error } = await supabase.rpc('get_referral_leaderboard');
  if (!error) return data || [];

  if (isAdmin) {
    try {
      return await fetchReferralLeaderboardAdminFallback();
    } catch (_) {}
  }

  if (error?.code === 'PGRST202' || /get_referral_leaderboard/i.test(error?.message || '')) {
    throw new Error('Referral tracker is not set up yet. Run supabase-update-20-referral-stats.sql in the Supabase SQL editor.');
  }
  throw error;
}

export function getReferralTotals(rows) {
  return (rows || []).reduce(
    (acc, row) => ({
      signups: acc.signups + Number(row.signups_total || 0),
      month: acc.month + Number(row.signups_this_month || 0),
      week: acc.week + Number(row.signups_this_week || 0),
      pending: acc.pending + Number(row.pending_requests || 0),
    }),
    { signups: 0, month: 0, week: 0, pending: 0 },
  );
}
