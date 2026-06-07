import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { BRANDS } from './data';
import { DEFAULT_GLOBAL_STYLES, parseJsonField } from './design';
import { mergeProductCommerce, commercePayloadFromForm, packPayloadFromForm } from './pricing';

export function useBrandContent() {
  const [brandOverrides, setBrandOverrides] = useState({});
  const [productOverrides, setProductOverrides] = useState({});
  const [galleryOverrides, setGalleryOverrides] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadContent(); }, []);

  const loadContent = async () => {
    try {
      const [{ data: brands }, { data: products }, { data: galleries }] = await Promise.all([
        supabase.from('brand_content').select('*'),
        supabase.from('product_content').select('*'),
        supabase.from('brand_gallery').select('*'),
      ]);
      if (brands) {
        const m = {};
        brands.forEach(b => { m[b.brand_id] = b; });
        setBrandOverrides(m);
      }
      if (products) {
        const m = {};
        products.forEach(p => { m[p.sku] = p; });
        setProductOverrides(m);
      }
      if (galleries) {
        const m = {};
        galleries.forEach(g => {
          if (!m[g.brand_id]) m[g.brand_id] = [];
          m[g.brand_id].push(g);
        });
        setGalleryOverrides(m);
      }
    } catch (_) {}
    setLoading(false);
  };

  const [hiddenBrands, setHiddenBrands] = useState([]);
  const [customBrands, setCustomBrands] = useState([]);
  const [bgColor, setBgColor] = useState('#F5F2ED');
  const [heroConfig, setHeroConfig] = useState({});
  const [globalStyles, setGlobalStyles] = useState(DEFAULT_GLOBAL_STYLES);
  const [navigation, setNavigation] = useState([]);
  const [customerChatLabel, setCustomerChatLabel] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase.from('site_settings').select('*');
        if (data) {
          data.forEach(s => {
            if (s.key === 'hidden_brands') setHiddenBrands(JSON.parse(s.value || '[]'));
            if (s.key === 'custom_brands') setCustomBrands(JSON.parse(s.value || '[]'));
            if (s.key === 'bg_color') setBgColor(s.value || '#F5F2ED');
            if (s.key === 'hero_config') setHeroConfig(parseJsonField(s.value, {}));
            if (s.key === 'global_styles') setGlobalStyles({ ...DEFAULT_GLOBAL_STYLES, ...parseJsonField(s.value, {}) });
            if (s.key === 'navigation') setNavigation(parseJsonField(s.value, []));
            if (s.key === 'customer_chat_label') setCustomerChatLabel(s.value || '');
          });
        }
      } catch (_) {}
    };
    loadSettings();
    const onUpdate = () => { loadContent(); loadSettings(); };
    window.addEventListener('ga-content-updated', onUpdate);
    return () => window.removeEventListener('ga-content-updated', onUpdate);
  }, []);

  const getMergedBrands = () => {
    const allBrands = [...BRANDS, ...customBrands].filter(b => !hiddenBrands.includes(b.id));
    return allBrands.map(brand => {
      const override = brandOverrides[brand.id] || {};

      // Gallery: admin gallery uploads + Supabase product photos + hardcoded brand photos
      const galleryItems = (galleryOverrides[brand.id] || [])
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(g => g.image_url)
        .filter(url => url && /^https?:\/\//.test(url));

      const uploadedProductImages = brand.products
        .map(p => (productOverrides[p.sku] || {}).image_url)
        .filter(url => url && /^https?:\/\//.test(url));

      const finalGallery = [...new Set([
        ...galleryItems,
        ...uploadedProductImages,
        ...(brand.gallery || []),
      ])].filter(Boolean);

      return {
        ...brand,
        tagline: override.tagline || brand.tagline,
        description: override.description || brand.description,
        color: override.color || brand.color,
        fontStyle: override.font_style || 'modern',
        logoUrl: override.logo_url || null,
        masterPricingMode: override.master_pricing_mode || brand.masterPricingMode || 'auto',
        layout: parseJsonField(override.layout_config, {}),
        gallery: finalGallery,
        products: brand.products.map(product => {
          const po = productOverrides[product.sku] || {};
          const mergedImage = po.image_url || product.image || null;
          return mergeProductCommerce({
            ...product,
            name: po.name || product.name,
            detail: po.detail || product.detail,
            image: mergedImage,
            orderUnit: po.order_unit || product.orderUnit,
            flavors_retail: po.flavors_retail !== undefined && po.flavors_retail !== null
              ? (typeof po.flavors_retail === 'string' ? JSON.parse(po.flavors_retail) : po.flavors_retail)
              : product.flavors_retail,
            flavors_distro: po.flavors_distro !== undefined && po.flavors_distro !== null
              ? (typeof po.flavors_distro === 'string' ? JSON.parse(po.flavors_distro) : po.flavors_distro)
              : product.flavors_distro,
          }, po);
        }),
      };
    });
  };

  return { getMergedBrands, loadContent, loading, brandOverrides, productOverrides, bgColor, heroConfig, globalStyles, navigation, customerChatLabel };
}

export async function saveBrandContent(brandId, data) {
  const { error } = await supabase.from('brand_content').upsert({
    brand_id: brandId,
    tagline: data.tagline,
    description: data.description,
    font_style: data.fontStyle,
    color: data.color,
    master_pricing_mode: data.masterPricingMode || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'brand_id' });
  return !error;
}

export async function saveProductContent(brandId, sku, data) {
  const payload = {
    brand_id: brandId,
    sku,
    updated_at: new Date().toISOString(),
  };
  if (data.name !== undefined) payload.name = data.name || null;
  if (data.detail !== undefined) payload.detail = data.detail || null;
  if (data.image_url !== undefined) payload.image_url = data.image_url || null;
  if (data.orderUnit !== undefined) payload.order_unit = data.orderUnit || null;
  if (data.flavors_retail !== undefined) payload.flavors_retail = JSON.stringify(data.flavors_retail);
  if (data.flavors_distro !== undefined) payload.flavors_distro = JSON.stringify(data.flavors_distro);

  const commerce = commercePayloadFromForm(data);
  for (const [key, value] of Object.entries(commerce)) {
    if (Object.prototype.hasOwnProperty.call(data, key)) payload[key] = value;
  }

  const pack = packPayloadFromForm(data);
  for (const [key, value] of Object.entries(pack)) {
    if (Object.prototype.hasOwnProperty.call(data, key)) payload[key] = value;
  }

  const { error } = await supabase.from('product_content').upsert(payload, { onConflict: 'sku' });
  if (error) console.error('saveProductContent error:', error);
  return !error;
}

export async function uploadBrandImage(brandId, sku, file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${brandId}/${sku}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('brand-images').upload(path, file, { upsert: true, contentType: file.type });
  if (error) { console.error('Upload error:', error); return null; }
  const { data } = supabase.storage.from('brand-images').getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadGalleryImage(brandId, file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${brandId}/gallery-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('brand-images').upload(path, file, { upsert: true, contentType: file.type });
  if (error) return null;
  const { data } = supabase.storage.from('brand-images').getPublicUrl(path);
  const url = data.publicUrl;
  await supabase.from('brand_gallery').insert({ brand_id: brandId, image_url: url, sort_order: Date.now() });
  return url;
}

export async function deleteGalleryImage(id) {
  await supabase.from('brand_gallery').delete().eq('id', id);
}

/** Same merge order as customer-facing BrandView gallery strip. */
export function buildVisibleBrandPhotos(brand, { galleryRecords = [], productImageBySku = {}, pendingBySku = {}, productForms = {} } = {}) {
  if (!brand) return { strip: [], skuCards: [] };

  const galleryUrls = (galleryRecords || [])
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map(g => g.image_url)
    .filter(url => url && /^https?:\/\//.test(url));

  const uploadedProductImages = (brand.products || [])
    .map(p => productImageBySku[p.sku])
    .filter(url => url && /^https?:\/\//.test(url));

  const builtInGallery = (brand.gallery || []).filter(Boolean);

  const stripUrls = [...new Set([...galleryUrls, ...uploadedProductImages, ...builtInGallery])].filter(Boolean);

  const sourceByUrl = {};
  galleryUrls.forEach(url => { sourceByUrl[url] = { source: 'placard', label: 'Placard upload' }; });
  (brand.products || []).forEach(p => {
    const url = productImageBySku[p.sku];
    if (url) sourceByUrl[url] = { source: 'sku', label: p.sku, sku: p.sku };
  });
  builtInGallery.forEach(url => {
    if (!sourceByUrl[url]) sourceByUrl[url] = { source: 'default', label: 'Built-in' };
  });

  const galleryIdByUrl = {};
  (galleryRecords || []).forEach(g => {
    if (g?.image_url) galleryIdByUrl[g.image_url] = g.id;
  });

  const strip = stripUrls.map((url, index) => ({
    id: `strip-${index}-${url}`,
    url,
    galleryId: galleryIdByUrl[url] || null,
    ...(sourceByUrl[url] || { source: 'unknown', label: 'Photo' }),
  }));

  const skuCards = (brand.products || []).map(p => {
    const url = pendingBySku[p.sku] || productImageBySku[p.sku] || p.image || null;
    const hasUploaded = !!productImageBySku[p.sku];
    const isPending = !!pendingBySku[p.sku];
    return {
      sku: p.sku,
      name: productForms[p.sku]?.name || p.name,
      url,
      isUploaded: hasUploaded,
      isDefault: !hasUploaded && !isPending && !!p.image,
      isEmpty: !url,
      pending: isPending,
    };
  });

  return { strip, skuCards };
}
