import { supabase } from './supabase';

export const INDUSTRY_FACT_CATEGORIES = [
  { id: 'compliance', label: 'Compliance' },
  { id: 'law_federal', label: 'Federal law' },
  { id: 'law_state', label: 'State law' },
  { id: 'tobacco', label: 'Tobacco' },
  { id: 'hemp_thc', label: 'Hemp / THC' },
  { id: 'vape', label: 'Vape' },
  { id: 'beverages', label: 'Beverages' },
  { id: 'functional', label: 'Functional products' },
  { id: 'market', label: 'Market insight' },
  { id: 'distribution', label: 'Distribution' },
];

export function categoryLabel(categoryId) {
  return INDUSTRY_FACT_CATEGORIES.find((c) => c.id === categoryId)?.label || categoryId;
}

/** Built-in fallback if Supabase table is not migrated yet. */
export const FALLBACK_INDUSTRY_FACTS = [
  {
    id: 'fallback-1',
    category: 'compliance',
    title: 'Account review',
    body: 'Wholesale access requires verified business credentials. We review licenses and resale certificates to keep product in legitimate retail channels.',
    state_code: null,
    source_url: null,
  },
  {
    id: 'fallback-2',
    category: 'law_state',
    title: 'State rules vary',
    body: 'Tobacco, hemp, and alternative product laws differ by state — what ships legally to one market may be restricted in another. Compliance is part of every order.',
    state_code: null,
    source_url: null,
  },
  {
    id: 'fallback-3',
    category: 'distribution',
    title: 'Authorized brands only',
    body: 'Global Access focuses on real brands with traceable supply — not show-floor knockoffs. That protects your store and your customers.',
    state_code: null,
    source_url: null,
  },
];

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function shuffleFacts(facts) {
  return shuffle(facts);
}

export async function fetchActiveIndustryFacts() {
  const { data, error } = await supabase
    .from('access_waiting_facts')
    .select('id, category, title, body, state_code, source_url, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === 'PGRST205' || /access_waiting_facts/i.test(error.message || '')) {
      return { ok: true, rows: FALLBACK_INDUSTRY_FACTS, fromFallback: true };
    }
    return { ok: false, error: error.message, rows: FALLBACK_INDUSTRY_FACTS, fromFallback: true };
  }

  const rows = data?.length ? data : FALLBACK_INDUSTRY_FACTS;
  return { ok: true, rows, fromFallback: !data?.length };
}

export async function fetchAllIndustryFactsAdmin() {
  const { data, error } = await supabase
    .from('access_waiting_facts')
    .select('*')
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return { ok: false, error: error.message, rows: [] };
  return { ok: true, rows: data || [] };
}

export async function createIndustryFact(payload) {
  const { error } = await supabase.from('access_waiting_facts').insert({
    category: payload.category,
    title: payload.title?.trim() || null,
    body: payload.body.trim(),
    state_code: payload.state_code?.trim().toUpperCase() || null,
    source_url: payload.source_url?.trim() || null,
    sort_order: Number(payload.sort_order) || 0,
    is_active: payload.is_active !== false,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateIndustryFact(id, payload) {
  const { error } = await supabase.from('access_waiting_facts').update({
    category: payload.category,
    title: payload.title?.trim() || null,
    body: payload.body.trim(),
    state_code: payload.state_code?.trim().toUpperCase() || null,
    source_url: payload.source_url?.trim() || null,
    sort_order: Number(payload.sort_order) || 0,
    is_active: !!payload.is_active,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteIndustryFact(id) {
  const { error } = await supabase.from('access_waiting_facts').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setIndustryFactActive(id, isActive) {
  const { error } = await supabase.from('access_waiting_facts').update({
    is_active: isActive,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
