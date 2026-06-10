/** When false, logged-in customers see MOQ/shipping/pack only — no dollar prices on catalog.
 *  Default off until catalog rates are filled in; set REACT_APP_SHOW_CATALOG_PRICES=true when ready. */
export function shouldShowCatalogPrices() {
  const raw = (process.env.REACT_APP_SHOW_CATALOG_PRICES || 'false').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export const DROP_SHIP_NOTICE =
  'Each brand ships separately from its supplier — orders are not combined in one shipment. MOQ and shipping apply per brand.';

export const PHONE_PLACEHOLDER = 'Include country code, e.g. +1 555 123 4567';
