import { supabase } from './supabase';

export async function subscribeStockNotify({ brandId, sku, flavor, brandName, productName, email }) {
  const { data, error } = await supabase.rpc('subscribe_stock_notify', {
    p_brand_id: brandId,
    p_sku: sku,
    p_flavor: flavor.replace(' — SOLD OUT', '').trim(),
    p_brand_name: brandName || null,
    p_product_name: productName || null,
    p_email: email || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: !!data };
}

export async function fetchMyStockAlerts(userId) {
  if (!userId) return [];
  const { data } = await supabase
    .from('stock_notify_requests')
    .select('sku, flavor')
    .eq('user_id', userId)
    .is('notified_at', null);
  return data || [];
}

export function stockAlertKey(sku, flavor) {
  return `${sku}::${flavor.replace(' — SOLD OUT', '').trim()}`;
}
