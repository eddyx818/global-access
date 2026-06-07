-- ============================================================================
-- Global Access — FULL SUPABASE MIGRATION (updates 2–19)
-- ============================================================================
-- Run once in Supabase SQL Editor → New query → Run
--
-- Safe to re-run on an existing project (uses IF NOT EXISTS, DROP POLICY IF EXISTS).
-- Keep numeric order — later sections replace RLS policies from earlier ones.
--
-- NOT SQL (configure in Supabase Dashboard separately):
--   Update 14 — Discord: deploy notify-discord edge function, secrets, DB webhook
--                 See supabase-update-14-discord-notify.sql for steps
--   Update 16 — Push: VAPID keys, deploy notify-push, DB webhook (after SQL below)
--
-- After running, mark your admin account (replace email):
--   UPDATE user_profiles SET is_portal_admin = true, role = 'admin'
--   WHERE email ILIKE 'your-admin@example.com';
-- ============================================================================

-- ============================================================================
-- supabase-update-2.sql
-- ============================================================================

-- Run this in Supabase SQL Editor -> New query

-- Add order_unit column to product_content if it doesn't exist
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS order_unit TEXT;

-- Create brand_gallery table if it doesn't exist
CREATE TABLE IF NOT EXISTS brand_gallery (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  sort_order BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE brand_gallery ENABLE ROW LEVEL SECURITY;

-- Drop policies first to avoid conflicts, then recreate
DROP POLICY IF EXISTS "public_read_gallery" ON brand_gallery;
DROP POLICY IF EXISTS "auth_write_gallery" ON brand_gallery;

CREATE POLICY "public_read_gallery" ON brand_gallery FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth_write_gallery" ON brand_gallery FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Make sure storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-images', 'brand-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Add new columns to access_requests for enhanced signup
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'retailer';
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS store_type TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS location_count TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS has_retail BOOLEAN DEFAULT false;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS retail_count TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Add sort_order to brand_content for drag reorder
ALTER TABLE brand_content ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add user_type to inquiries
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS user_type TEXT;

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  phone TEXT,
  role TEXT DEFAULT 'retailer',
  temp_password TEXT,
  disabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_profiles" ON user_profiles;
DROP POLICY IF EXISTS "auth_write_profiles" ON user_profiles;

CREATE POLICY "auth_read_profiles" ON user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_profiles" ON user_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Site settings table (bg color, hidden brands, custom brands)
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_settings" ON site_settings;
DROP POLICY IF EXISTS "auth_write_settings" ON site_settings;

CREATE POLICY "public_read_settings" ON site_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth_write_settings" ON site_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add flavors columns to product_content if missing
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS flavors_retail TEXT;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS flavors_distro TEXT;

-- Email drafts table
CREATE TABLE IF NOT EXISTS email_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT,
  brand_name TEXT,
  subject_a TEXT,
  subject_b TEXT,
  subject_used TEXT,
  preheader TEXT,
  html_content TEXT,
  copy_json TEXT,
  audience TEXT DEFAULT 'both',
  status TEXT DEFAULT 'pending',
  sent_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email campaigns table
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID REFERENCES email_drafts(id),
  brand_id TEXT,
  subject TEXT,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  audience TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_drafts" ON email_drafts;
DROP POLICY IF EXISTS "auth_all_campaigns" ON email_campaigns;

CREATE POLICY "auth_all_drafts" ON email_drafts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_campaigns" ON email_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================================
-- supabase-update-3.sql
-- ============================================================================

-- Run in Supabase SQL Editor after supabase-update-2.sql
-- Design editing support for Admin AI Assistant

ALTER TABLE brand_content ADD COLUMN IF NOT EXISTS layout_config TEXT;
ALTER TABLE brand_content ADD COLUMN IF NOT EXISTS logo_url TEXT;


-- ============================================================================
-- supabase-update-4-community.sql
-- ============================================================================

-- Global Access Community & Design Platform â€” Phase 1 Foundation
-- Run in Supabase SQL Editor (project: banqyouquhwmzmahmdsu)
-- Uses auth.users + user_profiles (no separate password table)

-- â”€â”€â”€ Extend user_profiles (community fields) â”€â”€â”€
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_avatar_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'retailer';

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_user_id_unique ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_active ON user_profiles(last_active_at DESC);

-- â”€â”€â”€ Guest portal sessions (replaces sessionStorage for access code + analytics) â”€â”€â”€
CREATE TABLE IF NOT EXISTS portal_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE,
  code_verified BOOLEAN DEFAULT false,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE portal_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_manage_own_portal_session" ON portal_sessions
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- â”€â”€â”€ Conversations â”€â”€â”€
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_user_ids UUID[] NOT NULL DEFAULT '{}',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  is_group BOOLEAN DEFAULT false,
  group_name TEXT,
  brand_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations USING GIN(participant_user_ids);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

-- â”€â”€â”€ Messages â”€â”€â”€
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  read_status BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_to_user_unread ON messages(to_user_id, read_status) WHERE read_status = false;

-- â”€â”€â”€ User activity (richer than analytics_events) â”€â”€â”€
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_token TEXT,
  event_type TEXT NOT NULL,
  page_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_created ON user_activity(created_at DESC);

-- â”€â”€â”€ Site design templates â”€â”€â”€
CREATE TABLE IF NOT EXISTS site_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL DEFAULT '{}',
  preview_image_url TEXT,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€â”€ Design drafts (Phase 5 foundation) â”€â”€â”€
CREATE TABLE IF NOT EXISTS design_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_key TEXT NOT NULL,
  draft_data JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(draft_key)
);

-- â”€â”€â”€ RLS â”€â”€â”€
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_drafts ENABLE ROW LEVEL SECURITY;

-- Conversations: participants only
CREATE POLICY "users_read_own_conversations" ON conversations
  FOR SELECT TO authenticated
  USING (auth.uid() = ANY(participant_user_ids));

CREATE POLICY "users_insert_conversations" ON conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = ANY(participant_user_ids));

CREATE POLICY "users_update_own_conversations" ON conversations
  FOR UPDATE TO authenticated USING (auth.uid() = ANY(participant_user_ids));

-- Messages: conversation participants
CREATE POLICY "users_read_conversation_messages" ON messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND auth.uid() = ANY(c.participant_user_ids)
    )
  );

CREATE POLICY "users_send_messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    from_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND auth.uid() = ANY(c.participant_user_ids)
    )
  );

CREATE POLICY "users_update_message_read" ON messages
  FOR UPDATE TO authenticated
  USING (to_user_id = auth.uid() OR from_user_id = auth.uid());

-- Activity: insert for all, read for authenticated (admin uses service role in dashboard)
CREATE POLICY "anyone_insert_activity" ON user_activity
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "auth_read_activity" ON user_activity
  FOR SELECT TO authenticated USING (true);

-- Templates: public read, auth write
CREATE POLICY "public_read_templates" ON site_templates
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "auth_write_templates" ON site_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_manage_drafts" ON design_drafts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Realtime (skip if already added)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed default templates (idempotent)
INSERT INTO site_templates (name, description, category, template_data)
SELECT 'Classic Hero', 'Dark hero with centered headline and white CTA', 'hero',
  '{"background_color":"#0D0D0D","cta_color":"#FFFFFF","button_style":"rounded"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM site_templates WHERE name = 'Classic Hero');

INSERT INTO site_templates (name, description, category, template_data)
SELECT 'Clean Grid', '3-column product grid with elevated cards', 'layout',
  '{"grid_columns":3,"card_style":"elevated","header_style":"hero"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM site_templates WHERE name = 'Clean Grid');

INSERT INTO site_templates (name, description, category, template_data)
SELECT 'Minimal Brand', 'Compact header, flat cards, modern font', 'layout',
  '{"header_style":"minimal","card_style":"flat","font_family":"modern"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM site_templates WHERE name = 'Minimal Brand');


-- ============================================================================
-- supabase-update-5-group-chats.sql
-- ============================================================================

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


-- ============================================================================
-- supabase-update-6-admin-ai.sql
-- ============================================================================

-- Admin AI: uploaded files + product metadata
-- Run in Supabase SQL Editor after prior migrations

CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  associated_brand TEXT,
  associated_sku TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_manage_uploaded_files" ON uploaded_files;
CREATE POLICY "auth_manage_uploaded_files" ON uploaded_files
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE product_content ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS price_retail NUMERIC;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS price_wholesale NUMERIC;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS created_by_ai BOOLEAN DEFAULT false;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL;

-- Admin uploads bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('admin-uploads', 'admin-uploads', true, 10485760)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760;

DROP POLICY IF EXISTS "auth_upload_admin_files" ON storage.objects;
DROP POLICY IF EXISTS "auth_update_admin_files" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_admin_files" ON storage.objects;
DROP POLICY IF EXISTS "public_read_admin_files" ON storage.objects;

CREATE POLICY "auth_upload_admin_files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'admin-uploads');

CREATE POLICY "auth_update_admin_files" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'admin-uploads');

CREATE POLICY "auth_delete_admin_files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'admin-uploads');

CREATE POLICY "public_read_admin_files" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'admin-uploads');


-- ============================================================================
-- supabase-update-7-private-messaging.sql
-- ============================================================================

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


-- ============================================================================
-- supabase-update-8-shared-support-inbox.sql
-- ============================================================================

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


-- ============================================================================
-- supabase-update-9-media-generation.sql
-- ============================================================================

-- Admin AI media generation: larger uploads for HD photos and short videos
-- Run in Supabase SQL Editor after prior migrations

UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'admin-uploads';


-- ============================================================================
-- supabase-update-10-pricing-commerce.sql
-- ============================================================================

-- Pricing, MOQ, shipping, promotions + chat contact reveal
-- Run in Supabase SQL Editor after prior migrations

ALTER TABLE product_content ADD COLUMN IF NOT EXISTS price_per_unit NUMERIC;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS price_per_case NUMERIC;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS price_per_pallet NUMERIC;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS price_msrp NUMERIC;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS moq_qty INTEGER;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS moq_unit TEXT DEFAULT 'case';
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS shipping_included BOOLEAN DEFAULT false;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS shipping_free_after_moq BOOLEAN DEFAULT false;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS free_shipping_moq_qty INTEGER;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS shipping_note TEXT;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS promo_label TEXT;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS promo_detail TEXT;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS promo_active BOOLEAN DEFAULT false;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS promo_audience TEXT DEFAULT 'both';

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_revealed BOOLEAN DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_confirmed_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS contact_confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;


-- ============================================================================
-- supabase-update-11-master-pricing-interest.sql
-- ============================================================================

-- Master Distributor pricing interest on inquiries
-- Run in Supabase SQL Editor after update 10

ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS master_pricing_brands JSONB DEFAULT '[]';


-- ============================================================================
-- supabase-update-12-master-distributor-account.sql
-- ============================================================================

-- Master Distributor: account-level qualification + private price list fields
-- Run in Supabase SQL Editor after update 11

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS master_pricing_interest BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS master_pricing_qualified BOOLEAN DEFAULT false;

ALTER TABLE product_content ADD COLUMN IF NOT EXISTS price_master_per_unit NUMERIC;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS price_master_per_case NUMERIC;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS price_master_per_pallet NUMERIC;

ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS master_pricing_interest BOOLEAN DEFAULT false;


-- ============================================================================
-- supabase-update-13-pack-config.sql
-- ============================================================================

-- Pack / case / pallet configuration per SKU (guest-visible catalog info)
-- Run in Supabase SQL Editor after update 12

ALTER TABLE product_content ADD COLUMN IF NOT EXISTS units_per_inner INTEGER;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS inner_unit_label TEXT;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS inners_per_case INTEGER;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS inner_pack_label TEXT;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS cases_per_pallet INTEGER;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS pack_config_note TEXT;


-- ============================================================================
-- supabase-update-15-chat-attachments.sql
-- ============================================================================

-- Chat photo & document attachments
-- Run in Supabase SQL Editor after update 14

ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Storage bucket for chat files (public read so both parties can open links)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-attachments', 'chat-attachments', true, 10485760)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760;

DROP POLICY IF EXISTS "auth_upload_chat_attachments" ON storage.objects;
DROP POLICY IF EXISTS "public_read_chat_attachments" ON storage.objects;

CREATE POLICY "auth_upload_chat_attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

CREATE POLICY "public_read_chat_attachments" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'chat-attachments');


-- ============================================================================
-- supabase-update-16-push-notifications.sql
-- ============================================================================

-- Web push for phone notification banners (works when app is in background)
-- Run after update 15.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_push_subscriptions" ON push_subscriptions;
CREATE POLICY "users_manage_own_push_subscriptions" ON push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- â”€â”€â”€ SETUP (required for background phone banners) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. Generate VAPID keys (Node.js):  npx web-push generate-vapid-keys
-- 2. Vercel env:  REACT_APP_VAPID_PUBLIC_KEY = public key
-- 3. Supabase Edge Function secrets:
--      VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT=mailto:you@yourdomain.com
--      PUSH_NOTIFY_SECRET = same style as DISCORD_NOTIFY_SECRET
-- 4. Deploy edge function: notify-push
-- 5. Database webhook on messages INSERT (same as Discord):
--      URL: https://YOUR_PROJECT.supabase.co/functions/v1/notify-push
--      Header: Authorization: Bearer YOUR_PUSH_NOTIFY_SECRET


-- ============================================================================
-- supabase-update-17-appointments.sql
-- ============================================================================

-- Preferred contact appointment (Profile â†’ Schedule a call)
-- Run after update 16.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferred_appointment_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS appointment_notes TEXT;


-- ============================================================================
-- supabase-update-18-rep-codes-contacts.sql
-- ============================================================================

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

-- â”€â”€â”€ Helper functions â”€â”€â”€
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


-- ============================================================================
-- supabase-update-19-account-tiers.sql
-- ============================================================================

-- CRM account tiers: VIP retailers, Whale distributors, per-brand Masters
-- Run after update 18

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS crm_tier TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS master_brand_ids JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN user_profiles.crm_tier IS 'Staff-only label: vip (key retailer) or whale (top distributor)';
COMMENT ON COLUMN user_profiles.master_brand_ids IS 'Brand IDs where this distributor is a Master on that brand';

