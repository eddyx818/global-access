import { whatsAppUrl } from './whatsapp';
import { parseInquiryInterests } from './inquiries';

function staffSignature(staff) {
  const name = staff?.name?.trim();
  if (name) return `${name} from Global Access`;
  return 'Global Access';
}

function formatLines(interests) {
  return parseInquiryInterests(interests).slice(0, 10).map((line) => {
    const qty = line.qty ? ` × ${line.qty}${line.orderUnitLabel ? ` ${line.orderUnitLabel}` : ''}` : '';
    return `• ${line.brandName || ''} ${line.productName || line.sku || 'Item'}${line.flavor ? ` (${line.flavor})` : ''}${qty}`;
  }).join('\n');
}


/** Plain-text message body for staff outreach (use with WhatsAppContactButton). */
export function inquiryLeadWhatsAppMessage(inquiry, staff = null) {
  if (!inquiry?.phone) return '';
  const lines = formatLines(inquiry.interests);
  return [
    `Hi ${inquiry.name || 'there'}, this is ${staffSignature(staff)} regarding your quote request.`,
    inquiry.company ? `Store: ${inquiry.company}` : null,
    inquiry.ready_to_order ? '\n⚡ Customer marked READY TO ORDER — please prioritize.' : null,
    inquiry.pricing_questions ? '\nThey have questions on pricing — see notes / line items.' : null,
    lines ? `\nItems:\n${lines}` : null,
    inquiry.notes ? `\nNotes: ${inquiry.notes}` : null,
    inquiry.contact_requested && !inquiry.ready_to_order ? '\n(They asked to be contacted about this inquiry.)' : null,
  ].filter(Boolean).join('\n');
}

/** Prefilled WhatsApp message for staff outreach on a lead/inquiry. */
export function inquiryLeadWhatsAppUrl(inquiry, staff = null) {
  if (!inquiry?.phone) return null;
  return whatsAppUrl(inquiry.phone, inquiryLeadWhatsAppMessage(inquiry, staff));
}

/** Prefilled WhatsApp when staff sends a priced quote. */
export function quoteOfferWhatsAppUrl(inquiry, lines, staff = null, { revision = 1, subtotal = null } = {}) {
  if (!inquiry?.phone) return null;
  const detail = (lines || []).map((line) => {
    const unit = line.orderUnitLabel || line.orderMode || 'unit';
    const price = line.unit_price != null ? `$${Number(line.unit_price).toFixed(2)}` : 'TBD';
    return `• ${line.brandName || ''} ${line.productName || line.sku} — ${line.qty || 1} ${unit} @ ${price}`;
  }).join('\n');
  const message = [
    `Hi ${inquiry.name || 'there'}, this is ${staffSignature(staff)} with your quote${revision > 1 ? ` (rev ${revision})` : ''}:`,
    detail,
    subtotal != null ? `\nSubtotal: $${Number(subtotal).toFixed(2)}` : null,
    '\nReply here with questions, or accept / counter in the portal under My Quotes.',
  ].filter(Boolean).join('\n');
  return whatsAppUrl(inquiry.phone, message);
}
