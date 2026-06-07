-- Private messaging: customers can only DM portal admins, not each other
-- Run in Supabase SQL Editor after prior migrations

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_portal_admin BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION public.auth_is_portal_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_portal_admin FROM user_profiles WHERE user_id = auth.uid() LIMIT 1),
    false
  );
$$;

-- Profile visibility: own profile, portal admins (for support contact), or full access if you are admin
DROP POLICY IF EXISTS "auth_read_profiles" ON user_profiles;
DROP POLICY IF EXISTS "users_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "scoped_read_profiles" ON user_profiles;

CREATE POLICY "scoped_read_profiles" ON user_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_portal_admin = true
    OR auth_is_portal_admin()
  );

-- Keep write-own-profile (merge with existing write policies)
DROP POLICY IF EXISTS "auth_write_profiles" ON user_profiles;
CREATE POLICY "auth_write_own_profile" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "auth_update_own_profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Conversations: customers only see 1:1 chats with a portal admin; admins see all their chats
DROP POLICY IF EXISTS "users_read_own_conversations" ON conversations;
CREATE POLICY "users_read_own_conversations" ON conversations
  FOR SELECT TO authenticated
  USING (
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
  );

DROP POLICY IF EXISTS "users_insert_conversations" ON conversations;
CREATE POLICY "users_insert_conversations" ON conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = ANY(participant_user_ids)
    AND (
      auth_is_portal_admin()
      OR (
        is_group = false
        AND array_length(participant_user_ids, 1) = 2
        AND EXISTS (
          SELECT 1 FROM user_profiles p
          WHERE p.user_id = ANY(participant_user_ids)
            AND p.is_portal_admin = true
            AND p.user_id <> auth.uid()
        )
      )
    )
  );

-- Mark your admin account (replace email with REACT_APP_ADMIN_EMAIL value)
-- UPDATE user_profiles SET is_portal_admin = true
-- WHERE email ILIKE 'your-admin@email.com';
