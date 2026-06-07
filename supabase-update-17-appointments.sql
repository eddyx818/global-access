-- Preferred contact appointment (Profile → Schedule a call)
-- Run after update 16.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferred_appointment_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS appointment_notes TEXT;
