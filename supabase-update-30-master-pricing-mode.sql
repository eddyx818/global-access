-- Per-brand Master Distributor pricing visibility (show | quote | auto)
-- Run if Content Editor save fails on master_pricing_mode.

ALTER TABLE brand_content ADD COLUMN IF NOT EXISTS master_pricing_mode TEXT;
