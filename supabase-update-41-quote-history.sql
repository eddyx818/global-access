-- Quote revision history per customer (compare past prices on reorders)
-- Run after update 40

CREATE TABLE IF NOT EXISTS inquiry_quote_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inquiry_id UUID REFERENCES inquiries(id) ON DELETE SET NULL,
  customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  revision INT NOT NULL DEFAULT 1,
  line_items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(12, 2),
  fulfillment_status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_history_customer ON inquiry_quote_history(customer_user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_history_inquiry ON inquiry_quote_history(inquiry_id, revision DESC);

ALTER TABLE inquiry_quote_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_quote_history" ON inquiry_quote_history;
CREATE POLICY "staff_read_quote_history" ON inquiry_quote_history
  FOR SELECT TO authenticated
  USING (auth_is_portal_admin() OR auth_is_sales_rep());

DROP POLICY IF EXISTS "customers_read_own_quote_history" ON inquiry_quote_history;
CREATE POLICY "customers_read_own_quote_history" ON inquiry_quote_history
  FOR SELECT TO authenticated
  USING (customer_user_id = auth.uid());

DROP POLICY IF EXISTS "staff_insert_quote_history" ON inquiry_quote_history;
CREATE POLICY "staff_insert_quote_history" ON inquiry_quote_history
  FOR INSERT TO authenticated
  WITH CHECK (auth_is_portal_admin() OR auth_is_sales_rep());

DROP POLICY IF EXISTS "staff_update_quote_history" ON inquiry_quote_history;
CREATE POLICY "staff_update_quote_history" ON inquiry_quote_history
  FOR UPDATE TO authenticated
  USING (auth_is_portal_admin() OR auth_is_sales_rep())
  WITH CHECK (auth_is_portal_admin() OR auth_is_sales_rep());

-- Allow editing lines after a quote was already sent (reopens for revision)
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
      WHEN quote_status IN ('new', 'quoted', 'closed') THEN 'in_review'
      ELSE quote_status
    END
  WHERE id = p_inquiry_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_inquiry_quote_send(
  p_inquiry_id UUID,
  p_line_items JSONB,
  p_subtotal NUMERIC,
  p_conversation_id UUID DEFAULT NULL,
  p_message_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inquiry inquiries%ROWTYPE;
  v_revision INT;
  v_history_id UUID;
BEGIN
  IF p_line_items IS NULL OR jsonb_typeof(p_line_items) <> 'array' THEN
    RAISE EXCEPTION 'Invalid line items';
  END IF;

  SELECT * INTO v_inquiry FROM inquiries WHERE id = p_inquiry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inquiry not found';
  END IF;

  IF NOT staff_can_manage_inquiry(v_inquiry.user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_inquiry.user_id IS NULL THEN
    RAISE EXCEPTION 'Customer account required';
  END IF;

  SELECT COALESCE(MAX(revision), 0) + 1 INTO v_revision
  FROM inquiry_quote_history
  WHERE inquiry_id = p_inquiry_id;

  INSERT INTO inquiry_quote_history (
    inquiry_id,
    customer_user_id,
    sent_by,
    conversation_id,
    message_id,
    revision,
    line_items,
    subtotal,
    fulfillment_status,
    sent_at
  ) VALUES (
    p_inquiry_id,
    v_inquiry.user_id,
    auth.uid(),
    p_conversation_id,
    p_message_id,
    v_revision,
    p_line_items,
    p_subtotal,
    'sent',
    NOW()
  )
  RETURNING id INTO v_history_id;

  UPDATE inquiries
  SET
    interests = p_line_items,
    quote_status = 'quoted',
    quoted_at = NOW(),
    quoted_by = auth.uid()
  WHERE id = p_inquiry_id;

  RETURN v_history_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_quote_history_status(
  p_history_id UUID,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row inquiry_quote_history%ROWTYPE;
BEGIN
  IF p_status NOT IN ('sent', 'accepted', 'paid', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT * INTO v_row FROM inquiry_quote_history WHERE id = p_history_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote history not found';
  END IF;

  IF NOT staff_can_manage_inquiry(v_row.customer_user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE inquiry_quote_history SET fulfillment_status = p_status WHERE id = p_history_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_inquiry_quote_send(UUID, JSONB, NUMERIC, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_quote_history_status(UUID, TEXT) TO authenticated;
