-- Admin AI media generation: larger uploads for HD photos and short videos
-- Run in Supabase SQL Editor after prior migrations

UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'admin-uploads';
