import React from 'react';
import { useTheme } from '../context/ThemeContext';

function SourceBadge({ source, label }) {
  const { t } = useTheme();
  const styles = {
    placard: { bg: t.goldBg, color: t.gold, border: t.gold },
    sku: { bg: t.successBg, color: t.successText, border: t.successBorder },
    default: { bg: t.bgMuted, color: t.textMuted, border: t.border },
    pending: { bg: t.warningBg, color: t.warningText, border: t.warningBorder },
  };
  const s = styles[source] || styles.default;
  return (
    <span style={{
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      padding: '2px 6px',
      borderRadius: 4,
      background: s.bg,
      color: s.color,
      border: `0.5px solid ${s.border}`,
    }}>
      {label}
    </span>
  );
}

export default function BrandPhotoPreviewGrid({
  brand,
  strip = [],
  skuCards = [],
  pendingStrip = [],
  onDeletePlacard,
  brandColor = '#C9A84C',
}) {
  const { t } = useTheme();
  const allStrip = [...pendingStrip, ...strip];

  return (
    <div style={{
      background: t.bgMuted,
      border: t.borderHairlineLight,
      borderRadius: 12,
      padding: '1rem 1.25rem',
      marginBottom: '1.5rem',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>
        Customer preview — {brand?.name}
      </div>
      <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5, marginBottom: 14 }}>
        This is what buyers see on the brand page after you save and upload. Placard photos appear first in the gallery strip, then SKU product images, then built-in photos.
      </div>

      <div style={{ fontSize: 10, color: t.textFaint, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
        Gallery strip (horizontal scroll on site)
      </div>
      {allStrip.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: 12, color: t.textDisabled, background: t.bgElevated, borderRadius: 10, border: `1.5px dashed ${t.border}`, marginBottom: 16 }}>
          No photos visible yet — upload placard photos or SKU images below.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}>
          {allStrip.map((item) => (
            <div key={item.id} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: t.borderHairlineLight, background: t.bgElevated }}>
              <div style={{ aspectRatio: '4/3', background: '#111' }}>
                <img
                  src={item.url}
                  alt={item.label || 'Preview'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: item.uploading ? 0.65 : 1 }}
                />
              </div>
              <div style={{ padding: '6px 8px', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', justifyContent: 'space-between' }}>
                <SourceBadge source={item.uploading ? 'pending' : item.source} label={item.uploading ? 'Uploading…' : item.label} />
                {item.galleryId && onDeletePlacard && !item.uploading && (
                  <button
                    type="button"
                    onClick={() => onDeletePlacard(item.galleryId)}
                    style={{ background: 'none', border: 'none', color: t.errorText, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 10, color: t.textFaint, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
        Product cards (per SKU)
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 12,
      }}>
        {skuCards.map(card => (
          <div key={card.sku} style={{ borderRadius: 12, overflow: 'hidden', border: t.borderHairlineLight, background: t.bgElevated, boxShadow: `0 2px 8px ${t.shadow}` }}>
            <div style={{ height: 120, background: card.url ? '#111' : t.bgSubtle, position: 'relative' }}>
              {card.url ? (
                <img src={card.url} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, opacity: 0.35 }}>📷</div>
              )}
              {card.pending && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: 11, fontWeight: 600 }}>
                  Uploading…
                </div>
              )}
            </div>
            <div style={{ padding: '8px 10px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.text, lineHeight: 1.3, marginBottom: 4 }}>{card.name}</div>
              <div style={{ fontSize: 10, color: brandColor, fontWeight: 600, marginBottom: 6 }}>{card.sku}</div>
              <SourceBadge
                source={card.pending ? 'pending' : card.isUploaded ? 'sku' : card.isDefault ? 'default' : 'default'}
                label={card.pending ? 'Uploading…' : card.isUploaded ? 'Your upload' : card.isDefault ? 'Default image' : 'No image'}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
