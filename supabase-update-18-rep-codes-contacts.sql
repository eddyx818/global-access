-- Sales rep access codes, customer referral tracking, contact imports
-- Run after update 17

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_sales_rep BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS rep_code TEXT UNIQUE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS referral_code_used TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_rep_code ON user_profiles(rep_code) WHERE rep_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_referred_by ON user_profiles(referred_by_user_id);

ALTER TABLE portal_sessions ADD COLUMN IF NOT EXISTS referral_rep_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE portal_sessions ADD COLUMN IF NOT EXISTS referral_code TEXT;

ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS referral_code_used TEXT;

-- Imported contact lists (CSV / spreadsheet rows)
CREATE TABLE IF NOT EXISTS uploaded_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_rep_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT,
  company TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  account_type TEXT DEFAULT 'retailer',
  store_type TEXT,
  notes TEXT,
  status TEXT DEFAULT 'imported',
  linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source_filename TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploaded_contacts_rep ON uploaded_contacts(assigned_rep_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_contacts_uploaded_by ON uploaded_contacts(uploaded_by);

ALTER TABLE uploaded_contacts ENABLE ROW LEVEL SECURITY;

-- ─── Helper functions ───
CREATE OR REPLACE FUNCTION public.auth_is_sales_rep()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_sales_rep FROM user_profiles WHERE user_id = auth.uid() LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.conversation_customer_id(p_ids UUID[])
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id
  FROM user_profiles p
  WHERE p.user_id = ANY(p_ids)
    AND COALESCE(p.is_portal_admin, false) = false
    AND COALESCE(p.is_sales_rep, false) = false
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.conversation_belongs_to_rep(p_ids UUID[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles p
    WHERE p.user_id = conversation_customer_id(p_ids)
      AND p.referred_by_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_sales_rep_unread_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM messages m
  JOIN conversations c ON c.id = m.conversation_id
  JOIN user_profiles cust ON cust.user_id = conversation_customer_id(c.participant_user_ids)
  WHERE auth_is_sales_rep()
    AND c.is_group = false
    AND cust.referred_by_user_id = auth.uid()
    AND m.read_status = false
    AND NOT EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.user_id = m.from_user_id
        AND (COALESCE(p.is_portal_admin, false) OR COALESCE(p.is_sales_rep, false))
    );
$$;

-- Allow gate to validate rep codes (read-only, codes only)
DROP POLICY IF EXISTS "public_validate_rep_codes" ON user_profiles;
CREATE POLICY "public_validate_rep_codes" ON user_profiles
  FOR SELECT TO anon, authenticated
  USING (
    rep_code IS NOT NULL
    AND (is_sales_rep = true OR is_portal_admin = true)
  );

-- Reps read profiles they referred + themselves
DROP POLICY IF EXISTS "reps_read_assigned_customers" ON user_profiles;
CREATE POLICY "reps_read_assigned_customers" ON user_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR referred_by_user_id = auth.uid()
    OR auth_is_portal_admin()
  );

-- Extend conversation access for assigned reps
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
    OR (
      auth_is_sales_rep()
      AND is_group = false
      AND conversation_belongs_to_rep(participant_user_ids)
    )
  );

DROP POLICY IF EXISTS "users_update_own_conversations" ON conversations;
CREATE POLICY "users_update_own_conversations" ON conversations
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = ANY(participant_user_ids)
    OR (auth_is_portal_admin() AND conversation_is_support_thread(id))
    OR (auth_is_sales_rep() AND conversation_belongs_to_rep(participant_user_ids))
  );

DROP POLICY IF EXISTS "users_read_conversation_messages" ON messages;
CREATE POLICY "users_read_conversation_messages" ON messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (
          auth.uid() = ANY(c.participant_user_ids)
          OR (auth_is_portal_admin() AND c.is_group = false AND conversation_has_customer(c.participant_user_ids))
          OR (auth_is_sales_rep() AND c.is_group = false AND conversation_belongs_to_rep(c.participant_user_ids))
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
          OR (auth_is_portal_admin() AND c.is_group = false AND conversation_has_customer(c.participant_user_ids))
          OR (auth_is_sales_rep() AND c.is_group = false AND conversation_belongs_to_rep(c.participant_user_ids))
        )
    )
  );

DROP POLICY IF EXISTS "users_update_message_read" ON messages;
CREATE POLICY "users_update_message_read" ON messages
  FOR UPDATE TO authenticated
  USING (
    to_user_id = auth.uid()
    OR from_user_id = auth.uid()
    OR (auth_is_portal_admin() AND conversation_is_support_thread(conversation_id))
    OR (
      auth_is_sales_rep()
      AND EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = conversation_id
          AND conversation_belongs_to_rep(c.participant_user_ids)
      )
    )
  );

-- Uploaded contacts: admins all; reps see assigned or own uploads
DROP POLICY IF EXISTS "staff_manage_uploaded_contacts" ON uploaded_contacts;
CREATE POLICY "staff_manage_uploaded_contacts" ON uploaded_contacts
  FOR ALL TO authenticated
  USING (
    auth_is_portal_admin()
    OR uploaded_by = auth.uid()
    OR assigned_rep_id = auth.uid()
  )
  WITH CHECK (
    auth_is_portal_admin()
    OR uploaded_by = auth.uid()
    OR assigned_rep_id = auth.uid()
  );

-- Reps can start threads with assigned customers
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
      OR (
        auth_is_sales_rep()
        AND is_group = false
        AND array_length(participant_user_ids, 1) = 2
        AND conversation_belongs_to_rep(participant_user_ids)
      )
    )
  );
