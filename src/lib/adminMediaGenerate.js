import { supabase } from './supabase';
import { executeAdminAction } from './adminActions';
import { BRANDS } from './data';

export async function callGenerateMedia(payload) {
  const { data: { user } } = await supabase.auth.getUser();
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

  const res = await fetch(`${supabaseUrl}/functions/v1/admin-generate-media`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ ...payload, user_id: user?.id }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Media generation failed');
  return data;
}

export async function applyGeneratedMedia(data) {
  const apply = data.apply_to;
  if (!apply?.asset_type || !apply.brand_id) {
    throw new Error('apply_to.asset_type and apply_to.brand_id are required');
  }
  if (!data.file_url) throw new Error('file_url is required');

  await executeAdminAction('upload_brand_asset', {
    brand_id: apply.brand_id,
    asset_type: apply.asset_type,
    file_url: data.file_url,
    sku: apply.sku,
  });
}

export function buildBrandContext(brandId, sku) {
  const brand = BRANDS.find(b => b.id === brandId);
  const product = brand?.products?.find(p => p.sku === sku);
  return {
    brand_id: brandId,
    brand_name: brand?.name,
    sku,
    product_name: product?.name,
  };
}
