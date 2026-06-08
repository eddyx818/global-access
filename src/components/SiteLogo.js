import React from 'react';

export const SITE_LOGO_SRC = '/logo.png';

export default function SiteLogo({ height = 36, style, className, alt = 'Global Access', ...props }) {
  return (
    <img
      src={SITE_LOGO_SRC}
      alt={alt}
      className={className}
      decoding="async"
      style={{
        height,
        width: 'auto',
        maxWidth: '100%',
        objectFit: 'contain',
        display: 'block',
        ...style,
      }}
      {...props}
    />
  );
}
