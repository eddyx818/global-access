-- Run this in Supabase SQL Editor → New query

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
