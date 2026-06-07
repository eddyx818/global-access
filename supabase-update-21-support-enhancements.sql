-- Support welcome bot message + system message flag
-- Run after update 20

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION public.ensure_support_welcome_message(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_customer_id UUID;
BEGIN
  IF NOT conversation_is_support_thread(p_conversation_id) THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM messages WHERE conversation_id = p_conversation_id LIMIT 1) THEN
    RETURN false;
  END IF;

  SELECT user_id INTO v_admin_id
  FROM user_profiles
  WHERE COALESCE(is_portal_admin, false) = true
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT conversation_customer_id(c.participant_user_ids) INTO v_customer_id
  FROM conversations c
  WHERE c.id = p_conversation_id;

  INSERT INTO messages (
    conversation_id,
    from_user_id,
    to_user_id,
    content,
    read_status,
    is_system,
    created_at
  ) VALUES (
    p_conversation_id,
    v_admin_id,
    v_customer_id,
    'Thanks for reaching out! Our support team has been notified and will reply shortly. Please be patient — someone will be with you soon.',
    false,
    true,
    NOW()
  );

  UPDATE conversations SET last_message_at = NOW() WHERE id = p_conversation_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_support_welcome_message(UUID) TO authenticated;

-- ─── SETUP (required) ───────────────────────────────────────────────────────
-- 1. Run this SQL in Supabase SQL Editor.
-- 2. Deploy edge function: notify-support-email
-- 3. Supabase → Project Settings → Edge Functions → Secrets:
--      RESEND_API_KEY          = your Resend API key (same as send-email)
--      RESEND_FROM             = Global Access <edward@churroslocos.shop>
--      SUPPORT_NOTIFY_SECRET   = long random string (e.g. openssl rand -hex 32)
--      PORTAL_URL              = https://global-access.vercel.app
-- 4. Supabase → Database → Webhooks → Create webhook:
--      Name:     notify-support-email-messages
--      Table:    messages
--      Events:   INSERT
--      URL:      https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-support-email
--      Method:   POST
--      Headers:  Authorization: Bearer YOUR_SUPPORT_NOTIFY_SECRET
--      Body:     { "record": { "from_user_id": "{{ record.from_user_id }}", "content": "{{ record.content }}", "is_system": {{ record.is_system }} } }
-- 5. Update existing notify-discord / notify-push webhooks to include is_system in the body:
--      ... "is_system": {{ record.is_system }} ...
--    (System welcome messages will not trigger Discord, push, or email.)
