// Sends web push notifications for new chat messages (phone banners when app is backgrounded).
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_NOTIFY_SECRET

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function truncate(text: string, max = 180) {
  if (!text) return 'New message';
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const secret = Deno.env.get('PUSH_NOTIFY_SECRET');
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@globalaccess.app';

    if (!secret || !publicKey || !privateKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Push not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const auth = req.headers.get('Authorization') || '';
    if (auth !== `Bearer ${secret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const body = await req.json();
    const record = body.record || body;
    const { conversation_id, from_user_id, content } = record || {};
    if (!from_user_id || !conversation_id) {
      return new Response(JSON.stringify({ ok: true, skipped: 'missing fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: sender } = await supabase
      .from('user_profiles')
      .select('name, company, username, is_portal_admin, role')
      .eq('user_id', from_user_id)
      .maybeSingle();

    const isAdminSender = sender?.is_portal_admin || sender?.role === 'admin';

    const { data: convo } = await supabase
      .from('conversations')
      .select('participant_user_ids, is_group')
      .eq('id', conversation_id)
      .maybeSingle();

    if (!convo?.participant_user_ids?.length) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no conversation' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let recipientIds: string[] = [];
    if (isAdminSender) {
      recipientIds = convo.participant_user_ids.filter((id: string) => id !== from_user_id);
    } else {
      const { data: admins } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('is_portal_admin', true);
      recipientIds = (admins || []).map((a) => a.user_id);
    }

    recipientIds = [...new Set(recipientIds.filter(Boolean))];
    if (!recipientIds.length) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no recipients' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', recipientIds);

    if (!subs?.length) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const senderName = sender?.name || sender?.username || sender?.company || 'Someone';
    const title = isAdminSender
      ? 'Reply from Global Access'
      : `New message from ${senderName}${sender?.company ? ` (${sender.company})` : ''}`;

    const payload = JSON.stringify({
      title,
      body: truncate(content),
      conversationId: conversation_id,
      url: '/',
    });

    let sent = 0;
    const stale: string[] = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
        sent += 1;
      } catch (err) {
        const status = err?.statusCode || err?.status;
        if (status === 404 || status === 410) stale.push(sub.endpoint);
      }
    }

    if (stale.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', stale);
    }

    return new Response(JSON.stringify({ ok: true, sent, stale: stale.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('notify-push error:', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
