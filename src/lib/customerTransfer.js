import { supabase } from './supabase';

export async function transferSignedUpCustomer(customerUserId, newRepUserId = null) {
  const { data, error } = await supabase.rpc('transfer_signed_up_customer', {
    p_customer_user_id: customerUserId,
    p_new_rep_user_id: newRepUserId || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: !!data };
}

export async function transferUploadedContact(contactId, newRepUserId = null) {
  const { data, error } = await supabase.rpc('transfer_uploaded_contact', {
    p_contact_id: contactId,
    p_new_rep_user_id: newRepUserId || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: !!data };
}

export function repDisplayName(rep) {
  if (!rep) return 'Unassigned';
  return rep.name || rep.company || rep.email || rep.rep_code || 'Rep';
}

export function buildRepOptions(reps) {
  return (reps || []).filter(r => r.rep_code);
}
