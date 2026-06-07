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

/** Map Nominatim result → structured fields (suite left blank for manual entry). */
export function partsFromNominatim(item) {
  const a = item.address || {};
  const house = a.house_number ? `${a.house_number} ` : '';
  const road = a.road || a.pedestrian || a.footway || '';
  const city = a.city || a.town || a.village || a.hamlet || a.municipality || '';
  const stateCode = a['ISO3166-2-lvl4']?.replace(/^US-/, '') || '';
  const state = stateCode || (a.state?.length === 2 ? a.state.toUpperCase() : a.state || '');
  const zip = a.postcode || '';
  return {
    address_line1: `${house}${road}`.trim() || item.display_name?.split(',')[0]?.trim() || '',
    address_line2: '',
    city,
    state,
    zip: zip.split('-')[0] || zip,
    lat: item.lat ? Number(item.lat) : null,
    lng: item.lon ? Number(item.lon) : null,
  };
}

let searchTimer = null;

/** US address suggestions via OpenStreetMap Nominatim (free, no API key). */
export function searchAddressSuggestions(query, { limit = 6 } = {}) {
  const q = query?.trim();
  if (!q || q.length < 3) return Promise.resolve([]);

  return new Promise((resolve) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          format: 'json',
          addressdetails: '1',
          countrycodes: 'us',
          limit: String(limit),
          q,
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'en',
            'User-Agent': 'GlobalAccess/1.0 (B2B trade portal contact form)',
          },
        });
        if (!res.ok) {
          resolve([]);
          return;
        }
        const data = await res.json();
        resolve(Array.isArray(data) ? data : []);
      } catch {
        resolve([]);
      }
    }, 320);
  });
}

export function stateLabel(state) {
  if (!state) return '';
  return state.length <= 3 ? state.toUpperCase() : state;
}
