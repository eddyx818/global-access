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
