import { supabase } from './supabase';
import { BRANDS } from './data';
import { validateHexColor, parseJsonField } from './design';

const VALID_FONT_FAMILIES = ['modern', 'bold', 'elegant', 'playful'];
const VALID_BUTTON_STYLES = ['rounded', 'pill', 'square'];
const VALID_HEADER_STYLES = ['hero', 'compact', 'minimal'];
const VALID_CARD_STYLES = ['flat', 'elevated', 'bordered'];
const VALID_GRID_COLUMNS = [1, 2, 3];
const VALID_ASSET_TYPES = ['logo', 'hero', 'product'];
const VALID_NAV_ACTIONS = ['add', 'remove', 'reorder'];

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

async function getCustomBrandIds() {
  const raw = await getSiteSetting('custom_brands');
  if (!raw) return [];
  try { return JSON.parse(raw).map(b => b.id); } catch { return []; }
}

async function validateBrandId(brandId) {
  const customIds = await getCustomBrandIds();
  if (!BRANDS.find(b => b.id === brandId) && !customIds.includes(brandId)) {
    throw new Error(`Unknown brand: ${brandId}`);
  }
}

function pickDefined(obj, keys) {
  const out = {};
  keys.forEach(k => { if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') out[k] = obj[k]; });
  return out;
}

async function mergeSiteSettingJson(key, partial) {
  const raw = await getSiteSetting(key);
  const current = raw ? parseJsonField(raw, {}) : {};
  const merged = { ...current, ...partial };
  await saveSiteSetting(key, merged);
  return merged;
}

async function mergeBrandLayout(brandId, partial) {
  const { data: existing } = await supabase.from('brand_content').select('layout_config').eq('brand_id', brandId).single();
  const current = parseJsonField(existing?.layout_config, {});
  const merged = { ...current, ...pickDefined(partial, ['header_style', 'grid_columns', 'card_style']) };
  if (partial.grid_columns !== undefined) merged.grid_columns = Number(partial.grid_columns);
  const { error } = await supabase.from('brand_content').upsert({
    brand_id: brandId,
    layout_config: JSON.stringify(merged),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'brand_id' });
  if (error) throw new Error(error.message);
  return merged;
}

export async function executeAdminAction(action, data) {
  switch (action) {
    case 'update_hero_section': {
      const section = data.section || 'home';
      if (section !== 'home') throw new Error(`Unsupported section: ${section}`);
      validateHexColor(data.background_color, 'background_color');
      validateHexColor(data.cta_color, 'cta_color');
      await mergeSiteSettingJson('hero_config', pickDefined(data, [
        'background_color', 'headline', 'subheadline', 'cta_text', 'cta_color',
      ]));
      break;
    }

    case 'update_global_styles': {
      if (data.font_family && !VALID_FONT_FAMILIES.includes(data.font_family)) {
        throw new Error(`font_family must be one of: ${VALID_FONT_FAMILIES.join(', ')}`);
      }
      if (data.button_style && !VALID_BUTTON_STYLES.includes(data.button_style)) {
        throw new Error(`button_style must be one of: ${VALID_BUTTON_STYLES.join(', ')}`);
      }
      validateHexColor(data.primary_color, 'primary_color');
      validateHexColor(data.secondary_color, 'secondary_color');
      await mergeSiteSettingJson('global_styles', pickDefined(data, [
        'primary_color', 'secondary_color', 'font_family', 'button_style',
      ]));
      break;
    }

    case 'update_brand_page_layout': {
      if (!data.brand_id) throw new Error('brand_id is required');
      await validateBrandId(data.brand_id);
      if (data.header_style && !VALID_HEADER_STYLES.includes(data.header_style)) {
        throw new Error(`header_style must be one of: ${VALID_HEADER_STYLES.join(', ')}`);
      }
      if (data.grid_columns !== undefined && !VALID_GRID_COLUMNS.includes(Number(data.grid_columns))) {
        throw new Error('grid_columns must be 1, 2, or 3');
      }
      if (data.card_style && !VALID_CARD_STYLES.includes(data.card_style)) {
        throw new Error(`card_style must be one of: ${VALID_CARD_STYLES.join(', ')}`);
      }
      await mergeBrandLayout(data.brand_id, data);
      break;
    }

    case 'upload_brand_asset': {
      if (!data.brand_id) throw new Error('brand_id is required');
      await validateBrandId(data.brand_id);
      if (!VALID_ASSET_TYPES.includes(data.asset_type)) {
        throw new Error(`asset_type must be one of: ${VALID_ASSET_TYPES.join(', ')}`);
      }
      if (!data.file_url || !/^https?:\/\//.test(data.file_url)) {
        throw new Error('file_url must be a valid http(s) URL');
      }
      if (data.asset_type === 'product') {
        if (!data.sku) throw new Error('sku is required for product assets');
        const { error } = await supabase.from('product_content').upsert({
          brand_id: data.brand_id,
          sku: data.sku,
          image_url: data.file_url,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'sku' });
        if (error) throw new Error(error.message);
      } else if (data.asset_type === 'hero') {
        const { error } = await supabase.from('brand_gallery').insert({
          brand_id: data.brand_id,
          image_url: data.file_url,
          sort_order: 0,
        });
        if (error) throw new Error(error.message);
      } else if (data.asset_type === 'logo') {
        const { error } = await supabase.from('brand_content').upsert({
          brand_id: data.brand_id,
          logo_url: data.file_url,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'brand_id' });
        if (error) throw new Error(error.message);
      }
      break;
    }

    case 'update_navigation': {
      if (!VALID_NAV_ACTIONS.includes(data.action)) {
        throw new Error(`action must be one of: ${VALID_NAV_ACTIONS.join(', ')}`);
      }
      const raw = await getSiteSetting('navigation');
      let nav = raw ? parseJsonField(raw, []) : [];

      if (data.action === 'add') {
        if (!data.label || !data.url) throw new Error('label and url are required for add');
        const id = data.item_id || data.label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (nav.find(i => i.id === id)) throw new Error(`Nav item "${id}" already exists`);
        nav.splice(data.position ?? nav.length, 0, { id, label: data.label, url: data.url });
      } else if (data.action === 'remove') {
        if (!data.item_id) throw new Error('item_id is required for remove');
        nav = nav.filter(i => i.id !== data.item_id);
      } else if (data.action === 'reorder') {
        if (!data.item_id || data.position === undefined) throw new Error('item_id and position are required for reorder');
        const idx = nav.findIndex(i => i.id === data.item_id);
        if (idx === -1) throw new Error(`Nav item not found: ${data.item_id}`);
        const [item] = nav.splice(idx, 1);
        nav.splice(Math.min(data.position, nav.length), 0, item);
      }

      if (data.label && data.item_id && data.action !== 'add') {
        nav = nav.map(i => i.id === data.item_id
          ? { ...i, label: data.label, ...(data.url ? { url: data.url } : {}) }
          : i);
      }

      await saveSiteSetting('navigation', nav);
      break;
    }

    default:
      throw new Error(`Unknown design action: ${action}`);
  }
}

export const DESIGN_ACTIONS = [
  'update_hero_section',
  'update_global_styles',
  'update_brand_page_layout',
  'upload_brand_asset',
  'update_navigation',
];

export function isDesignAction(action) {
  return DESIGN_ACTIONS.includes(action);
}
