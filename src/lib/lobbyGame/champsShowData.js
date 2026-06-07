/** Champs trade show — aisle themes, satirical dialogue, booth styles. */

export const CHECKOUT_GOAL = 1400;

/** Legit Global Access portfolio — collect these. */
export const GLOBAL_ACCESS_BRANDS = [
  'GoldWhip', 'LuxGas', 'Sokka', 'numbz', 'Blizzy', 'Rise', 'Churros Locos', 'Good Spirits',
];

/** Knockoff disposables when real SKUs sell out. */
export const KNOCKOFF_VAPE_BRANDS = [
  { name: 'Geekbarz', mimics: 'GeekBar' },
  { name: 'Foggest', mimics: 'Foger' },
  { name: 'GeekBarz Pro', mimics: 'GeekBar' },
  { name: 'Fogerz', mimics: 'Foger' },
  { name: 'Geek Bar Plus', mimics: 'GeekBar' },
  { name: 'Fogger Max', mimics: 'Foger' },
  { name: 'GeekBrr', mimics: 'GeekBar' },
  { name: 'Fogist', mimics: 'Foger' },
];

/** Per-brand crate colors for pickups. */
export const BRAND_CRATE_COLORS = {
  GoldWhip: { fill: '#FFD700', stroke: '#B8860B', label: '#1a1a1a' },
  LuxGas: { fill: '#7B68EE', stroke: '#483D8B', label: '#fff' },
  Sokka: { fill: '#FF6B35', stroke: '#C44D1A', label: '#fff' },
  numbz: { fill: '#00CED1', stroke: '#008B8B', label: '#111' },
  Blizzy: { fill: '#FF1493', stroke: '#C71585', label: '#fff' },
  Rise: { fill: '#32CD32', stroke: '#228B22', label: '#111' },
  'Churros Locos': { fill: '#D2691E', stroke: '#8B4513', label: '#fff' },
  'Good Spirits': { fill: '#4169E1', stroke: '#27408B', label: '#fff' },
};

/**
 * Booth visual archetypes inspired by Champs floor design — generic labels only.
 * (Two-story gradient walls, smiley THC walls, neon beast branding, pre-roll labs, etc.)
 */
export const BOOTH_STYLES = {
  sunset_tower: {
    id: 'sunset_tower',
    title: 'MEGA LOUNGE CO',
    subtitle: '2-STORY EXPERIENCE',
    top: '#5B2C8A',
    mid: '#E67E22',
    bottom: '#F1C40F',
    led: ['#9B59B6', '#E74C3C', '#F39C12'],
    counter: '#fff',
  },
  smiley_wall: {
    id: 'smiley_wall',
    title: 'DELTA SMILE CO',
    subtitle: 'PREMIUM DELTA THC',
    top: '#FF69B4',
    mid: '#FFD700',
    bottom: '#7B68EE',
    led: ['#FF00FF', '#FFFF00', '#00FFFF'],
    counter: '#FFD700',
  },
  neon_beast: {
    id: 'neon_beast',
    title: 'LOUD DISPO CO',
    subtitle: 'AGGRESSIVE FLAVOR',
    top: '#ADFF2F',
    mid: '#111111',
    bottom: '#111111',
    led: ['#ADFF2F', '#000000', '#ADFF2F'],
    counter: '#ADFF2F',
  },
  preroll_lab: {
    id: 'preroll_lab',
    title: 'AUTO JOINT HQ',
    subtitle: 'ROBOT PRE-ROLL',
    top: '#111111',
    mid: '#1a1a2e',
    bottom: '#0d0d18',
    led: ['#00AAFF', '#0088FF', '#44CCFF'],
    counter: '#222',
  },
  mushroom_psyche: {
    id: 'mushroom_psyche',
    title: 'FUNGI FEAST',
    subtitle: 'MUSHROOM EDIBLES',
    top: '#6A0DAD',
    mid: '#FF1493',
    bottom: '#FF6347',
    led: ['#DA70D6', '#FF69B4', '#FF4500'],
    counter: '#4B0082',
  },
  seven_oh: {
    id: 'seven_oh',
    title: '7-OH LAB',
    subtitle: '7-HYDROXYMITRAGYNINE · SHH',
    top: '#1E8449',
    mid: '#27AE60',
    bottom: '#145A32',
    led: ['#00FF88', '#2ECC71', '#00CC66'],
    counter: '#196F3D',
  },
  euphoric_blend: {
    id: 'euphoric_blend',
    title: 'EUPHORIC BLEND™',
    subtitle: 'TOTALLY NOT 7-OH',
    top: '#6A0DAD',
    mid: '#9B59B6',
    bottom: '#4A235A',
    led: ['#DA70D6', '#FF69B4', '#BA55D3'],
    counter: '#FFD700',
  },
  knockoff_import: {
    id: 'knockoff_import',
    title: 'IMPORT ALLEY',
    subtitle: 'NO MOQ · NO LABEL',
    top: '#8B0000',
    mid: '#C0392B',
    bottom: '#922B21',
    led: ['#FF0000', '#FFD700', '#FF0000'],
    counter: '#333',
  },
};

/** Which booth styles appear per aisle. */
export const AISLE_BOOTH_STYLES = {
  tobacco: ['sunset_tower', 'knockoff_import'],
  glass: ['preroll_lab', 'sunset_tower'],
  beverage: ['mushroom_psyche', 'smiley_wall'],
  thc: ['seven_oh', 'euphoric_blend', 'mushroom_psyche', 'smiley_wall'],
  vape: ['neon_beast', 'knockoff_import', 'knockoff_import'],
  home: ['knockoff_import', 'seven_oh', 'preroll_lab'],
};

export const SHOW_AISLES = [
  {
    id: 'tobacco',
    name: 'Tobacco Row',
    skyTop: '#2a1810',
    skyBottom: '#4a3020',
    floor: '#5c4a3a',
    carpet: '#8B6914',
    lane: '#FFB347',
    banner: '#D35400',
    bannerText: 'WRAPS · FRONTO · LOUNGE BOOTHS',
    vendorShirt: '#8B4513',
    neon: '#FF8C00',
    boothPalette: ['#A0522D', '#CD853F', '#8B4513', '#D2691E'],
    ledStrip: ['#FF6600', '#FFAA00', '#FF4400'],
  },
  {
    id: 'glass',
    name: 'Glass & Pre-Roll Row',
    skyTop: '#1a1030',
    skyBottom: '#3d2060',
    floor: '#3a3050',
    carpet: '#6A3D9A',
    lane: '#DA70D6',
    banner: '#9B59B6',
    bannerText: 'GLASS · CONES · AUTO PRE-ROLL',
    vendorShirt: '#6C3483',
    neon: '#E056FD',
    boothPalette: ['#8E44AD', '#BB8FCE', '#5B2C6F', '#AF7AC5'],
    ledStrip: ['#FF00FF', '#CC66FF', '#9933FF'],
  },
  {
    id: 'beverage',
    name: 'Functional & Bevs',
    skyTop: '#2a1018',
    skyBottom: '#5c2030',
    floor: '#4a2830',
    carpet: '#C0392B',
    lane: '#FF6B6B',
    banner: '#E74C3C',
    bannerText: 'RTD · KAVA · MUSHROOM DRINKS',
    vendorShirt: '#922B21',
    neon: '#FF4757',
    boothPalette: ['#E74C3C', '#FF7675', '#D63031', '#FF6348'],
    ledStrip: ['#FF0000', '#FF4444', '#FF8800'],
  },
  {
    id: 'thc',
    name: '7-OH & Gray Market',
    skyTop: '#0a2018',
    skyBottom: '#1a5038',
    floor: '#2a4535',
    carpet: '#27AE60',
    lane: '#58D68D',
    banner: '#1E8449',
    bannerText: '7-OH BANS · EUPHORIC BLENDS · GUMMIES',
    vendorShirt: '#196F3D',
    neon: '#2ECC71',
    boothPalette: ['#27AE60', '#52BE80', '#1D8348', '#76D7C4'],
    ledStrip: ['#00FF88', '#00CC66', '#33FF99'],
  },
  {
    id: 'vape',
    name: 'Vape & Knockoffs',
    skyTop: '#081828',
    skyBottom: '#1a4060',
    floor: '#243848',
    carpet: '#2980B9',
    lane: '#5DADE2',
    banner: '#1F618D',
    bannerText: 'DISPO · CLONES · SHENZHEN ROW',
    vendorShirt: '#154360',
    neon: '#3498DB',
    boothPalette: ['#2980B9', '#5DADE2', '#1A5276', '#85C1E9'],
    ledStrip: ['#00AAFF', '#0088FF', '#44CCFF'],
  },
  {
    id: 'home',
    name: 'Global Access Home Stretch',
    skyTop: '#12121a',
    skyBottom: '#2a2a38',
    floor: '#3a3a48',
    carpet: '#C9A84C',
    lane: '#F4D03F',
    banner: '#1A1A1A',
    bannerText: '★ REAL BRANDS · GLOBAL ACCESS ★',
    vendorShirt: '#2c2c2c',
    neon: '#C9A84C',
    boothPalette: ['#1A1A1A', '#C9A84C', '#333', '#FFD700'],
    ledStrip: ['#FFD700', '#C9A84C', '#FFF8DC'],
  },
];

/** Background signage — generic, satirical. */
export const BOOTH_SIGNAGE = {
  tobacco: ['LOUNGE HQ', 'WRAP KING', 'FRONTO ROW', '2-STORY CO', 'SMOKE TEMPLE'],
  glass: ['AUTO JOINT', 'CONE BOT', 'GLASS LAB', 'RING LIGHT', 'PRE-ROLL 9000'],
  beverage: ['FUNCTION+', 'KAVA CHUG', 'MUSH DRINK', 'TRIP TEA', 'RTD HYPE'],
  thc: ['7-OH LAB', 'EUPHORIC™', 'BLISS STACK', 'FEEL-GOOD', 'NOT-BANNED'],
  vape: ['LOUD DISPO', 'CLONE ROW', 'SHENZHEN', 'NEON BEAST', 'FAKE BARZ'],
  home: ['GA PARTNER', 'REAL SKUs', 'LEGIT ONLY', 'GLOBAL', 'ACCESS →'],
};

/** Satirical vendor pitches — roast everyone on the floor. */
export const VENDOR_PITCHES = {
  tobacco: [
    'Our booth cost more than your rent — hear me out!',
    'Two-story lounge vibes, one-story margins!',
    'Fronto leaf sample — ignore the compliance binder!',
    'We spent the marketing budget on LED walls!',
    'Your customers smoke — why not from US?',
  ],
  glass: [
    'Automated pre-roll — fire your rollers!',
    'Ring light is ON — let me film this pitch!',
    'King cones move faster than your inventory turns!',
    'Glass so nice your accountant will cry!',
    'Robot rolled 10k joints — want a demo?',
  ],
  beverage: [
    'Functional bev — legally distinct from illegal!',
    'Mushroom drink — trip responsibly (lawyer said)!',
    'TikTok made us do this flavor!',
    'Kava + caffeine — what could go wrong?',
    'RTD is the future — yesterday!',
  ],
  thc: [
    '7-hydroxymitragynine — we spell it E-U-P-H-O-R-I-C!',
    'States banning 7-OH? Good thing we rebranded!',
    'Same feel — new label since the lawyers called!',
    'Heavy regs on 7-OH — try our Feel-Good Mix!',
    'NOT on the banned list — yet — sample!',
    'Mushroom gummies — amanita adjacent!',
    'Premium delta — premium MY commission!',
    'COA says blend — you say bliss!',
    'Bans rolling state to state — our SKU rolls faster!',
  ],
  vape: [
    'GeekBar sold out — Geekbarz never does!',
    'Foger energy, Foggest pricing!',
    'Neon booth = quality product, obviously!',
    'Disposables louder than our lab reports!',
    'Import carton — sticker comes separate!',
  ],
  home: [
    'GA is RIGHT there — but my euphoric blend tho!',
    'One more pre-roll robot demo — please!',
    'Real brands at GA — my 7-OH rebrand though!',
    'Last gray-market booth before legitimacy!',
  ],
};

export const CHINESE_VENDOR_PITCHES = [
  'Shenzhen direct — box looks official!',
  'Same shape as name brand — half price!',
  'Container landed — paperwork optional!',
  'We print YOUR label on THEIR mold!',
  'MOQ is one pallet — cash only!',
  'Quality same same — trust me bro!',
  'Export version — wink wink!',
];

export const KNOCKOFF_BOOTH_PITCHES = [
  'NOT the real thing — visually close!',
  'Sold out everywhere? We never sold IN!',
  'LED wall cost more than the liquid inside!',
  'Compliance folder empty — booth full!',
  'Jump over us — regret buying later!',
];

export const PREROLL_PITCHES = [
  'Robot rolls faster than union break!',
  'Auto pre-roll — human optional!',
  '10k joints/hour — FDA who?',
  'Ring light demo — content is product!',
];

export const MUSHROOM_PITCHES = [
  'Mushroom gummies — federally creative!',
  'Not psilocybin — marketing is!',
  'Smiley wall says premium — trust smiles!',
  'Trip sold separately from liability!',
  'Amanita chic — influencer approved!',
];

export const SEVEN_OH_PITCHES = [
  '7-OH is hydroxymitragynine — shhh!',
  'Heavy laws on 7-OH — we still got pallets!',
  'Banned in half the states — sold in all booths!',
  'Same alkaloid profile — brand-new sticker!',
  'Law changed Tuesday — formula changed Monday!',
  'Your lawyer said no 7-OH — try Euphoric Blend!',
  'Hydroxy-who? Never met her. Bliss Stack though…',
  'Regulators circling — margins still beautiful!',
];

export const EUPHORIC_BLEND_PITCHES = [
  'Euphoric Blend™ — definitely not 7-OH!',
  'Feel-Good Mix — lawyers wrote the name!',
  'New formula since the ban headlines!',
  'Same customer, same rush, new compliance story!',
  'We do not say mitragynine — we say MAGIC!',
  'State ban list? Our label printer is faster!',
  '7-OH got hot — we got "wellness stack"!',
  'Rebrand special — old stock, new name!',
];

export const CHASE_LINES = [
  [
    'Wait! 7-OH sample — laws are… flexible!',
    'Try our Euphoric Blend — NOT banned YET!',
    'Badge scan? I need ONE yes today!',
  ],
  [
    'You cannot OUTRUN hydroxymitragynine deals!',
    'States ban 7-OH — we ban the word only!',
    'Geekbarz is basically GeekBar!',
  ],
  [
    'Were you at Champs this past year?',
    'New euphoric SKU since the law dropped!',
    'Your competitor stocked before the ban!',
    'Two-story booth — one-minute pitch!',
  ],
  [
    'GLOBAL ACCESS is on the RIGHT — but 7-OH!',
    'RECORD week — euphoric blends moving!',
    'Real brands at GA — my rebrand though…',
    'Heavy regs mean heavy margins for me!',
  ],
  [
    'The GA booth is RIGHT THERE — PLEASE!',
    'I trained for THIS aisle at Champs!',
    'Jump my booth — still take a Feel-Good sample!',
    'Every vendor wants you — I NEED you!',
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

/** Rare casual aisle greetings — mixed floor slang, not tied to any one vendor type (~12% of lines). */
export const FLOOR_CASUAL_GREETINGS = [
  'Hey bhai, how are you? Quick look at my line!',
  'Assalamualaikum — good show? Got a minute?',
  'What\'s good boss — you stocking up today?',
  'Hey friend, thirty seconds — best margin on the row!',
  'How\'s the show treating you? Sample before you run!',
  'Yo chief — catch this deal before aisle closes!',
  'Hey neighbor booth sent you — want a carton price?',
  'What\'s up — you look like a serious buyer!',
];

export function randomVendorPitch(aisleId) {
  const list = VENDOR_PITCHES[aisleId] || VENDOR_PITCHES.tobacco;
  return list[Math.floor(Math.random() * list.length)];
}

export function withRareCasualGreeting(pitch) {
  if (Math.random() > 0.12) return pitch;
  return FLOOR_CASUAL_GREETINGS[Math.floor(Math.random() * FLOOR_CASUAL_GREETINGS.length)];
}

export function randomKnockoffBrand() {
  return KNOCKOFF_VAPE_BRANDS[Math.floor(Math.random() * KNOCKOFF_VAPE_BRANDS.length)];
}

export function randomChinesePitch() {
  return CHINESE_VENDOR_PITCHES[Math.floor(Math.random() * CHINESE_VENDOR_PITCHES.length)];
}

export function randomKnockoffBoothPitch(knockoff) {
  const base = KNOCKOFF_BOOTH_PITCHES[Math.floor(Math.random() * KNOCKOFF_BOOTH_PITCHES.length)];
  return knockoff ? `${knockoff.name} — ${base}` : base;
}

export function randomBoothStyle(aisleId) {
  const pool = AISLE_BOOTH_STYLES[aisleId] || AISLE_BOOTH_STYLES.vape;
  const id = pool[Math.floor(Math.random() * pool.length)];
  return BOOTH_STYLES[id] || BOOTH_STYLES.knockoff_import;
}

export function randomObstaclePitch(aisleId, boothStyle, knockoff, chinese) {
  let pitch;
  if (chinese) pitch = randomChinesePitch();
  else if (knockoff && (aisleId === 'vape' || boothStyle?.id === 'knockoff_import')) {
    pitch = randomKnockoffBoothPitch(knockoff);
  } else {
    const styleId = boothStyle?.id;
    if (styleId === 'preroll_lab') {
      pitch = PREROLL_PITCHES[Math.floor(Math.random() * PREROLL_PITCHES.length)];
    } else if (styleId === 'mushroom_psyche' || styleId === 'smiley_wall') {
      pitch = MUSHROOM_PITCHES[Math.floor(Math.random() * MUSHROOM_PITCHES.length)];
    } else if (styleId === 'seven_oh') {
      const pool = [...SEVEN_OH_PITCHES, ...EUPHORIC_BLEND_PITCHES];
      pitch = pool[Math.floor(Math.random() * pool.length)];
    } else if (styleId === 'euphoric_blend') {
      pitch = EUPHORIC_BLEND_PITCHES[Math.floor(Math.random() * EUPHORIC_BLEND_PITCHES.length)];
    } else {
      pitch = randomVendorPitch(aisleId);
    }
  }
  return withRareCasualGreeting(pitch);
}

export function brandCrateStyle(brandName) {
  return BRAND_CRATE_COLORS[brandName] || { fill: '#C9A84C', stroke: '#8B7355', label: '#111' };
}
