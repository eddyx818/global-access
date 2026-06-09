import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useBrandContent, pickRotatingCatalogPhotos } from '../lib/content';
import { customerChatActionLabel } from '../lib/chatLabels';
import { applyBrandOrder, saveUserBrandOrder } from '../lib/userBrandOrder';

import MasterPricingNotice from './MasterPricingNotice';
import { useTheme } from '../context/ThemeContext';

/** Always lead the hero with this brand, then rotate in catalog card order. */
const HERO_LEAD_BRAND_ID = 'churros-locos';
/** Brand-to-brand hero fade — keep in sync with .hero-slide-copy transition. */
const HERO_BRAND_FADE_MS = 850;

function heroLeadIndex(brands) {
  if (!brands?.length) return 0;
  const i = brands.findIndex(b => b.id === HERO_LEAD_BRAND_ID);
  return i >= 0 ? i : 0;
}

export default function HomeView({
  onBrandClick,
  isMobile,
  userId,
  userType,
  masterPricingQualified,
  isStaff = false,
  chatLabel = 'Trade Desk',
  onMessageUs = null,
  onBrowseSignUp = null,
  onBrowseSignIn = null,
  visible = true,
}) {
  const { t, isNight } = useTheme();
  const [slideIdx, setSlideIdx] = useState(null);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [skipGalleryFade, setSkipGalleryFade] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [cardTilts, setCardTilts] = useState({});
  const [customOrder, setCustomOrder] = useState(null);
  const [heroTransitions, setHeroTransitions] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [swapSourceIdx, setSwapSourceIdx] = useState(null);
  const [arrowPressed, setArrowPressed] = useState(null);
  const autoTimer = useRef(null);
  const galleryTimer = useRef(null);
  const heroRef = useRef(null);
  const heroTouchRef = useRef({ startX: 0, startY: 0, startTime: 0, moved: false, suppressTap: false });
  const brandPressRef = useRef({ startTime: 0, longPressFired: false, idx: null });
  const longPressTimer = useRef(null);
  const prevVisibleRef = useRef(false);
  const preloadedHeroImages = useRef(new Set());
  const { getMergedBrands, loading, heroConfig } = useBrandContent();
  const allBrands = getMergedBrands();

  const brands = useMemo(() => {
    if (loading || !allBrands.length) return [];
    return customOrder ?? applyBrandOrder(allBrands, userId);
  }, [loading, customOrder, allBrands, userId]);

  const leadIdx = useMemo(() => heroLeadIndex(brands), [brands]);
  const activeSlideIdx = slideIdx ?? leadIdx;

  const catalogPhotosFor = (brand) => {
    if (!brand) return [];
    return (brand.catalogGallery?.length ? brand.catalogGallery : brand.gallery) || [];
  };

  const heroGallerySeed = useMemo(() => {
    try {
      let seed = sessionStorage.getItem('ga-hero-gallery-seed');
      if (!seed) {
        seed = String(Date.now());
        sessionStorage.setItem('ga-hero-gallery-seed', seed);
      }
      return seed;
    } catch (_) {
      return '0';
    }
  }, []);

  const heroPhotosFor = (brand) => {
    if (!brand) return [];
    if (brand.featuredCatalogPhotos?.length) {
      return pickRotatingCatalogPhotos(
        brand.featuredCatalogPhotos,
        `${brand.id}:hero:${heroGallerySeed}`,
      );
    }
    return catalogPhotosFor(brand);
  };

  const heroBg = heroConfig.background_color || '#0D0D0D';

  useEffect(() => {
    setCustomOrder(null);
  }, [userId]);

  // Start on Churros Locos whenever home becomes visible (avoids flash from stale index 0).
  useLayoutEffect(() => {
    if (!brands.length) return;
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;
    if (!visible) return;
    if (!wasVisible) {
      setSlideIdx(heroLeadIndex(brands));
      setGalleryIdx(0);
      return;
    }
    setSlideIdx(prev => (prev == null || prev >= brands.length ? heroLeadIndex(brands) : prev));
  }, [visible, brands.length, leadIdx, brands]);

  useEffect(() => {
    if (!visible) {
      setHeroTransitions(false);
      return undefined;
    }
    let innerId = 0;
    const outerId = requestAnimationFrame(() => {
      innerId = requestAnimationFrame(() => setHeroTransitions(true));
    });
    return () => {
      cancelAnimationFrame(outerId);
      cancelAnimationFrame(innerId);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !brands.length) {
      clearInterval(autoTimer.current);
      return undefined;
    }
    autoTimer.current = setInterval(() => setSlideIdx(i => (i + 1) % brands.length), 4500);
    return () => clearInterval(autoTimer.current);
  }, [brands.length, visible]);

  useEffect(() => {
    if (!visible) {
      clearInterval(galleryTimer.current);
      return undefined;
    }
    setGalleryIdx(0);
    setSkipGalleryFade(true);
    const fadeUnlockId = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSkipGalleryFade(false));
    });
    const gallery = heroPhotosFor(brands[activeSlideIdx]);
    if (gallery.length <= 1) {
      return () => cancelAnimationFrame(fadeUnlockId);
    }
    galleryTimer.current = setInterval(() => setGalleryIdx(i => (i + 1) % gallery.length), 2500);
    return () => {
      cancelAnimationFrame(fadeUnlockId);
      clearInterval(galleryTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlideIdx, visible, heroGallerySeed]);

  // Preload hero gallery images for the active brand (avoids pop-in on 2nd+ photo)
  useEffect(() => {
    if (!brands.length) return;
    const gallery = heroPhotosFor(brands[activeSlideIdx]);
    gallery.forEach(src => {
      if (!src || preloadedHeroImages.current.has(src)) return;
      const img = new Image();
      img.src = src;
      preloadedHeroImages.current.add(src);
    });
    const nextIdx = (activeSlideIdx + 1) % brands.length;
    heroPhotosFor(brands[nextIdx]).forEach(src => {
      if (!src || preloadedHeroImages.current.has(src)) return;
      const img = new Image();
      img.src = src;
      preloadedHeroImages.current.add(src);
    });
  }, [activeSlideIdx, brands, heroGallerySeed]);

  // Prefetch the next gallery frame before it appears
  useEffect(() => {
    const gallery = heroPhotosFor(brands[activeSlideIdx]);
    if (gallery.length <= 1) return;
    const nextSrc = gallery[(galleryIdx + 1) % gallery.length];
    if (nextSrc && !preloadedHeroImages.current.has(nextSrc)) {
      const img = new Image();
      img.src = nextSrc;
      preloadedHeroImages.current.add(nextSrc);
    }
  }, [activeSlideIdx, galleryIdx, brands, heroGallerySeed]);

  const changeSlide = (newIdx) => {
    if (animating || newIdx === activeSlideIdx) return;
    clearInterval(autoTimer.current);
    setAnimating(true);
    setSlideIdx(newIdx);
    setGalleryIdx(0);
    setTimeout(() => setAnimating(false), 600);
    if (brands.length) {
      autoTimer.current = setInterval(() => setSlideIdx(i => (i + 1) % brands.length), 4500);
    }
  };

  const TAP_MAX_MS = 280;
  const TAP_MAX_MOVE_PX = 14;
  const LONG_PRESS_MS = 3000;
  const SWIPE_MIN_PX = 44;
  const DRAG_START_PX = 12;

  const resetBrandPress = () => {
    brandPressRef.current = {
      idx: null,
      startTime: 0,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      moved: false,
      longPressFired: false,
    };
  };

  const markBrandPressMoved = () => {
    brandPressRef.current.moved = true;
    clearLongPress();
  };

  const isDeliberateTap = (st) => {
    if (st.moved) return false;
    const elapsed = Date.now() - st.startTime;
    if (elapsed > TAP_MAX_MS) return false;
    const dx = st.lastX - st.startX;
    const dy = st.lastY - st.startY;
    return Math.hypot(dx, dy) <= TAP_MAX_MOVE_PX;
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const exitReorderMode = () => {
    setReorderMode(false);
    setSwapSourceIdx(null);
    clearLongPress();
    resetBrandPress();
  };

  const enterReorderMode = (idx = null) => {
    setReorderMode(true);
    setSwapSourceIdx(typeof idx === 'number' ? idx : null);
    if (typeof idx === 'number' && navigator.vibrate) navigator.vibrate(25);
  };

  useEffect(() => {
    if (!reorderMode || !isMobile) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [reorderMode, isMobile]);

  const releaseArrowPress = (side) => {
    setArrowPressed(prev => (prev === side ? null : prev));
  };

  const handleHeroTouchStart = (e) => {
    if (!isMobile || e.touches.length !== 1) return;
    const touch = e.touches[0];
    heroTouchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      startTime: Date.now(),
      moved: false,
      suppressTap: false,
    };
  };

  const handleHeroTouchMove = (e) => {
    if (!isMobile || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const st = heroTouchRef.current;
    st.lastX = touch.clientX;
    st.lastY = touch.clientY;
    const dx = touch.clientX - st.startX;
    const dy = touch.clientY - st.startY;
    if (Math.abs(dx) > TAP_MAX_MOVE_PX || Math.abs(dy) > TAP_MAX_MOVE_PX) {
      st.moved = true;
    }
    // Horizontal swipe on hero carousel — keep page from scrolling sideways
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > DRAG_START_PX) {
      e.preventDefault();
    }
  };

  const handleHeroTouchEnd = (e) => {
    if (!isMobile) return;
    const st = heroTouchRef.current;
    const touch = e.changedTouches[0];
    st.lastX = touch.clientX;
    st.lastY = touch.clientY;
    const dx = touch.clientX - st.startX;
    const dy = touch.clientY - st.startY;
    const elapsed = Date.now() - st.startTime;

    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) changeSlide((activeSlideIdx + 1) % brands.length);
      else changeSlide((activeSlideIdx - 1 + brands.length) % brands.length);
      st.suppressTap = true;
      window.setTimeout(() => { st.suppressTap = false; }, 350);
      return;
    }

    // Vertical scroll or any drag — never open a brand from the hero
    if (Math.abs(dy) > TAP_MAX_MOVE_PX && Math.abs(dy) >= Math.abs(dx)) return;
    if (st.moved || st.suppressTap) return;
    if (isDeliberateTap(st)) {
      onBrandClick(brands[activeSlideIdx]?.id);
    }
  };

  useEffect(() => {
    const el = heroRef.current;
    if (!el || !isMobile) return undefined;
    el.addEventListener('touchmove', handleHeroTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', handleHeroTouchMove);
  }, [isMobile, activeSlideIdx, brands.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const applyBrandReorder = (fromIdx, toIdx) => {
    if (fromIdx === null || toIdx === null || fromIdx === toIdx) return;
    const newOrder = [...brands];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);
    setCustomOrder(newOrder);
    saveUserBrandOrder(userId, newOrder.map(b => b.id));
  };

  const handleBrandSwapTap = (idx) => {
    if (swapSourceIdx === null) {
      setSwapSourceIdx(idx);
      return;
    }
    if (swapSourceIdx === idx) {
      setSwapSourceIdx(null);
      return;
    }
    applyBrandReorder(swapSourceIdx, idx);
    setSwapSourceIdx(null);
  };

  const handleBrandPressStart = (e, idx) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    brandPressRef.current = {
      idx,
      startTime: Date.now(),
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      moved: false,
      longPressFired: false,
    };
    if (reorderMode) return;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      if (brandPressRef.current.moved || brandPressRef.current.idx !== idx) return;
      brandPressRef.current.longPressFired = true;
      enterReorderMode(idx);
    }, LONG_PRESS_MS);
  };

  const handleBrandTouchMove = (e, idx) => {
    if (!isMobile || brandPressRef.current.idx !== idx) return;
    const touch = e.touches[0];
    const st = brandPressRef.current;
    st.lastX = touch.clientX;
    st.lastY = touch.clientY;
    const dx = touch.clientX - st.startX;
    const dy = touch.clientY - st.startY;
    if (Math.abs(dx) > TAP_MAX_MOVE_PX || Math.abs(dy) > TAP_MAX_MOVE_PX) {
      markBrandPressMoved();
    }
  };

  const handleBrandPressEnd = (idx, brandId) => {
    if (!isMobile) return;
    const st = brandPressRef.current;
    clearLongPress();
    if (st.idx !== idx) return;

    if (st.longPressFired) {
      resetBrandPress();
      return;
    }

    if (st.moved || !isDeliberateTap(st)) {
      resetBrandPress();
      return;
    }

    if (reorderMode) {
      handleBrandSwapTap(idx);
      resetBrandPress();
      return;
    }

    onBrandClick(brandId);
    resetBrandPress();
  };

  const handleBrandCardClick = (e, idx, brandId) => {
    e.preventDefault();
    if (isMobile) return;
    if (reorderMode) {
      handleBrandSwapTap(idx);
      return;
    }
    onBrandClick(brandId);
  };

  const handleHeroCopyClick = (brandId) => {
    if (isMobile) return;
    onBrandClick(brandId);
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
        @media (hover: hover) and (pointer: fine) {
          .hero-arrow-zone:hover > .arrow-inner {
            background: rgba(255,255,255,0.28) !important;
            transform: scale(1.12) !important;
          }
        }
        .hero-arrow-zone:active > .arrow-inner,
        .hero-arrow-zone.hero-arrow-zone--pressed > .arrow-inner {
          background: rgba(255,255,255,0.28) !important;
          transform: scale(1.08) !important;
        }
        .hero-arrow-zone:focus { outline: none; }
        .hero-arrow-zone:focus-visible > .arrow-inner {
          box-shadow: 0 0 0 2px rgba(255,255,255,0.45);
        }
        .arrow-inner { transition: background 0.2s ease, transform 0.2s ease !important; }
        .brand-card {
          -webkit-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
          touch-action: pan-y;
        }
        .brand-card--dragging {
          opacity: 0.45;
          z-index: 5;
        }
        .brand-card--reorder {
          cursor: grab;
          touch-action: none;
        }
        .hero-gallery-photo {
          transition: opacity 1.6s ease-in-out;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .hero-gallery-photo--instant {
          transition: none !important;
        }
        .hero-gallery-stack--float {
          animation: heroImgFloat 10s ease-in-out infinite;
        }
        @keyframes heroImgFloat { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(0,-6px,0)} }
        .hero-slide-copy {
          transition: opacity ${HERO_BRAND_FADE_MS}ms ease-in-out;
        }
        .hero-slide-copy--active {
          opacity: 1;
        }
        .hero-slide-copy--inactive {
          opacity: 0;
          pointer-events: none;
        }
        .hero-brand-slide {
          transition: opacity ${HERO_BRAND_FADE_MS}ms ease-in-out;
        }
      `}</style>

      {/* HERO */}
      <div
        ref={heroRef}
        className="hero-carousel app-no-select"
        onMouseMove={handleHeroMouseMove}
        onMouseLeave={() => setMousePos({ x: 0, y: 0 })}
        onTouchStart={handleHeroTouchStart}
        onTouchEnd={handleHeroTouchEnd}
        style={{
          margin: isMobile ? '0.75rem' : '1.25rem',
          borderRadius: 24,
          overflow: 'hidden',
          position: 'relative',
          height: isMobile ? 300 : 500,
          background: heroBg,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: isMobile ? 'pan-y' : 'auto',
        }}
      >
        {brands.map((brand, i) => {
          const heroPhotos = heroPhotosFor(brand);
          return (
          <div key={brand.id} className="hero-brand-slide" style={{
              position: 'absolute',
              inset: 0,
              zIndex: i === activeSlideIdx ? 2 : 1,
              transition: heroTransitions ? undefined : 'none',
              opacity: i === activeSlideIdx ? 1 : 0,
              pointerEvents: 'none',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 20% 60%, ${brand.color}65 0%, transparent 50%), radial-gradient(ellipse at 80% 30%, ${brand.color}30 0%, transparent 50%), ${heroBg}` }} />
            {heroPhotos.length > 0 && (
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
                <div className={i === activeSlideIdx && !isNight && !isMobile ? 'hero-gallery-stack hero-gallery-stack--float' : 'hero-gallery-stack'} style={{ position: 'absolute', inset: 0 }}>
                  {heroPhotos.map((img, gi) => {
                    const isActiveBrand = i === activeSlideIdx;
                    const isVisible = isActiveBrand && gi === galleryIdx;
                    return (
                      <img
                        key={img}
                        src={img}
                        alt=""
                        aria-hidden="true"
                        loading={isActiveBrand && gi < 2 ? 'eager' : 'lazy'}
                        decoding="async"
                        className={`hero-gallery-photo${skipGalleryFade && isVisible ? ' hero-gallery-photo--instant' : ''}`}
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
          );
        })}
        {brands.map((brand, i) => {
          const isActive = i === activeSlideIdx;
          const slideHeadline = heroConfig.headline || brand.name;
          const slideSubheadline = heroConfig.subheadline || brand.tagline;
          const heroPillStyle = {
            background: `${brand.color}28`,
            border: `1px solid ${brand.color}66`,
            borderRadius: 20,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          };
          return (
            <div
              key={`copy-${brand.id}`}
              className={`hero-slide-copy ${isActive ? 'hero-slide-copy--active' : 'hero-slide-copy--inactive'}`}
              role={isMobile ? undefined : 'button'}
              tabIndex={isMobile ? -1 : (isActive ? 0 : -1)}
              aria-hidden={!isActive}
              aria-label={isMobile ? undefined : `View ${brand.name}`}
              onClick={() => handleHeroCopyClick(brand.id)}
              onKeyDown={(e) => {
                if (isMobile) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleHeroCopyClick(brand.id);
                }
              }}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: isMobile ? '2rem 3.5rem 2rem' : '3rem 8rem 2.5rem',
                cursor: isMobile ? 'default' : 'pointer',
                pointerEvents: isActive ? (isMobile ? 'none' : 'auto') : 'none',
                transform: isActive ? `perspective(800px) rotateY(${mousePos.x * 0.03}deg) rotateX(${-mousePos.y * 0.03}deg)` : 'none',
                transition: heroTransitions
                  ? `opacity ${HERO_BRAND_FADE_MS}ms ease-in-out, transform 0.35s ease-out`
                  : 'transform 0.35s ease-out',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 520, gap: 14 }}>
                <div style={{ ...heroPillStyle, display: 'inline-block', padding: '5px 16px', fontSize: 10, color: brand.color, letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 700 }}>{brand.category}</div>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: isMobile ? 54 : 88,
                  letterSpacing: '0.03em',
                  color: '#FFF',
                  lineHeight: 0.9,
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
                {slideSubheadline && (
                  <div style={{
                    ...heroPillStyle,
                    padding: isMobile ? '10px 18px' : '12px 22px',
                    fontSize: isMobile ? 13 : 15,
                    color: 'rgba(255,255,255,0.88)',
                    letterSpacing: '0.04em',
                    maxWidth: 380,
                    lineHeight: 1.5,
                    fontWeight: 500,
                  }}>
                    {slideSubheadline}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <button
          type="button"
          className={`hero-arrow-zone app-no-select${arrowPressed === 'prev' ? ' hero-arrow-zone--pressed' : ''}`}
          aria-label="Previous brand"
          onClick={(e) => {
            e.stopPropagation();
            changeSlide((activeSlideIdx - 1 + brands.length) % brands.length);
          }}
          onPointerDown={() => setArrowPressed('prev')}
          onPointerUp={() => releaseArrowPress('prev')}
          onPointerLeave={() => releaseArrowPress('prev')}
          onPointerCancel={() => releaseArrowPress('prev')}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => { e.stopPropagation(); releaseArrowPress('prev'); e.currentTarget.blur(); }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: isMobile ? 56 : 72,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            padding: 0,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <div className="arrow-inner" style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: 18 }}>‹</div>
        </button>
        <button
          type="button"
          className={`hero-arrow-zone app-no-select${arrowPressed === 'next' ? ' hero-arrow-zone--pressed' : ''}`}
          aria-label="Next brand"
          onClick={(e) => {
            e.stopPropagation();
            changeSlide((activeSlideIdx + 1) % brands.length);
          }}
          onPointerDown={() => setArrowPressed('next')}
          onPointerUp={() => releaseArrowPress('next')}
          onPointerLeave={() => releaseArrowPress('next')}
          onPointerCancel={() => releaseArrowPress('next')}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => { e.stopPropagation(); releaseArrowPress('next'); e.currentTarget.blur(); }}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: isMobile ? 56 : 72,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            padding: 0,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <div className="arrow-inner" style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: 18 }}>›</div>
        </button>
        <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '3px 10px', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em' }}>
          {activeSlideIdx + 1} / {brands.length}
        </div>
      </div>

      {/* 3D BRAND GRID */}
      <div style={{ padding: isMobile ? '0 0.75rem 2rem' : '0 1.25rem 2rem' }}>
        {userType === 'distributor' && !isStaff && (
          <MasterPricingNotice qualified={masterPricingQualified} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', color: t.textFaint, textTransform: 'uppercase', fontWeight: 500 }}>Our Brands</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!reorderMode && (
              <button
                type="button"
                onClick={() => enterReorderMode(null)}
                style={{ background: t.bgHover, border: t.borderHairline, borderRadius: 8, padding: '4px 10px', fontSize: 11, color: t.textMuted, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Reorder
              </button>
            )}
            <div style={{ fontSize: 11, color: t.textDisabled }}>
              {reorderMode
                ? (swapSourceIdx != null ? 'Tap another brand to swap' : 'Tap a brand, then tap where to move it')
                : (isMobile ? 'Tap to open · hold 3 sec to reorder' : `${brands.length} brands · Reorder to arrange`)}
            </div>
          </div>
        </div>
        {reorderMode && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '8px 12px', background: t.warningBg, border: `0.5px solid ${t.warningBorder}`, borderRadius: 10, fontSize: 12, color: t.warningText }}>
            <span>
              {swapSourceIdx != null
                ? `Swap “${brands[swapSourceIdx]?.name}” — tap destination`
                : 'Reorder mode — tap a brand, then tap where to move it'}
            </span>
            <button type="button" onClick={exitReorderMode} style={{ background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? 12 : 16, touchAction: reorderMode ? 'manipulation' : undefined }}>
          {brands.map((brand, idx) => {
            const tilt = cardTilts[brand.id] || { x: 0, y: 0 };
            const isSelected = swapSourceIdx === idx;
            return (
              <div
                key={brand.id}
                role="button"
                tabIndex={0}
                data-brand-idx={idx}
                className={`brand-card app-no-select${isSelected ? ' brand-card--selected' : ''}${reorderMode ? ' brand-card--reorder' : ''}`}
                onClick={(e) => handleBrandCardClick(e, idx, brand.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (reorderMode) handleBrandSwapTap(idx);
                    else if (!isMobile) onBrandClick(brand.id);
                  }
                }}
                onTouchStart={(e) => isMobile && handleBrandPressStart(e, idx)}
                onTouchMove={(e) => isMobile && handleBrandTouchMove(e, idx)}
                onTouchEnd={() => isMobile && handleBrandPressEnd(idx, brand.id)}
                onTouchCancel={() => { clearLongPress(); resetBrandPress(); }}
                onMouseMove={(e) => !reorderMode && handleCardMouseMove(e, brand.id)}
                onMouseLeave={() => { clearLongPress(); handleCardMouseLeave(brand.id); }}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                  background: t.bgElevated,
                  border: `0.5px solid ${isSelected ? brand.color : t.borderLight}`,
                  borderRadius: 18,
                  padding: 0,
                  cursor: reorderMode ? 'pointer' : (isMobile ? 'pointer' : 'pointer'),
                  outline: 'none',
                  overflow: 'visible',
                  position: 'relative',
                  animation: reorderMode ? 'none' : `cardEntrance 0.4s ease-out ${idx * 0.06}s both`,
                  transform: isMobile || reorderMode
                    ? (isSelected ? 'scale(0.97)' : 'none')
                    : `perspective(600px) rotateY(${tilt.x * 0.6}deg) rotateX(${-tilt.y * 0.6}deg) translateZ(0) scale(${tilt.x !== 0 || tilt.y !== 0 ? 1.04 : 1})`,
                  transition: isMobile || reorderMode ? 'transform 0.15s ease, box-shadow 0.2s ease, border-color 0.2s' : 'transform 0.15s ease-out, box-shadow 0.2s ease, border-color 0.2s',
                  boxShadow: isSelected
                    ? `0 0 0 2px ${brand.color}55, 0 8px 24px ${brand.color}33`
                    : (isMobile
                      ? `0 4px 16px ${t.shadow}`
                      : (tilt.x !== 0 || tilt.y !== 0
                        ? `${-tilt.x * 0.5}px ${tilt.y * 0.5}px 32px ${t.shadow}, 0 8px 24px ${brand.color}22, inset 0 1px 0 ${isNight ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)'}`
                        : `0 4px 16px ${t.shadow}, inset 0 1px 0 ${isNight ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)'}`)),
                  transformStyle: 'preserve-3d',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >

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
                  {(() => {
                    const cardPhoto = catalogPhotosFor(brand)[0];
                    return cardPhoto ? (
                    <img src={cardPhoto} alt={brand.name}
                      loading="lazy"
                      decoding="async"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease', transform: `scale(${tilt.x !== 0 || tilt.y !== 0 ? 1.06 : 1})` }}
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, color: brand.color + '33', letterSpacing: '0.05em', transform: 'translateZ(20px)' }}>{brand.name[0]}</div>
                    </div>
                  );
                  })()}
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
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: t.textDisabled }}>
          {isMobile ? 'Swipe the hero to change brands · Tap a card to open' : 'Drag cards to reorder · Order saves automatically'}
        </div>

        {!isStaff && (
          <div style={{
            marginTop: isMobile ? '1.75rem' : '2.25rem',
            padding: isMobile ? '1.25rem 1rem' : '1.5rem 1.75rem',
            background: t.bgElevated,
            border: t.borderHairlineLight,
            borderRadius: 16,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.textFaint, fontWeight: 600, marginBottom: 8 }}>
              Can&apos;t find what you need?
            </div>
            <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 600, color: t.text, lineHeight: 1.35, marginBottom: 8, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
              Looking for a brand that isn&apos;t listed here?
            </div>
            <div style={{ fontSize: isMobile ? 13 : 14, color: t.textMuted, lineHeight: 1.6, maxWidth: 520, margin: '0 auto 1.25rem' }}>
              {onBrowseSignUp
                ? 'Create an account or sign in to tell us what you\u2019re looking for — we\u2019ll help source brands not listed here.'
                : 'Tell us what you\u2019re looking for — we\u2019ll help you source it and get it to you.'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
              {onMessageUs ? (
                <button
                  type="button"
                  onClick={onMessageUs}
                  style={{
                    background: t.btnPrimaryBg,
                    color: t.btnPrimaryText,
                    border: 'none',
                    borderRadius: 10,
                    padding: isMobile ? '11px 18px' : '12px 22px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {customerChatActionLabel(chatLabel)}
                </button>
              ) : onBrowseSignUp ? (
                <>
                  <button
                    type="button"
                    onClick={onBrowseSignUp}
                    style={{
                      background: t.btnPrimaryBg,
                      color: t.btnPrimaryText,
                      border: 'none',
                      borderRadius: 10,
                      padding: isMobile ? '11px 18px' : '12px 22px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Create account
                  </button>
                  {onBrowseSignIn && (
                    <button
                      type="button"
                      onClick={onBrowseSignIn}
                      style={{
                        background: 'none',
                        border: t.borderHairline,
                        borderRadius: 10,
                        padding: isMobile ? '11px 18px' : '12px 22px',
                        fontSize: 13,
                        fontWeight: 600,
                        color: t.textMuted,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Sign in
                    </button>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: t.textFaint }}>
                  Contact us via {chatLabel} or your quote request.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: t.borderHairline, padding: '2rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.12em', color: t.text, marginBottom: 6 }}>Global Access</div>
        <div style={{ fontSize: 12, color: t.textDisabled }}>Trade portal · Invite only · Contact us via {chatLabel} or your quote request</div>
      </div>
    </div>
  );
}
