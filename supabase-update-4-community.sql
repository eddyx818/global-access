-- Global Access Community & Design Platform — Phase 1 Foundation
-- Run in Supabase SQL Editor (project: banqyouquhwmzmahmdsu)
-- Uses auth.users + user_profiles (no separate password table)

-- ─── Extend user_profiles (community fields) ───
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_avatar_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'retailer';

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_user_id_unique ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_active ON user_profiles(last_active_at DESC);

-- ─── Guest portal sessions (replaces sessionStorage for access code + analytics) ───
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

-- ─── Conversations ───
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

-- ─── Messages ───
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

-- ─── User activity (richer than analytics_events) ───
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

-- ─── Site design templates ───
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

-- ─── Design drafts (Phase 5 foundation) ───
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

-- ─── RLS ───
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
