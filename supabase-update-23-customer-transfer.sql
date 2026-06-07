-- Transfer signed-up customers and imported contacts between reps/admins
-- Run after update 21

CREATE OR REPLACE FUNCTION public.is_assignable_rep(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = p_user_id
      AND rep_code IS NOT NULL
      AND (COALESCE(is_sales_rep, false) OR COALESCE(is_portal_admin, false))
  );
$$;

CREATE OR REPLACE FUNCTION public.transfer_signed_up_customer(
  p_customer_user_id UUID,
  p_new_rep_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer user_profiles%ROWTYPE;
  v_new_code TEXT;
BEGIN
  IF p_customer_user_id IS NULL THEN
    RAISE EXCEPTION 'Customer is required';
  END IF;

  SELECT * INTO v_customer
  FROM user_profiles
  WHERE user_id = p_customer_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF COALESCE(v_customer.is_portal_admin, false) OR COALESCE(v_customer.is_sales_rep, false) THEN
    RAISE EXCEPTION 'Cannot transfer staff accounts';
  END IF;

  IF p_new_rep_user_id IS NOT NULL AND NOT public.is_assignable_rep(p_new_rep_user_id) THEN
    RAISE EXCEPTION 'Target must be a rep or admin with an access code';
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

  v_new_code := NULL;
  IF p_new_rep_user_id IS NOT NULL THEN
    SELECT rep_code INTO v_new_code FROM user_profiles WHERE user_id = p_new_rep_user_id;
  END IF;

  UPDATE user_profiles
  SET
    referred_by_user_id = p_new_rep_user_id,
    referral_code_used = v_new_code,
    updated_at = NOW()
  WHERE user_id = p_customer_user_id;

  IF v_customer.email IS NOT NULL THEN
    UPDATE access_requests
    SET
      referred_by_user_id = p_new_rep_user_id,
      referral_code_used = v_new_code
    WHERE lower(email) = lower(v_customer.email);
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_uploaded_contact(
  p_contact_id UUID,
  p_new_rep_user_id UUID DEFAULT NULL
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

  IF p_new_rep_user_id IS NOT NULL AND NOT public.is_assignable_rep(p_new_rep_user_id) THEN
    RAISE EXCEPTION 'Target must be a rep or admin with an access code';
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
  SET
    assigned_rep_id = p_new_rep_user_id,
    updated_at = NOW()
  WHERE id = p_contact_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_signed_up_customer(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_uploaded_contact(UUID, UUID) TO authenticated;
