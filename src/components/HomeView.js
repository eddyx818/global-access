import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useBrandContent, pickRotatingCatalogPhotos } from '../lib/content';
import { applyBrandOrder, saveUserBrandOrder } from '../lib/userBrandOrder';
import { COPY } from '../lib/portalCopy';

import MasterPricingNotice from './MasterPricingNotice';
import PricingPreviewToggle from './PricingPreviewToggle';
import { useTheme } from '../context/ThemeContext';

/** Always lead the hero with this brand, then rotate in catalog card order. */
const HERO_LEAD_BRAND_ID = 'churros-locos';

function heroLeadIndex(brands) {
  if (!brands?.length) return 0;
  const i = brands.findIndex(b => b.id === HERO_LEAD_BRAND_ID);
  return i >= 0 ? i : 0;
}

const USER_TYPE_LABEL = {
  distributor: 'Distributor account',
  retailer: 'Retailer account',
};

export default function HomeView({
  onBrandClick,
  isMobile,
  userId,
  userType,
  masterPricingQualified,
  isStaff = false,
  showPricingPreview = false,
  onUserTypeChange = null,
  isPortalUser = false,
  companyName = '',
  onMessageUs = null,
  onBrowseSignUp = null,
  onBrowseSignIn = null,
  visible = true,
}) {
  const { t } = useTheme();
  const [slideIdx, setSlideIdx] = useState(null);
  const [animating, setAnimating] = useState(false);
  const [customOrder, setCustomOrder] = useState(null);
  const [heroTransitions, setHeroTransitions] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [swapSourceIdx, setSwapSourceIdx] = useState(null);
  const [arrowPressed, setArrowPressed] = useState(null);
  const autoTimer = useRef(null);
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

  const heroImageFor = (brand) => {
    const photos = heroPhotosFor(brand);
    return photos[0] || null;
  };

  // Preload hero images for active and next brand
  useEffect(() => {
    if (!brands.length) return;
    [activeSlideIdx, (activeSlideIdx + 1) % brands.length].forEach(idx => {
      const src = heroImageFor(brands[idx]);
      if (!src || preloadedHeroImages.current.has(src)) return;
      const img = new Image();
      img.src = src;
      preloadedHeroImages.current.add(src);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlideIdx, brands, heroGallerySeed]);

  const changeSlide = (newIdx) => {
    if (animating || newIdx === activeSlideIdx) return;
    clearInterval(autoTimer.current);
    setAnimating(true);
    setSlideIdx(newIdx);
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

  const accountLabel = USER_TYPE_LABEL[userType] || 'Trade account';
  const displayCompany = (companyName || '').trim();

  return (
    <div className="home-page">
      {/* HERO */}
      <div
        ref={heroRef}
        className="hero-carousel app-no-select"
        onTouchStart={handleHeroTouchStart}
        onTouchEnd={handleHeroTouchEnd}
        style={{
          height: isMobile ? 300 : 480,
          background: heroBg,
          touchAction: isMobile ? 'pan-y' : 'auto',
        }}
      >
        {brands.map((brand, i) => {
          const heroImg = heroImageFor(brand);
          const isActive = i === activeSlideIdx;
          return (
            <div
              key={brand.id}
              className={[
                'hero-brand-slide',
                heroTransitions ? '' : 'hero-brand-slide--no-transition',
                isActive ? '' : 'hero-brand-slide--inactive',
              ].filter(Boolean).join(' ')}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: isActive ? 2 : 1,
                opacity: isActive ? 1 : 0,
                pointerEvents: 'none',
              }}
            >
              <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 18% 55%, ${brand.color}55 0%, transparent 48%), radial-gradient(ellipse at 82% 28%, ${brand.color}28 0%, transparent 45%), ${heroBg}` }} />
              {heroImg && (
                <div className="hero-slide-image-wrap">
                  <img
                    src={heroImg}
                    alt=""
                    aria-hidden="true"
                    loading={isActive ? 'eager' : 'lazy'}
                    decoding="async"
                    className="hero-slide-image"
                    onError={e => { e.target.style.opacity = 0; }}
                  />
                </div>
              )}
            </div>
          );
        })}
        <div className="hero-slide-scrim" aria-hidden="true" />
        {brands.map((brand, i) => {
          const isActive = i === activeSlideIdx;
          const slideHeadline = heroConfig.headline || brand.name;
          const slideSubheadline = heroConfig.subheadline || brand.tagline;
          const heroPillStyle = {
            background: `${brand.color}24`,
            border: `1px solid ${brand.color}55`,
          };
          return (
            <div
              key={`copy-${brand.id}`}
              className={`hero-slide-copy ${isActive ? 'hero-slide-copy--active' : 'hero-slide-copy--inactive'}`}
              role={isMobile ? undefined : 'button'}
              tabIndex={isMobile ? -1 : (isActive ? 0 : -1)}
              aria-hidden={!isActive}
              aria-label={isMobile ? undefined : `View ${brand.name} catalog`}
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
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 520, gap: 14 }}>
                <div className="hero-pill" style={{ ...heroPillStyle, display: 'inline-block', padding: '5px 16px', fontSize: 10, color: brand.color, letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 700 }}>{brand.category}</div>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: isMobile ? 54 : 88,
                  letterSpacing: '0.03em',
                  color: '#FFF',
                  lineHeight: 0.9,
                  textShadow: '0 2px 24px rgba(0,0,0,0.45)',
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
                  <div className="hero-pill" style={{
                    ...heroPillStyle,
                    padding: isMobile ? '10px 18px' : '12px 22px',
                    fontSize: isMobile ? 13 : 15,
                    color: 'rgba(255,255,255,0.9)',
                    letterSpacing: '0.03em',
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
          <div className="arrow-inner">‹</div>
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
          <div className="arrow-inner">›</div>
        </button>
        <div className="hero-slide-counter">
          {activeSlideIdx + 1} / {brands.length}
        </div>
      </div>

      {showPricingPreview && (
        <PricingPreviewToggle
          userType={userType}
          onChange={onUserTypeChange}
          isMobile={isMobile}
        />
      )}

      <div className="home-trust-strip" style={{ color: t.textFaint }}>
        <span>Invite-only trade portal</span>
        <span className="home-trust-strip__dot" aria-hidden="true">·</span>
        <span>Verified business accounts</span>
        <span className="home-trust-strip__dot" aria-hidden="true">·</span>
        <span>Case &amp; pallet pricing</span>
      </div>

      {/* BRAND CATALOG */}
      <div className="home-catalog">
        {userType === 'distributor' && !isStaff && (
          <MasterPricingNotice qualified={masterPricingQualified} />
        )}
        <div className="home-catalog__header">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div className="home-catalog__title" style={{ color: t.textFaint }}>Our Brands</div>
              <div className="home-catalog__subtitle" style={{ color: t.textMuted }}>
                Wholesale Catalog · MOQ &amp; Case Pricing · Direct Rep Support
              </div>
              {isPortalUser && displayCompany && (
                <div className="home-catalog__personal" style={{ color: t.textMuted }}>
                  <strong style={{ color: t.text }}>{displayCompany}</strong>
                  {' · '}
                  {accountLabel}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
                  : (isMobile ? 'Tap to Open · Hold 3 Sec to Reorder' : `${brands.length} Brands · Reorder to Arrange`)}
              </div>
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
        <div className="home-brand-grid" style={{ touchAction: reorderMode ? 'manipulation' : undefined }}>
          {brands.map((brand, idx) => {
            const isSelected = swapSourceIdx === idx;
            const cardPhoto = catalogPhotosFor(brand)[0];
            return (
              <div
                key={brand.id}
                role="button"
                tabIndex={0}
                data-brand-idx={idx}
                className={[
                  'home-brand-card',
                  'app-no-select',
                  isSelected ? 'home-brand-card--selected' : '',
                  reorderMode ? 'home-brand-card--reorder' : '',
                ].filter(Boolean).join(' ')}
                style={{
                  background: t.bgElevated,
                  border: `0.5px solid ${isSelected ? brand.color : t.borderLight}`,
                  boxShadow: isSelected
                    ? `0 0 0 2px ${brand.color}55, 0 8px 24px ${brand.color}33`
                    : `0 4px 16px ${t.shadow}`,
                  WebkitTapHighlightColor: 'transparent',
                }}
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
              >
                <div className="home-brand-card__media" style={{ background: `linear-gradient(135deg, ${brand.color}20, ${brand.color}06)` }}>
                  {brand.logoUrl && (
                    <img
                      src={brand.logoUrl}
                      alt=""
                      className="home-brand-card__logo"
                      loading="lazy"
                      decoding="async"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  )}
                  {cardPhoto ? (
                    <img
                      src={cardPhoto}
                      alt={brand.name}
                      className="home-brand-card__img"
                      loading="lazy"
                      decoding="async"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, color: brand.color + '33', letterSpacing: '0.05em' }}>{brand.name[0]}</div>
                    </div>
                  )}
                  <div className="home-brand-card__scrim" />
                  <div className="home-brand-card__bar" style={{ background: `linear-gradient(to right, ${brand.color}, ${brand.color}88)` }} />
                </div>

                <div className="home-brand-card__body">
                  <div className="home-brand-card__category" style={{ color: brand.color }}>{brand.category}</div>
                  <div className="home-brand-card__name" style={{ color: t.text }}>{brand.name}</div>
                  {brand.tagline && (
                    <div className="home-brand-card__tagline" style={{ color: t.textFaint }}>{brand.tagline}</div>
                  )}
                  <div className="home-brand-card__cta" style={{ color: brand.color, background: brand.color + '12' }}>View catalog</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: t.textDisabled }}>
          {isMobile ? 'Swipe the Hero to Change Brands · Tap a Card to Open' : 'Drag Cards to Reorder · Order Saves Automatically'}
        </div>

        {!isStaff && (
          <div className="home-sourcing-cta" style={{
            background: t.bgElevated,
            border: t.borderHairlineLight,
          }}>
            <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.textFaint, fontWeight: 600, marginBottom: 8 }}>
              Need a brand not listed?
            </div>
            <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 600, color: t.text, lineHeight: 1.35, marginBottom: 8, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
              Tell us what you&apos;re sourcing — we follow up on WhatsApp and post quotes in {COPY.myQuotes}.
            </div>
            <div style={{ fontSize: isMobile ? 13 : 14, color: t.textMuted, lineHeight: 1.6, maxWidth: 520, margin: '0 auto 1.25rem' }}>
              {onBrowseSignUp
                ? 'Create an account or sign in to request brands not in our catalog, or submit a quote from any brand page.'
                : 'We help source products beyond this catalog and get them to your door.'}
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
                  {COPY.myQuotes}
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
                <div style={{ fontSize: 13, color: t.textFaint, lineHeight: 1.55 }}>
                  Sign in to track quotes in {COPY.myQuotes}, or submit from any brand page.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: t.borderHairline, padding: '2rem 1.5rem', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.12em', color: t.text, marginBottom: 8 }}>Global Access</div>
        <div style={{ fontSize: 12, color: t.textDisabled, lineHeight: 1.65, maxWidth: 440, margin: '0 auto' }}>
          Trade Portal · Invite Only
          {!isStaff && onMessageUs ? (
            <>
              <br />
              Drop a note in{' '}
              <button
                type="button"
                onClick={onMessageUs}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: t.gold,
                  fontWeight: 600,
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                {COPY.myQuotes}
              </button>
              {' '}— or request pricing from your quote list.
            </>
          ) : !isStaff ? (
            <>
              <br />
              Sign in to track quotes in {COPY.myQuotes}, or request pricing from any brand page.
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
