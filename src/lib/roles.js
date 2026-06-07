export const ROLE_LABELS = {
  retailer: 'Retailer',
  distributor: 'Distributor',
  sales_rep: 'Sales',
  admin: 'Admin',
};

export function formatRoleLabel(role) {
  if (!role) return '—';
  return ROLE_LABELS[role] || role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
