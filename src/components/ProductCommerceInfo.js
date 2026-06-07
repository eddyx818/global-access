import React from 'react';
import { formatPrice, getVisiblePrices, getActivePromo, getShippingSummary, getMoqLabel, getPackConfigLines } from '../lib/pricing';

export default function ProductCommerceInfo({
  product,
  userType,
  orderMode,
  masterPricingQualified = false,
  pricingVisible = true,
  onSignIn,
  onRequestAccess,
}) {
  const prices = getVisiblePrices(product, userType, orderMode, { masterPricingQualified, pricingVisible });
  const promo = getActivePromo(product, userType, { pricingVisible });
  const shipping = getShippingSummary(product);
  const moq = getMoqLabel(product);
  const packLines = getPackConfigLines(product);

  if (!prices.length && !promo && !shipping && !moq && !packLines.length && pricingVisible) return null;
  if (!pricingVisible && !packLines.length && !shipping && !moq) return null;

  return (
    <div style={{ marginBottom: 14, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      {packLines.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, minWidth: 0 }}>
          {packLines.map(line => (
            <span key={line} style={{
              fontSize: 11,
              color: '#555',
              background: '#F8F6F3',
              border: '0.5px solid #E8E4DF',
              borderRadius: 6,
              padding: '4px 8px',
              lineHeight: 1.4,
              maxWidth: '100%',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
            }}>
              {line}
            </span>
          ))}
        </div>
      )}

      {!pricingVisible && (
        <div style={{
          background: '#F8F6F3',
          border: '0.5px solid #E8E4DF',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 }}>
            Pricing for approved members
          </div>
          <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5, marginBottom: onSignIn || onRequestAccess ? 10 : 0 }}>
            Sign in for account pricing, or request access and our team will follow up with wholesale details.
          </div>
          {(onSignIn || onRequestAccess) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {onSignIn && (
                <button type="button" onClick={onSignIn} style={{ background: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Sign in
                </button>
              )}
              {onRequestAccess && (
                <button type="button" onClick={onRequestAccess} style={{ background: '#FFF', color: '#555', border: '0.5px solid #E0DDD8', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Request access
                </button>
              )}
            </div>
          )}
        </div>
      )}

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
