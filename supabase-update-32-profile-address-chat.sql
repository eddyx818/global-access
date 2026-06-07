-- Profile address (map integration), appointment workflow, staff availability
-- Run after update 31.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS zip TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS appointment_status TEXT DEFAULT 'none';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS appointment_counter_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS support_availability TEXT DEFAULT 'available';
