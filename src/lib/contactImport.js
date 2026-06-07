import { supabase } from './supabase';
import { parseCsvText } from './adminUpload';

const HEADER_MAP = {
  name: ['name', 'full name', 'contact name', 'contact', 'first name'],
  company: ['company', 'business', 'store', 'business name', 'company / store'],
  email: ['email', 'e-mail', 'email address'],
  phone: ['phone', 'mobile', 'whatsapp', 'phone / whatsapp', 'telephone', 'cell'],
  address: ['address', 'location', 'street', 'city'],
  account_type: ['account type', 'type', 'account_type', 'role'],
  store_type: ['store type', 'store_type', 'category'],
  notes: ['notes', 'note', 'comments', 'comment'],
};

function normalizeHeader(h) {
  return (h || '').trim().toLowerCase();
}

function mapRow(row) {
  const keys = Object.keys(row).reduce((acc, k) => {
    acc[normalizeHeader(k)] = row[k];
    return acc;
  }, {});

  const pick = (field) => {
    for (const alias of HEADER_MAP[field]) {
      if (keys[alias]) return (keys[alias] || '').trim();
    }
    return '';
  };

  const accountType = pick('account_type').toLowerCase();
  return {
    name: pick('name'),
    company: pick('company'),
    email: pick('email'),
    phone: pick('phone'),
    address: pick('address'),
    account_type: accountType.includes('dist') ? 'distributor' : 'retailer',
    store_type: pick('store_type'),
    notes: pick('notes'),
  };
}

export function parseContactSpreadsheet(text, filename = '') {
  const rows = parseCsvText(text);
  if (!rows.length) return [];
  return rows
    .map(mapRow)
    .filter(r => r.name || r.company || r.email || r.phone);
}

export async function importContacts(rows, { uploadedBy, assignedRepId, filename }) {
  if (!rows.length) return { imported: 0 };

  const payload = rows.map(r => ({
    uploaded_by: uploadedBy,
    assigned_rep_id: assignedRepId || uploadedBy,
    name: r.name || null,
    company: r.company || null,
    email: r.email?.toLowerCase() || null,
    phone: r.phone || null,
    address: r.address || null,
    account_type: r.account_type || 'retailer',
    store_type: r.store_type || null,
    notes: r.notes || null,
    status: 'imported',
    source_filename: filename || null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('uploaded_contacts').insert(payload);
  if (error) throw error;
  return { imported: payload.length };
}

export async function fetchUploadedContacts({ userId, isAdmin, isSalesRep }) {
  let query = supabase
    .from('uploaded_contacts')
    .select('*')
    .order('created_at', { ascending: false });

  if (isSalesRep && !isAdmin) {
    query = query.or(`assigned_rep_id.eq.${userId},uploaded_by.eq.${userId}`);
  }

  const { data } = await query;
  return data || [];
}
