import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { supabase } from './supabase';
import { BRANDS } from './data';
import { DEFAULT_GLOBAL_STYLES, parseJsonField } from './design';
import { mergeProductCommerce, commercePayloadFromForm, packPayloadFromForm } from './pricing';

const BrandContentContext = createContext(null);

const CONTENT_SYNC_CHANNEL = 'ga-content-sync';

function safeJsonArray(value, fallback = []) {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseFlavorField(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return safeJsonArray(value, fallback);
  return fallback;
}

/** Tell every open tab + in-app listeners to reload CMS content from Supabase. */
export function notifyContentUpdated(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('ga-content-updated', { detail }));
  try {
    const bc = new BroadcastChannel(CONTENT_SYNC_CHANNEL);
    bc.postMessage({ type: 'content-updated', ...detail });
    bc.close();
  } catch (_) {}
}

export function useBrandContent() {
  const ctx = useContext(BrandContentContext);
  if (!ctx) throw new Error('useBrandContent must be used within BrandContentProvider');
  return ctx;
}

function useBrandContentState() {
  const [brandOverrides, setBrandOverrides] = useState({});
  const [productOverrides, setProductOverrides] = useState({});
  const [galleryOverrides, setGalleryOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [hiddenBrands, setHiddenBrands] = useState([]);
  const [customBrands, setCustomBrands] = useState([]);
  const [bgColor, setBgColor] = useState('#F5F2ED');
  const [heroConfig, setHeroConfig] = useState({});
  const [globalStyles, setGlobalStyles] = useState(DEFAULT_GLOBAL_STYLES);
  const [navigation, setNavigation] = useState([]);
  const [customerChatLabel, setCustomerChatLabel] = useState('');
  const initialLoadDone = useRef(false);

  const loadContentData = useCallback(async () => {
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
  }, []);

  const loadSettingsData = useCallback(async () => {
    try {
      const { data } = await supabase.from('site_settings').select('*');
      if (data) {
        data.forEach(s => {
          if (s.key === 'hidden_brands') setHiddenBrands(safeJsonArray(s.value, []));
          if (s.key === 'custom_brands') setCustomBrands(safeJsonArray(s.value, []));
          if (s.key === 'bg_color') setBgColor(s.value || '#F5F2ED');
          if (s.key === 'hero_config') setHeroConfig(parseJsonField(s.value, {}));
          if (s.key === 'global_styles') setGlobalStyles({ ...DEFAULT_GLOBAL_STYLES, ...parseJsonField(s.value, {}) });
          if (s.key === 'navigation') setNavigation(parseJsonField(s.value, []));
          if (s.key === 'customer_chat_label') setCustomerChatLabel(s.value || '');
        });
      }
    } catch (_) {}
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      await Promise.all([loadContentData(), loadSettingsData()]);
    } finally {
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    }
  }, [loadContentData, loadSettingsData]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  useEffect(() => {
    let debounceTimer;
    const onUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { refreshAll(); }, 250);
    };

    window.addEventListener('ga-content-updated', onUpdate);
    let bc;
    try {
      bc = new BroadcastChannel(CONTENT_SYNC_CHANNEL);
      bc.onmessage = (ev) => {
        if (ev.data?.type === 'content-updated') onUpdate();
      };
    } catch (_) {}

    let channel;
    try {
      channel = supabase
        .channel('ga-content-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'brand_content' }, onUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'product_content' }, onUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'brand_gallery' }, onUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, onUpdate)
        .subscribe();
    } catch (_) {}

    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('ga-content-updated', onUpdate);
      bc?.close();
      if (channel) supabase.removeChannel(channel);
    };
  }, [refreshAll]);

  const loadContent = refreshAll;

  const getMergedBrands = () => {
    const allBrands = [...BRANDS, ...customBrands].filter(b => b?.id && !hiddenBrands.includes(b.id));
    return allBrands.map(brand => {
      const override = brandOverrides[brand.id] || {};
      const products = Array.isArray(brand.products) ? brand.products : [];

      const galleryRecords = galleryOverrides[brand.id] || [];
      const galleryItems = galleryRecords
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(g => g.image_url)
        .filter(url => isHttpsImageUrl(url));

      const productImageBySku = Object.fromEntries(
        products.map(p => [p.sku, (productOverrides[p.sku] || {}).image_url]).filter(([, url]) => url)
      );
      const httpsPool = buildHttpsImagePool(galleryRecords, productImageBySku);

      const uploadedProductImages = products
        .map(p => resolveProductImageUrl(p.image, p.sku, productImageBySku, httpsPool))
        .filter(url => isHttpsImageUrl(url));

      const supersededGalleryPaths = new Set(
        products
          .filter(p => {
            const resolved = resolveProductImageUrl(p.image, p.sku, productImageBySku, httpsPool);
            return p.image && isHttpsImageUrl(resolved);
          })
          .map(p => p.image)
      );

      const resolvedBuiltInGallery = (brand.gallery || [])
        .map(path => resolveImageFromPool(path, httpsPool))
        .filter(isHttpsImageUrl);

      const finalGallery = [...new Set([
        ...galleryItems,
        ...uploadedProductImages,
        ...resolvedBuiltInGallery.filter(url => !supersededGalleryPaths.has(url)),
      ])].filter(Boolean);

      const featuredUrls = galleryRecords
        .filter(g => g.catalog_featured && isHttpsImageUrl(g.image_url))
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(g => g.image_url);
      const catalogGallery = featuredUrls.length
        ? pickRotatingCatalogPhotos(featuredUrls, brand.id)
        : finalGallery;

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
        catalogGallery,
        products: products.map(product => {
          const po = productOverrides[product.sku] || {};
          const mergedImage = resolveProductImageUrl(
            product.image,
            product.sku,
            productImageBySku,
            httpsPool,
          ) || (isHttpsImageUrl(po.image_url) ? po.image_url : null);
          return mergeProductCommerce({
            ...product,
            name: po.name || product.name,
            detail: po.detail || product.detail,
            image: mergedImage,
            orderUnit: po.order_unit || product.orderUnit,
            flavors_retail: parseFlavorField(po.flavors_retail, product.flavors_retail),
            flavors_distro: parseFlavorField(po.flavors_distro, product.flavors_distro),
          }, po);
        }),
      };
    });
  };

  return { getMergedBrands, loadContent, loading, brandOverrides, productOverrides, bgColor, heroConfig, globalStyles, navigation, customerChatLabel };
}

export function BrandContentProvider({ children }) {
  const value = useBrandContentState();
  return (
    <BrandContentContext.Provider value={value}>
      {children}
    </BrandContentContext.Provider>
  );
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
  if (!error) notifyContentUpdated();
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
  else notifyContentUpdated();
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

export async function uploadGalleryImage(brandId, file, { products = [] } = {}) {
  const ext = file.name.split('.').pop().toLowerCase();
  const stem = (file.name.replace(/\.[^.]+$/, '') || 'photo')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(0, 64);
  const path = `${brandId}/gallery-${stem}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('brand-images').upload(path, file, { upsert: true, contentType: file.type });
  if (error) return null;
  const { data } = supabase.storage.from('brand-images').getPublicUrl(path);
  const url = data.publicUrl;
  await supabase.from('brand_gallery').insert({ brand_id: brandId, image_url: url, sort_order: Date.now() });

  const uploadKey = imageFileKey(file.name);
  const stemNorm = stem.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (products.length) {
    const match = products.find((p) => {
      const key = imageFileKey(p.image);
      if (uploadKey && key && (key === uploadKey || key.includes(uploadKey) || uploadKey.includes(key))) {
        return true;
      }
      const skuNorm = p.sku.toLowerCase().replace(/[^a-z0-9]/g, '');
      const skuRaw = p.sku.toLowerCase();
      return (skuNorm.length >= 3 && stemNorm.includes(skuNorm))
        || (skuRaw.length >= 3 && stem.toLowerCase().includes(skuRaw));
    });
    if (match) {
      await supabase.from('product_content').upsert({
        brand_id: brandId,
        sku: match.sku,
        image_url: url,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'sku' });
    }
  }

  notifyContentUpdated();
  return url;
}

export async function deleteGalleryImage(id) {
  await supabase.from('brand_gallery').delete().eq('id', id);
  notifyContentUpdated();
}

export async function setGalleryCatalogFeatured(id, featured) {
  const { error } = await supabase
    .from('brand_gallery')
    .update({ catalog_featured: !!featured })
    .eq('id', id);
  if (!error) notifyContentUpdated();
  return { ok: !error, error: error?.message };
}

/** Stable shuffle for catalog hero/card photos — rotates every 12 hours per brand. */
export function pickRotatingCatalogPhotos(urls, brandId, bucketHours = 12) {
  const unique = [...new Set((urls || []).filter(isHttpsImageUrl))];
  if (unique.length <= 1) return unique;
  const bucket = Math.floor(Date.now() / (bucketHours * 60 * 60 * 1000));
  let seed = 0;
  const key = `${brandId}:${bucket}`;
  for (let i = 0; i < key.length; i += 1) {
    seed = ((seed << 5) - seed + key.charCodeAt(i)) | 0;
  }
  const arr = [...unique];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    seed = (seed * 1103515245 + 12345) | 0;
    const j = Math.abs(seed) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Resolve /images/... paths for admin preview on the same origin. */
export function resolveBrandImageUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith('/') && typeof window !== 'undefined') {
    return `${window.location.origin}${url}`;
  }
  return url;
}

export function isHttpsImageUrl(url) {
  return !!url && /^https?:\/\//.test(url);
}

/** Normalized filename stem for matching gallery uploads to default product paths. */
export function imageFileKey(url) {
  if (!url) return '';
  return url.split('?')[0].split('/').pop()?.toLowerCase()
    .replace(/\.(jpe?g|png|webp|gif|svg)$/i, '')
    .replace(/[-_+.]+/g, '') || '';
}

export function buildHttpsImagePool(galleryRecords = [], productImageBySku = {}) {
  const pool = [];
  (galleryRecords || []).forEach((g) => {
    if (isHttpsImageUrl(g?.image_url)) pool.push(g.image_url);
  });
  Object.values(productImageBySku).forEach((url) => {
    if (isHttpsImageUrl(url)) pool.push(url);
  });
  return [...new Set(pool)];
}

/** Match a Supabase upload to a built-in /images/... path by filename. */
export function resolveImageFromPool(defaultPath, httpsPool = []) {
  if (!defaultPath || !httpsPool.length) return null;
  if (isHttpsImageUrl(defaultPath)) return defaultPath;
  const key = imageFileKey(defaultPath);
  if (!key) return null;
  const exact = httpsPool.find((u) => imageFileKey(u) === key);
  if (exact) return exact;
  const partial = httpsPool.find((u) => {
    const uk = imageFileKey(u);
    return uk.length >= 4 && (uk.includes(key) || key.includes(uk));
  });
  if (partial) return partial;
  // Substring match for long default stems (e.g. 1000mg-ultra-strawberry-banana)
  for (let size = Math.min(key.length, 14); size >= 6; size -= 1) {
    for (let i = 0; i <= key.length - size; i += 1) {
      const slice = key.slice(i, i + size);
      const hit = httpsPool.find((u) => imageFileKey(u).includes(slice));
      if (hit) return hit;
    }
  }
  return null;
}

function matchPoolBySku(sku, httpsPool = []) {
  if (!sku || !httpsPool.length) return null;
  const lowerSku = sku.toLowerCase();
  const compactSku = lowerSku.replace(/[^a-z0-9]/g, '');
  return httpsPool.find((u) => {
    const lower = u.toLowerCase();
    return lower.includes(`/${lowerSku}-`)
      || lower.includes(`/${lowerSku}.`)
      || lower.includes(`${compactSku}-`)
      || (compactSku.length >= 3 && lower.includes(`gallery-${compactSku}`))
      || (lowerSku.length >= 3 && lower.includes(`gallery-${lowerSku}`));
  }) || null;
}

/** Product card URL: SKU upload → gallery match → filename match. Never returns undeployed /images/ paths. */
export function resolveProductImageUrl(defaultPath, sku, productImageBySku = {}, httpsPool = []) {
  const direct = productImageBySku[sku];
  if (isHttpsImageUrl(direct)) return direct;
  const fromSkuPath = matchPoolBySku(sku, httpsPool);
  if (fromSkuPath) return fromSkuPath;
  const fromPool = resolveImageFromPool(defaultPath, httpsPool);
  if (fromPool) return fromPool;
  if (isHttpsImageUrl(defaultPath)) return defaultPath;
  if (isHttpsImageUrl(direct)) return direct;
  return null;
}

/** Resolve every SKU image for a brand using the same rules as the live customer portal. */
export function buildResolvedProductImages(brand, productImageBySku = {}, galleryRecords = []) {
  const products = brand?.products || [];
  const httpsPool = buildHttpsImagePool(galleryRecords, productImageBySku);
  return Object.fromEntries(
    products.map((p) => {
      const resolved = resolveProductImageUrl(p.image, p.sku, productImageBySku, httpsPool);
      return [p.sku, resolved];
    }).filter(([, url]) => isHttpsImageUrl(url))
  );
}

export function imageBasename(url) {
  if (!url) return 'Photo';
  const file = url.split('?')[0].split('/').pop() || 'Photo';
  return file.replace(/\.(jpe?g|png|webp|gif)$/i, '').replace(/[-_]+/g, ' ');
}

/** Same merge order as customer-facing BrandView gallery strip. */
export function buildVisibleBrandPhotos(brand, { galleryRecords = [], productImageBySku = {}, pendingBySku = {}, productForms = {} } = {}) {
  if (!brand) return { uploadStrip: [], defaultStrip: [], skuCards: [] };

  const builtInGallery = (brand.gallery || []).filter(Boolean);
  const httpsPool = buildHttpsImagePool(galleryRecords, productImageBySku);

  const skuCards = (brand.products || []).map(p => {
    const rawUrl = pendingBySku[p.sku]
      || resolveProductImageUrl(p.image, p.sku, productImageBySku, httpsPool)
      || null;
    const url = rawUrl ? resolveBrandImageUrl(rawUrl) : null;
    const hasUploaded = isHttpsImageUrl(rawUrl);
    const isPending = !!pendingBySku[p.sku];
    const isDefault = !hasUploaded && !isPending && isHttpsImageUrl(p.image);
    return {
      sku: p.sku,
      name: productForms[p.sku]?.name || p.name,
      url,
      rawUrl: rawUrl || null,
      isUploaded: hasUploaded,
      isDefault,
      isEmpty: !url,
      pending: isPending,
    };
  });

  // Built-in paths used as product hero images belong on SKU cards only — not "extra gallery".
  const productDefaultPaths = new Set(
    (brand.products || []).map(p => p.image).filter(Boolean)
  );

  const uploadStrip = [];
  (galleryRecords || [])
    .filter(g => g?.image_url && /^https?:\/\//.test(g.image_url))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .forEach((g) => {
      uploadStrip.push({
        id: `placard-${g.id}`,
        url: resolveBrandImageUrl(g.image_url),
        galleryId: g.id,
        catalogFeatured: !!g.catalog_featured,
        source: 'placard',
        label: 'Placard upload',
      });
    });

  (brand.products || []).forEach(p => {
    const url = resolveProductImageUrl(p.image, p.sku, productImageBySku, httpsPool);
    if (!url || !/^https?:\/\//.test(url)) return;
    const displayUrl = resolveBrandImageUrl(url);
    if (uploadStrip.some(item => item.url === displayUrl)) return;
    uploadStrip.push({
      id: `sku-upload-${p.sku}`,
      url: displayUrl,
      galleryId: null,
      source: 'sku',
      label: `${p.sku} upload`,
      sku: p.sku,
    });
  });

  // Built-in gallery photos not tied to any product card — only show when a real upload exists.
  const defaultStrip = builtInGallery
    .filter(url => !productDefaultPaths.has(url))
    .map((url, index) => {
      const resolved = resolveImageFromPool(url, httpsPool);
      if (!resolved) return null;
      return {
        id: `default-${index}-${url}`,
        url: resolveBrandImageUrl(resolved),
        galleryId: null,
        source: 'default',
        label: imageBasename(url),
      };
    })
    .filter(Boolean);

  return { uploadStrip, defaultStrip, skuCards, legacyStrip: [...uploadStrip, ...defaultStrip] };
}
