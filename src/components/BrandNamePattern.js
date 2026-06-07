import React, { useMemo } from 'react';

/** Diagonal repeating brand name — fills wide-screen margins behind brand pages. */
export default function BrandNamePattern({ brand, isMobile, isNight = false }) {
  const { angle, rowCount, repeatsPerRow } = useMemo(() => {
    const seed = (brand?.id || brand?.name || '').split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
    return {
      angle: seed % 2 === 0 ? -32 : 32,
      rowCount: isMobile ? 16 : 22,
      repeatsPerRow: isMobile ? 7 : 12,
    };
  }, [brand?.id, brand?.name, isMobile]);

  if (!brand?.name) return null;

  const label = brand.name.toUpperCase();

  return (
    <div
      className="brand-name-pattern"
      aria-hidden="true"
      data-night={isNight ? 'true' : 'false'}
      data-mobile={isMobile ? 'true' : 'false'}
      style={{
        '--pattern-angle': `${angle}deg`,
        '--pattern-color': brand.color || '#C9A84C',
      }}
    >
      <div className="brand-name-pattern__canvas">
        {Array.from({ length: rowCount }, (_, rowIdx) => (
          <div
            key={rowIdx}
            className="brand-name-pattern__row"
            style={{ paddingLeft: rowIdx % 2 === 0 ? 0 : 'clamp(1.5rem, 4vw, 4rem)' }}
          >
            {Array.from({ length: repeatsPerRow }, (_, wordIdx) => (
              <span key={wordIdx} className="brand-name-pattern__word">
                {label}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
