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
  if (!facts?.length) return [];
  return shuffle(facts);
}

function normalizeStateCode(value) {
  const raw = (value || '').trim().toUpperCase();
  if (!raw) return null;
  return raw.length === 2 ? raw : null;
}

function normalizeFactPayload(payload) {
  const body = (payload.body || '').trim();
  const title = (payload.title || '').trim();
  const source = (payload.source_url || '').trim();
  return {
    category: payload.category,
    title: title || null,
    body,
    state_code: normalizeStateCode(payload.state_code),
    source_url: source || null,
    sort_order: Number(payload.sort_order) || 0,
    is_active: payload.is_active !== false,
  };
}

export async function fetchActiveIndustryFacts() {
  const { data, error } = await supabase
    .from('access_waiting_facts')
    .select('id, category, title, body, state_code, source_url, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: false })
    .order('created_at', { ascending: false });

  if (error || !data?.length) {
    return {
      ok: true,
      rows: FALLBACK_INDUSTRY_FACTS,
      fromFallback: true,
      error: error?.message,
    };
  }

  return { ok: true, rows: data, fromFallback: false };
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
  const normalized = normalizeFactPayload(payload);
  if (normalized.body.length < 10) {
    return { ok: false, error: 'Fact must be at least 10 characters.' };
  }
  if ((payload.state_code || '').trim() && !normalized.state_code) {
    return { ok: false, error: 'State must be a 2-letter code (e.g. TX) or left blank.' };
  }
  const { error } = await supabase.from('access_waiting_facts').insert({
    ...normalized,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateIndustryFact(id, payload) {
  const normalized = normalizeFactPayload(payload);
  if (normalized.body.length < 10) {
    return { ok: false, error: 'Fact must be at least 10 characters.' };
  }
  if ((payload.state_code || '').trim() && !normalized.state_code) {
    return { ok: false, error: 'State must be a 2-letter code (e.g. TX) or left blank.' };
  }
  const { error } = await supabase.from('access_waiting_facts').update({
    ...normalized,
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
