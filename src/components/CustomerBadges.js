import React from 'react';
import { getAccountBadges } from '../lib/accountBadges';

export default function CustomerBadges({ profile, size = 'sm', wrap = true, staffOnly = true }) {
  if (staffOnly && !profile) return null;

  const badges = getAccountBadges(profile);
  if (!badges.length) return null;

  const fontSize = size === 'md' ? 11 : 10;
  const padding = size === 'md' ? '3px 9px' : '2px 7px';

  return (
    <span style={{ display: wrap ? 'flex' : 'inline-flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {badges.map(b => (
        <span
          key={b.key}
          title={b.label}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            fontSize,
            padding,
            borderRadius: 20,
            background: b.bg,
            color: b.color,
            fontWeight: 600,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            lineHeight: 1.2,
          }}
        >
          <span aria-hidden="true">{b.icon}</span>
          {b.label}
        </span>
      ))}
    </span>
  );
}

export function CustomerNameWithBadges({ profile, name, size = 'sm', nameStyle = {} }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
      <span style={{ fontWeight: 600, ...nameStyle }}>{name}</span>
      <CustomerBadges profile={profile} size={size} wrap={false} />
    </span>
  );
}
