import React, { useMemo } from 'react';
import { getPatternAppearance, getPatternDensity } from '../lib/patternStyle';

/** Diagonal repeating brand name — fills page margins behind brand pages. */
export default function BrandNamePattern({ brand, isMobile, isNight = false, pageBg }) {
  const label = brand?.name?.toUpperCase() || '';

  const { angle, rowCount, repeatsPerRow, color, opacity } = useMemo(() => {
    const seed = (brand?.id || brand?.name || '').split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
    const appearance = getPatternAppearance(brand?.color, pageBg, { isNight, isMobile });
    const density = getPatternDensity(label, isMobile);
    return {
      angle: seed % 2 === 0 ? -32 : 32,
      ...density,
      color: appearance.color,
      opacity: appearance.opacity,
    };
  }, [brand?.id, brand?.name, brand?.color, isMobile, isNight, pageBg, label]);

  if (!label) return null;

  return (
    <div
      className="brand-name-pattern"
      aria-hidden="true"
      data-night={isNight ? 'true' : 'false'}
      data-mobile={isMobile ? 'true' : 'false'}
      style={{
        '--pattern-angle': `${angle}deg`,
        '--pattern-color': color,
        '--pattern-opacity': opacity,
      }}
    >
      <div className="brand-name-pattern__canvas">
        {Array.from({ length: rowCount }, (_, rowIdx) => (
          <div
            key={rowIdx}
            className="brand-name-pattern__row"
            style={{ paddingLeft: rowIdx % 2 === 0 ? 0 : 'clamp(1.5rem, 5vw, 5rem)' }}
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
