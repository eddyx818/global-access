-- Soft-delete messages: hide from customer (or self) while staff admins retain full visibility
-- Run after update 41

ALTER TABLE messages ADD COLUMN IF NOT EXISTS hidden_for_user_ids UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_messages_hidden_for ON messages USING GIN (hidden_for_user_ids);

CREATE OR REPLACE FUNCTION public.message_hidden_for_user(p_hidden UUID[], p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_user_id IS NOT NULL
    AND COALESCE(p_hidden, '{}') @> ARRAY[p_user_id];
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_conversation(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = p_conversation_id
      AND (
        auth.uid() = ANY(c.participant_user_ids)
        OR (auth_is_portal_admin() AND c.is_group = false AND conversation_has_customer(c.participant_user_ids))
        OR (auth_is_sales_rep() AND c.is_group = false AND conversation_belongs_to_rep(c.participant_user_ids))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.conversation_customer_user_id(p_conversation_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT uid
  FROM unnest((
    SELECT participant_user_ids FROM conversations WHERE id = p_conversation_id
  )) AS uid
  JOIN user_profiles p ON p.user_id = uid
  WHERE NOT COALESCE(p.is_portal_admin, false)
    AND NOT COALESCE(p.is_sales_rep, false)
    AND COALESCE(p.role, '') NOT IN ('admin', 'sales_rep')
  LIMIT 1;
$$;

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
  IF p_scope NOT IN ('me', 'customer') THEN
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

DROP POLICY IF EXISTS "users_read_conversation_messages" ON messages;
CREATE POLICY "users_read_conversation_messages" ON messages
  FOR SELECT TO authenticated
  USING (
    user_can_access_conversation(conversation_id)
    AND (
      auth_is_portal_admin()
      OR NOT message_hidden_for_user(hidden_for_user_ids, auth.uid())
    )
  );

GRANT EXECUTE ON FUNCTION public.soft_delete_message(UUID, TEXT) TO authenticated;
