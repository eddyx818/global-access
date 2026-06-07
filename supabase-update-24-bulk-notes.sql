-- Bulk transfer + staff-only customer notes
-- Run after update 23

CREATE TABLE IF NOT EXISTS customer_staff_notes (
  customer_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE customer_staff_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_manage_customer_notes" ON customer_staff_notes;
CREATE POLICY "staff_manage_customer_notes" ON customer_staff_notes
  FOR ALL TO authenticated
  USING (
    auth_is_portal_admin()
    OR EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.user_id = customer_staff_notes.customer_user_id
        AND p.referred_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth_is_portal_admin()
    OR EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.user_id = customer_staff_notes.customer_user_id
        AND p.referred_by_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.bulk_transfer_signed_up_customers(
  p_customer_user_ids UUID[],
  p_new_rep_user_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_count INTEGER := 0;
BEGIN
  IF p_customer_user_ids IS NULL OR array_length(p_customer_user_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  FOREACH v_id IN ARRAY p_customer_user_ids
  LOOP
    BEGIN
      IF public.transfer_signed_up_customer(v_id, p_new_rep_user_id) THEN
        v_count := v_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_transfer_uploaded_contacts(
  p_contact_ids UUID[],
  p_new_rep_user_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_count INTEGER := 0;
BEGIN
  IF p_contact_ids IS NULL OR array_length(p_contact_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  FOREACH v_id IN ARRAY p_contact_ids
  LOOP
    BEGIN
      IF public.transfer_uploaded_contact(v_id, p_new_rep_user_id) THEN
        v_count := v_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_customer_staff_notes(
  p_customer_user_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer user_profiles%ROWTYPE;
BEGIN
  IF p_customer_user_id IS NULL THEN
    RAISE EXCEPTION 'Customer is required';
  END IF;

  SELECT * INTO v_customer FROM user_profiles WHERE user_id = p_customer_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF COALESCE(v_customer.is_portal_admin, false) OR COALESCE(v_customer.is_sales_rep, false) THEN
    RAISE EXCEPTION 'Cannot add notes to staff accounts';
  END IF;

  IF auth_is_portal_admin() THEN
    NULL;
  ELSIF auth_is_sales_rep() THEN
    IF v_customer.referred_by_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Customer is not assigned to you';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NULLIF(trim(p_notes), '') IS NULL THEN
    DELETE FROM customer_staff_notes WHERE customer_user_id = p_customer_user_id;
  ELSE
    INSERT INTO customer_staff_notes (customer_user_id, notes, updated_at, updated_by)
    VALUES (p_customer_user_id, trim(p_notes), NOW(), auth.uid())
    ON CONFLICT (customer_user_id) DO UPDATE
    SET notes = EXCLUDED.notes, updated_at = NOW(), updated_by = auth.uid();
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_uploaded_contact_notes(
  p_contact_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact uploaded_contacts%ROWTYPE;
BEGIN
  IF p_contact_id IS NULL THEN
    RAISE EXCEPTION 'Contact is required';
  END IF;

  SELECT * INTO v_contact FROM uploaded_contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  IF auth_is_portal_admin() THEN
    NULL;
  ELSIF auth_is_sales_rep() THEN
    IF v_contact.assigned_rep_id IS DISTINCT FROM auth.uid()
       AND v_contact.uploaded_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Contact is not assigned to you';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE uploaded_contacts
  SET notes = NULLIF(trim(p_notes), ''), updated_at = NOW()
  WHERE id = p_contact_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_transfer_signed_up_customers(UUID[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_transfer_uploaded_contacts(UUID[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_customer_staff_notes(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_uploaded_contact_notes(UUID, TEXT) TO authenticated;
