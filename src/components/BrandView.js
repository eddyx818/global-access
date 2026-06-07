import React, { useState, useRef, useEffect } from 'react';
import ProductCommerceInfo from './ProductCommerceInfo';
import BrandNamePattern from './BrandNamePattern';
import { minQtyForProduct, formatOrderUnitLabel, getOrderUnitHeading, getProductOrderOptions, defaultOrderMode } from '../lib/pricing';
import { subscribeStockNotify, fetchMyStockAlerts, stockAlertKey } from '../lib/stockNotify';
import { useTheme } from '../context/ThemeContext';
import { useBrandContent } from '../lib/content';

export default function BrandView({ brand, userType, user, userEmail, onBack, toggleInterest, updateInterestLine, isInterested, interests, onSubmit, isMobile, hasBottomNav = false, masterPricingQualified = false, pricingVisible = true, onSignIn, onRequestAccess, chatLabel = 'Trade Desk' }) {
  const { t, isNight } = useTheme();
  const { bgColor } = useBrandContent();
  const [lightbox, setLightbox] = useState(null);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [orderMode, setOrderMode] = useState({}); // per sku default for new selections
  const [lineOrderMode, setLineOrderMode] = useState({}); // per flavor line: `${sku}__${flavor}`
  const [quantities, setQuantities] = useState({}); // per flavor key: qty
  const [brokenImages, setBrokenImages] = useState({});
  const [stockAlerts, setStockAlerts] = useState(() => new Set());
  const [notifyBusy, setNotifyBusy] = useState(null);
  const [notifyMsg, setNotifyMsg] = useState('');
  const galleryRef = useRef(null);
  const isDistributor = userType === 'distributor';

  useEffect(() => {
    if (!user?.id) {
      setStockAlerts(new Set());
      return;
    }
    fetchMyStockAlerts(user.id).then(rows => {
      setStockAlerts(new Set(rows.map(r => stockAlertKey(r.sku, r.flavor))));
    });
  }, [user?.id]);

  const markImageBroken = (key) => {
    setBrokenImages(prev => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  const galleryImages = (brand?.gallery || []).filter(img => img && !brokenImages[`gallery:${img}`]);

  // Keyboard navigation for lightbox
  React.useEffect(() => {
    const handleKey = (e) => {
      if (lightbox === null) return;
      const gallery = brand?.gallery || [];
      if (e.key === 'ArrowRight') setLightboxIdx(i => (i + 1) % galleryImages.length);
      if (e.key === 'ArrowLeft') setLightboxIdx(i => (i - 1 + galleryImages.length) % galleryImages.length);
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightbox, brand, galleryImages.length]);

  // Sync lightbox image when idx changes (only if already open)
  React.useEffect(() => {
    if (lightbox !== null && galleryImages.length && lightboxIdx >= 0) {
      setLightbox(galleryImages[lightboxIdx]);
    }
  }, [lightboxIdx, galleryImages, lightbox]); // eslint-disable-line

  const scrollGallery = (dir) => {
    if (galleryRef.current) galleryRef.current.scrollBy({ left: dir * 220, behavior: 'smooth' });
  };

  const getOrderMode = (product, flavorKey = null) => {
    if (flavorKey && lineOrderMode[flavorKey]) return lineOrderMode[flavorKey];
    if (orderMode[product.sku]) return orderMode[product.sku];
    return defaultOrderMode(product, userType);
  };

  const productFlavorsForSku = (product) => (
    isDistributor ? (product.flavors_distro || []) : (product.flavors_retail || [])
  );

  const syncLineToInterest = (product, flavor, mode, qty) => {
    const key = `${product.sku}__${flavor}`;
    if (!isInterested(product.sku, flavor) || !updateInterestLine) return;
    const n = qty ?? quantities[key] ?? minQtyForProduct(product, userType);
    updateInterestLine(key, {
      qty: n,
      orderMode: mode,
      orderUnitLabel: formatOrderUnitLabel(product, userType, mode, n),
    });
  };

  const setProductOrderMode = (product, mode) => {
    setOrderMode(prev => ({ ...prev, [product.sku]: mode }));
    const lineUpdates = {};
    productFlavorsForSku(product).forEach(flavor => {
      if (!isInterested(product.sku, flavor)) return;
      const key = `${product.sku}__${flavor}`;
      lineUpdates[key] = mode;
      syncLineToInterest(product, flavor, mode);
    });
    if (Object.keys(lineUpdates).length) {
      setLineOrderMode(prev => ({ ...prev, ...lineUpdates }));
    }
  };

  const setLineOrderModeForFlavor = (product, flavor, mode) => {
    const key = `${product.sku}__${flavor}`;
    setLineOrderMode(prev => ({ ...prev, [key]: mode }));
    syncLineToInterest(product, flavor, mode);
  };

  const setQty = (key, val, product, flavor) => {
    const min = minQtyForProduct(product, userType);
    const n = Math.max(min, parseInt(val, 10) || min);
    setQuantities(prev => ({ ...prev, [key]: n }));
    if (flavor && isInterested(product.sku, flavor)) {
      const mode = getOrderMode(product, key);
      syncLineToInterest(product, flavor, mode, n);
    }
  };

  const handleFlavorClick = (product, flavor) => {
    const isSoldOut = flavor.includes('SOLD OUT');
    if (isSoldOut) return;
    const key = `${product.sku}__${flavor}`;
    const wasSelected = isInterested(product.sku, flavor);
    const mode = getOrderMode(product, key);
    const qty = quantities[key] || minQtyForProduct(product, userType);
    const orderUnitLabel = formatOrderUnitLabel(product, userType, mode, qty);
    toggleInterest(product.sku, product.name, brand.name, flavor, qty, mode, brand.id, orderUnitLabel);
    if (!wasSelected) {
      setLineOrderMode(prev => ({ ...prev, [key]: mode }));
    }
  };

  const handleStockNotify = async (product, flavor) => {
    if (!user?.id) {
      if (onSignIn) onSignIn();
      else if (onRequestAccess) onRequestAccess();
      return;
    }
    const key = stockAlertKey(product.sku, flavor);
    if (stockAlerts.has(key)) return;

    setNotifyBusy(key);
    setNotifyMsg('');
    const result = await subscribeStockNotify({
      brandId: brand.id,
      sku: product.sku,
      flavor,
      brandName: brand.name,
      productName: product.name,
      email: userEmail,
    });
    setNotifyBusy(null);
    if (!result.ok) {
      setNotifyMsg(result.error || 'Could not save alert.');
      return;
    }
    setStockAlerts(prev => new Set([...prev, key]));
    setNotifyMsg('You will be notified when this flavor is back in stock.');
  };

  if (!brand) return null;

  const layout = brand.layout || {};
  const headerStyle = layout.header_style || 'hero';
  const gridColumns = layout.grid_columns || (isMobile ? 1 : null);
  const cardStyle = layout.card_style || 'elevated';
  const headerHeights = { hero: isMobile ? 260 : 260, compact: isMobile ? 160 : 180, minimal: isMobile ? 120 : 140 };
  const headerMinHeight = headerHeights[headerStyle] || headerHeights.hero;
  const productCardStyles = {
    flat: { boxShadow: 'none', border: t.borderHairlineLight },
    elevated: { boxShadow: `0 2px 12px ${t.shadow}`, border: t.borderHairlineLight },
    bordered: { boxShadow: 'none', border: `2px solid ${brand.color}` },
  };
  const flavorGridCols = isMobile
    ? '1fr'
    : (gridColumns ? `repeat(${gridColumns}, minmax(0, 1fr))` : 'repeat(auto-fill, minmax(200px, 1fr))');

  const stickyBottom = hasBottomNav
    ? 'var(--ga-bottom-nav-height)'
    : 'var(--ga-inset-bottom)';

  const pagePaddingBottom = interests.length > 0
    ? (hasBottomNav ? 'calc(8rem + var(--ga-bottom-nav-height))' : 'calc(6rem + var(--ga-inset-bottom))')
    : (hasBottomNav ? 'calc(2rem + var(--ga-bottom-nav-height))' : 'calc(2rem + var(--ga-inset-bottom))');

  const productHeader = (product, { onDark = false } = {}) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: onDark ? 24 : 24,
          color: onDark ? '#FFF' : t.text,
          letterSpacing: '0.04em',
          lineHeight: 1,
        }}>
          {product.name}
        </div>
        {product.detail && (
          <div style={{
            fontSize: onDark ? 11 : 12,
            color: onDark ? 'rgba(255,255,255,0.65)' : t.textFaint,
            marginTop: 4,
            lineHeight: 1.5,
          }}>
            {product.detail}
          </div>
        )}
      </div>
      <div style={{
        background: onDark ? 'rgba(0,0,0,0.55)' : t.warningBg,
        border: onDark ? 'none' : `0.5px solid ${t.warningBorder}`,
        borderRadius: onDark ? 6 : 8,
        padding: onDark ? '3px 9px' : '6px 12px',
        fontSize: onDark ? 10 : 11,
        color: onDark ? t.gold : t.warningText,
        fontWeight: 700,
        letterSpacing: '0.08em',
        flexShrink: 0,
        textAlign: 'center',
        backdropFilter: onDark ? 'blur(6px)' : 'none',
      }}>
        {!onDark && <div style={{ fontSize: 9, color: '#C9A84C', letterSpacing: '0.1em', marginBottom: 2 }}>SKU</div>}
        {onDark ? `SKU: ${product.sku}` : product.sku}
      </div>
    </div>
  );

  const unitLabel = (product, qty = 1, flavorKey = null) => formatOrderUnitLabel(product, userType, getOrderMode(product, flavorKey), qty);

  return (
    <>
      <BrandNamePattern brand={brand} isMobile={isMobile} isNight={isNight} pageBg={bgColor} />
      <div
        className="brand-page"
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 760,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
          padding: isMobile ? '1rem' : '1.5rem',
          paddingBottom: pagePaddingBottom,
        }}
      >
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=Pacifico&display=swap" rel="stylesheet" />

      <button onClick={onBack} style={{ background: 'none', border: 'none', color: t.textFaint, cursor: 'pointer', fontSize: 13, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontFamily: 'inherit' }}>← All Brands</button>

      {/* Hero */}
      <div style={{ background: '#0D0D0D', borderRadius: headerStyle === 'minimal' ? 12 : 20, overflow: 'hidden', marginBottom: '1.5rem', position: 'relative', minHeight: headerMinHeight }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 20% 50%, ${brand.color}55 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, ${brand.color}33 0%, transparent 60%)` }} />
        {headerStyle !== 'minimal' && brand.gallery && brand.gallery[0] && (
          <img src={brand.gallery[0]} alt={brand.name} className="brand-hero-bg" style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: headerStyle === 'compact' ? '40%' : '50%', objectFit: 'cover', opacity: 0.25, WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,0.8), transparent)', maskImage: 'linear-gradient(to left, rgba(0,0,0,0.8), transparent)' }} onError={e => { e.target.style.display = 'none'; }} />
        )}
        <div style={{ position: 'relative', zIndex: 2, padding: isMobile ? '1.5rem' : '2rem' }}>
          {brand.logoUrl && (
            <img src={brand.logoUrl} alt={`${brand.name} logo`} style={{ height: headerStyle === 'compact' ? 32 : 44, maxWidth: '100%', marginBottom: 10, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
          )}
          <div style={{ display: 'inline-block', background: brand.color + '22', border: `0.5px solid ${brand.color}55`, borderRadius: 20, padding: '4px 12px', fontSize: 10, color: brand.color, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>{brand.category}</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: headerStyle === 'compact' ? (isMobile ? 30 : 40) : (isMobile ? 38 : 52), color: '#FFF', lineHeight: 0.95, marginBottom: 10 }}>{brand.name}</div>
          {headerStyle !== 'minimal' && (
            <div style={{ fontSize: headerStyle === 'compact' ? 12 : 13, color: '#AAA', maxWidth: 460, lineHeight: 1.7 }}>{brand.description}</div>
          )}
          {headerStyle === 'hero' && (
            <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, background: isDistributor ? 'rgba(201,168,76,0.15)' : 'rgba(76,175,125,0.15)', border: `0.5px solid ${isDistributor ? '#C9A84C' : '#4CAF7D'}55`, borderRadius: 20, padding: '5px 12px' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: isDistributor ? '#C9A84C' : '#4CAF7D' }} />
              <span style={{ fontSize: 11, color: isDistributor ? '#C9A84C' : '#4CAF7D', fontWeight: 500, letterSpacing: '0.06em' }}>{isDistributor ? 'Distributor Account' : 'Retailer Account'}</span>
            </div>
          )}
        </div>
      </div>

      {(isDistributor ? brand.distributorOrderNote : brand.retailerOrderNote) && (
        <div style={{
          background: isDistributor ? t.warningBg : t.successBg,
          border: `0.5px solid ${isDistributor ? t.warningBorder : t.successBorder}`,
          borderRadius: 12,
          padding: '12px 14px',
          marginBottom: '1.25rem',
          fontSize: 12,
          color: isDistributor ? t.warningText : t.successText,
          lineHeight: 1.55,
        }}>
          {isDistributor ? brand.distributorOrderNote : brand.retailerOrderNote}
        </div>
      )}

      {/* Gallery — only show slots with valid photos */}
      {galleryImages.length > 0 && (
        <div style={{ marginBottom: '1.5rem', maxWidth: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: t.textFaint, textTransform: 'uppercase' }}>Photos</div>
            {!isMobile && galleryImages.length > 1 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => scrollGallery(-1)} style={{ width: 28, height: 28, background: t.bgElevated, border: t.borderHairline, borderRadius: '50%', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', color: t.text }}>‹</button>
                <button type="button" onClick={() => scrollGallery(1)} style={{ width: 28, height: 28, background: t.bgElevated, border: t.borderHairline, borderRadius: '50%', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', color: t.text }}>›</button>
              </div>
            )}
          </div>
          {isMobile ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }} className="brand-gallery-grid">
              {galleryImages.map((img, i) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => { setLightboxIdx(i); setLightbox(img); }}
                  style={{
                    border: t.borderHairlineLight,
                    borderRadius: 12,
                    overflow: 'hidden',
                    padding: 0,
                    cursor: 'pointer',
                    background: t.bgMuted,
                    aspectRatio: '4/3',
                  }}
                >
                  <img
                    src={img}
                    alt={`${brand.name} ${i + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={() => markImageBroken(`gallery:${img}`)}
                  />
                </button>
              ))}
            </div>
          ) : (
            <div
              ref={galleryRef}
              className="brand-gallery-scroll"
              style={{
                display: 'flex',
                gap: 10,
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                paddingBottom: 8,
                scrollbarWidth: 'none',
                maxWidth: '100%',
              }}
            >
              {galleryImages.map((img, i) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => { setLightboxIdx(i); setLightbox(img); }}
                  style={{
                    flexShrink: 0,
                    width: 200,
                    height: 150,
                    borderRadius: 12,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    scrollSnapAlign: 'start',
                    border: t.borderHairlineLight,
                    padding: 0,
                    background: t.bgMuted,
                  }}
                >
                  <img
                    src={img}
                    alt={`${brand.name} ${i + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={() => markImageBroken(`gallery:${img}`)}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox with navigation */}
      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          {/* Main image */}
          <img src={lightbox} alt="Full size" style={{ maxWidth: 'calc(100% - 120px)', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} />

          {/* Close */}
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: 'none', borderRadius: '50%', width: 44, height: 44, color: '#FFF', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>×</button>

          {/* Left arrow */}
          {brand.gallery && galleryImages.length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => (i - 1 + galleryImages.length) % galleryImages.length); }}
              style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: 'none', borderRadius: '50%', width: 48, height: 48, color: '#FFF', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>‹</button>
          )}

          {/* Right arrow */}
          {brand.gallery && galleryImages.length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => (i + 1) % galleryImages.length); }}
              style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: 'none', borderRadius: '50%', width: 48, height: 48, color: '#FFF', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>›</button>
          )}

          {/* Counter */}
          {galleryImages.length > 1 && (
            <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.06em' }}>
              {lightboxIdx + 1} / {galleryImages.length}
            </div>
          )}

          {/* Dot strip */}
          {galleryImages.length > 1 && (
            <div style={{ position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
              {galleryImages.map((_, i) => (
                <div key={i} onClick={() => setLightboxIdx(i)} style={{ width: i === lightboxIdx ? 20 : 6, height: 6, borderRadius: 3, background: i === lightboxIdx ? '#FFF' : 'rgba(255,255,255,0.3)', cursor: 'pointer', transition: 'all 0.2s' }} />
              ))}
            </div>
          )}

          {/* Tap outside to close */}
          <div onClick={() => setLightbox(null)} style={{ position: 'absolute', inset: 0, zIndex: -1 }} />
        </div>
      )}

      <div style={{ background: brand.color + '12', border: `0.5px solid ${brand.color}33`, borderRadius: 10, padding: '10px 14px', marginBottom: '1.25rem', fontSize: 13, color: '#666' }}>
        👆 Tap options to build your quote list — we will follow up in {chatLabel} with pricing and availability.
      </div>
      {notifyMsg && (
        <div style={{ background: t.successBg, border: `0.5px solid ${t.successBorder}`, borderRadius: 10, padding: '10px 14px', marginBottom: '1rem', fontSize: 12, color: t.successText }}>
          {notifyMsg}
        </div>
      )}

      {/* Products */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, width: '100%' }}>
        {brand.products.map(product => {
          const productFlavors = isDistributor ? (product.flavors_distro || []) : (product.flavors_retail || []);
          const currentMode = getOrderMode(product);
          const orderOptions = getProductOrderOptions(product, userType);
          const showToggle = orderOptions.length > 1;
          const imageKey = `product:${product.sku}`;
          const showProductImage = product.image && !brokenImages[imageKey];

          return (
            <div key={product.sku} style={{ background: t.bgElevated, borderRadius: 16, overflow: 'hidden', maxWidth: '100%', minWidth: 0, width: '100%', ...productCardStyles[cardStyle] }}>
              {showProductImage && (
                <div className="brand-product-image" style={{ position: 'relative', height: 160, overflow: 'hidden', maxWidth: '100%' }}>
                  <img
                    src={product.image}
                    alt={product.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={() => markImageBroken(imageKey)}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65), transparent)' }} />
                  <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16 }}>
                    {productHeader(product, { onDark: true })}
                  </div>
                </div>
              )}

              {!showProductImage && (
                <div style={{ padding: '1rem 1.25rem 0.5rem', borderBottom: '0.5px solid #F0EDE8' }}>
                  {productHeader(product)}
                </div>
              )}

              <div style={{ padding: '1rem 1.25rem 1.25rem', minWidth: 0, overflow: 'hidden' }}>
                <ProductCommerceInfo
                  product={product}
                  brand={brand}
                  userType={userType}
                  orderMode={currentMode}
                  masterPricingQualified={masterPricingQualified}
                  pricingVisible={pricingVisible}
                  onSignIn={onSignIn}
                  onRequestAccess={onRequestAccess}
                />

                {/* Order unit toggle when multiple options are configured */}
                {showToggle && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: t.textFaint, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Default order by:</span>
                    <div style={{ display: 'flex', background: t.bgMuted, border: t.borderHairline, borderRadius: 8, overflow: 'hidden', flexWrap: 'wrap' }}>
                      {orderOptions.map(opt => (
                        <button key={opt.id} type="button" onClick={() => setProductOrderMode(product, opt.id)}
                          style={{ padding: '6px 14px', fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: currentMode === opt.id ? 600 : 400, background: currentMode === opt.id ? t.btnPrimaryBg : 'transparent', color: currentMode === opt.id ? t.btnPrimaryText : t.textMuted, transition: 'all 0.15s', textTransform: 'capitalize' }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Order unit label for single-option products */}
                {!showToggle && orderOptions.length === 1 && (
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 11, background: brand.color + '15', color: brand.color, border: `0.5px solid ${brand.color}44`, borderRadius: 20, padding: '4px 12px', fontWeight: 600, letterSpacing: '0.06em' }}>
                      {getOrderUnitHeading(product, userType, currentMode)} ordering
                    </span>
                  </div>
                )}

                <div style={{ fontSize: 10, color: t.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                  {showToggle || isDistributor
                    ? `Select ${getOrderUnitHeading(product, userType, getOrderMode(product))}(s)`
                    : 'Select Flavors'}
                </div>

                {/* Flavors/options grid */}
                <div style={{ display: 'grid', gridTemplateColumns: flavorGridCols, gap: 8, minWidth: 0, width: '100%' }}>
                  {productFlavors.map(flavor => {
                    const isSoldOut = flavor.includes(' SOLD OUT') || flavor.includes(' — SOLD OUT');
                    const selected = isInterested(product.sku, flavor);
                    const key = `${product.sku}__${flavor}`;

                    return (
                      <div key={flavor} style={{ position: 'relative', minWidth: 0, maxWidth: '100%' }}>
                        <button onClick={() => handleFlavorClick(product, flavor)} disabled={isSoldOut}
                          style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', background: selected ? brand.color + '15' : t.bgMuted, border: `0.5px solid ${selected ? brand.color : t.borderLight}`, borderRadius: 10, padding: '10px 12px', textAlign: 'left', cursor: isSoldOut ? 'not-allowed' : 'pointer', opacity: isSoldOut ? 0.4 : 1, transition: 'all 0.15s', outline: 'none', fontFamily: 'inherit', overflow: 'hidden' }}>
                          <div style={{ fontSize: 13, color: selected ? t.text : t.textSecondary, fontWeight: selected ? 500 : 400, lineHeight: 1.4, paddingRight: selected ? 24 : 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{flavor.replace(' — SOLD OUT', '')}</div>
                          {isSoldOut && <div style={{ fontSize: 10, color: '#E05A5A', marginTop: 2, fontWeight: 500 }}>Sold out</div>}
                          {selected && <div style={{ position: 'absolute', top: 10, right: 10, width: 20, height: 20, background: brand.color, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#FFF', fontWeight: 700 }}>✓</div>}
                        </button>
                        {isSoldOut && (
                          <button
                            type="button"
                            onClick={() => handleStockNotify(product, flavor)}
                            disabled={stockAlerts.has(stockAlertKey(product.sku, flavor)) || notifyBusy === stockAlertKey(product.sku, flavor)}
                            style={{
                              width: '100%',
                              marginTop: 6,
                              background: stockAlerts.has(stockAlertKey(product.sku, flavor)) ? t.bgMuted : t.goldBg,
                              color: stockAlerts.has(stockAlertKey(product.sku, flavor)) ? t.textMuted : t.gold,
                              border: `0.5px solid ${t.gold}`,
                              borderRadius: 8,
                              padding: '6px 10px',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: stockAlerts.has(stockAlertKey(product.sku, flavor)) ? 'default' : 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            {stockAlerts.has(stockAlertKey(product.sku, flavor))
                              ? '✓ Notify when back in stock'
                              : (notifyBusy === stockAlertKey(product.sku, flavor) ? 'Saving…' : 'Notify me when back in stock')}
                          </button>
                        )}

                        {selected && (
                          <div style={{ marginTop: 8, padding: '8px', background: t.bgMuted, borderRadius: 10, border: t.borderHairlineLight }}>
                            {showToggle && (
                              <div style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 10, color: t.textFaint, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Order by</div>
                                <div style={{ display: 'flex', background: t.bgElevated, border: t.borderHairline, borderRadius: 8, overflow: 'hidden', flexWrap: 'wrap' }}>
                                  {orderOptions.map(opt => {
                                    const lineMode = getOrderMode(product, key);
                                    return (
                                      <button
                                        key={opt.id}
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setLineOrderModeForFlavor(product, flavor, opt.id); }}
                                        style={{ padding: '5px 10px', fontSize: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: lineMode === opt.id ? 600 : 400, background: lineMode === opt.id ? brand.color : 'transparent', color: lineMode === opt.id ? '#FFF' : t.textMuted, textTransform: 'capitalize' }}
                                      >
                                        {opt.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, color: t.textFaint }}>Qty:</span>
                              <button type="button" onClick={() => setQty(key, (quantities[key] || minQtyForProduct(product, userType)) - 1, product, flavor)} style={{ width: 24, height: 24, background: t.bgElevated, border: t.borderHairline, borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textSecondary }}>−</button>
                              <input type="number" min={minQtyForProduct(product, userType)} value={quantities[key] || minQtyForProduct(product, userType)} onChange={e => setQty(key, e.target.value, product, flavor)}
                                style={{ width: 44, textAlign: 'center', background: t.inputBg, border: t.borderHairline, borderRadius: 6, padding: '4px', fontSize: 13, outline: 'none', fontFamily: 'inherit', color: t.text }} />
                              <button type="button" onClick={() => setQty(key, (quantities[key] || minQtyForProduct(product, userType)) + 1, product, flavor)} style={{ width: 24, height: 24, background: brand.color, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>+</button>
                              <span style={{ fontSize: 11, color: t.textFaint, fontWeight: 500 }}>{unitLabel(product, quantities[key] || minQtyForProduct(product, userType), key)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky submit */}
      {interests.length > 0 && (
        <div style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: stickyBottom,
          padding: '1rem',
          paddingLeft: 'max(1rem, var(--ga-inset-left))',
          paddingRight: 'max(1rem, var(--ga-inset-right))',
          background: 'rgba(245,242,237,0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '0.5px solid #E0DDD8',
          zIndex: 50,
          boxSizing: 'border-box',
        }}>
          <button onClick={onSubmit} style={{ width: '100%', maxWidth: 760, margin: '0 auto', display: 'block', background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 12, padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em', fontFamily: 'inherit' }}>
            Request quote ({interests.length} item{interests.length !== 1 ? 's' : ''}) →
          </button>
        </div>
      )}
      </div>
    </>
  );
}
