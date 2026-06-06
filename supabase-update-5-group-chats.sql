-- Group chat: join RPC + discover brand channels
-- Run in Supabase SQL Editor after supabase-update-4-community.sql

CREATE OR REPLACE FUNCTION join_group_chat(p_conversation_id uuid)
RETURNS conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result conversations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE conversations
  SET participant_user_ids = CASE
    WHEN auth.uid() = ANY(participant_user_ids) THEN participant_user_ids
    ELSE array_append(participant_user_ids, auth.uid())
  END
  WHERE id = p_conversation_id
    AND is_group = true
  RETURNING * INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION join_group_chat(uuid) TO authenticated;

DROP POLICY IF EXISTS "users_read_brand_groups" ON conversations;
CREATE POLICY "users_read_brand_groups" ON conversations
  FOR SELECT TO authenticated
  USING (is_group = true AND brand_id IS NOT NULL);
