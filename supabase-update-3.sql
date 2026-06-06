-- Run in Supabase SQL Editor after supabase-update-2.sql
-- Design editing support for Admin AI Assistant

ALTER TABLE brand_content ADD COLUMN IF NOT EXISTS layout_config TEXT;
ALTER TABLE brand_content ADD COLUMN IF NOT EXISTS logo_url TEXT;
