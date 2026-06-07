-- Retailer order unit label (jar, box, case, etc.) for quote qty display
-- Run if admin Content Editor save fails on retail_order_unit.

ALTER TABLE product_content ADD COLUMN IF NOT EXISTS retail_order_unit TEXT;
