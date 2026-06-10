-- WhatsApp-first leads: contact opt-in, customer quote responses, shipping status
-- Run after update 41

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS contact_requested BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE product_content
  ADD COLUMN IF NOT EXISTS shipping_status TEXT NOT NULL DEFAULT 'known';

ALTER TABLE inquiry_quote_history
  ADD COLUMN IF NOT EXISTS customer_response TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS customer_counter_lines JSONB,
  ADD COLUMN IF NOT EXISTS customer_counter_notes TEXT,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- Customer responds to a sent quote (accept / deny / counter)
CREATE OR REPLACE FUNCTION public.customer_respond_to_quote(
  p_history_id UUID,
  p_response TEXT,
  p_counter_lines JSONB DEFAULT NULL,
  p_counter_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row inquiry_quote_history%ROWTYPE;
BEGIN
  IF p_response NOT IN ('accepted', 'denied', 'countered') THEN
    RAISE EXCEPTION 'Invalid response';
  END IF;

  SELECT * INTO v_row FROM inquiry_quote_history WHERE id = p_history_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  IF v_row.customer_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_row.customer_response NOT IN ('pending', 'countered') THEN
    RAISE EXCEPTION 'Quote already responded';
  END IF;

  UPDATE inquiry_quote_history
  SET
    customer_response = p_response,
    customer_counter_lines = CASE WHEN p_response = 'countered' THEN p_counter_lines ELSE NULL END,
    customer_counter_notes = NULLIF(TRIM(p_counter_notes), ''),
    responded_at = NOW(),
    fulfillment_status = CASE
      WHEN p_response = 'accepted' THEN 'accepted'
      WHEN p_response = 'denied' THEN 'cancelled'
      ELSE fulfillment_status
    END
  WHERE id = p_history_id;

  IF v_row.inquiry_id IS NOT NULL THEN
    UPDATE inquiries
    SET quote_status = CASE
      WHEN p_response = 'accepted' THEN 'quoted'
      WHEN p_response = 'denied' THEN 'closed'
      ELSE 'in_review'
    END
    WHERE id = v_row.inquiry_id;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.customer_respond_to_quote(UUID, TEXT, JSONB, TEXT) TO authenticated;
