-- Staff quote builder: verify SKUs, set line prices, send to customer inbox
-- Run after update 39

ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMPTZ;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS quoted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.staff_can_manage_inquiry(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth_is_portal_admin() THEN true
    WHEN auth_is_sales_rep() AND p_user_id IS NOT NULL THEN EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.user_id = p_user_id
        AND p.referred_by_user_id = auth.uid()
    )
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.update_inquiry_quote_lines(
  p_inquiry_id UUID,
  p_interests JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inquiry inquiries%ROWTYPE;
BEGIN
  IF p_interests IS NULL OR jsonb_typeof(p_interests) <> 'array' THEN
    RAISE EXCEPTION 'Invalid interests payload';
  END IF;

  SELECT * INTO v_inquiry FROM inquiries WHERE id = p_inquiry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inquiry not found';
  END IF;

  IF NOT staff_can_manage_inquiry(v_inquiry.user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE inquiries
  SET
    interests = p_interests,
    quote_status = CASE
      WHEN quote_status IN ('new', 'in_review') THEN 'in_review'
      ELSE quote_status
    END
  WHERE id = p_inquiry_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_inquiry_quoted(p_inquiry_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inquiry inquiries%ROWTYPE;
BEGIN
  SELECT * INTO v_inquiry FROM inquiries WHERE id = p_inquiry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inquiry not found';
  END IF;

  IF NOT staff_can_manage_inquiry(v_inquiry.user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE inquiries
  SET
    quote_status = 'quoted',
    quoted_at = NOW(),
    quoted_by = auth.uid()
  WHERE id = p_inquiry_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_inquiry_quote_lines(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_inquiry_quoted(UUID) TO authenticated;
