import React, { useState, useEffect, useRef } from 'react';
import { useBrandContent } from '../lib/content';
import { getButtonRadius } from '../lib/design';
import { supabase } from '../lib/supabase';

import MasterPricingNotice from './MasterPricingNotice';
import { useTheme } from '../context/ThemeContext';

export default function HomeView({ onBrandClick, isMobile, userType, masterPricingQualified, isStaff = false, chatLabel = 'Trade Desk' }) {
  const { t, isNight } = useTheme();
  const [slideIdx, setSlideIdx] = useState(0);
  const [galleryIdx, setGalleryIdx] = useState(0); // cycles hero bg image
  const [animating, setAnimating] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [cardTilts, setCardTilts] = useState({});
  const [brandOrder, setBrandOrder] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const autoTimer = useRef(null);
  const galleryTimer = useRef(null);
  const heroRef = useRef(null);
  const preloadedHeroImages = useRef(new Set());
  const { getMergedBrands, loading, heroConfig, globalStyles } = useBrandContent();
  const allBrands = getMergedBrands();

  // Load saved brand order
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.from('brand_content').select('brand_id').order('sort_order', { ascending: true });
        if (data && data.length > 0) {
          const ordered = data.map(d => allBrands.find(b => b.id === d.brand_id)).filter(Boolean);
          const rest = allBrands.filter(b => !ordered.find(o => o.id === b.id));
          setBrandOrder([...ordered, ...rest]);
        }
      } catch (_) {}
    };
    if (!loading) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const brands = brandOrder || allBrands;
  const heroBg = heroConfig.background_color || '#0D0D0D';
  const heroCtaBg = heroConfig.cta_color || 'rgba(255,255,255,0.95)';
  const heroCtaColor = heroConfig.cta_color ? '#FFF' : globalStyles.primary_color || '#1A1A1A';
  const ctaRadius = getButtonRadius(globalStyles.button_style);

  useEffect(() => {
    if (!brands.length) return undefined;
    autoTimer.current = setInterval(() => setSlideIdx(i => (i + 1) % brands.length), 4500);
    return () => clearInterval(autoTimer.current);
  }, [brands.length]);

  // Cycle hero background image for current brand every 2.5s
  useEffect(() => {
    setGalleryIdx(0); // reset when brand changes
    const gallery = brands[slideIdx]?.gallery || [];
    if (gallery.length <= 1) return;
    galleryTimer.current = setInterval(() => setGalleryIdx(i => (i + 1) % gallery.length), 2500);
    return () => clearInterval(galleryTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIdx]);

  // Preload hero gallery images for the active brand (avoids pop-in on 2nd+ photo)
  useEffect(() => {
    const gallery = brands[slideIdx]?.gallery || [];
    gallery.forEach(src => {
      if (!src || preloadedHeroImages.current.has(src)) return;
      const img = new Image();
      img.src = src;
      preloadedHeroImages.current.add(src);
    });
  }, [slideIdx, brands]);

  // Prefetch the next gallery frame before it appears
  useEffect(() => {
    const gallery = brands[slideIdx]?.gallery || [];
    if (gallery.length <= 1) return;
    const nextSrc = gallery[(galleryIdx + 1) % gallery.length];
    if (nextSrc && !preloadedHeroImages.current.has(nextSrc)) {
      const img = new Image();
      img.src = nextSrc;
      preloadedHeroImages.current.add(nextSrc);
    }
  }, [slideIdx, galleryIdx, brands]);

  const changeSlide = (newIdx) => {
    if (animating || newIdx === slideIdx) return;
    clearInterval(autoTimer.current);
    setAnimating(true);
    setSlideIdx(newIdx);
    setTimeout(() => setAnimating(false), 600);
    if (brands.length) {
      autoTimer.current = setInterval(() => setSlideIdx(i => (i + 1) % brands.length), 4500);
    }
  };

  const handleHeroMouseMove = (e) => {
    if (isMobile || !heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 16;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 8;
    setMousePos({ x, y });
  };

  // 3D card tilt
  const handleCardMouseMove = (e, brandId) => {
    if (isMobile) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 24;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 18;
    setCardTilts(prev => ({ ...prev, [brandId]: { x, y } }));
  };

  const handleCardMouseLeave = (brandId) => {
    setCardTilts(prev => ({ ...prev, [brandId]: { x: 0, y: 0 } }));
  };

  // Drag to reorder
  const handleDragStart = (e, idx) => {
    setDragging(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(idx);
  };

  const handleDrop = async (e, idx) => {
    e.preventDefault();
    if (dragging === null || dragging === idx) { setDragging(null); setDragOver(null); return; }
    const newOrder = [...brands];
    const [moved] = newOrder.splice(dragging, 1);
    newOrder.splice(idx, 0, moved);
    setBrandOrder(newOrder);
    setDragging(null);
    setDragOver(null);
    // Save order to Supabase
    await Promise.all(newOrder.map((brand, i) =>
      supabase.from('brand_content').upsert({ brand_id: brand.id, sort_order: i, updated_at: new Date().toISOString() }, { onConflict: 'brand_id' })
    ));
  };

  if (loading) {
    return (
      <div style={{ minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: `2px solid ${t.border}`, borderTopColor: t.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!brands.length) {
    return (
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: t.textMuted, fontSize: 14 }}>
        No brands are visible right now. Contact your rep if this looks wrong.
      </div>
    );
  }

  return (
    <div>
      <style>{`
        @keyframes cardEntrance { from{opacity:0;transform:translateY(24px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }
        .hero-arrow-zone:hover > .arrow-inner { background: rgba(255,255,255,0.28) !important; transform: scale(1.12) !important; }
        .arrow-inner { transition: all 0.2s ease !important; }
        .hero-gallery-photo {
          transition: opacity 1.6s ease-in-out;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .hero-gallery-stack--float {
          animation: heroImgFloat 10s ease-in-out infinite;
        }
        @keyframes heroImgFloat { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(0,-6px,0)} }
        .hero-slide-copy {
          transition: opacity 0.85s ease-in-out;
        }
        .hero-slide-copy--active {
          opacity: 1;
        }
        .hero-slide-copy--inactive {
          opacity: 0;
          pointer-events: none;
        }
      `}</style>

      {/* HERO */}
      <div ref={heroRef} onMouseMove={handleHeroMouseMove} onMouseLeave={() => setMousePos({ x: 0, y: 0 })}
        style={{ margin: isMobile ? '0.75rem' : '1.25rem', borderRadius: 24, overflow: 'hidden', position: 'relative', height: isMobile ? 300 : 500, background: heroBg, userSelect: 'none' }}>
        {brands.map((brand, i) => (
          <div key={brand.id} style={{ position: 'absolute', inset: 0, transition: 'opacity 0.7s ease', opacity: i === slideIdx ? 1 : 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 20% 60%, ${brand.color}65 0%, transparent 50%), radial-gradient(ellipse at 80% 30%, ${brand.color}30 0%, transparent 50%), ${heroBg}` }} />
            {brand.gallery && brand.gallery.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  right: '-2%',
                  top: 0,
                  width: isMobile ? '70%' : '55%',
                  height: '100%',
                  transform: `translate(${mousePos.x * 0.4}px, ${mousePos.y * 0.4}px)`,
                  transition: 'transform 0.4s ease-out',
                }}
              >
                <div className={i === slideIdx && !isNight && !isMobile ? 'hero-gallery-stack hero-gallery-stack--float' : 'hero-gallery-stack'} style={{ position: 'absolute', inset: 0 }}>
                  {brand.gallery.map((img, gi) => {
                    const isActiveBrand = i === slideIdx;
                    const isVisible = isActiveBrand && gi === galleryIdx;
                    return (
                      <img
                        key={img}
                        src={img}
                        alt=""
                        aria-hidden="true"
                        loading={isActiveBrand && gi < 2 ? 'eager' : 'lazy'}
                        decoding="async"
                        className="hero-gallery-photo"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          opacity: isVisible ? 0.38 : 0,
                          zIndex: isVisible ? 2 : 1,
                          WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 45%, transparent 90%)',
                          maskImage: 'linear-gradient(to left, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 45%, transparent 90%)',
                        }}
                        onError={e => { e.target.style.opacity = 0; }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
        {brands.map((brand, i) => {
          const isActive = i === slideIdx;
          const slideHeadline = heroConfig.headline || brand.name;
          const slideSubheadline = heroConfig.subheadline || brand.tagline;
          const slideCta = heroConfig.cta_text || `Explore ${brand.name}`;
          return (
            <div
              key={`copy-${brand.id}`}
              className={`hero-slide-copy ${isActive ? 'hero-slide-copy--active' : 'hero-slide-copy--inactive'}`}
              onClick={() => onBrandClick(brand.id)}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: isMobile ? '2rem 3.5rem 1.75rem' : '3rem 8rem 2.5rem',
                cursor: 'pointer',
                transform: isActive ? `perspective(800px) rotateY(${mousePos.x * 0.03}deg) rotateX(${-mousePos.y * 0.03}deg)` : 'none',
                transition: 'transform 0.35s ease-out',
              }}
            >
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 520 }}>
                <div style={{ display: 'inline-block', background: brand.color + '28', border: `1px solid ${brand.color}66`, borderRadius: 20, padding: '5px 16px', fontSize: 10, color: brand.color, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 700, backdropFilter: 'blur(6px)' }}>{brand.category}</div>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: isMobile ? 54 : 88,
                  letterSpacing: '0.03em',
                  color: '#FFF',
                  lineHeight: 0.9,
                  marginBottom: 14,
                  textShadow: '0 4px 32px rgba(0,0,0,0.5)',
                  minHeight: isMobile ? '2.6em' : '1.8em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  maxWidth: '100%',
                }}>
                  {slideHeadline}
                </div>
                <div style={{ fontSize: isMobile ? 13 : 15, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', maxWidth: 360, minHeight: isMobile ? 40 : 44, lineHeight: 1.5 }}>{slideSubheadline}</div>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: heroCtaBg, color: heroCtaColor, borderRadius: ctaRadius, padding: isMobile ? '12px 22px' : '14px 30px', fontSize: isMobile ? 13 : 14, fontWeight: 700, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', letterSpacing: '0.03em', flexShrink: 0 }}>
                {slideCta} <span style={{ fontSize: 16 }}>→</span>
              </div>
            </div>
          );
        })}
        <div className="hero-arrow-zone" onClick={(e) => { e.stopPropagation(); changeSlide((slideIdx - 1 + brands.length) % brands.length); }}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: isMobile ? 56 : 72, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <div className="arrow-inner" style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: 18 }}>‹</div>
        </div>
        <div className="hero-arrow-zone" onClick={(e) => { e.stopPropagation(); changeSlide((slideIdx + 1) % brands.length); }}
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: isMobile ? 56 : 72, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <div className="arrow-inner" style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: 18 }}>›</div>
        </div>
        <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '3px 10px', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em' }}>
          {slideIdx + 1} / {brands.length}
        </div>
      </div>

      {/* 3D BRAND GRID */}
      <div style={{ padding: isMobile ? '0 0.75rem 2rem' : '0 1.25rem 2rem' }}>
        {userType === 'distributor' && !isStaff && (
          <MasterPricingNotice qualified={masterPricingQualified} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', color: t.textFaint, textTransform: 'uppercase', fontWeight: 500 }}>Our Brands</div>
          <div style={{ fontSize: 11, color: t.textDisabled }}>{brands.length} brands · drag to reorder</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? 12 : 16 }}>
          {brands.map((brand, idx) => {
            const tilt = cardTilts[brand.id] || { x: 0, y: 0 };
            const isDraggingThis = dragging === idx;
            const isDragTarget = dragOver === idx;
            return (
              <a key={brand.id}
                href={`#${brand.id}`}
                onClick={(e) => { e.preventDefault(); onBrandClick(brand.id); }}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={() => { setDragging(null); setDragOver(null); }}
                onMouseMove={(e) => handleCardMouseMove(e, brand.id)}
                onMouseLeave={() => handleCardMouseLeave(brand.id)}
                style={{
                  display: 'block', textDecoration: 'none', color: 'inherit',
                  background: t.bgElevated,
                  border: `0.5px solid ${isDragTarget ? brand.color : t.borderLight}`,
                  borderRadius: 18,
                  padding: 0,
                  cursor: 'grab',
                  outline: 'none',
                  overflow: 'visible',
                  opacity: isDraggingThis ? 0.4 : 1,
                  animation: `cardEntrance 0.4s ease-out ${idx * 0.06}s both`,
                  // 3D transform
                  transform: isMobile
                    ? 'none'
                    : `perspective(600px) rotateY(${tilt.x * 0.6}deg) rotateX(${-tilt.y * 0.6}deg) translateZ(0) scale(${tilt.x !== 0 || tilt.y !== 0 ? 1.04 : 1})`,
                  transition: isMobile ? 'box-shadow 0.2s ease' : 'transform 0.15s ease-out, box-shadow 0.2s ease, border-color 0.2s',
                  boxShadow: isMobile
                    ? `0 4px 16px ${t.shadow}`
                    : (tilt.x !== 0 || tilt.y !== 0
                      ? `${-tilt.x * 0.5}px ${tilt.y * 0.5}px 32px ${t.shadow}, 0 8px 24px ${brand.color}22, inset 0 1px 0 ${isNight ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)'}`
                      : `0 4px 16px ${t.shadow}, inset 0 1px 0 ${isNight ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)'}`),
                  transformStyle: 'preserve-3d',
                }}>

                {/* Card shine layer */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 18, pointerEvents: 'none', zIndex: 2,
                  background: tilt.x !== 0 || tilt.y !== 0
                    ? `radial-gradient(circle at ${50 + tilt.x * 2}% ${50 - tilt.y * 2}%, rgba(255,255,255,0.18) 0%, transparent 60%)`
                    : 'none',
                  transition: 'background 0.15s ease-out',
                }} />

                {/* Image area */}
                <div style={{ height: isMobile ? 90 : 130, overflow: 'hidden', position: 'relative', background: `linear-gradient(135deg, ${brand.color}20, ${brand.color}06)`, borderRadius: '18px 18px 0 0' }}>
                  {brand.gallery && brand.gallery[0] ? (
                    <img src={brand.gallery[0]} alt={brand.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease', transform: `scale(${tilt.x !== 0 || tilt.y !== 0 ? 1.06 : 1})` }}
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, color: brand.color + '33', letterSpacing: '0.05em', transform: 'translateZ(20px)' }}>{brand.name[0]}</div>
                    </div>
                  )}
                  {/* Gradient overlay */}
                  <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, transparent 40%, rgba(255,255,255,0.15))` }} />
                  {/* Color bar */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: `linear-gradient(to right, ${brand.color}, ${brand.color}88)` }} />
                </div>

                {/* Card content */}
                <div style={{ padding: isMobile ? '0.75rem' : '1rem', position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: 9, color: brand.color, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5, fontWeight: 700 }}>{brand.category}</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: isMobile ? 19 : 23, letterSpacing: '0.04em', color: t.text, lineHeight: 1 }}>{brand.name}</div>
                  <div style={{ fontSize: 10, color: t.textFaint, marginTop: 4, lineHeight: 1.5 }}>{brand.tagline}</div>
                  <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: brand.color, fontWeight: 600, background: brand.color + '12', borderRadius: 6, padding: '4px 8px' }}>View →</div>
                </div>
              </a>
            );
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: t.textDisabled }}>Drag cards to reorder · Order saves automatically</div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: t.borderHairline, padding: '2rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.12em', color: t.text, marginBottom: 6 }}>Global Access</div>
        <div style={{ fontSize: 12, color: t.textDisabled }}>Trade portal · Invite only · Contact us via {chatLabel} or your quote request</div>
      </div>
    </div>
  );
}
