import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { EMPTY_ADDRESS } from '../lib/addressFormat';

export default function AddressFields({
  value = EMPTY_ADDRESS,
  onChange,
  inputStyle: inputStyleProp,
  labelStyle: labelStyleProp,
  isMobile = false,
}) {
  const { t } = useTheme();

  const inputStyle = inputStyleProp || {
    width: '100%',
    background: t.inputBg,
    border: t.borderHairline,
    borderRadius: 8,
    padding: isMobile ? '14px 12px' : '11px 12px',
    color: t.text,
    fontSize: 16,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };
  const labelStyle = labelStyleProp || {
    fontSize: 11,
    color: t.textFaint,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 6,
  };

  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="address-fields">
      <div style={{ marginBottom: isMobile ? 12 : 10 }}>
        <label style={labelStyle}>Street address</label>
        <input
          value={value.address_line1 || ''}
          onChange={(e) => set({ address_line1: e.target.value })}
          placeholder="133 Olive Ave"
          style={inputStyle}
          autoComplete="street-address"
          autoCapitalize="words"
        />
        <div style={{ fontSize: 11, color: t.textDisabled, marginTop: 4, lineHeight: 1.4 }}>
          Street number and name together — e.g. 133 Olive Ave
        </div>
      </div>

      <div style={{ marginBottom: isMobile ? 12 : 10 }}>
        <label style={labelStyle}>Suite / unit / building (optional)</label>
        <input
          value={value.address_line2 || ''}
          onChange={(e) => set({ address_line2: e.target.value })}
          placeholder="Suite 200, Bldg B, Unit 4"
          style={inputStyle}
          autoComplete="address-line2"
          autoCapitalize="words"
        />
      </div>

      <div className="address-fields-local" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.6fr 0.8fr', gap: isMobile ? 12 : 10 }}>
        <div>
          <label style={labelStyle}>City</label>
          <input
            value={value.city || ''}
            onChange={(e) => set({ city: e.target.value })}
            placeholder="Los Angeles"
            style={inputStyle}
            autoComplete="address-level2"
            autoCapitalize="words"
          />
        </div>
        <div>
          <label style={labelStyle}>State</label>
          <input
            value={value.state || ''}
            onChange={(e) => set({ state: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) })}
            placeholder="CA"
            style={inputStyle}
            autoComplete="address-level1"
            maxLength={2}
          />
        </div>
        <div>
          <label style={labelStyle}>ZIP</label>
          <input
            value={value.zip || ''}
            onChange={(e) => set({ zip: e.target.value.replace(/[^\d-]/g, '').slice(0, 10) })}
            placeholder="90201"
            style={inputStyle}
            inputMode="numeric"
            autoComplete="postal-code"
          />
        </div>
      </div>
    </div>
  );
}

export { EMPTY_ADDRESS };
