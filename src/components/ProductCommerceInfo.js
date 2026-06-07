import React from 'react';
import { formatPrice, getVisiblePrices, getActivePromo, getShippingSummary, getMoqLabel } from '../lib/pricing';

export default function ProductCommerceInfo({ product, userType, orderMode, masterPricingQualified = false }) {
  const prices = getVisiblePrices(product, userType, orderMode, { masterPricingQualified });
  const promo = getActivePromo(product, userType);
  const shipping = getShippingSummary(product);
  const moq = getMoqLabel(product);

  if (!prices.length && !promo && !shipping && !moq) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      {promo && (
        <div style={{ background: '#FDF6E3', border: '0.5px solid #F5D87A', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#A07A20', letterSpacing: '0.04em' }}>🏷 {promo.label}</div>
          {promo.detail && <div style={{ fontSize: 11, color: '#888', marginTop: 4, lineHeight: 1.4 }}>{promo.detail}</div>}
        </div>
      )}
      {prices.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {prices.map(({ label, value, tier }) => (
            <div key={label} style={{
              background: tier === 'master' ? '#FDF6E3' : '#F8F6F3',
              border: tier === 'master' ? '0.5px solid #F5D87A' : '0.5px solid #E8E4DF',
              borderRadius: 8,
              padding: '6px 10px',
              minWidth: 88,
            }}>
              <div style={{ fontSize: 9, color: tier === 'master' ? '#A07A20' : '#AAA', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginTop: 2 }}>{formatPrice(value)}</div>
            </div>
          ))}
        </div>
      )}
      {(moq || shipping) && (
        <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5 }}>
          {moq && <span>{moq}</span>}
          {moq && shipping && <span> · </span>}
          {shipping && <span>{shipping}</span>}
        </div>
      )}
    </div>
  );
}
