-- Profile columns used by Profile save (phone + schedule-a-call fields)
-- Run if profile save fails with missing column errors.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferred_appointment_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS appointment_notes TEXT;
