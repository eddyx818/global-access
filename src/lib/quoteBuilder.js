import { supabase } from './supabase';
import { getOrderPrice, getMasterOrderPrice } from './pricing';
import { parseInquiryInterests } from './inquiries';
import { quoteOfferWhatsAppUrl } from './inquiryWhatsApp';

export function lineUnitLabel(line) {
  if (line.orderUnitLabel) return line.orderUnitLabel;
  if (line.orderMode === 'pallet') return 'pallet';
  return 'case';
}

export function catalogPriceForInterest(product, line, inquiry) {
  if (!product) return null;
  const userType = inquiry?.user_type || 'retailer';
  const useMaster = inquiry?.master_pricing_interest && userType === 'distributor';
  if (useMaster) {
    const master = getMasterOrderPrice(product, line.orderMode);
    if (master != null) return master;
  }
  const orderPrice = getOrderPrice(product, line.orderMode);
  if (orderPrice != null) return orderPrice;
  return product.price_wholesale ?? product.price_retail ?? null;
}

export async function fetchProductPricingBySkus(skus) {
  const unique = [...new Set((skus || []).filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await supabase
    .from('product_content')
    .select('sku, brand_id, price_per_unit, price_per_case, price_per_pallet, price_master_per_unit, price_master_per_case, price_master_per_pallet, price_wholesale, price_retail')
    .in('sku', unique);
  return Object.fromEntries((data || []).map(row => [row.sku, row]));
}

export function enrichInquiryLines(inquiry, catalogBySku = {}) {
  return parseInquiryInterests(inquiry?.interests).map(line => {
    const product = line.sku ? catalogBySku[line.sku] : null;
    const catalogPrice = catalogPriceForInterest(product, line, inquiry);
    const savedPrice = line.unit_price != null && line.unit_price !== '' ? Number(line.unit_price) : null;
    return {
      ...line,
      verified: !!line.verified,
      catalog_price: catalogPrice,
      unit_price: savedPrice != null && !Number.isNaN(savedPrice) ? savedPrice : (catalogPrice ?? ''),
    };
  });
}

export function serializeQuoteLines(lines) {
  return lines.map(line => ({
    key: line.key,
    sku: line.sku,
    productName: line.productName,
    brandName: line.brandName,
    brandId: line.brandId,
    flavor: line.flavor,
    qty: Number(line.qty) || 1,
    orderMode: line.orderMode,
    orderUnitLabel: line.orderUnitLabel,
    verified: !!line.verified,
    unit_price: (() => {
      if (line.unit_price === '' || line.unit_price == null) return null;
      const n = Number(line.unit_price);
      return Number.isNaN(n) ? null : n;
    })(),
    catalog_price: line.catalog_price ?? null,
  }));
}

export function quoteLineTotal(line) {
  const qty = Number(line.qty) || 1;
  const price = Number(line.unit_price);
  if (Number.isNaN(price)) return null;
  return qty * price;
}

export function quoteSubtotal(lines) {
  return lines.reduce((sum, line) => {
    const total = quoteLineTotal(line);
    return total == null ? sum : sum + total;
  }, 0);
}

export function canSendQuote(inquiry, lines) {
  if (!inquiry?.user_id) {
    return { ok: false, reason: 'Customer needs a portal account to receive quotes in My Quotes.' };
  }
  if (!lines.length) {
    return { ok: false, reason: 'Add at least one line item.' };
  }
  for (const line of lines) {
    if (!line.verified) {
      return { ok: false, reason: 'Verify every SKU before sending.' };
    }
    const price = Number(line.unit_price);
    if (Number.isNaN(price) || price < 0) {
      return { ok: false, reason: 'Enter a valid price for each verified line.' };
    }
  }
  return { ok: true };
}

export function formatQuoteMessage(inquiry, lines, { revision = 1, previousSubtotal = null } = {}) {
  const items = lines.map(line => {
    const qty = Number(line.qty) || 1;
    const price = Number(line.unit_price);
    const unit = lineUnitLabel(line);
    const plural = qty === 1 ? unit : `${unit}s`;
    const lineTotal = quoteLineTotal(line);
    const skuPart = line.sku ? `${line.sku} · ` : '';
    return [
      `• ${skuPart}${line.brandName} — ${line.productName}`,
      `  ${line.flavor || '—'} · ${qty} ${plural} @ $${price.toFixed(2)}/${unit} = $${lineTotal.toFixed(2)}`,
    ].join('\n');
  }).join('\n\n');

  const total = quoteSubtotal(lines);
  const heading = revision > 1 ? `📋 Revised quote (#${revision})` : '📋 Your quote is ready';
  const parts = [
    heading,
    '',
    inquiry.company || inquiry.name || 'Your order',
  ];
  if (revision > 1 && previousSubtotal != null) {
    parts.push(`Previous quote total: $${Number(previousSubtotal).toFixed(2)}`);
  }
  parts.push('', items, '', `Estimated total: $${total.toFixed(2)}`, '', 'Reply here with any questions or to place your order.');
  return parts.join('\n');
}

export async function fetchQuoteHistoryForInquiry(inquiryId) {
  if (!inquiryId) return [];
  try {
    const { data, error } = await supabase
      .from('inquiry_quote_history')
      .select('*')
      .eq('inquiry_id', inquiryId)
      .order('revision', { ascending: false });
    if (error) return [];
    return data || [];
  } catch (_) {
    return [];
  }
}

export async function fetchQuoteHistoryForCustomer(customerUserId, limit = 15) {
  if (!customerUserId) return [];
  try {
    const { data, error } = await supabase
      .from('inquiry_quote_history')
      .select('*')
      .eq('customer_user_id', customerUserId)
      .order('sent_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return data || [];
  } catch (_) {
    return [];
  }
}

export async function updateQuoteHistoryStatus(historyId, status) {
  const { data, error } = await supabase.rpc('update_quote_history_status', {
    p_history_id: historyId,
    p_status: status,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: !!data };
}

export function linePriceLookupKey(line) {
  return line.sku || line.key || `${line.brandName}-${line.productName}-${line.flavor}`;
}

export function compareLinesToHistory(lines, historyRow) {
  if (!historyRow?.line_items?.length) return [];
  const prevByKey = Object.fromEntries(
    (historyRow.line_items || []).map(item => [linePriceLookupKey(item), item])
  );
  return lines.map(line => {
    const prev = prevByKey[linePriceLookupKey(line)];
    const catalogNow = line.catalog_price != null ? Number(line.catalog_price) : null;
    const lastQuoted = prev?.unit_price != null ? Number(prev.unit_price) : null;
    const currentDraft = line.unit_price !== '' && line.unit_price != null ? Number(line.unit_price) : null;
    let note = null;
    if (lastQuoted != null && catalogNow != null && catalogNow !== lastQuoted) {
      note = catalogNow > lastQuoted ? 'Catalog higher than last quote' : 'Catalog lower than last quote';
    } else if (lastQuoted != null && catalogNow != null && catalogNow === lastQuoted) {
      note = 'Same as last quoted price';
    }
    return { line, lastQuoted, catalogNow, currentDraft, note };
  });
}

export const QUOTE_FULFILLMENT_STATUSES = [
  { id: 'sent', label: 'Sent' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'paid', label: 'Paid / processed' },
  { id: 'cancelled', label: 'Cancelled' },
];

export async function updateInquiryQuoteLines(inquiryId, lines) {
  const payload = serializeQuoteLines(lines);
  const { data, error } = await supabase.rpc('update_inquiry_quote_lines', {
    p_inquiry_id: inquiryId,
    p_interests: payload,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: !!data, lines: payload };
}

export async function respondToQuote(historyId, response, { counterLines = null, counterNotes = null } = {}) {
  const { data, error } = await supabase.rpc('customer_respond_to_quote', {
    p_history_id: historyId,
    p_response: response,
    p_counter_lines: counterLines,
    p_counter_notes: counterNotes,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: !!data };
}

export async function sendQuoteToCustomer(inquiry, lines, staffUserId, { revision = 1, previousSubtotal = null, staff = null } = {}) {
  const check = canSendQuote(inquiry, lines);
  if (!check.ok) return { ok: false, error: check.reason };

  const saveResult = await updateInquiryQuoteLines(inquiry.id, lines);
  if (!saveResult.ok) return saveResult;

  const subtotal = quoteSubtotal(lines);
  const { data: historyId, error } = await supabase.rpc('record_inquiry_quote_send', {
    p_inquiry_id: inquiry.id,
    p_line_items: saveResult.lines,
    p_subtotal: subtotal,
    p_conversation_id: null,
    p_message_id: null,
  });
  if (error) {
    const { data: marked, error: markErr } = await supabase.rpc('mark_inquiry_quoted', {
      p_inquiry_id: inquiry.id,
    });
    if (markErr) {
      return {
        ok: false,
        error: `${error.message} (run SQL migration 41 to enable quote history)`,
      };
    }
    return {
      ok: !!marked,
      revision,
      historySkipped: true,
      whatsAppUrl: quoteOfferWhatsAppUrl(inquiry, saveResult.lines, staff, { revision, subtotal }),
    };
  }

  return {
    ok: !!historyId,
    historyId,
    revision,
    whatsAppUrl: quoteOfferWhatsAppUrl(inquiry, saveResult.lines, staff, { revision, subtotal }),
  };
}
