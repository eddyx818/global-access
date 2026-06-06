-- Run this in your Supabase SQL Editor after the first setup script

-- Brand content table (descriptions, taglines, fonts)
CREATE TABLE IF NOT EXISTS brand_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT NOT NULL UNIQUE,
  tagline TEXT,
  description TEXT,
  font_style TEXT DEFAULT 'modern', -- 'modern' | 'bold' | 'elegant' | 'playful'
  color TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product content table (names, details, images)
CREATE TABLE IF NOT EXISTS product_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  name TEXT,
  detail TEXT,
  image_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE brand_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_content ENABLE ROW LEVEL SECURITY;

-- Anyone can read (for the portal)
CREATE POLICY "public_read_brand_content" ON brand_content FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_product_content" ON product_content FOR SELECT TO anon, authenticated USING (true);

-- Only authenticated (admin) can write
CREATE POLICY "auth_write_brand_content" ON brand_content FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_product_content" ON product_content FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for brand images
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-images', 'brand-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "auth_upload_images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'brand-images');
CREATE POLICY "auth_update_images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'brand-images');
CREATE POLICY "auth_delete_images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'brand-images');

-- Allow public to view images
CREATE POLICY "public_read_images" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'brand-images');

-- User profiles table (run this in SQL Editor)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT,
  name TEXT,
  company TEXT,
  phone TEXT,
  user_type TEXT DEFAULT 'retailer',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_profile" ON user_profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Brand gallery table
CREATE TABLE IF NOT EXISTS brand_gallery (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE brand_gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_gallery" ON brand_gallery FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth_write_gallery" ON brand_gallery FOR ALL TO authenticated USING (true) WITH CHECK (true);
