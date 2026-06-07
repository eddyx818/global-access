import { supabase } from './supabase';
import { BRANDS } from './data';
import { executeAdminAction, isDesignAction } from './adminActions';
import { commercePayloadFromForm } from './pricing';

async function getSiteSetting(key) {
  const { data } = await supabase.from('site_settings').select('value').eq('key', key).single();
  return data?.value ?? null;
}

async function saveSiteSetting(key, value) {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  const { error } = await supabase.from('site_settings').upsert(
    { key, value: str, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) throw new Error(error.message);
}

async function getCustomBrands() {
  const raw = await getSiteSetting('custom_brands');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

async function validateBrandId(brandId) {
  const custom = await getCustomBrands();
  if (!BRANDS.find(b => b.id === brandId) && !custom.find(b => b.id === brandId)) {
    throw new Error(`Unknown brand: ${brandId}`);
  }
}

async function appendProductToCustomBrand(brandId, product) {
  const custom = await getCustomBrands();
  const idx = custom.findIndex(b => b.id === brandId);
  if (idx === -1) return;

  const brand = custom[idx];
  const exists = brand.products?.find(p => p.sku === product.sku);
  if (exists) {
    brand.products = brand.products.map(p => p.sku === product.sku ? { ...p, ...product } : p);
  } else {
    brand.products = [...(brand.products || []), product];
  }
  custom[idx] = brand;
  await saveSiteSetting('custom_brands', custom);
}

export async function createProduct(data) {
  if (!data.brand_id || !data.sku || !data.name) {
    throw new Error('brand_id, sku, and name are required');
  }
  await validateBrandId(data.brand_id);

  const payload = {
    brand_id: data.brand_id,
    sku: data.sku,
    name: data.name,
    detail: data.detail || null,
    category: data.category || null,
    price_retail: data.price_retail ?? null,
    price_wholesale: data.price_wholesale ?? null,
    image_url: data.images?.[0] || data.image_url || null,
    order_unit: data.order_unit || 'master_case',
    created_by_ai: true,
    source_file_id: data.source_file_id || null,
    updated_at: new Date().toISOString(),
  };
  if (data.flavors_retail) payload.flavors_retail = JSON.stringify(data.flavors_retail);
  if (data.flavors_distro) payload.flavors_distro = JSON.stringify(data.flavors_distro);
  Object.assign(payload, commercePayloadFromForm(data));

  const { error } = await supabase.from('product_content').upsert(payload, { onConflict: 'sku' });
  if (error) throw new Error(error.message);

  const productDef = {
    sku: data.sku,
    name: data.name,
    detail: data.detail || '',
    orderUnit: data.order_unit || 'master_case',
    image: payload.image_url,
    flavors_retail: data.flavors_retail || [],
    flavors_distro: data.flavors_distro || [],
  };
  await appendProductToCustomBrand(data.brand_id, productDef);
}

export async function bulkImportProducts(data) {
  if (!Array.isArray(data.products) || !data.products.length) {
    throw new Error('products array is required');
  }
  let created = 0;
  let skipped = 0;

  for (const row of data.products) {
    if (!row.brand_id || !row.sku || !row.name) { skipped++; continue; }

    if (!data.overwrite_existing) {
      const { data: existing } = await supabase.from('product_content').select('sku').eq('sku', row.sku).maybeSingle();
      if (existing) { skipped++; continue; }
    }

    await createProduct({
      ...row,
      flavors_retail: row.flavors_retail || (row.flavors ? row.flavors.split('|').map(s => s.trim()) : []),
      flavors_distro: row.flavors_distro || row.flavors_retail || [],
      source_file_id: data.source_file_id,
    });
    created++;
  }

  return { created, skipped };
}

export async function queryDatabase(data) {
  const type = data.query_type || 'analytics';
  const since = data.date_range?.start || new Date(Date.now() - 7 * 86400000).toISOString();

  if (type === 'analytics') {
    const [views, clicks, inquiries, activity] = await Promise.all([
      supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view').gte('created_at', since),
      supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'click').gte('created_at', since),
      supabase.from('inquiries').select('*', { count: 'exact', head: true }).gte('created_at', since),
      supabase.from('user_activity').select('*', { count: 'exact', head: true }).gte('created_at', since),
    ]);
    return {
      page_views: views.count || 0,
      clicks: clicks.count || 0,
      inquiries: inquiries.count || 0,
      activity_events: activity.count || 0,
      since,
    };
  }

  if (type === 'users') {
    const { data: profiles, count } = await supabase.from('user_profiles').select('*', { count: 'exact' });
    const online = (profiles || []).filter(p => p.status === 'online').length;
    return { total_users: count || profiles?.length || 0, online_now: online };
  }

  if (type === 'inventory') {
    const { data: products } = await supabase.from('product_content').select('sku, brand_id, name, category');
    return { product_count: products?.length || 0, products: products || [] };
  }

  if (type === 'orders') {
    const { data: inqs } = await supabase.from('inquiries').select('id, name, company, created_at').order('created_at', { ascending: false }).limit(20);
    return { recent_inquiries: inqs || [] };
  }

  throw new Error(`Unknown query_type: ${type}`);
}

export async function checkSystem() {
  const checks = {};
  const now = Date.now();

  try {
    const start = Date.now();
    const { error } = await supabase.from('site_settings').select('key').limit(1);
    checks.database = { ok: !error, latency_ms: Date.now() - start, error: error?.message };
  } catch (e) {
    checks.database = { ok: false, error: e.message };
  }

  try {
    const start = Date.now();
    const res = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: process.env.REACT_APP_SUPABASE_ANON_KEY },
    });
    checks.api = { ok: res.ok, latency_ms: Date.now() - start, status: res.status };
  } catch (e) {
    checks.api = { ok: false, error: e.message };
  }

  checks.cdn = { ok: true, note: 'Static assets served via Vercel + Supabase Storage' };
  checks.server = { ok: true, checked_at: new Date(now).toISOString() };

  return checks;
}

export const EXTENDED_ACTIONS = [
  'create_product',
  'bulk_import',
  'analyze_image',
  'parse_document',
  'query_database',
  'check_system',
  'generate_preview',
];

export function isExtendedAction(action) {
  return EXTENDED_ACTIONS.includes(action);
}

export async function executeExtendedAction(action, data) {
  switch (action) {
    case 'create_product':
      await createProduct(data);
      break;
    case 'bulk_import':
      return await bulkImportProducts(data);
    case 'query_database':
      return await queryDatabase(data);
    case 'check_system':
      return await checkSystem();
    case 'analyze_image':
    case 'parse_document':
      throw new Error(`${action} is handled during analysis — no separate execute step`);
    case 'generate_preview':
      break;
    default:
      throw new Error(`Unknown extended action: ${action}`);
  }
}

export async function executeAllAdminActions(action, data) {
  if (isDesignAction(action)) return executeAdminAction(action, data);
  if (isExtendedAction(action)) return executeExtendedAction(action, data);
  return null;
}
