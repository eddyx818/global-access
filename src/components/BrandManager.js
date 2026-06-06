import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BRANDS } from '../lib/data';

const BG_PRESETS = [
  { label: 'Warm Cream', value: '#F5F2ED' },
  { label: 'Pure White', value: '#FFFFFF' },
  { label: 'Soft Gray', value: '#F0F0F0' },
  { label: 'Dark Mode', value: '#111111' },
  { label: 'Deep Navy', value: '#0F1B2D' },
  { label: 'Forest', value: '#1A2A1A' },
  { label: 'Charcoal', value: '#1C1C1E' },
  { label: 'Sand', value: '#EDE8DF' },
];

export default function BrandManager({ onSaved }) {
  const [hiddenBrands, setHiddenBrands] = useState([]);
  const [customBrands, setCustomBrands] = useState([]);
  const [bgColor, setBgColor] = useState('#F5F2ED');
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [newBrand, setNewBrand] = useState({
    name: '', category: 'Tablets', tagline: '', description: '', color: '#4CAF7D',
    orderUnit: 'master_case',
    product_name: '', product_detail: '', product_sku: '',
    flavors_retail: '', flavors_distro: '',
  });

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase.from('site_settings').select('*');
      if (data) {
        data.forEach(s => {
          if (s.key === 'hidden_brands') setHiddenBrands(JSON.parse(s.value || '[]'));
          if (s.key === 'bg_color') setBgColor(s.value || '#F5F2ED');
          if (s.key === 'custom_brands') setCustomBrands(JSON.parse(s.value || '[]'));
        });
      }
    } catch (_) {}
  };

  const saveSetting = async (key, value) => {
    await supabase.from('site_settings').upsert({ key, value: typeof value === 'string' ? value : JSON.stringify(value) }, { onConflict: 'key' });
  };

  const toggleBrandVisibility = async (brandId) => {
    const newHidden = hiddenBrands.includes(brandId)
      ? hiddenBrands.filter(id => id !== brandId)
      : [...hiddenBrands, brandId];
    setHiddenBrands(newHidden);
    await saveSetting('hidden_brands', newHidden);
    setSaved('Saved!'); setTimeout(() => setSaved(''), 2000);
    onSaved && onSaved();
  };

  const handleBgChange = async (color) => {
    setBgColor(color);
    await saveSetting('bg_color', color);
    setSaved('Background updated!'); setTimeout(() => setSaved(''), 2000);
    onSaved && onSaved();
  };

  const handleAddBrand = async () => {
    if (!newBrand.name || !newBrand.product_sku) { setSaved(''); return; }
    setSaving(true);
    const brand = {
      id: newBrand.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      name: newBrand.name,
      category: newBrand.category,
      tagline: newBrand.tagline,
      description: newBrand.description,
      color: newBrand.color,
      gallery: [],
      products: [{
        sku: newBrand.product_sku,
        name: newBrand.product_name || newBrand.name,
        detail: newBrand.product_detail,
        orderUnit: newBrand.orderUnit,
        image: null,
        flavors_retail: newBrand.flavors_retail.split('\n').map(f => f.trim()).filter(Boolean),
        flavors_distro: newBrand.flavors_distro.split('\n').map(f => f.trim()).filter(Boolean),
      }],
    };
    const updated = [...customBrands, brand];
    setCustomBrands(updated);
    await saveSetting('custom_brands', updated);
    setShowAddForm(false);
    setNewBrand({ name: '', category: 'Tablets', tagline: '', description: '', color: '#4CAF7D', orderUnit: 'master_case', product_name: '', product_detail: '', product_sku: '', flavors_retail: '', flavors_distro: '' });
    setSaving(false);
    setSaved('Brand added!'); setTimeout(() => setSaved(''), 2000);
    onSaved && onSaved();
  };

  const handleDeleteCustomBrand = async (brandId) => {
    if (!window.confirm('Delete this brand? This cannot be undone.')) return;
    const updated = customBrands.filter(b => b.id !== brandId);
    setCustomBrands(updated);
    await saveSetting('custom_brands', updated);
    setSaved('Brand deleted.'); setTimeout(() => setSaved(''), 2000);
    onSaved && onSaved();
  };

  const inputStyle = { width: '100%', background: '#F8F6F3', border: '0.5px solid #E0DDD8', borderRadius: 8, padding: '10px 12px', color: '#1A1A1A', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
  const labelStyle = { fontSize: 11, color: '#AAA', display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' };
  const card = { background: '#FFF', border: '0.5px solid #E8E4DF', borderRadius: 12, padding: '1.25rem', marginBottom: 10 };

  const CATEGORIES = ['Catering Gas', 'Tablets', 'Papers', 'Beverages', 'Functional Edibles', 'Other'];

  return (
    <div>
      {saved && <div style={{ background: '#F0FAF4', border: '0.5px solid #C6EDD7', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#2D7A50', marginBottom: 16 }}>{saved}</div>}

      {/* Background Color */}
      <div style={card}>
        <div style={{ fontSize: 12, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 500 }}>Site Background Color</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginBottom: 14 }}>
          {BG_PRESETS.map(preset => (
            <button key={preset.value} onClick={() => handleBgChange(preset.value)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `0.5px solid ${bgColor === preset.value ? '#1A1A1A' : '#E0DDD8'}`, borderRadius: 8, cursor: 'pointer', background: bgColor === preset.value ? '#F8F6F3' : '#FFF', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              <div style={{ width: 20, height: 20, borderRadius: 4, background: preset.value, border: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#555', fontWeight: bgColor === preset.value ? 600 : 400 }}>{preset.label}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div>
            <label style={labelStyle}>Custom Color</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ width: 44, height: 40, border: '0.5px solid #E0DDD8', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
              <input value={bgColor} onChange={e => setBgColor(e.target.value)} onBlur={e => handleBgChange(e.target.value)} style={{ ...inputStyle, width: 120 }} placeholder="#F5F2ED" />
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <button onClick={() => handleBgChange(bgColor)} style={{ background: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Apply</button>
          </div>
        </div>
        {/* Live preview */}
        <div style={{ marginTop: 14, padding: '1rem', borderRadius: 10, background: bgColor, border: '0.5px solid #E0DDD8' }}>
          <div style={{ fontSize: 12, color: bgColor === '#111111' || bgColor === '#0F1B2D' || bgColor === '#1A2A1A' || bgColor === '#1C1C1E' ? '#FFF' : '#555' }}>Preview — this is how your site background will look</div>
        </div>
      </div>

      {/* Hardcoded brands — show/hide */}
      <div style={card}>
        <div style={{ fontSize: 12, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 500 }}>Brand Visibility</div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>Toggle brands on/off. Hidden brands won't appear on the portal for buyers.</div>
        {BRANDS.map(brand => {
          const isHidden = hiddenBrands.includes(brand.id);
          return (
            <div key={brand.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid #F0EDE8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: brand.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: isHidden ? '#CCC' : '#1A1A1A' }}>{brand.name}</div>
                  <div style={{ fontSize: 11, color: '#AAA' }}>{brand.category}</div>
                </div>
              </div>
              <button onClick={() => toggleBrandVisibility(brand.id)}
                style={{ background: isHidden ? '#F8F6F3' : brand.color + '18', border: `0.5px solid ${isHidden ? '#E0DDD8' : brand.color + '55'}`, borderRadius: 20, padding: '5px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, color: isHidden ? '#AAA' : brand.color, transition: 'all 0.15s' }}>
                {isHidden ? 'Show' : 'Visible ✓'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Custom brands */}
      {customBrands.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 12, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14, fontWeight: 500 }}>Custom Brands</div>
          {customBrands.map(brand => (
            <div key={brand.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid #F0EDE8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: brand.color }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{brand.name}</div>
                  <div style={{ fontSize: 11, color: '#AAA' }}>{brand.category} · {brand.products?.length || 0} product(s)</div>
                </div>
              </div>
              <button onClick={() => handleDeleteCustomBrand(brand.id)}
                style={{ background: '#FEF0F0', border: '0.5px solid #FECACA', borderRadius: 20, padding: '5px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#C53030' }}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new brand */}
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={() => setShowAddForm(!showAddForm)}
          style={{ width: '100%', background: showAddForm ? '#F8F6F3' : '#1A1A1A', color: showAddForm ? '#555' : '#FFF', border: `0.5px solid ${showAddForm ? '#E0DDD8' : '#1A1A1A'}`, borderRadius: 10, padding: '13px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
          {showAddForm ? '× Cancel' : '+ Add New Brand'}
        </button>
      </div>

      {showAddForm && (
        <div style={{ background: '#FAFAFA', border: '0.5px solid #E0DDD8', borderRadius: 14, padding: '1.5rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: '1.25rem' }}>New Brand Details</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Brand Name *</label>
              <input value={newBrand.name} onChange={e => setNewBrand(b => ({ ...b, name: e.target.value }))} placeholder="e.g. Rise" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Category *</label>
              <select value={newBrand.category} onChange={e => setNewBrand(b => ({ ...b, category: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Tagline</label>
            <input value={newBrand.tagline} onChange={e => setNewBrand(b => ({ ...b, tagline: e.target.value }))} placeholder="e.g. 7-OH Premium Chewables" style={inputStyle} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Description</label>
            <textarea value={newBrand.description} onChange={e => setNewBrand(b => ({ ...b, description: e.target.value }))} style={{ ...inputStyle, height: 70, resize: 'vertical' }} placeholder="Brief brand description..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Brand Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={newBrand.color} onChange={e => setNewBrand(b => ({ ...b, color: e.target.value }))} style={{ width: 44, height: 40, border: '0.5px solid #E0DDD8', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                <input value={newBrand.color} onChange={e => setNewBrand(b => ({ ...b, color: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Order Unit</label>
              <select value={newBrand.orderUnit} onChange={e => setNewBrand(b => ({ ...b, orderUnit: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="master_case">Master Case</option>
                <option value="pallet">Pallet</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>

          <div style={{ borderTop: '0.5px solid #E0DDD8', paddingTop: '1.25rem', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>First Product / SKU</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Product Name</label>
                <input value={newBrand.product_name} onChange={e => setNewBrand(b => ({ ...b, product_name: e.target.value }))} placeholder="e.g. Rise 500mg" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>SKU *</label>
                <input value={newBrand.product_sku} onChange={e => setNewBrand(b => ({ ...b, product_sku: e.target.value.toUpperCase() }))} placeholder="e.g. RS-500" style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Product Details / Specs</label>
              <input value={newBrand.product_detail} onChange={e => setNewBrand(b => ({ ...b, product_detail: e.target.value }))} placeholder="e.g. 10 chewables · 20 boxes/master case" style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Retailer Flavors (one per line)</label>
                <textarea value={newBrand.flavors_retail} onChange={e => setNewBrand(b => ({ ...b, flavors_retail: e.target.value }))} placeholder={"Watermelon\nStrawberry\nMango"} style={{ ...inputStyle, height: 90, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={labelStyle}>Distributor Options (one per line)</label>
                <textarea value={newBrand.flavors_distro} onChange={e => setNewBrand(b => ({ ...b, flavors_distro: e.target.value }))} placeholder={"Watermelon\nStrawberry\nMango"} style={{ ...inputStyle, height: 90, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            </div>
          </div>

          <button onClick={handleAddBrand} disabled={saving || !newBrand.name || !newBrand.product_sku}
            style={{ width: '100%', background: !newBrand.name || !newBrand.product_sku ? '#E0DDD8' : '#1A1A1A', color: !newBrand.name || !newBrand.product_sku ? '#AAA' : '#FFF', border: 'none', borderRadius: 10, padding: '13px', fontSize: 13, fontWeight: 700, cursor: !newBrand.name || !newBrand.product_sku ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Adding...' : 'Add Brand to Portal →'}
          </button>
          <div style={{ fontSize: 11, color: '#CCC', textAlign: 'center', marginTop: 8 }}>You can upload images and edit flavors from the Content tab after adding</div>
        </div>
      )}
    </div>
  );
}
