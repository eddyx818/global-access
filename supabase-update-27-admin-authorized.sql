-- Admin can grant portal access without email verification (or alongside it).
-- Run in Supabase SQL editor after update 26.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS admin_authorized BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS admin_authorized_at TIMESTAMPTZ;

-- Accounts created by admin approval or admin user creation should already be authorized.
UPDATE user_profiles SET admin_authorized = true, admin_authorized_at = COALESCE(admin_authorized_at, updated_at, created_at, NOW())
WHERE admin_authorized IS NOT TRUE
  AND (is_portal_admin = true OR is_sales_rep = true OR temp_password IS NOT NULL);
