import { supabase } from './supabase';

export async function transferSignedUpCustomer(customerUserId, newRepUserId = null) {
  const { data, error } = await supabase.rpc('transfer_signed_up_customer', {
    p_customer_user_id: customerUserId,
    p_new_rep_user_id: newRepUserId || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: !!data };
}

export async function bulkTransferSignedUpCustomers(customerUserIds, newRepUserId = null) {
  const { data, error } = await supabase.rpc('bulk_transfer_signed_up_customers', {
    p_customer_user_ids: customerUserIds,
    p_new_rep_user_id: newRepUserId || null,
  });
  if (error) return { ok: false, error: error.message, count: 0 };
  return { ok: true, count: data || 0 };
}

export async function transferUploadedContact(contactId, newRepUserId = null) {
  const { data, error } = await supabase.rpc('transfer_uploaded_contact', {
    p_contact_id: contactId,
    p_new_rep_user_id: newRepUserId || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: !!data };
}

export async function bulkTransferUploadedContacts(contactIds, newRepUserId = null) {
  const { data, error } = await supabase.rpc('bulk_transfer_uploaded_contacts', {
    p_contact_ids: contactIds,
    p_new_rep_user_id: newRepUserId || null,
  });
  if (error) return { ok: false, error: error.message, count: 0 };
  return { ok: true, count: data || 0 };
}

export async function saveCustomerStaffNotes(customerUserId, notes) {
  const { data, error } = await supabase.rpc('upsert_customer_staff_notes', {
    p_customer_user_id: customerUserId,
    p_notes: notes || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: !!data };
}

export async function saveUploadedContactNotes(contactId, notes) {
  const { data, error } = await supabase.rpc('update_uploaded_contact_notes', {
    p_contact_id: contactId,
    p_notes: notes || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: !!data };
}

export async function fetchCustomerStaffNotes(customerUserId) {
  if (!customerUserId) return '';
  const { data } = await supabase
    .from('customer_staff_notes')
    .select('notes')
    .eq('customer_user_id', customerUserId)
    .maybeSingle();
  return data?.notes || '';
}

export async function fetchCustomerStaffNotesMap() {
  const { data, error } = await supabase
    .from('customer_staff_notes')
    .select('customer_user_id, notes');
  if (error) return {};
  const map = {};
  (data || []).forEach((row) => { map[row.customer_user_id] = row.notes || ''; });
  return map;
}

export function repDisplayName(rep) {
  if (!rep) return 'Unassigned';
  return rep.name || rep.company || rep.email || rep.rep_code || 'Rep';
}

export function buildRepOptions(reps) {
  return (reps || []).filter(r => r.rep_code);
}
