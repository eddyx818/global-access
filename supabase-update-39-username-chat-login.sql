-- Unique usernames (case-insensitive), login-by-username, chat display privacy toggle.
-- Run in Supabase SQL Editor after update 38.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS show_username_in_chat BOOLEAN NOT NULL DEFAULT false;

UPDATE user_profiles
SET username = lower(trim(username))
WHERE username IS NOT NULL AND username <> lower(trim(username));

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(username))
      ORDER BY admin_authorized DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM user_profiles
  WHERE username IS NOT NULL AND trim(username) <> ''
)
DELETE FROM user_profiles up
USING ranked r
WHERE up.id = r.id AND r.rn > 1;

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_username_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username_unique
  ON user_profiles (lower(trim(username)))
  WHERE username IS NOT NULL AND trim(username) <> '';

CREATE OR REPLACE FUNCTION public.normalize_profile_username()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.username IS NOT NULL AND trim(NEW.username) = '' THEN
    NEW.username := NULL;
  ELSIF NEW.username IS NOT NULL THEN
    NEW.username := lower(trim(NEW.username));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_normalize_username ON user_profiles;
CREATE TRIGGER trg_user_profiles_normalize_username
  BEFORE INSERT OR UPDATE OF username ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.normalize_profile_username();

CREATE OR REPLACE FUNCTION public.resolve_login_email(p_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id TEXT := lower(trim(p_identifier));
  v_email TEXT;
BEGIN
  IF v_id IS NULL OR v_id = '' THEN
    RETURN NULL;
  END IF;

  IF v_id LIKE '%@%' THEN
    RETURN v_id;
  END IF;

  SELECT up.email INTO v_email
  FROM user_profiles up
  WHERE lower(trim(up.username)) = v_id
  LIMIT 1;

  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_username_available(p_username TEXT, p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT := lower(trim(p_username));
  v_owner UUID;
BEGIN
  IF v_username IS NULL OR v_username = '' THEN
    RETURN true;
  END IF;

  SELECT user_id INTO v_owner
  FROM user_profiles
  WHERE lower(trim(username)) = v_username
  LIMIT 1;

  IF v_owner IS NULL THEN
    RETURN true;
  END IF;

  RETURN p_user_id IS NOT NULL AND v_owner = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT, UUID) TO anon, authenticated;
