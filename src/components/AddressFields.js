import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  EMPTY_ADDRESS,
  searchAddressSuggestions,
  partsFromNominatim,
} from '../lib/addressFormat';

export default function AddressFields({
  value = EMPTY_ADDRESS,
  onChange,
  inputStyle: inputStyleProp,
  labelStyle: labelStyleProp,
  isMobile = false,
}) {
  const { t } = useTheme();
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef(null);

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

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, []);

  const onStreetChange = async (text) => {
    set({ address_line1: text });
    if (text.trim().length < 3) {
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }
    setSearching(true);
    const results = await searchAddressSuggestions(text);
    setSuggestions(results);
    setSuggestOpen(results.length > 0);
    setSearching(false);
  };

  const pickSuggestion = (item) => {
    const parts = partsFromNominatim(item);
    onChange({
      ...value,
      ...parts,
      address_line2: value.address_line2 || '',
    });
    setSuggestions([]);
    setSuggestOpen(false);
  };

  return (
    <div className="address-fields">
      <div ref={wrapRef} style={{ marginBottom: isMobile ? 12 : 10, position: 'relative' }}>
        <label style={labelStyle}>Street address</label>
        <input
          value={value.address_line1 || ''}
          onChange={(e) => onStreetChange(e.target.value)}
          onFocus={() => suggestions.length && setSuggestOpen(true)}
          placeholder="Start typing — e.g. 123 Main St"
          style={inputStyle}
          autoComplete="address-line1"
          autoCapitalize="words"
        />
        {searching && (
          <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>Searching…</div>
        )}
        {suggestOpen && suggestions.length > 0 && (
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            marginTop: 4,
            zIndex: 40,
            background: t.bgElevated,
            border: t.borderHairline,
            borderRadius: 10,
            boxShadow: `0 8px 24px ${t.shadow}`,
            maxHeight: 220,
            overflowY: 'auto',
          }}>
            {suggestions.map((item) => (
              <button
                key={item.place_id}
                type="button"
                onClick={() => pickSuggestion(item)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  border: 'none',
                  borderBottom: t.borderHairlineLight,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  color: t.text,
                  lineHeight: 1.4,
                }}
              >
                {item.display_name}
              </button>
            ))}
          </div>
        )}
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
        <div style={{ fontSize: 11, color: t.textDisabled, marginTop: 4, lineHeight: 1.4 }}>
          Add this after picking a street so we keep suite numbers separate for your contact record.
        </div>
      </div>

      <div className="address-fields-local" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.6fr 0.8fr', gap: isMobile ? 12 : 10 }}>
        <div>
          <label style={labelStyle}>City</label>
          <input
            value={value.city || ''}
            onChange={(e) => set({ city: e.target.value })}
            style={inputStyle}
            autoComplete="address-level2"
          />
        </div>
        <div>
          <label style={labelStyle}>State</label>
          <input
            value={value.state || ''}
            onChange={(e) => set({ state: e.target.value.toUpperCase().slice(0, 2) })}
            placeholder="TX"
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
            placeholder="78701"
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
