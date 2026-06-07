/** Champs trade show — aisle themes, vendor pitches, chase lines. */

export const CHECKOUT_GOAL = 1400;

export const GLOBAL_ACCESS_BRANDS = [
  'GoldWhip', 'LuxGas', 'Sokka', 'numbz', 'Blizzy', 'Rise', 'Churros Locos', 'Good Spirits',
];

export const SHOW_AISLES = [
  {
    id: 'tobacco',
    name: 'Tobacco Row',
    sky: '#1a1410',
    floor: '#3d342c',
    lane: '#c9a84c',
    banner: '#8B4513',
    bannerText: 'TOBACCO · SMOKE · WRAPS',
    vendorShirt: '#5c4033',
  },
  {
    id: 'glass',
    name: 'Glass & Papers',
    sky: '#121820',
    floor: '#2a3040',
    lane: '#9b59b6',
    banner: '#6c3483',
    bannerText: 'GLASS · PAPERS · CONES',
    vendorShirt: '#4a235a',
  },
  {
    id: 'beverage',
    name: 'Beverage Blvd',
    sky: '#1a1010',
    floor: '#352828',
    lane: '#e74c3c',
    banner: '#922b21',
    bannerText: 'BEVS · FUNCTIONAL · RTD',
    vendorShirt: '#641e16',
  },
  {
    id: 'thc',
    name: 'THC & Functional',
    sky: '#0f1a12',
    floor: '#243328',
    lane: '#27ae60',
    banner: '#1e8449',
    bannerText: '7-OH · HEMP · FUNCTIONAL',
    vendorShirt: '#145a32',
  },
  {
    id: 'vape',
    name: 'Vape & Cloud',
    sky: '#0d1520',
    floor: '#1e2d3d',
    lane: '#3498db',
    banner: '#1f618d',
    bannerText: 'VAPE · DISPO · CLOUD',
    vendorShirt: '#154360',
  },
  {
    id: 'home',
    name: 'Global Access Home Stretch',
    sky: '#0f0f12',
    floor: '#2a2a30',
    lane: '#C9A84C',
    banner: '#1A1A1A',
    bannerText: '★ GLOBAL ACCESS ★',
    vendorShirt: '#2c2c2c',
  },
];

/** Vendor reps blocking the aisle — per-aisle pitches. */
export const VENDOR_PITCHES = {
  tobacco: [
    'Bro — try my wrap sample!',
    'Best margins in the hall!',
    'You NEED this fronto leaf!',
    'Free display if you order today!',
  ],
  glass: [
    'King size cones — moving fast!',
    'Wholesale glass, one case min!',
    'Slow burn papers, trust me!',
    'My booth has the new flavors!',
  ],
  beverage: [
    'Thirsty? Try our functional line!',
    'RTD is the future — taste this!',
    'We are blowing up on TikTok!',
    'Case deal ends at show close!',
  ],
  thc: [
    'Were you at Champs last year?',
    '7-OH is what your customers want!',
    'Compliance-friendly — hear me out!',
    'My gummies sample pack is RIGHT here!',
  ],
  vape: [
    'Disposables are 40% of the floor!',
    'New SKU drop — exclusive!',
    'Cloud production on point!',
    'Margin stack with my line!',
  ],
  home: [
    'Last chance before the GA booth!',
    'Everyone stops here — you sure?',
    'Global Access has EVERYTHING!',
    'The models are at GA — hurry!',
  ],
};

/** Rep chasing from behind — gets funnier each aisle tier. */
export const CHASE_LINES = [
  [
    'Hey! Wanna know more about my product?',
    'Wait — special show pricing!',
    'Can I scan your badge real quick?',
  ],
  [
    'You cannot OUTRUN opportunity!',
    'My manager is WATCHING this aisle!',
    'Nobody reads emails at Champs!',
  ],
  [
    'Were you at Champs this past year?',
    'I have samples in my backpack!',
    'Your competitor stopped already!',
  ],
  [
    'I will walk with you to your hotel. Politely.',
    'RECORD week — one yes saves me!',
    'The booth models are nice but MY margins…',
  ],
  [
    'GLOBAL ACCESS is right there — but hear me out first!',
    'I trained for THIS moment at Champs!',
    'The cart is empty. Your P&L is crying.',
  ],
];

export function aisleIndexFromProgress(progress) {
  const seg = CHECKOUT_GOAL / SHOW_AISLES.length;
  return Math.min(SHOW_AISLES.length - 1, Math.floor(progress / seg));
}

export function chaseTierFromProgress(progress) {
  return Math.min(CHASE_LINES.length, Math.floor(progress / (CHECKOUT_GOAL / CHASE_LINES.length)) + 1);
}

export function repLinesForTier(tier) {
  const pool = [];
  for (let i = 0; i < Math.min(tier, CHASE_LINES.length); i += 1) {
    pool.push(...CHASE_LINES[i]);
  }
  return pool.length ? pool : CHASE_LINES[0];
}

export function randomVendorPitch(aisleId) {
  const list = VENDOR_PITCHES[aisleId] || VENDOR_PITCHES.tobacco;
  return list[Math.floor(Math.random() * list.length)];
}
