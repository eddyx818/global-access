-- Reset waiting-room game high scores (admin-only going forward).
-- Run once in Supabase SQL Editor to clear old test names immediately.

DELETE FROM lobby_game_scores;

CREATE OR REPLACE FUNCTION public.reset_lobby_game_scores()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF NOT auth_is_portal_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM lobby_game_scores;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_lobby_game_scores() TO authenticated;
