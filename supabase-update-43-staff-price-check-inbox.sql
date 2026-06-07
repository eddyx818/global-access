-- Staff price checks inbox (internal SKU / pricing requests — not customer quotes)
-- Run after update 42

CREATE TABLE IF NOT EXISTS staff_price_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interests JSONB NOT NULL DEFAULT '[]',
  user_type TEXT DEFAULT 'retailer',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_price_checks_created ON staff_price_checks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_price_checks_staff ON staff_price_checks(staff_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_price_checks_status ON staff_price_checks(status);

ALTER TABLE staff_price_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_price_checks" ON staff_price_checks;
CREATE POLICY "staff_read_price_checks" ON staff_price_checks
  FOR SELECT TO authenticated
  USING (auth_is_portal_admin() OR auth_is_sales_rep());

DROP POLICY IF EXISTS "staff_insert_own_price_checks" ON staff_price_checks;
CREATE POLICY "staff_insert_own_price_checks" ON staff_price_checks
  FOR INSERT TO authenticated
  WITH CHECK (
    staff_user_id = auth.uid()
    AND (auth_is_portal_admin() OR auth_is_sales_rep())
  );

DROP POLICY IF EXISTS "admin_delete_price_checks" ON staff_price_checks;
CREATE POLICY "admin_delete_price_checks" ON staff_price_checks
  FOR DELETE TO authenticated
  USING (auth_is_portal_admin());

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
  IF p_status NOT IN ('new', 'in_review', 'answered', 'closed') THEN
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

GRANT EXECUTE ON FUNCTION public.update_staff_price_check_status(UUID, TEXT) TO authenticated;
