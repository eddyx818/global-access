// eslint-disable-next-line no-unused-vars
import { supabase } from '../lib/supabase';
import React, { useState } from 'react';
import { BRANDS } from '../lib/data';
import {
  saveBrandContent, saveProductContent, uploadBrandImage,
  uploadGalleryImage, deleteGalleryImage, buildVisibleBrandPhotos,
} from '../lib/content';
import { parseCommerceFields, parsePackFields } from '../lib/pricing';
import BrandPhotoPreviewGrid from './BrandPhotoPreviewGrid';
import { useTheme } from '../context/ThemeContext';
import { getAdminUi } from '../lib/theme';

const FONT_STYLES = [
  { id: 'modern', label: 'Modern', font: "'DM Sans', sans-serif", preview: 'Clean & minimal' },
  { id: 'bold', label: 'Bold', font: "'Bebas Neue', sans-serif", preview: 'STRONG & IMPACTFUL' },
  { id: 'elegant', label: 'Elegant', font: "'Playfair Display', serif", preview: 'Refined & luxurious' },
  { id: 'playful', label: 'Playful', font: "'Pacifico', cursive", preview: 'Fun & energetic' },
];

export function getFontFamily(fontStyle) {
  const f = FONT_STYLES.find(f => f.id === fontStyle);
  return f ? f.font : "'DM Sans', sans-serif";
}

export default function ContentEditor({ brandOverrides, productOverrides, onSaved }) {
  const { t } = useTheme();
  const ui = getAdminUi();
  const [selectedBrand, setSelectedBrand] = useState(BRANDS[0]);
  const [brandForm, setBrandForm] = useState({});
  const [productForms, setProductForms] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [uploading, setUploading] = useState({});
  const [galleryItems, setGalleryItems] = useState([]);
  const [pendingStrip, setPendingStrip] = useState([]);
  const [pendingSkuPreview, setPendingSkuPreview] = useState({});
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [activeProductTab, setActiveProductTab] = useState('details'); // 'details' | 'flavors' | 'pricing'
  const fileRefs = React.useRef({});
  const galleryFileRef = React.useRef(null);

  const loadBrand = async (brand) => {
    setSelectedBrand(brand);
    setPendingStrip([]);
    setPendingSkuPreview({});
    const override = brandOverrides[brand.id] || {};
    setBrandForm({
      tagline: override.tagline || brand.tagline,
      description: override.description || brand.description,
      color: override.color || brand.color,
      fontStyle: override.font_style || 'modern',
      masterPricingMode: override.master_pricing_mode || brand.masterPricingMode || 'auto',
    });
    const pf = {};
    brand.products.forEach(p => {
      const po = productOverrides[p.sku] || {};
      pf[p.sku] = {
        name: po.name || p.name,
        detail: po.detail || p.detail,
        image_url: po.image_url || p.image || '',
        orderUnit: po.order_unit || p.orderUnit || 'master_case',
        flavors_retail: po.flavors_retail ? JSON.parse(po.flavors_retail) : [...p.flavors_retail],
        flavors_distro: po.flavors_distro ? JSON.parse(po.flavors_distro) : [...p.flavors_distro],
        ...parseCommerceFields(po),
        ...parsePackFields({ ...p, ...po }),
      };
    });
    setProductForms(pf);

    const { data: gallery } = await supabase
      .from('brand_gallery')
      .select('*')
      .eq('brand_id', brand.id)
      .order('sort_order', { ascending: true });
    setGalleryItems(gallery || []);
  };

  React.useEffect(() => { loadBrand(BRANDS[0]); }, []); // eslint-disable-line

  const productImageBySku = Object.fromEntries(
    Object.entries(productForms).map(([sku, form]) => [sku, form?.image_url || '']).filter(([, url]) => url)
  );

  const { uploadStrip, defaultStrip, skuCards } = buildVisibleBrandPhotos(selectedBrand, {
    galleryRecords: galleryItems,
    productImageBySku,
    pendingBySku: pendingSkuPreview,
    productForms,
  });

  const handleImageUpload = async (brandId, sku, file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPendingSkuPreview(prev => ({ ...prev, [sku]: previewUrl }));
    setUploading(u => ({ ...u, [sku]: true }));
    const url = await uploadBrandImage(brandId, sku, file);
    URL.revokeObjectURL(previewUrl);
    setPendingSkuPreview(prev => {
      const next = { ...prev };
      delete next[sku];
      return next;
    });
    if (url) {
      setProductForms(pf => ({ ...pf, [sku]: { ...pf[sku], image_url: url } }));
      await saveProductContent(brandId, sku, { ...productForms[sku], image_url: url });
      setSaved('Image uploaded!'); setTimeout(() => setSaved(''), 2000);
      window.dispatchEvent(new CustomEvent('ga-content-updated'));
      onSaved && onSaved();
    }
    setUploading(u => ({ ...u, [sku]: false }));
  };

  const handleGalleryUpload = async (fileList) => {
    const files = [...(fileList || [])];
    if (!files.length) return;
    setUploadingGallery(true);
    for (const file of files) {
      const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const previewUrl = URL.createObjectURL(file);
      setPendingStrip(prev => [...prev, {
        id: tempId,
        url: previewUrl,
        source: 'placard',
        label: file.name,
        uploading: true,
      }]);
      const url = await uploadGalleryImage(selectedBrand.id, file);
      URL.revokeObjectURL(previewUrl);
      setPendingStrip(prev => prev.filter(p => p.id !== tempId));
      if (url) {
        setGalleryItems(prev => [...prev, {
          id: tempId,
          brand_id: selectedBrand.id,
          image_url: url,
          sort_order: Date.now(),
        }]);
      }
    }
    setUploadingGallery(false);
    setSaved('Placard photo(s) uploaded!'); setTimeout(() => setSaved(''), 2000);
    window.dispatchEvent(new CustomEvent('ga-content-updated'));
    onSaved && onSaved();
    const { data: gallery } = await supabase
      .from('brand_gallery')
      .select('*')
      .eq('brand_id', selectedBrand.id)
      .order('sort_order', { ascending: true });
    setGalleryItems(gallery || []);
  };

  const handleDeletePlacard = async (galleryId) => {
    if (!window.confirm('Remove this placard photo from the customer gallery?')) return;
    await deleteGalleryImage(galleryId);
    setGalleryItems(prev => prev.filter(g => g.id !== galleryId));
    window.dispatchEvent(new CustomEvent('ga-content-updated'));
    onSaved && onSaved();
  };

  const toggleFlavorSoldOut = (sku, flavorType, idx) => {
    setProductForms(pf => {
      const arr = [...(pf[sku][flavorType] || [])];
      const flavor = arr[idx];
      if (flavor.includes(' — SOLD OUT')) arr[idx] = flavor.replace(' — SOLD OUT', '');
      else arr[idx] = flavor + ' — SOLD OUT';
      return { ...pf, [sku]: { ...pf[sku], [flavorType]: arr } };
    });
  };

  const addFlavor = (sku, flavorType) => {
    setProductForms(pf => ({ ...pf, [sku]: { ...pf[sku], [flavorType]: [...(pf[sku][flavorType] || []), 'New Flavor'] } }));
  };

  const removeFlavor = (sku, flavorType, idx) => {
    setProductForms(pf => {
      const arr = [...(pf[sku][flavorType] || [])];
      arr.splice(idx, 1);
      return { ...pf, [sku]: { ...pf[sku], [flavorType]: arr } };
    });
  };

  const updateFlavor = (sku, flavorType, idx, val) => {
    setProductForms(pf => {
      const arr = [...(pf[sku][flavorType] || [])];
      arr[idx] = val;
      return { ...pf, [sku]: { ...pf[sku], [flavorType]: arr } };
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    await saveBrandContent(selectedBrand.id, brandForm);
    await Promise.all(selectedBrand.products.map(p => saveProductContent(selectedBrand.id, p.sku, productForms[p.sku] || {})));
    setSaving(false);
    setSaved('All changes saved!'); setTimeout(() => setSaved(''), 2500);
    window.dispatchEvent(new CustomEvent('ga-content-updated'));
    onSaved && onSaved();
  };

  const inputStyle = { ...ui.input, fontSize: 13 };
  const labelStyle = { fontSize: 11, color: t.textFaint, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' };
  const card = { ...ui.card, marginBottom: '1rem' };

  return (
    <div>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=Pacifico&display=swap" rel="stylesheet" />

      {/* Brand selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {BRANDS.map(brand => (
          <button key={brand.id} onClick={() => loadBrand(brand)}
            style={{ background: selectedBrand.id === brand.id ? brand.color : t.bgElevated, color: selectedBrand.id === brand.id ? '#FFF' : t.textSecondary, border: `0.5px solid ${selectedBrand.id === brand.id ? brand.color : t.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: selectedBrand.id === brand.id ? 600 : 400, transition: 'all 0.15s' }}>
            {brand.name}
          </button>
        ))}
      </div>

      <BrandPhotoPreviewGrid
        brand={selectedBrand}
        uploadStrip={uploadStrip}
        defaultStrip={defaultStrip}
        skuCards={skuCards}
        pendingStrip={pendingStrip}
        onDeletePlacard={handleDeletePlacard}
        brandColor={brandForm.color || selectedBrand.color}
      />

      {/* Placard / gallery uploads */}
      <div style={card}>
        <div style={{ fontSize: 12, color: t.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 500 }}>
          Placard photos — {selectedBrand.name}
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5, marginBottom: 12 }}>
          Upload brand placard or hero photos. They appear first in the customer gallery strip above. You can select multiple images at once.
        </div>
        <button
          type="button"
          onClick={() => galleryFileRef.current?.click()}
          disabled={uploadingGallery}
          style={{
            background: uploadingGallery ? t.border : (brandForm.color || selectedBrand.color),
            color: uploadingGallery ? t.textFaint : '#FFF',
            border: 'none',
            borderRadius: 10,
            padding: '12px 18px',
            fontSize: 13,
            fontWeight: 600,
            cursor: uploadingGallery ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {uploadingGallery ? 'Uploading…' : '+ Upload placard photos'}
        </button>
        <input
          ref={galleryFileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            handleGalleryUpload(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Brand info */}
      <div style={card}>
        <div style={{ fontSize: 12, color: t.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 500 }}>Brand Info — {selectedBrand.name}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Tagline</label>
            <input value={brandForm.tagline || ''} onChange={e => setBrandForm(f => ({ ...f, tagline: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Brand Color</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={brandForm.color || '#C9A84C'} onChange={e => setBrandForm(f => ({ ...f, color: e.target.value }))} style={{ width: 44, height: 40, border: t.borderHairline, borderRadius: 8, cursor: 'pointer', padding: 2 }} />
              <input value={brandForm.color || ''} onChange={e => setBrandForm(f => ({ ...f, color: e.target.value }))} style={{ ...inputStyle, flex: 1 }} placeholder="#C9A84C" />
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Description</label>
          <textarea value={brandForm.description || ''} onChange={e => setBrandForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, height: 80, resize: 'vertical' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Master Distributor pricing</label>
          <select
            value={brandForm.masterPricingMode || 'auto'}
            onChange={e => setBrandForm(f => ({ ...f, masterPricingMode: e.target.value }))}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="auto">Auto — show master rates when entered on SKUs</option>
            <option value="show">Show — publish master rates when entered</option>
            <option value="quote">Quote only — team follows up with pricing</option>
          </select>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6, lineHeight: 1.45 }}>
            Use quote only for partner brands where master rates cannot be listed publicly.
          </div>
        </div>
        <div>
          <label style={labelStyle}>Font Style</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            {FONT_STYLES.map(font => (
              <button key={font.id} onClick={() => setBrandForm(f => ({ ...f, fontStyle: font.id }))}
                style={{ background: brandForm.fontStyle === font.id ? selectedBrand.color + '18' : t.bgMuted, border: `0.5px solid ${brandForm.fontStyle === font.id ? selectedBrand.color : t.border}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{font.label}</div>
                <div style={{ fontSize: 14, fontFamily: font.font, color: brandForm.fontStyle === font.id ? selectedBrand.color : t.textSecondary }}>{font.preview}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products */}
      <div style={{ fontSize: 12, color: t.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12, fontWeight: 500 }}>Products</div>

      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['details', 'pricing', 'flavors'].map(tabKey => (
          <button key={tabKey} onClick={() => setActiveProductTab(tabKey)}
            style={ui.tabBtn(activeProductTab === tabKey)}>
            {tabKey === 'details' ? 'Details & Images' : tabKey === 'pricing' ? 'Pricing & Promos' : 'Flavors'}
          </button>
        ))}
      </div>

      {selectedBrand.products.map(product => (
        <div key={product.sku} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.04em', color: t.text }}>{product.name}</div>
              <div style={{ fontSize: 11, color: '#C9A84C', fontWeight: 600, marginTop: 2 }}>SKU: {product.sku}</div>
            </div>
          </div>

          {activeProductTab === 'details' && (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {/* Image upload */}
              <div style={{ flexShrink: 0 }}>
                <label style={labelStyle}>Product Image</label>
                <div onClick={() => !uploading[product.sku] && fileRefs.current[product.sku]?.click()}
                  style={{ width: 160, height: 120, border: `1.5px dashed ${selectedBrand.color}66`, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: uploading[product.sku] ? 'wait' : 'pointer', overflow: 'hidden', background: t.bgMuted, position: 'relative' }}>
                  {(pendingSkuPreview[product.sku] || productForms[product.sku]?.image_url) ? (
                    <>
                      <img
                        src={pendingSkuPreview[product.sku] || productForms[product.sku].image_url}
                        alt={product.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                      {uploading[product.sku] && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: 11, fontWeight: 600 }}>
                          Uploading…
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>📷</div>
                      <div style={{ fontSize: 11, color: t.textFaint, textAlign: 'center', padding: '0 8px' }}>Tap to upload</div>
                    </>
                  )}
                </div>
                <div style={{ fontSize: 10, color: t.textFaint, marginTop: 6, maxWidth: 160, lineHeight: 1.4 }}>
                  Preview updates above in the SKU grid when uploaded.
                </div>
                <input ref={el => { fileRefs.current[product.sku] = el; }} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageUpload(selectedBrand.id, product.sku, e.target.files[0])} />
              </div>
              {/* Details */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Product Name</label>
                  <input value={productForms[product.sku]?.name || ''} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], name: e.target.value } }))} style={inputStyle} placeholder={product.name} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Details / Specs</label>
                  <input value={productForms[product.sku]?.detail || ''} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], detail: e.target.value } }))} style={inputStyle} placeholder={product.detail} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Order Unit (legacy fallback)</label>
                  <select value={productForms[product.sku]?.orderUnit || product.orderUnit} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], orderUnit: e.target.value } }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="master_case">Master Case Only</option>
                    <option value="pallet">Pallet Only</option>
                    <option value="both">Both (buyer chooses)</option>
                  </select>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6, lineHeight: 1.45 }}>
                    Used only when custom order unit lists below are empty.
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Retailer order units</label>
                  <input
                    value={productForms[product.sku]?.retail_order_units || ''}
                    onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], retail_order_units: e.target.value } }))}
                    style={inputStyle}
                    placeholder="e.g. jar  or  box, case"
                  />
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6, lineHeight: 1.45 }}>
                    Comma-separated units buyers can toggle per flavor (e.g. box, master case, pallet). Shown when selecting flavors on the brand page.
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Distributor order units</label>
                  <input
                    value={productForms[product.sku]?.distributor_order_units || ''}
                    onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], distributor_order_units: e.target.value } }))}
                    style={inputStyle}
                    placeholder="e.g. box, master case, pallet"
                  />
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6, lineHeight: 1.45 }}>
                    Distributors pick the unit per line item after clicking a flavor — use the steps that match how that SKU is sold.
                  </div>
                </div>
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid #F0EDE8' }}>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
                    Pack configuration — shown to all visitors (including access-code guests). Fill only the levels that apply to this SKU.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 10 }}>
                    {[['units_per_inner', 'Count (smallest unit)'], ['inners_per_case', 'Per case count'], ['cases_per_pallet', 'Cases per pallet']].map(([field, label]) => (
                      <div key={field}>
                        <label style={labelStyle}>{label}</label>
                        <input type="number" min="1" value={productForms[product.sku]?.[field] ?? ''} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], [field]: e.target.value } }))} style={inputStyle} placeholder="—" />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={labelStyle}>Smallest unit name</label>
                      <input value={productForms[product.sku]?.inner_unit_label || ''} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], inner_unit_label: e.target.value } }))} style={inputStyle} placeholder="e.g. pieces, chewables" />
                    </div>
                    <div>
                      <label style={labelStyle}>Inner pack name</label>
                      <input value={productForms[product.sku]?.inner_pack_label || ''} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], inner_pack_label: e.target.value } }))} style={inputStyle} placeholder="e.g. jar, box, pouch" />
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Retailer default unit (single)</label>
                    <input value={productForms[product.sku]?.retail_order_unit || ''} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], retail_order_unit: e.target.value } }))} style={inputStyle} placeholder="Fallback if retailer list above is empty — e.g. jar, box" />
                  </div>
                  <div>
                    <label style={labelStyle}>Extra pack note (optional)</label>
                    <input value={productForms[product.sku]?.pack_config_note || ''} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], pack_config_note: e.target.value } }))} style={inputStyle} placeholder="e.g. Flat pack · tube display" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeProductTab === 'pricing' && (
            <div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 12, lineHeight: 1.5 }}>Retailers see wholesale + MSRP. Distributors see unit/case/pallet and retailer tier pricing. Master Distributor rates (below) are only shown to qualified accounts.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
                {[['price_per_unit', 'Per unit'], ['price_per_case', 'Per case'], ['price_per_pallet', 'Per pallet'], ['price_wholesale', 'Wholesale'], ['price_retail', 'Retailer tier'], ['price_msrp', 'MSRP']].map(([field, label]) => (
                  <div key={field}>
                    <label style={labelStyle}>{label}</label>
                    <input type="number" step="0.01" min="0" value={productForms[product.sku]?.[field] ?? ''} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], [field]: e.target.value } }))} style={inputStyle} placeholder="0.00" />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#A07A20', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>Master Distributor (qualified accounts only)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
                {[['price_master_per_unit', 'Per unit'], ['price_master_per_case', 'Per case'], ['price_master_per_pallet', 'Per pallet']].map(([field, label]) => (
                  <div key={field}>
                    <label style={labelStyle}>{label}</label>
                    <input type="number" step="0.01" min="0" value={productForms[product.sku]?.[field] ?? ''} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], [field]: e.target.value } }))} style={{ ...inputStyle, borderColor: '#F5D87A' }} placeholder="0.00" />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>MOQ qty</label>
                  <input type="number" min="1" value={productForms[product.sku]?.moq_qty ?? ''} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], moq_qty: e.target.value } }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>MOQ unit</label>
                  <select value={productForms[product.sku]?.moq_unit || 'case'} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], moq_unit: e.target.value } }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="unit">Unit</option>
                    <option value="case">Case</option>
                    <option value="pallet">Pallet</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Free ship at qty</label>
                  <input type="number" min="1" value={productForms[product.sku]?.free_shipping_moq_qty ?? ''} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], free_shipping_moq_qty: e.target.value } }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.textSecondary, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!productForms[product.sku]?.shipping_included} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], shipping_included: e.target.checked } }))} />
                  Shipping included
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.textSecondary, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!productForms[product.sku]?.shipping_free_after_moq} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], shipping_free_after_moq: e.target.checked } }))} />
                  Free shipping after MOQ
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: t.textSecondary, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!productForms[product.sku]?.promo_active} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], promo_active: e.target.checked } }))} />
                  Promotion active
                </label>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Shipping note</label>
                <input value={productForms[product.sku]?.shipping_note || ''} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], shipping_note: e.target.value } }))} style={inputStyle} placeholder="e.g. FOB Los Angeles" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>Promo label</label>
                  <input value={productForms[product.sku]?.promo_label || ''} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], promo_label: e.target.value } }))} style={inputStyle} placeholder="e.g. 10% off first order" />
                </div>
                <div>
                  <label style={labelStyle}>Promo audience</label>
                  <select value={productForms[product.sku]?.promo_audience || 'both'} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], promo_audience: e.target.value } }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="both">Both</option>
                    <option value="retailer">Retailers only</option>
                    <option value="distributor">Distributors only</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label style={labelStyle}>Promo details</label>
                <input value={productForms[product.sku]?.promo_detail || ''} onChange={e => setProductForms(pf => ({ ...pf, [product.sku]: { ...pf[product.sku], promo_detail: e.target.value } }))} style={inputStyle} placeholder="Terms, dates, or bundle info" />
              </div>
            </div>
          )}

          {activeProductTab === 'flavors' && (
            <div>
              {['flavors_retail', 'flavors_distro'].map(flavorType => (
                <div key={flavorType} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>{flavorType === 'flavors_retail' ? 'Retailer Flavors' : 'Distributor Options'}</label>
                    <button onClick={() => addFlavor(product.sku, flavorType)}
                      style={{ background: selectedBrand.color, color: '#FFF', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>+ Add</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(productForms[product.sku]?.[flavorType] || []).map((flavor, idx) => {
                      const isSoldOut = flavor.includes(' — SOLD OUT');
                      const cleanFlavor = flavor.replace(' — SOLD OUT', '');
                      return (
                        <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input value={cleanFlavor} onChange={e => updateFlavor(product.sku, flavorType, idx, e.target.value + (isSoldOut ? ' — SOLD OUT' : ''))}
                            style={{ ...inputStyle, flex: 1, padding: '8px 10px', background: isSoldOut ? t.errorBg : t.bgMuted, border: `0.5px solid ${isSoldOut ? t.errorBorder : t.border}` }} />
                          <button onClick={() => toggleFlavorSoldOut(product.sku, flavorType, idx)} title={isSoldOut ? 'Mark in stock' : 'Mark sold out'}
                            style={{ width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, background: isSoldOut ? '#FEF0F0' : '#F0FAF4', color: isSoldOut ? '#E05A5A' : '#4CAF7D', flexShrink: 0 }}>
                            {isSoldOut ? '✗' : '✓'}
                          </button>
                          <button onClick={() => removeFlavor(product.sku, flavorType, idx)}
                            style={{ width: 32, height: 32, border: t.borderHairline, borderRadius: 6, cursor: 'pointer', fontSize: 16, background: t.bgElevated, color: t.textDisabled, flexShrink: 0 }}>×</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Save */}
      <div style={{ position: 'sticky', bottom: 16 }}>
        <button onClick={handleSaveAll} disabled={saving}
          style={{ width: '100%', background: saving ? t.border : selectedBrand.color, color: saving ? t.textFaint : '#FFF', border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
          {saving ? 'Saving...' : `Save All Changes for ${selectedBrand.name}`}
        </button>
        {saved && <div style={{ textAlign: 'center', fontSize: 13, color: '#4CAF7D', marginTop: 8, fontWeight: 500 }}>{saved}</div>}
      </div>
    </div>
  );
}
