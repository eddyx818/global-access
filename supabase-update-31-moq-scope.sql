-- Optional: MOQ scope for mix-and-match case orders (e.g. Churros Locos MOQ 6 cases total).
-- Values: 'line' (default per SKU line) | 'order' (total across mixed lines).
ALTER TABLE product_content ADD COLUMN IF NOT EXISTS moq_scope text;
