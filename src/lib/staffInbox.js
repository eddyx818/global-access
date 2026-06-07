import { fetchRecentInquiries } from './inquiries';
import { fetchRecentPriceChecks } from './priceChecks';

export function countNewInboxItems(quotes = [], priceChecks = []) {
  const newQuotes = quotes.filter(i => (i.quote_status || 'new') === 'new').length;
  const newChecks = priceChecks.filter(c => (c.status || 'new') === 'new').length;
  return newQuotes + newChecks;
}

export async function fetchStaffInboxItems(limit = 50) {
  const [quotes, priceChecks] = await Promise.all([
    fetchRecentInquiries(limit),
    fetchRecentPriceChecks(limit),
  ]);

  const items = [
    ...quotes.map(row => ({ kind: 'quote', created_at: row.created_at, row })),
    ...priceChecks.map(row => ({ kind: 'price_check', created_at: row.created_at, row })),
  ];

  items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return { items, quotes, priceChecks };
}

export function filterInboxItems(items, filter) {
  if (filter === 'new') {
    return items.filter(item => {
      if (item.kind === 'quote') return (item.row.quote_status || 'new') === 'new';
      return (item.row.status || 'new') === 'new';
    });
  }
  if (filter === 'quotes') {
    return items.filter(item => item.kind === 'quote');
  }
  if (filter === 'price_checks') {
    return items.filter(item => item.kind === 'price_check');
  }
  return items;
}
