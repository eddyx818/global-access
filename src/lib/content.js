import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { BRANDS } from './data';

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

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase.from('site_settings').select('*');
        if (data) {
          data.forEach(s => {
            if (s.key === 'hidden_brands') setHiddenBrands(JSON.parse(s.value || '[]'));
            if (s.key === 'custom_brands') setCustomBrands(JSON.parse(s.value || '[]'));
            if (s.key === 'bg_color') setBgColor(s.value || '#F5F2ED');
          });
        }
      } catch (_) {}
    };
    loadSettings();
  }, []);

  const getMergedBrands = () => {
    const allBrands = [...BRANDS, ...customBrands].filter(b => !hiddenBrands.includes(b.id));
    return allBrands.map(brand => {
      const override = brandOverrides[brand.id] || {};

      // Build gallery: start with hardcoded, add any uploaded images from product_content
      const uploadedProductImages = brand.products
        .map(p => {
          const po = productOverrides[p.sku] || {};
          return po.image_url || null;
        })
        .filter(Boolean);

      // Also include gallery table uploads
      const galleryItems = (galleryOverrides[brand.id] || [])
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(g => g.image_url);

      // Merge: uploaded product images first, then gallery extras, then hardcoded fallbacks
      const allImages = [...new Set([...uploadedProductImages, ...galleryItems, ...brand.gallery])];
      const finalGallery = allImages.filter(Boolean).length > 0 ? allImages.filter(Boolean) : brand.gallery;

      return {
        ...brand,
        tagline: override.tagline || brand.tagline,
        description: override.description || brand.description,
        color: override.color || brand.color,
        fontStyle: override.font_style || 'modern',
        gallery: finalGallery,
        products: brand.products.map(product => {
          const po = productOverrides[product.sku] || {};
          const mergedImage = po.image_url || product.image || null;
          return {
            ...product,
            name: po.name || product.name,
            detail: po.detail || product.detail,
            image: mergedImage,
            orderUnit: po.order_unit || product.orderUnit,
            // Always use saved flavors if they exist, even if empty array
            flavors_retail: po.flavors_retail !== undefined && po.flavors_retail !== null
              ? (typeof po.flavors_retail === 'string' ? JSON.parse(po.flavors_retail) : po.flavors_retail)
              : product.flavors_retail,
            flavors_distro: po.flavors_distro !== undefined && po.flavors_distro !== null
              ? (typeof po.flavors_distro === 'string' ? JSON.parse(po.flavors_distro) : po.flavors_distro)
              : product.flavors_distro,
          };
        }),
      };
    });
  };

  return { getMergedBrands, loadContent, loading, brandOverrides, productOverrides, bgColor };
}

export async function saveBrandContent(brandId, data) {
  const { error } = await supabase.from('brand_content').upsert({
    brand_id: brandId,
    tagline: data.tagline,
    description: data.description,
    font_style: data.fontStyle,
    color: data.color,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'brand_id' });
  return !error;
}

export async function saveProductContent(brandId, sku, data) {
  const payload = {
    brand_id: brandId,
    sku,
    name: data.name || null,
    detail: data.detail || null,
    image_url: data.image_url || null,
    order_unit: data.orderUnit || null,
    updated_at: new Date().toISOString(),
  };
  // Always save flavor fields (even empty arrays) so deletions persist
  payload.flavors_retail = data.flavors_retail ? JSON.stringify(data.flavors_retail) : null;
  payload.flavors_distro = data.flavors_distro ? JSON.stringify(data.flavors_distro) : null;

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
