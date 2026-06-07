-- Structured address on access requests (signup form)
-- Run after update 32.

ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE access_requests ADD COLUMN IF NOT EXISTS zip TEXT;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS address_line2 TEXT;
