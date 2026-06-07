export const EMPTY_ADDRESS = {
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  zip: '',
  lat: null,
  lng: null,
};

/** Single-line display for lists and legacy `address` column. */
export function formatFullAddress(parts = {}) {
  const line1 = [parts.address_line1, parts.address_line2].filter(Boolean).join(', ');
  const locality = [parts.city, parts.state, parts.zip].filter(Boolean).join(', ');
  return [line1, locality].filter(Boolean).join(', ');
}

export function normalizeAddressParts(raw = {}) {
  return {
    address_line1: raw.address_line1 || raw.address || '',
    address_line2: raw.address_line2 || '',
    city: raw.city || '',
    state: raw.state || '',
    zip: raw.zip || '',
    lat: raw.lat ?? null,
    lng: raw.lng ?? null,
  };
}

export function stateLabel(state) {
  if (!state) return '';
  return state.length <= 3 ? state.toUpperCase() : state;
}
