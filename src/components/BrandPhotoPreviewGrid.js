import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

function SourceBadge({ source, label }) {
  const { t } = useTheme();
  const styles = {
    placard: { bg: t.goldBg, color: t.gold, border: t.gold },
    sku: { bg: t.successBg, color: t.successText, border: t.successBorder },
    default: { bg: t.bgMuted, color: t.textMuted, border: t.border },
    pending: { bg: t.warningBg, color: t.warningText, border: t.warningBorder },
    missing: { bg: t.errorBg, color: t.errorText, border: t.errorBorder },
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

const overlayBtn = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'inherit',
  fontSize: 14,
  lineHeight: 1,
  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
};

function PreviewTile({ item, onDeletePlacard, onToggleFeatured }) {
  const { t } = useTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [item.url]);

  const canManage = item.galleryId && !item.uploading && !failed;

  return (
    <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: item.catalogFeatured ? `2px solid ${t.gold}` : t.borderHairlineLight, background: t.bgElevated }}>
      <div style={{ aspectRatio: '4/3', background: failed ? t.bgSubtle : '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {!failed ? (
          <img
            src={item.url}
            alt={item.label || 'Preview'}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: item.uploading ? 0.65 : 1 }}
            onError={() => setFailed(true)}
          />
        ) : (
          <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: 11, color: t.textMuted, lineHeight: 1.45 }}>
            Image not found on server
            <div style={{ fontSize: 10, color: t.textDisabled, marginTop: 4 }}>Upload a replacement below</div>
          </div>
        )}
        {canManage && (
          <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 6 }}>
            {onToggleFeatured && (
              <button
                type="button"
                title={item.catalogFeatured ? 'Remove from catalog rotation' : 'Star for catalog home / cards'}
                onClick={() => onToggleFeatured(item.galleryId, !item.catalogFeatured)}
                style={{
                  ...overlayBtn,
                  background: item.catalogFeatured ? t.gold : 'rgba(0,0,0,0.55)',
                  color: item.catalogFeatured ? '#1A1A1A' : '#FFF',
                  fontSize: 15,
                }}
              >
                {item.catalogFeatured ? '★' : '☆'}
              </button>
            )}
            {onDeletePlacard && (
              <button
                type="button"
                title="Remove photo"
                onClick={() => onDeletePlacard(item.galleryId)}
                style={{
                  ...overlayBtn,
                  background: 'rgba(0,0,0,0.55)',
                  color: '#FFF',
                  fontSize: 18,
                  fontWeight: 400,
                }}
              >
                ×
              </button>
            )}
          </div>
        )}
        {item.catalogFeatured && !failed && (
          <div style={{ position: 'absolute', left: 6, bottom: 6, background: 'rgba(0,0,0,0.55)', color: t.gold, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6 }}>
            Catalog
          </div>
        )}
      </div>
      <div style={{ padding: '6px 8px', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
        <SourceBadge
          source={item.uploading ? 'pending' : failed ? 'missing' : item.source}
          label={item.uploading ? 'Uploading…' : failed ? 'Missing' : item.label}
        />
      </div>
    </div>
  );
}

function PhotoGrid({ items, onDeletePlacard, onToggleFeatured, emptyMessage }) {
  const { t } = useTheme();
  if (!items.length) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', fontSize: 12, color: t.textDisabled, background: t.bgElevated, borderRadius: 10, border: `1.5px dashed ${t.border}`, marginBottom: 12 }}>
        {emptyMessage}
      </div>
    );
  }
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: 10,
      marginBottom: 12,
    }}>
      {items.map(item => (
        <PreviewTile
          key={item.id}
          item={item}
          onDeletePlacard={onDeletePlacard}
          onToggleFeatured={onToggleFeatured}
        />
      ))}
    </div>
  );
}

export default function BrandPhotoPreviewGrid({
  brand,
  uploadStrip = [],
  defaultStrip = [],
  skuCards = [],
  pendingStrip = [],
  onDeletePlacard,
  onToggleFeatured,
  brandColor = '#C9A84C',
}) {
  const { t } = useTheme();
  const allUploads = [...pendingStrip, ...uploadStrip];
  const defaultCount = defaultStrip.length;
  const skuDefaultCount = skuCards.filter(c => c.isDefault).length;
  const starredCount = allUploads.filter(i => i.catalogFeatured).length;

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
        Tap ★ on a placard photo to use it on the home catalog and brand cards.
        {starredCount > 1 ? ' Multiple stars rotate every 12 hours.' : starredCount === 1 ? ' One starred photo is always shown.' : ' No stars yet — the first gallery photo is used.'}
        {' '}Use × to remove uploads. Product photos show on each SKU card.
      </div>

      <div style={{ fontSize: 10, color: t.textFaint, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
        Your uploads (gallery strip)
      </div>
      <PhotoGrid
        items={allUploads}
        onDeletePlacard={onDeletePlacard}
        onToggleFeatured={onToggleFeatured}
        emptyMessage="No uploads yet — add placard photos below or upload SKU images in each product section."
      />

      {defaultCount > 0 && (
        <>
          <div style={{ fontSize: 10, color: t.textFaint, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
            Extra site gallery photos ({defaultCount})
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, lineHeight: 1.45 }}>
            Built-in brand photos from the site bundle — shown in the customer gallery until replaced by uploads.
          </div>
          <PhotoGrid
            items={defaultStrip}
            onDeletePlacard={null}
            onToggleFeatured={null}
            emptyMessage=""
          />
        </>
      )}

      <div style={{ fontSize: 10, color: t.textFaint, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8, marginTop: 4 }}>
        Product cards (per SKU)
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 12,
      }}>
        {skuCards.map(card => (
          <SkuCard key={card.sku} card={card} brandColor={brandColor} />
        ))}
      </div>
    </div>
  );
}

function SkuCard({ card, brandColor }) {
  const { t } = useTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [card.url]);

  const failMessage = card.isUploaded
    ? 'Uploaded image not loading — re-upload below'
    : 'Default file missing — upload below';

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: t.borderHairlineLight, background: t.bgElevated, boxShadow: `0 2px 8px ${t.shadow}` }}>
      <div style={{ height: 120, background: card.url && !failed ? '#111' : t.bgSubtle, position: 'relative' }}>
        {card.url && !failed ? (
          <img
            src={card.url}
            alt={card.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setFailed(true)}
          />
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.5rem', textAlign: 'center', fontSize: 11, color: t.textMuted, lineHeight: 1.4 }}>
            {card.isEmpty || failed ? (
              <>
                <span style={{ fontSize: 22, opacity: 0.35, marginBottom: 4 }}>📷</span>
                {failed ? failMessage : 'No image — upload below'}
              </>
            ) : null}
          </div>
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
          source={card.pending ? 'pending' : card.isUploaded ? 'sku' : failed ? 'missing' : card.isDefault ? 'default' : 'default'}
          label={
            card.pending ? 'Uploading…'
              : card.isUploaded ? 'Your upload'
                : failed ? 'Missing file'
                  : card.isDefault ? 'Default image'
                    : 'No image'
          }
        />
      </div>
    </div>
  );
}
