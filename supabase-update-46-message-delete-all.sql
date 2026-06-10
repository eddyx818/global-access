-- Staff can permanently delete a message for everyone (scope = all)
-- Run after update 42

CREATE OR REPLACE FUNCTION public.soft_delete_message(
  p_message_id UUID,
  p_scope TEXT DEFAULT 'me'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg messages%ROWTYPE;
  v_target UUID;
BEGIN
  IF p_scope NOT IN ('me', 'customer', 'all') THEN
    RAISE EXCEPTION 'Invalid scope';
  END IF;

  SELECT * INTO v_msg FROM messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF COALESCE(v_msg.is_system, false) THEN
    RAISE EXCEPTION 'System messages cannot be deleted';
  END IF;

  IF NOT user_can_access_conversation(v_msg.conversation_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_scope = 'all' THEN
    IF NOT (auth_is_portal_admin() OR auth_is_sales_rep()) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    DELETE FROM messages WHERE id = p_message_id;
    RETURN true;
  END IF;

  IF p_scope = 'me' THEN
    v_target := auth.uid();
  ELSE
    IF NOT (auth_is_portal_admin() OR auth_is_sales_rep()) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    v_target := conversation_customer_user_id(v_msg.conversation_id);
    IF v_target IS NULL THEN
      RAISE EXCEPTION 'Customer not found for conversation';
    END IF;
  END IF;

  UPDATE messages
  SET hidden_for_user_ids = (
    SELECT COALESCE(array_agg(DISTINCT x), '{}')
    FROM unnest(COALESCE(hidden_for_user_ids, '{}') || ARRAY[v_target]) AS x
  )
  WHERE id = p_message_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_message(UUID, TEXT) TO authenticated;
