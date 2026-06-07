-- Shared support inbox: all portal admins can see and reply to customer messages
-- Run in Supabase SQL Editor after supabase-update-7-private-messaging.sql

CREATE OR REPLACE FUNCTION public.conversation_has_customer(p_ids UUID[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles p
    WHERE p.user_id = ANY(p_ids)
      AND COALESCE(p.is_portal_admin, false) = false
  );
$$;

CREATE OR REPLACE FUNCTION public.conversation_is_support_thread(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = p_conversation_id
      AND c.is_group = false
      AND conversation_has_customer(c.participant_user_ids)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_admin_unread_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM messages m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE auth_is_portal_admin()
    AND c.is_group = false
    AND conversation_has_customer(c.participant_user_ids)
    AND m.read_status = false
    AND NOT EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.user_id = m.from_user_id
        AND COALESCE(p.is_portal_admin, false) = true
    );
$$;

-- Conversations: admins can read all customer support threads
DROP POLICY IF EXISTS "users_read_own_conversations" ON conversations;
CREATE POLICY "users_read_own_conversations" ON conversations
  FOR SELECT TO authenticated
  USING (
    (
      auth.uid() = ANY(participant_user_ids)
      AND (
        auth_is_portal_admin()
        OR (
          is_group = false
          AND EXISTS (
            SELECT 1 FROM user_profiles p
            WHERE p.user_id = ANY(participant_user_ids)
              AND p.is_portal_admin = true
              AND p.user_id <> auth.uid()
          )
        )
      )
    )
    OR (
      auth_is_portal_admin()
      AND is_group = false
      AND conversation_has_customer(participant_user_ids)
    )
  );

DROP POLICY IF EXISTS "users_update_own_conversations" ON conversations;
CREATE POLICY "users_update_own_conversations" ON conversations
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = ANY(participant_user_ids)
    OR (
      auth_is_portal_admin()
      AND conversation_is_support_thread(id)
    )
  );

-- Messages: admins can read/send in any customer support thread
DROP POLICY IF EXISTS "users_read_conversation_messages" ON messages;
CREATE POLICY "users_read_conversation_messages" ON messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (
          auth.uid() = ANY(c.participant_user_ids)
          OR (
            auth_is_portal_admin()
            AND c.is_group = false
            AND conversation_has_customer(c.participant_user_ids)
          )
        )
    )
  );

DROP POLICY IF EXISTS "users_send_messages" ON messages;
CREATE POLICY "users_send_messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    from_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (
          auth.uid() = ANY(c.participant_user_ids)
          OR (
            auth_is_portal_admin()
            AND c.is_group = false
            AND conversation_has_customer(c.participant_user_ids)
          )
        )
    )
  );

DROP POLICY IF EXISTS "users_update_message_read" ON messages;
CREATE POLICY "users_update_message_read" ON messages
  FOR UPDATE TO authenticated
  USING (
    to_user_id = auth.uid()
    OR from_user_id = auth.uid()
    OR (
      auth_is_portal_admin()
      AND conversation_is_support_thread(conversation_id)
    )
  );

-- Seed legacy env admins (run manually with your emails):
-- UPDATE user_profiles SET is_portal_admin = true, role = 'admin'
-- WHERE email ILIKE ANY (ARRAY['admin1@example.com', 'admin2@example.com']);
