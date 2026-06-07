-- Lobby waiting-room game scores + access request status lookup
-- Run in Supabase SQL Editor, then deploy edge function: send-access-welcome

CREATE TABLE IF NOT EXISTS lobby_game_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL CHECK (char_length(trim(player_name)) BETWEEN 1 AND 40),
  score INTEGER NOT NULL CHECK (score >= 0),
  products_collected INTEGER NOT NULL DEFAULT 0 CHECK (products_collected >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lobby_game_scores_score ON lobby_game_scores (score DESC, created_at DESC);

ALTER TABLE lobby_game_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_lobby_scores" ON lobby_game_scores;
CREATE POLICY "anon_insert_lobby_scores" ON lobby_game_scores
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "public_read_lobby_scores" ON lobby_game_scores;
CREATE POLICY "public_read_lobby_scores" ON lobby_game_scores
  FOR SELECT TO anon, authenticated
  USING (true);

-- Returns only status for the latest access request matching email (no PII leak)
CREATE OR REPLACE FUNCTION public.get_access_request_status(p_email TEXT)
RETURNS TABLE (status TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  v_email := lower(trim(p_email));
  IF v_email IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ar.status, ar.created_at
  FROM access_requests ar
  WHERE lower(ar.email) = v_email
  ORDER BY ar.created_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_access_request_status(TEXT) TO anon, authenticated;
