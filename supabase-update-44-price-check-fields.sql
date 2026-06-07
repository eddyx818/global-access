-- Price check workspace: account name, customer link, target rates, edit while open
-- Run after update 43

ALTER TABLE staff_price_checks ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE staff_price_checks ADD COLUMN IF NOT EXISTS customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE staff_price_checks ADD COLUMN IF NOT EXISTS target_rates TEXT;
ALTER TABLE staff_price_checks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'catalog';

UPDATE staff_price_checks SET status = 'approved' WHERE status = 'answered';

CREATE OR REPLACE FUNCTION public.update_staff_price_check_status(
  p_check_id UUID,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row staff_price_checks%ROWTYPE;
BEGIN
  IF p_status NOT IN ('new', 'in_review', 'approved', 'closed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT * INTO v_row FROM staff_price_checks WHERE id = p_check_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Price check not found';
  END IF;

  IF auth_is_portal_admin() THEN
    NULL;
  ELSIF auth_is_sales_rep() AND v_row.staff_user_id = auth.uid() THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE staff_price_checks
  SET status = p_status, updated_at = NOW()
  WHERE id = p_check_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_staff_price_check(
  p_check_id UUID,
  p_account_name TEXT DEFAULT NULL,
  p_user_type TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_target_rates TEXT DEFAULT NULL,
  p_interests JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row staff_price_checks%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM staff_price_checks WHERE id = p_check_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Price check not found';
  END IF;

  IF v_row.status IN ('approved', 'closed') THEN
    RAISE EXCEPTION 'Price check is locked';
  END IF;

  IF auth_is_portal_admin() THEN
    NULL;
  ELSIF auth_is_sales_rep() AND v_row.staff_user_id = auth.uid() THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE staff_price_checks
  SET
    account_name = COALESCE(NULLIF(trim(p_account_name), ''), account_name),
    user_type = COALESCE(NULLIF(trim(p_user_type), ''), user_type),
    notes = CASE WHEN p_notes IS NOT NULL THEN NULLIF(trim(p_notes), '') ELSE notes END,
    target_rates = CASE WHEN p_target_rates IS NOT NULL THEN NULLIF(trim(p_target_rates), '') ELSE target_rates END,
    interests = COALESCE(p_interests, interests),
    updated_at = NOW()
  WHERE id = p_check_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_staff_price_check(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
