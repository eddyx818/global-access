-- Master Distributor pricing interest on inquiries
-- Run in Supabase SQL Editor after update 10

ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS master_pricing_brands JSONB DEFAULT '[]';
