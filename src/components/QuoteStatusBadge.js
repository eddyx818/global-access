import React from 'react';
import { quoteStatusMeta } from '../lib/inquiries';

export default function QuoteStatusBadge({ status, size = 'sm' }) {
  const meta = quoteStatusMeta(status);
  const fontSize = size === 'md' ? 12 : 11;
  const padding = size === 'md' ? '4px 12px' : '3px 10px';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize,
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      padding,
      borderRadius: 20,
      background: `${meta.color}18`,
      color: meta.color,
      border: `0.5px solid ${meta.color}44`,
    }}>
      {meta.label}
    </span>
  );
}
