-- Web push for phone notification banners (works when app is in background)
-- Run after update 15.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_push_subscriptions" ON push_subscriptions;
CREATE POLICY "users_manage_own_push_subscriptions" ON push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── SETUP (required for background phone banners) ─────────────────────────
-- 1. Generate VAPID keys (Node.js):  npx web-push generate-vapid-keys
-- 2. Vercel env:  REACT_APP_VAPID_PUBLIC_KEY = public key
-- 3. Supabase Edge Function secrets:
--      VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT=mailto:you@yourdomain.com
--      PUSH_NOTIFY_SECRET = same style as DISCORD_NOTIFY_SECRET
-- 4. Deploy edge function: notify-push
-- 5. Database webhook on messages INSERT (same as Discord):
--      URL: https://YOUR_PROJECT.supabase.co/functions/v1/notify-push
--      Header: Authorization: Bearer YOUR_PUSH_NOTIFY_SECRET
