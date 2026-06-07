import { BRANDS } from './data';

export const CRM_TIER = {
  VIP: 'vip',
  WHALE: 'whale',
};

export const BRAND_NAME_BY_ID = Object.fromEntries(BRANDS.map(b => [b.id, b.name]));

export function normalizeMasterBrandIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [];
}

export function getAccountBadges(profile = {}, { brandNames = BRAND_NAME_BY_ID } = {}) {
  if (!profile || profile.is_portal_admin || profile.is_sales_rep) return [];

  const badges = [];
  const role = profile.role || profile.user_type;

  if (profile.crm_tier === CRM_TIER.VIP) {
    badges.push({ key: 'vip', label: 'VIP', icon: '★', color: '#C9A84C', bg: '#FDF6E3' });
  }

  if (profile.crm_tier === CRM_TIER.WHALE) {
    badges.push({ key: 'whale', label: 'Whale', icon: '🐋', color: '#2563EB', bg: '#EFF6FF' });
  }

  if (role === 'distributor' && profile.master_pricing_qualified) {
    badges.push({ key: 'master', label: 'Master', icon: '★', color: '#A07A20', bg: '#FDF6E3' });
  }

  normalizeMasterBrandIds(profile.master_brand_ids).forEach(brandId => {
    badges.push({
      key: `master-${brandId}`,
      label: `Master · ${brandNames[brandId] || brandId}`,
      icon: '★',
      color: '#7B6CF6',
      bg: '#F3F0FF',
      compact: true,
    });
  });

  return badges;
}

export function hasAccountBadges(profile) {
  return getAccountBadges(profile).length > 0;
}
