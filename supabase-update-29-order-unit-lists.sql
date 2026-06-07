-- Comma-separated order unit lists per buyer type (e.g. "box, case, master case, pallet")
-- Run if Content Editor save fails on these columns.

ALTER TABLE product_content ADD COLUMN IF NOT EXISTS retail_order_units TEXT;
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS distributor_order_units TEXT;
