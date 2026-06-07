export function formatPrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return `$${n.toFixed(2)}`;
}

export function parsePackFields(src = {}) {
  return {
    units_per_inner: src.units_per_inner ?? null,
    inner_unit_label: src.inner_unit_label || '',
    inners_per_case: src.inners_per_case ?? null,
    inner_pack_label: src.inner_pack_label || '',
    retail_order_unit: src.retail_order_unit || '',
    retail_order_units: src.retail_order_units || '',
    distributor_order_units: src.distributor_order_units || '',
    cases_per_pallet: src.cases_per_pallet ?? null,
    pack_config_note: src.pack_config_note || '',
  };
}

export function slugOrderUnit(label) {
  return String(label || '').trim().toLowerCase().replace(/\s+/g, '_');
}

/** Parse "box, case, master case, pallet" into selectable options. */
export function parseOrderUnitsList(str) {
  if (!str || typeof str !== 'string') return [];
  return str.split(/[,;|]/).map(s => s.trim()).filter(Boolean)
    .map(label => ({ id: slugOrderUnit(label), label }));
}

function legacyDistroOrderOptions(product) {
  if (product.orderUnit === 'pallet') return [{ id: 'pallet', label: 'pallet' }];
  if (product.orderUnit === 'both') {
    return [
      { id: 'master_case', label: 'case' },
      { id: 'pallet', label: 'pallet' },
    ];
  }
  return [{ id: 'master_case', label: 'case' }];
}

/** Order-by choices for the current buyer type (typed in admin, comma-separated). */
export function getProductOrderOptions(product, userType) {
  const listField = userType === 'distributor' ? 'distributor_order_units' : 'retail_order_units';
  const parsed = parseOrderUnitsList(product[listField]);
  if (parsed.length) return parsed;

  if (userType !== 'distributor') {
    const single = product.retail_order_unit || product.inner_pack_label;
    if (single) return [{ id: slugOrderUnit(single), label: single }];
    if (product.orderUnit === 'pallet') return [{ id: 'case', label: 'case' }];
    return [{ id: 'box', label: 'box' }];
  }

  return legacyDistroOrderOptions(product);
}

export function defaultOrderMode(product, userType) {
  return getProductOrderOptions(product, userType)[0]?.id || 'case';
}

export function getOrderOptionLabel(product, userType, orderMode) {
  const options = getProductOrderOptions(product, userType);
  const id = slugOrderUnit(orderMode);
  const match = options.find(o => o.id === id);
  if (match) return match.label;
  return options[0]?.label || 'case';
}

/** Map a selected unit to a pricing tier (unit / case / pallet). */
export function normalizeOrderModeKey(orderMode) {
  const m = slugOrderUnit(orderMode);
  if (m.includes('pallet')) return 'pallet';
  if (m.includes('master')) return 'master_case';
  if (m === 'case' || m.endsWith('_case')) return 'master_case';
  return 'unit';
}

/** Pluralize a pack unit label (jar → jars, case → cases). */
export function pluralizeUnit(label, count = 1) {
  if (!label) return '';
  if (count === 1) return label;
  const lower = label.toLowerCase();
  if (lower.endsWith('s')) return label;
  const irregular = { box: 'boxes', case: 'cases', jar: 'jars', pouch: 'pouches', pallet: 'pallets', can: 'cans', unit: 'units', 'master case': 'master cases' };
  if (irregular[lower]) return irregular[lower];
  return `${label}s`;
}

/** What retailers typically order by when no custom list is set. */
export function getRetailOrderUnit(product) {
  const options = getProductOrderOptions(product, 'retailer');
  if (options.length) return options[0].label;
  if (product.retail_order_unit) return product.retail_order_unit;
  if (product.inner_pack_label) return product.inner_pack_label;
  if (product.orderUnit === 'pallet') return 'case';
  return 'box';
}

/** What distributors order by for the current mode when no custom list is set. */
export function getDistroOrderUnit(product, orderMode = 'master_case') {
  return getOrderOptionLabel(product, 'distributor', orderMode);
}

export function getOrderUnitLabel(product, userType, orderMode) {
  return getOrderOptionLabel(product, userType, orderMode);
}

export function formatOrderUnitLabel(product, userType, orderMode, qty = 1) {
  return pluralizeUnit(getOrderOptionLabel(product, userType, orderMode), qty);
}

export function getOrderUnitHeading(product, userType, orderMode) {
  const label = getOrderOptionLabel(product, userType, orderMode);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function parseCommerceFields(po = {}) {
  return {
    price_per_unit: po.price_per_unit ?? null,
    price_per_case: po.price_per_case ?? null,
    price_per_pallet: po.price_per_pallet ?? null,
    price_master_per_unit: po.price_master_per_unit ?? null,
    price_master_per_case: po.price_master_per_case ?? null,
    price_master_per_pallet: po.price_master_per_pallet ?? null,
    price_wholesale: po.price_wholesale ?? null,
    price_retail: po.price_retail ?? null,
    price_msrp: po.price_msrp ?? null,
    moq_qty: po.moq_qty ?? null,
    moq_unit: po.moq_unit || 'case',
    shipping_included: !!po.shipping_included,
    shipping_free_after_moq: !!po.shipping_free_after_moq,
    free_shipping_moq_qty: po.free_shipping_moq_qty ?? null,
    shipping_note: po.shipping_note || '',
    promo_label: po.promo_label || '',
    promo_detail: po.promo_detail || '',
    promo_active: !!po.promo_active,
    promo_audience: po.promo_audience || 'both',
  };
}

export function mergeProductCommerce(product, po = {}) {
  const merged = { ...product, ...po };
  return { ...product, ...parseCommerceFields(po), ...parsePackFields(merged) };
}

export function getPackConfigLines(product) {
  const lines = [];
  const unitLabel = product.inner_unit_label || 'units';
  const packLabel = product.inner_pack_label || 'boxes';
  const packLabelPlural = product.inners_per_case === 1 ? packLabel : `${packLabel}s`;

  if (product.units_per_inner && product.inners_per_case) {
    lines.push(`${product.units_per_inner} ${unitLabel} per ${packLabel}`);
    lines.push(`${product.inners_per_case} ${packLabelPlural} per case`);
  } else if (product.units_per_inner) {
    lines.push(`${product.units_per_inner} ${unitLabel} per case`);
  } else if (product.inners_per_case) {
    lines.push(`${product.inners_per_case} ${packLabelPlural} per case`);
  }

  if (product.cases_per_pallet) {
    lines.push(`${product.cases_per_pallet} cases per pallet`);
  }

  if (product.pack_config_note) lines.push(product.pack_config_note);

  return lines;
}

export function getOrderPrice(product, orderMode) {
  const key = normalizeOrderModeKey(orderMode);
  if (key === 'pallet' && product.price_per_pallet != null) return product.price_per_pallet;
  if (key === 'master_case' && product.price_per_case != null) return product.price_per_case;
  if (product.price_per_unit != null) return product.price_per_unit;
  return product.price_wholesale;
}

export function getMasterOrderPrice(product, orderMode) {
  const key = normalizeOrderModeKey(orderMode);
  if (key === 'pallet' && product.price_master_per_pallet != null) return product.price_master_per_pallet;
  if (key === 'master_case' && product.price_master_per_case != null) return product.price_master_per_case;
  if (product.price_master_per_unit != null) return product.price_master_per_unit;
  return null;
}

function priceDisplayLabel(product, userType, orderMode) {
  return `Per ${getOrderOptionLabel(product, userType, orderMode)}`;
}

export function getVisiblePrices(product, userType, orderMode = 'master_case', { masterPricingQualified = false, pricingVisible = true } = {}) {
  if (!pricingVisible) return [];

  const isDistributor = userType === 'distributor';
  const lines = [];
  const modeKey = normalizeOrderModeKey(orderMode);

  if (isDistributor && masterPricingQualified) {
    const masterPrice = getMasterOrderPrice(product, orderMode);
    if (masterPrice != null) lines.push({ label: priceDisplayLabel(product, userType, orderMode), value: masterPrice, tier: 'master' });
    if (product.price_master_per_unit != null && modeKey === 'master_case') {
      lines.push({ label: 'Per unit', value: product.price_master_per_unit, tier: 'master' });
    }
    if (product.price_msrp != null) lines.push({ label: 'MSRP', value: product.price_msrp });
    return lines;
  }

  if (isDistributor) {
    const orderPrice = getOrderPrice(product, orderMode);
    if (orderPrice != null) lines.push({ label: priceDisplayLabel(product, userType, orderMode), value: orderPrice });
    if (product.price_per_unit != null && modeKey === 'master_case') {
      lines.push({ label: 'Per unit', value: product.price_per_unit });
    }
    if (product.price_wholesale != null) lines.push({ label: 'Wholesale', value: product.price_wholesale });
    if (product.price_retail != null) lines.push({ label: 'Retailer price', value: product.price_retail });
  } else {
    if (product.price_wholesale != null) lines.push({ label: 'Wholesale', value: product.price_wholesale });
  }

  if (product.price_msrp != null) lines.push({ label: 'MSRP', value: product.price_msrp });

  return lines;
}

export function getActivePromo(product, userType, { pricingVisible = true } = {}) {
  if (!pricingVisible || !product.promo_active || !product.promo_label) return null;
  const audience = product.promo_audience || 'both';
  if (audience !== 'both' && audience !== userType) return null;
  return { label: product.promo_label, detail: product.promo_detail };
}

export function getShippingSummary(product) {
  const parts = [];
  if (product.shipping_included) parts.push('Shipping included');
  if (product.shipping_free_after_moq && product.free_shipping_moq_qty) {
    parts.push(`Free shipping at ${product.free_shipping_moq_qty}+ ${product.moq_unit || 'case'}(s)`);
  } else if (product.shipping_free_after_moq) {
    parts.push('Free shipping after MOQ');
  }
  if (product.shipping_note) parts.push(product.shipping_note);
  if (!parts.length && !product.shipping_included) return null;
  return parts.join(' · ');
}

export function getMoqLabel(product) {
  if (!product.moq_qty) return null;
  const unit = product.moq_unit || 'case';
  return `MOQ: ${product.moq_qty} ${unit}${product.moq_qty !== 1 ? 's' : ''}`;
}

export function minQtyForProduct(product) {
  return product.moq_qty && product.moq_qty > 0 ? product.moq_qty : 1;
}

export function packPayloadFromForm(data) {
  const int = (v) => (v === '' || v === null || v === undefined ? null : parseInt(v, 10));
  return {
    units_per_inner: int(data.units_per_inner),
    inner_unit_label: data.inner_unit_label || null,
    inners_per_case: int(data.inners_per_case),
    inner_pack_label: data.inner_pack_label || null,
    retail_order_unit: data.retail_order_unit || null,
    retail_order_units: data.retail_order_units || null,
    distributor_order_units: data.distributor_order_units || null,
    cases_per_pallet: int(data.cases_per_pallet),
    pack_config_note: data.pack_config_note || null,
  };
}

export function commercePayloadFromForm(data) {
  const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  const int = (v) => (v === '' || v === null || v === undefined ? null : parseInt(v, 10));
  return {
    price_per_unit: num(data.price_per_unit),
    price_per_case: num(data.price_per_case),
    price_per_pallet: num(data.price_per_pallet),
    price_master_per_unit: num(data.price_master_per_unit),
    price_master_per_case: num(data.price_master_per_case),
    price_master_per_pallet: num(data.price_master_per_pallet),
    price_wholesale: num(data.price_wholesale),
    price_retail: num(data.price_retail),
    price_msrp: num(data.price_msrp),
    moq_qty: int(data.moq_qty),
    moq_unit: data.moq_unit || 'case',
    shipping_included: !!data.shipping_included,
    shipping_free_after_moq: !!data.shipping_free_after_moq,
    free_shipping_moq_qty: int(data.free_shipping_moq_qty),
    shipping_note: data.shipping_note || null,
    promo_label: data.promo_label || null,
    promo_detail: data.promo_detail || null,
    promo_active: !!data.promo_active,
    promo_audience: data.promo_audience || 'both',
  };
}
