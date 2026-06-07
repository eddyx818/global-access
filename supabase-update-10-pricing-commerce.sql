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
