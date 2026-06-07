-- Profile phone number (used for Support chat + WhatsApp)
-- Run after update 21 if profile save fails with missing column errors.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
