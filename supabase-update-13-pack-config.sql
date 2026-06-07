-- Pack / case / pallet configuration per SKU (guest-visible catalog info)
-- Run in Supabase SQL Editor after update 12

ALTER TABLE product_content ADD COLUMN IF NOT EXISTS units_per_inner INTEGER;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS inner_unit_label TEXT;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS inners_per_case INTEGER;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS inner_pack_label TEXT;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS cases_per_pallet INTEGER;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS pack_config_note TEXT;
