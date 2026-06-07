-- Referral / access-code signup leaderboard for sales reps and admins
-- Run after update 19

CREATE OR REPLACE FUNCTION public.get_referral_leaderboard()
RETURNS TABLE (
  rep_user_id UUID,
  rep_name TEXT,
  rep_code TEXT,
  signups_total BIGINT,
  signups_this_month BIGINT,
  signups_this_week BIGINT,
  pending_requests BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  month_start TIMESTAMPTZ := date_trunc('month', NOW());
  week_start TIMESTAMPTZ := date_trunc('week', NOW());
BEGIN
  IF NOT (auth_is_portal_admin() OR auth_is_sales_rep()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH reps AS (
    SELECT
      p.user_id,
      COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(p.company), ''), p.email, 'Rep') AS display_name,
      p.rep_code
    FROM user_profiles p
    WHERE p.rep_code IS NOT NULL
      AND (COALESCE(p.is_sales_rep, false) OR COALESCE(p.is_portal_admin, false))
  ),
  customer_signups AS (
    SELECT
      COALESCE(c.referred_by_user_id, r.user_id) AS rep_id,
      c.user_id,
      c.created_at
    FROM user_profiles c
    LEFT JOIN reps r ON LOWER(c.referral_code_used) = LOWER(r.rep_code)
    WHERE COALESCE(c.is_portal_admin, false) = false
      AND COALESCE(c.is_sales_rep, false) = false
      AND (c.referred_by_user_id IS NOT NULL OR c.referral_code_used IS NOT NULL)
      AND COALESCE(c.referred_by_user_id, r.user_id) IS NOT NULL
  ),
  pending AS (
    SELECT
      COALESCE(a.referred_by_user_id, r.user_id) AS rep_id
    FROM access_requests a
    LEFT JOIN reps r ON LOWER(a.referral_code_used) = LOWER(r.rep_code)
    WHERE a.status = 'pending'
      AND (a.referred_by_user_id IS NOT NULL OR a.referral_code_used IS NOT NULL)
      AND COALESCE(a.referred_by_user_id, r.user_id) IS NOT NULL
  ),
  pending_counts AS (
    SELECT p.rep_id, COUNT(*)::BIGINT AS cnt
    FROM pending p
    GROUP BY p.rep_id
  )
  SELECT
    reps.user_id,
    reps.display_name,
    reps.rep_code,
    COUNT(DISTINCT cs.user_id)::BIGINT,
    COUNT(DISTINCT cs.user_id) FILTER (WHERE cs.created_at >= month_start)::BIGINT,
    COUNT(DISTINCT cs.user_id) FILTER (WHERE cs.created_at >= week_start)::BIGINT,
    COALESCE(pc.cnt, 0)::BIGINT
  FROM reps
  LEFT JOIN customer_signups cs ON cs.rep_id = reps.user_id
  LEFT JOIN pending_counts pc ON pc.rep_id = reps.user_id
  GROUP BY reps.user_id, reps.display_name, reps.rep_code, pc.cnt
  ORDER BY signups_total DESC, reps.display_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_leaderboard() TO authenticated;
