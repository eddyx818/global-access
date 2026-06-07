import React from 'react';
import { BRANDS } from '../lib/data';
import { getFontFamily, getButtonRadius, DEFAULT_GLOBAL_STYLES } from '../lib/design';

function Swatch({ color, label }) {
  if (!color) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 16, height: 16, borderRadius: 4, background: color, border: '0.5px solid rgba(0,0,0,0.15)' }} />
      <span style={{ fontSize: 10, color: '#666' }}>{label}: {color}</span>
    </div>
  );
}

export function HeroPreview({ data, brandName, brandColor }) {
  const bg = data.background_color || '#0D0D0D';
  const headline = data.headline || brandName || 'Brand Name';
  const subheadline = data.subheadline || 'Tagline goes here';
  const ctaText = data.cta_text || `Explore ${brandName || 'Brand'}`;
  const ctaBg = data.cta_color || '#FFFFFF';
  const ctaColor = data.cta_color ? '#FFF' : '#1A1A1A';

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '0.5px solid #E0DDD8', marginTop: 8 }}>
      <div style={{ background: bg, padding: '20px 16px', textAlign: 'center', position: 'relative', minHeight: 100 }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 30% 60%, ${brandColor || '#4CAF7D'}55 0%, transparent 60%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: '#FFF', marginBottom: 6 }}>{headline}</div>
        <div style={{ position: 'relative', fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 12 }}>{subheadline}</div>
        <div style={{ position: 'relative', display: 'inline-block', background: ctaBg, color: ctaColor, borderRadius: 10, padding: '6px 14px', fontSize: 10, fontWeight: 700 }}>{ctaText}</div>
      </div>
    </div>
  );
}

export function GlobalStylesPreview({ data }) {
  const styles = { ...DEFAULT_GLOBAL_STYLES, ...data };
  const radius = getButtonRadius(styles.button_style);
  return (
    <div style={{ borderRadius: 10, border: '0.5px solid #E0DDD8', padding: 12, marginTop: 8, background: '#FFF' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        <Swatch color={styles.primary_color} label="Primary" />
        <Swatch color={styles.secondary_color} label="Secondary" />
      </div>
      <div style={{ fontSize: 11, fontFamily: getFontFamily(styles.font_family), color: styles.primary_color, marginBottom: 8 }}>
        Sample heading text
      </div>
      <div style={{ display: 'inline-block', background: styles.primary_color, color: '#FFF', borderRadius: radius, padding: '6px 14px', fontSize: 10, fontWeight: 600 }}>
        Button preview
      </div>
      <div style={{ fontSize: 9, color: '#AAA', marginTop: 8 }}>{styles.font_family} · {styles.button_style}</div>
    </div>
  );
}

export function BrandLayoutPreview({ data }) {
  const brand = BRANDS.find(b => b.id === data.brand_id);
  const cols = data.grid_columns || 2;
  const cardStyle = data.card_style || 'elevated';
  const cardStyles = {
    flat: { boxShadow: 'none', border: '0.5px solid #E8E4DF' },
    elevated: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '0.5px solid #E8E4DF' },
    bordered: { boxShadow: 'none', border: `2px solid ${brand?.color || '#4CAF7D'}` },
  };

  return (
    <div style={{ borderRadius: 10, border: '0.5px solid #E0DDD8', padding: 12, marginTop: 8, background: '#FAFAF8' }}>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>
        {brand?.name || data.brand_id} · {data.header_style || 'hero'} header · {cols}-col grid
      </div>
      <div style={{ background: '#0D0D0D', borderRadius: 8, height: 36, marginBottom: 8, display: 'flex', alignItems: 'center', padding: '0 10px' }}>
        <div style={{ fontSize: 11, color: '#FFF', fontFamily: "'Bebas Neue', sans-serif" }}>{brand?.name || 'Brand'}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6 }}>
        {[1, 2, 3].slice(0, cols * 2).map(i => (
          <div key={i} style={{ ...cardStyles[cardStyle], borderRadius: 6, padding: '8px 6px', background: '#FFF', fontSize: 9, color: '#666', textAlign: 'center' }}>
            Item {i}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssetPreview({ data }) {
  return (
    <div style={{ borderRadius: 10, border: '0.5px solid #E0DDD8', padding: 10, marginTop: 8, background: '#FFF' }}>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>{data.asset_type} · {data.brand_id}{data.sku ? ` · ${data.sku}` : ''}</div>
      {data.file_url && (
        <img src={data.file_url} alt="preview" style={{ maxWidth: '100%', maxHeight: 80, borderRadius: 6, objectFit: 'contain', background: '#F8F6F3' }}
          onError={e => { e.target.style.display = 'none'; }} />
      )}
      <div style={{ fontSize: 9, color: '#BBB', marginTop: 4, wordBreak: 'break-all' }}>{data.file_url}</div>
    </div>
  );
}

export function ProductPreview({ data }) {
  const brand = BRANDS.find(b => b.id === data.brand_id);
  return (
    <div style={{ borderRadius: 10, border: '0.5px solid #E0DDD8', padding: 12, marginTop: 8, background: '#FFF' }}>
      {(data.images?.[0] || data.image_url) && (
        <img src={data.images?.[0] || data.image_url} alt="" style={{ width: '100%', maxHeight: 80, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />
      )}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>{data.name || 'New Product'}</div>
      <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>{brand?.name || data.brand_id} · SKU: {data.sku}</div>
      {data.detail && <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>{data.detail}</div>}
      {data.flavors_retail?.length > 0 && (
        <div style={{ fontSize: 10, color: '#AAA', marginTop: 8 }}>{data.flavors_retail.length} retail flavors</div>
      )}
    </div>
  );
}

export function BulkImportPreview({ data }) {
  const count = data.products?.length || 0;
  return (
    <div style={{ borderRadius: 10, border: '0.5px solid #E0DDD8', padding: 12, marginTop: 8, background: '#FFF', fontSize: 11, color: '#666' }}>
      Import {count} product{count !== 1 ? 's' : ''}{data.overwrite_existing ? ' (overwrite existing)' : ''}
    </div>
  );
}

export function NavigationPreview({ data }) {
  const items = data._previewItems || (data.label ? [{ label: data.label, url: data.url }] : []);
  return (
    <div style={{ borderRadius: 10, border: '0.5px solid #E0DDD8', padding: '8px 12px', marginTop: 8, background: 'rgba(245,242,237,0.95)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: '#1A1A1A' }}>Global Access</span>
      {items.map((item, i) => (
        <span key={i} style={{ fontSize: 10, color: '#555', background: '#FFF', border: '0.5px solid #E0DDD8', borderRadius: 12, padding: '3px 10px' }}>{item.label}</span>
      ))}
      {data.action === 'remove' && (
        <span style={{ fontSize: 10, color: '#C0392B' }}>− {data.item_id}</span>
      )}
    </div>
  );
}

export default function DesignPreview({ action, data }) {
  if (action === 'generate_preview' && data.preview_type) {
    const changes = data.changes || data;
    switch (data.preview_type) {
      case 'hero_section': return <HeroPreview data={changes} />;
      case 'brand_page': return <BrandLayoutPreview data={changes} />;
      case 'product_card': return <ProductPreview data={changes} />;
      default: return <HeroPreview data={changes} />;
    }
  }

  switch (action) {
    case 'update_hero_section':
      return <HeroPreview data={data} brandName="Churros Locos" brandColor="#F5943A" />;
    case 'update_global_styles':
      return <GlobalStylesPreview data={data} />;
    case 'update_brand_page_layout':
      return <BrandLayoutPreview data={data} />;
    case 'upload_brand_asset':
      return <AssetPreview data={data} />;
    case 'update_navigation':
      return <NavigationPreview data={data} />;
    case 'create_product':
      return <ProductPreview data={data} />;
    case 'bulk_import':
      return <BulkImportPreview data={data} />;
    default:
      return null;
  }
}
