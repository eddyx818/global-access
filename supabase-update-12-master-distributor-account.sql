-- Master Distributor: account-level qualification + private price list fields
-- Run in Supabase SQL Editor after update 11

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS master_pricing_interest BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS master_pricing_qualified BOOLEAN DEFAULT false;

ALTER TABLE product_content ADD COLUMN IF NOT EXISTS price_master_per_unit NUMERIC;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS price_master_per_case NUMERIC;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS price_master_per_pallet NUMERIC;

ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS master_pricing_interest BOOLEAN DEFAULT false;
