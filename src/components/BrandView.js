import React, { useState, useRef } from 'react';

export default function BrandView({ brand, userType, onBack, toggleInterest, isInterested, interests, onSubmit, isMobile }) {
  const [lightbox, setLightbox] = useState(null);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [orderMode, setOrderMode] = useState({}); // per sku: 'master_case' | 'pallet'
  const [quantities, setQuantities] = useState({}); // per flavor key: qty
  const galleryRef = useRef(null);
  const isDistributor = userType === 'distributor';

  // Keyboard navigation for lightbox
  React.useEffect(() => {
    const handleKey = (e) => {
      if (lightbox === null) return;
      const gallery = brand?.gallery || [];
      if (e.key === 'ArrowRight') setLightboxIdx(i => (i + 1) % gallery.length);
      if (e.key === 'ArrowLeft') setLightboxIdx(i => (i - 1 + gallery.length) % gallery.length);
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightbox, brand]);

  // Sync lightbox image when idx changes (only if already open)
  React.useEffect(() => {
    if (lightbox !== null && brand?.gallery && lightboxIdx >= 0) {
      setLightbox(brand.gallery[lightboxIdx]);
    }
  }, [lightboxIdx]); // eslint-disable-line

  const scrollGallery = (dir) => {
    if (galleryRef.current) galleryRef.current.scrollBy({ left: dir * 220, behavior: 'smooth' });
  };

  const getOrderMode = (product) => {
    if (orderMode[product.sku]) return orderMode[product.sku];
    if (product.orderUnit === 'pallet') return 'pallet';
    if (product.orderUnit === 'master_case') return 'master_case';
    return 'master_case'; // default for 'both'
  };

  const setQty = (key, val) => {
    const n = parseInt(val) || 0;
    setQuantities(prev => ({ ...prev, [key]: n }));
  };

  const handleFlavorClick = (product, flavor) => {
    const isSoldOut = flavor.includes('SOLD OUT');
    if (isSoldOut) return;
    const mode = getOrderMode(product);
    const qty = quantities[`${product.sku}__${flavor}`] || 1;
    toggleInterest(product.sku, product.name, brand.name, flavor, qty, mode);
  };

  if (!brand) return null;

  const unitLabel = (product) => {
    const mode = getOrderMode(product);
    return mode === 'pallet' ? 'Pallet' : 'Master Case';
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem', paddingBottom: '6rem' }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=Pacifico&display=swap" rel="stylesheet" />

      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#AAA', cursor: 'pointer', fontSize: 13, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontFamily: 'inherit' }}>← All Brands</button>

      {/* Hero */}
      <div style={{ background: '#0D0D0D', borderRadius: 20, overflow: 'hidden', marginBottom: '1.5rem', position: 'relative', minHeight: isMobile ? 200 : 260 }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 20% 50%, ${brand.color}55 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, ${brand.color}33 0%, transparent 60%)` }} />
        {brand.gallery && brand.gallery[0] && (
          <img src={brand.gallery[0]} alt={brand.name} style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: '50%', objectFit: 'cover', opacity: 0.25, WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,0.8), transparent)', maskImage: 'linear-gradient(to left, rgba(0,0,0,0.8), transparent)' }} onError={e => { e.target.style.display = 'none'; }} />
        )}
        <div style={{ position: 'relative', zIndex: 2, padding: isMobile ? '1.5rem' : '2rem' }}>
          <div style={{ display: 'inline-block', background: brand.color + '22', border: `0.5px solid ${brand.color}55`, borderRadius: 20, padding: '4px 12px', fontSize: 10, color: brand.color, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 600 }}>{brand.category}</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: isMobile ? 38 : 52, color: '#FFF', lineHeight: 0.95, marginBottom: 10 }}>{brand.name}</div>
          <div style={{ fontSize: 13, color: '#AAA', maxWidth: 460, lineHeight: 1.7 }}>{brand.description}</div>
          <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, background: isDistributor ? 'rgba(201,168,76,0.15)' : 'rgba(76,175,125,0.15)', border: `0.5px solid ${isDistributor ? '#C9A84C' : '#4CAF7D'}55`, borderRadius: 20, padding: '5px 12px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: isDistributor ? '#C9A84C' : '#4CAF7D' }} />
            <span style={{ fontSize: 11, color: isDistributor ? '#C9A84C' : '#4CAF7D', fontWeight: 500, letterSpacing: '0.06em' }}>{isDistributor ? 'Distributor Account' : 'Retailer Account'}</span>
          </div>
        </div>
      </div>

      {/* Gallery */}
      {brand.gallery && brand.gallery.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#BBB', textTransform: 'uppercase' }}>Photos</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => scrollGallery(-1)} style={{ width: 28, height: 28, background: '#FFF', border: '0.5px solid #E0DDD8', borderRadius: '50%', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>‹</button>
              <button onClick={() => scrollGallery(1)} style={{ width: 28, height: 28, background: '#FFF', border: '0.5px solid #E0DDD8', borderRadius: '50%', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>›</button>
            </div>
          </div>
          <div ref={galleryRef} style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 8, scrollbarWidth: 'none' }}>
            {brand.gallery.map((img, i) => (
              <div key={i} onClick={() => { setLightboxIdx(i); setLightbox(img); }} style={{ flexShrink: 0, width: isMobile ? 160 : 200, height: isMobile ? 120 : 150, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', scrollSnapAlign: 'start', border: '0.5px solid #E8E4DF', transition: 'transform 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                <img src={img} alt={`${brand.name} ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.parentElement.style.background = '#F8F6F3'; e.target.style.display = 'none'; }} />
              </div>
            ))}
          </div>
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
          {brand.gallery && brand.gallery.length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => (i - 1 + brand.gallery.length) % brand.gallery.length); }}
              style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: 'none', borderRadius: '50%', width: 48, height: 48, color: '#FFF', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>‹</button>
          )}

          {/* Right arrow */}
          {brand.gallery && brand.gallery.length > 1 && (
            <button onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => (i + 1) % brand.gallery.length); }}
              style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: 'none', borderRadius: '50%', width: 48, height: 48, color: '#FFF', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>›</button>
          )}

          {/* Counter */}
          {brand.gallery && brand.gallery.length > 1 && (
            <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '5px 14px', fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.06em' }}>
              {lightboxIdx + 1} / {brand.gallery.length}
            </div>
          )}

          {/* Dot strip */}
          {brand.gallery && brand.gallery.length > 1 && (
            <div style={{ position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
              {brand.gallery.map((_, i) => (
                <div key={i} onClick={() => setLightboxIdx(i)} style={{ width: i === lightboxIdx ? 20 : 6, height: 6, borderRadius: 3, background: i === lightboxIdx ? '#FFF' : 'rgba(255,255,255,0.3)', cursor: 'pointer', transition: 'all 0.2s' }} />
              ))}
            </div>
          )}

          {/* Tap outside to close */}
          <div onClick={() => setLightbox(null)} style={{ position: 'absolute', inset: 0, zIndex: -1 }} />
        </div>
      )}

      <div style={{ background: brand.color + '12', border: `0.5px solid ${brand.color}33`, borderRadius: 10, padding: '10px 14px', marginBottom: '1.25rem', fontSize: 13, color: '#666' }}>
        👆 Tap any option you are interested in — we will reach out before your meeting with full details.
      </div>

      {/* Products */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {brand.products.map(product => {
          const productFlavors = isDistributor ? (product.flavors_distro || []) : (product.flavors_retail || []);
          const currentMode = getOrderMode(product);
          const showToggle = isDistributor && product.orderUnit === 'both';

          return (
            <div key={product.sku} style={{ background: '#FFF', border: '0.5px solid #E8E4DF', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
              {/* Product image */}
              {product.image && (
                <div style={{ position: 'relative', height: 160, overflow: 'hidden' }}>
                  <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.parentElement.style.display = 'none'; }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65), transparent)' }} />
                  <div style={{ position: 'absolute', bottom: 14, left: 16, right: 80 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: '#FFF', letterSpacing: '0.04em', lineHeight: 1 }}>{product.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>{product.detail}</div>
                  </div>
                  <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', borderRadius: 6, padding: '3px 9px', fontSize: 10, color: '#C9A84C', letterSpacing: '0.08em', fontWeight: 600 }}>SKU: {product.sku}</div>
                </div>
              )}

              {/* No image fallback — always shows name, detail, SKU */}
              {!product.image && (
                <div style={{ padding: '1rem 1.25rem 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, borderBottom: '0.5px solid #F0EDE8' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: '#1A1A1A', letterSpacing: '0.04em', lineHeight: 1 }}>{product.name}</div>
                    <div style={{ fontSize: 12, color: '#AAA', marginTop: 4, lineHeight: 1.5 }}>{product.detail}</div>
                  </div>
                  <div style={{ background: '#FDF6E3', border: '0.5px solid #F5D87A', borderRadius: 8, padding: '6px 12px', fontSize: 11, color: '#A07A20', fontWeight: 700, letterSpacing: '0.08em', flexShrink: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#C9A84C', letterSpacing: '0.1em', marginBottom: 2 }}>SKU</div>
                    {product.sku}
                  </div>
                </div>
              )}

              <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
                {/* Order unit toggle for distributors with 'both' option */}
                {showToggle && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 11, color: '#AAA', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Order by:</span>
                    <div style={{ display: 'flex', background: '#F8F6F3', border: '0.5px solid #E0DDD8', borderRadius: 8, overflow: 'hidden' }}>
                      {['master_case','pallet'].map(mode => (
                        <button key={mode} onClick={() => setOrderMode(prev => ({ ...prev, [product.sku]: mode }))}
                          style={{ padding: '6px 14px', fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: currentMode === mode ? 600 : 400, background: currentMode === mode ? '#1A1A1A' : 'transparent', color: currentMode === mode ? '#FFF' : '#888', transition: 'all 0.15s' }}>
                          {mode === 'master_case' ? 'Master Case' : 'Pallet'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Order unit label for non-toggle products */}
                {!showToggle && isDistributor && (
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 11, background: brand.color + '15', color: brand.color, border: `0.5px solid ${brand.color}44`, borderRadius: 20, padding: '4px 12px', fontWeight: 600, letterSpacing: '0.06em' }}>
                      {currentMode === 'pallet' ? 'Pallet Ordering' : 'Master Case Ordering'}
                    </span>
                  </div>
                )}

                <div style={{ fontSize: 10, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
                  {isDistributor ? `Select ${unitLabel(product)}(s)` : 'Select Flavors'}
                </div>

                {/* Flavors/options grid */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                  {productFlavors.map(flavor => {
                    const isSoldOut = flavor.includes('SOLD OUT');
                    const selected = isInterested(product.sku, flavor);
                    const key = `${product.sku}__${flavor}`;

                    return (
                      <div key={flavor} style={{ position: 'relative' }}>
                        <button onClick={() => handleFlavorClick(product, flavor)} disabled={isSoldOut}
                          style={{ width: '100%', background: selected ? brand.color + '15' : '#F8F6F3', border: `0.5px solid ${selected ? brand.color : '#E8E4DF'}`, borderRadius: 10, padding: '10px 12px', textAlign: 'left', cursor: isSoldOut ? 'not-allowed' : 'pointer', opacity: isSoldOut ? 0.4 : 1, transition: 'all 0.15s', outline: 'none', fontFamily: 'inherit' }}>
                          <div style={{ fontSize: 13, color: selected ? '#1A1A1A' : '#444', fontWeight: selected ? 500 : 400, lineHeight: 1.4, paddingRight: selected ? 24 : 0 }}>{flavor.replace(' — SOLD OUT', '')}</div>
                          {isSoldOut && <div style={{ fontSize: 10, color: '#E05A5A', marginTop: 2, fontWeight: 500 }}>Sold out</div>}
                          {selected && <div style={{ position: 'absolute', top: 10, right: 10, width: 20, height: 20, background: brand.color, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#FFF', fontWeight: 700 }}>✓</div>}
                        </button>

                        {/* Qty input when selected */}
                        {selected && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '0 2px' }}>
                            <span style={{ fontSize: 11, color: '#AAA' }}>Qty:</span>
                            <button onClick={() => setQty(key, (quantities[key] || 1) - 1)} style={{ width: 24, height: 24, background: '#F8F6F3', border: '0.5px solid #E0DDD8', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>−</button>
                            <input type="number" min="1" value={quantities[key] || 1} onChange={e => setQty(key, e.target.value)}
                              style={{ width: 44, textAlign: 'center', background: '#F8F6F3', border: '0.5px solid #E0DDD8', borderRadius: 6, padding: '4px', fontSize: 13, outline: 'none', fontFamily: 'inherit', color: '#1A1A1A' }} />
                            <button onClick={() => setQty(key, (quantities[key] || 1) + 1)} style={{ width: 24, height: 24, background: brand.color, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>+</button>
                            <span style={{ fontSize: 11, color: '#AAA' }}>{unitLabel(product)}{(quantities[key] || 1) !== 1 ? 's' : ''}</span>
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
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '1rem', background: 'rgba(245,242,237,0.95)', backdropFilter: 'blur(12px)', borderTop: '0.5px solid #E0DDD8', zIndex: 50 }}>
          <button onClick={onSubmit} style={{ width: '100%', maxWidth: 760, margin: '0 auto', display: 'block', background: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: 12, padding: '14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em', fontFamily: 'inherit' }}>
            Submit Interest List ({interests.length} item{interests.length !== 1 ? 's' : ''}) →
          </button>
        </div>
      )}
    </div>
  );
}
