/** Shared portal labels — Title Case, consistent across nav and pages. */
export const COPY = {
  myList: 'My List',
  myQuotes: 'My Quotes',
  priceCheck: 'Price Check',
  requestQuote: 'Request a Quote',
  quotes: 'Quotes',
  profile: 'Profile',
  home: 'Home',
  catalog: 'Catalog',
  readyToOrder: 'Ready to Order',
  pricingQuestions: 'Pricing Questions',
  whatsAppContact: 'WhatsApp Contact',
  dropShip: 'Drop Ship',
  pricingOnQuote: 'Pricing on Quote',
};

export const portalType = {
  pageTitle: (fontSize = 38) => ({
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize,
    letterSpacing: '0.06em',
    lineHeight: 1,
  }),
  pageTitleSm: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 28,
    letterSpacing: '0.06em',
    lineHeight: 1,
  },
  pageSubtitle: {
    fontSize: 13,
    lineHeight: 1.6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  navLabel: {
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '0.04em',
  },
  navLabelActive: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.04em',
  },
  callout: {
    fontSize: 13,
    lineHeight: 1.55,
  },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.03em',
  },
};
