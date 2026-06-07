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
-- 1. Generate VAPID keys (Node.js on your PC):
--      npx web-push generate-vapid-keys
--    Save publicKey and privateKey.
--
-- 2. Vercel → Project → Settings → Environment Variables:
--      REACT_APP_VAPID_PUBLIC_KEY = (public key only)
--    Redeploy the site after saving.
--
-- 3. Supabase → Project Settings → Edge Functions → Secrets:
--      VAPID_PUBLIC_KEY     = same public key
--      VAPID_PRIVATE_KEY    = private key
--      VAPID_SUBJECT        = mailto:edward@churroslocos.shop
--      PUSH_NOTIFY_SECRET   = long random string (openssl rand -hex 32)
--
-- 4. Deploy edge function (Supabase CLI from project root):
--      supabase login
--      supabase link --project-ref YOUR_PROJECT_REF
--      supabase functions deploy notify-push
--
-- 5. Supabase → Database → Webhooks → Create webhook:
--      Name:     notify-push-messages
--      Table:    messages
--      Events:   INSERT
--      Type:     Supabase Edge Function → notify-push
--    OR HTTP Request:
--      URL:      https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-push
--      Method:   POST
--      Headers:  Authorization: Bearer YOUR_PUSH_NOTIFY_SECRET
--      Body:     { "record": { "id": "{{ record.id }}", "conversation_id": "{{ record.conversation_id }}", "from_user_id": "{{ record.from_user_id }}", "content": "{{ record.content }}", "created_at": "{{ record.created_at }}" } }
--
-- 6. On your phone: open globalaccess.shop → Profile → enable notifications → allow when prompted.
--    Push only works on HTTPS + installed PWA or supported mobile browser (not plain desktop Safari without permission).
