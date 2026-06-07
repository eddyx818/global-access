-- Quote workflow, back-in-stock alerts, inquiry policies
-- Run after update 24

ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS quote_status TEXT DEFAULT 'new';

ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS stock_notify_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  brand_name TEXT,
  sku TEXT NOT NULL,
  product_name TEXT,
  flavor TEXT NOT NULL,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_notify_user_sku_flavor
  ON stock_notify_requests(user_id, sku, flavor)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_notify_email_sku_flavor
  ON stock_notify_requests(lower(email), sku, flavor)
  WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_inquiries_user_created ON inquiries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_quote_status ON inquiries(quote_status);

ALTER TABLE stock_notify_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_stock_notify" ON stock_notify_requests;
CREATE POLICY "users_manage_own_stock_notify" ON stock_notify_requests
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "staff_read_stock_notify" ON stock_notify_requests;
CREATE POLICY "staff_read_stock_notify" ON stock_notify_requests
  FOR SELECT TO authenticated
  USING (auth_is_portal_admin() OR auth_is_sales_rep());

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_read_own_inquiries" ON inquiries;
CREATE POLICY "customers_read_own_inquiries" ON inquiries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "staff_read_inquiries" ON inquiries;
CREATE POLICY "staff_read_inquiries" ON inquiries
  FOR SELECT TO authenticated
  USING (auth_is_portal_admin() OR auth_is_sales_rep());

DROP POLICY IF EXISTS "anyone_insert_inquiries" ON inquiries;
CREATE POLICY "anyone_insert_inquiries" ON inquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_inquiry_quote_status(
  p_inquiry_id UUID,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inquiry inquiries%ROWTYPE;
BEGIN
  IF p_status NOT IN ('new', 'in_review', 'quoted', 'closed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT * INTO v_inquiry FROM inquiries WHERE id = p_inquiry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inquiry not found';
  END IF;

  IF auth_is_portal_admin() THEN
    NULL;
  ELSIF auth_is_sales_rep() AND v_inquiry.user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.user_id = v_inquiry.user_id
        AND p.referred_by_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE inquiries SET quote_status = p_status WHERE id = p_inquiry_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.subscribe_stock_notify(
  p_brand_id TEXT,
  p_sku TEXT,
  p_flavor TEXT,
  p_brand_name TEXT DEFAULT NULL,
  p_product_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  v_email := NULLIF(trim(p_email), '');

  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_email FROM user_profiles WHERE user_id = v_user_id LIMIT 1;
    IF v_email IS NULL THEN
      SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
    END IF;
  END IF;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Email required';
  END IF;

  INSERT INTO stock_notify_requests (
    user_id, email, brand_id, brand_name, sku, product_name, flavor
  ) VALUES (
    v_user_id, lower(v_email), p_brand_id, p_brand_name, p_sku, p_product_name, p_flavor
  )
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_inquiry_quote_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.subscribe_stock_notify(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.subscribe_stock_notify(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
