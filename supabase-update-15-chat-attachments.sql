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
