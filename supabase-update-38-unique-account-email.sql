-- One email per portal account (phone numbers may repeat).
-- Run in Supabase SQL Editor after update 37.

-- Normalize stored emails before adding uniqueness rules
UPDATE user_profiles
SET email = lower(trim(email))
WHERE email IS NOT NULL AND email <> lower(trim(email));

UPDATE access_requests
SET email = lower(trim(email))
WHERE email IS NOT NULL AND email <> lower(trim(email));

-- If duplicates exist, keep the best row per email (authorized first, then newest)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(email))
      ORDER BY admin_authorized DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM user_profiles
  WHERE email IS NOT NULL AND trim(email) <> ''
)
DELETE FROM user_profiles up
USING ranked r
WHERE up.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_email_unique
  ON user_profiles (lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';

-- Only one active pending access request per email
CREATE UNIQUE INDEX IF NOT EXISTS idx_access_requests_pending_email_unique
  ON access_requests (lower(trim(email)))
  WHERE status = 'pending' AND dismissed_at IS NULL;

CREATE OR REPLACE FUNCTION public.normalize_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(trim(NEW.email));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_normalize_email ON user_profiles;
CREATE TRIGGER trg_user_profiles_normalize_email
  BEFORE INSERT OR UPDATE OF email ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.normalize_profile_email();

CREATE OR REPLACE FUNCTION public.normalize_access_request_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(trim(NEW.email));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_access_requests_normalize_email ON access_requests;
CREATE TRIGGER trg_access_requests_normalize_email
  BEFORE INSERT OR UPDATE OF email ON access_requests
  FOR EACH ROW EXECUTE FUNCTION public.normalize_access_request_email();

-- Signup gate: does this email already have an account or pending request?
CREATE OR REPLACE FUNCTION public.check_signup_email(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_has_account BOOLEAN := false;
  v_request_status TEXT;
  v_request_created_at TIMESTAMPTZ;
BEGIN
  v_email := lower(trim(p_email));
  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('has_account', false, 'request_status', NULL, 'request_created_at', NULL);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_profiles up WHERE lower(trim(up.email)) = v_email
  ) OR EXISTS (
    SELECT 1 FROM auth.users au WHERE lower(trim(au.email::text)) = v_email
  )
  INTO v_has_account;

  SELECT ar.status, ar.created_at
  INTO v_request_status, v_request_created_at
  FROM access_requests ar
  WHERE lower(trim(ar.email)) = v_email
    AND ar.dismissed_at IS NULL
  ORDER BY ar.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'has_account', COALESCE(v_has_account, false),
    'request_status', v_request_status,
    'request_created_at', v_request_created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_signup_email(TEXT) TO anon, authenticated;
