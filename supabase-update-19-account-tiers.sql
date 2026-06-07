-- CRM account tiers: VIP retailers, Whale distributors, per-brand Masters
-- Run after update 18

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS crm_tier TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS master_brand_ids JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN user_profiles.crm_tier IS 'Staff-only label: vip (key retailer) or whale (top distributor)';
COMMENT ON COLUMN user_profiles.master_brand_ids IS 'Brand IDs where this distributor is a Master on that brand';
