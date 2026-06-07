// Notifies Discord when a customer sends a support chat message.
// Set secrets: DISCORD_WEBHOOK_URL, DISCORD_NOTIFY_SECRET
// Trigger via Database Webhook on messages INSERT (see supabase-update-14-discord-notify.sql)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function truncate(text: string, max = 900) {
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const secret = Deno.env.get('DISCORD_NOTIFY_SECRET');
    const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL');
    if (!secret || !webhookUrl) {
      return new Response(JSON.stringify({ ok: false, error: 'Discord not configured' }), {
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

    const body = await req.json();
    const record = body.record || body;
    const { id, conversation_id, from_user_id, content, created_at } = record || {};
    if (!from_user_id || !content) {
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
      .select('name, company, email, username, is_portal_admin, role')
      .eq('user_id', from_user_id)
      .maybeSingle();

    if (sender?.is_portal_admin || sender?.role === 'admin') {
      return new Response(JSON.stringify({ ok: true, skipped: 'admin message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (record?.is_system) {
      return new Response(JSON.stringify({ ok: true, skipped: 'system message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const displayName = sender?.name || sender?.username || sender?.email || 'Customer';
    const company = sender?.company ? ` · ${sender.company}` : '';
    const siteUrl = Deno.env.get('PORTAL_URL') || '';

    const embed = {
      title: '💬 New support message',
      description: truncate(content),
      color: 0xc9a84c,
      fields: [
        { name: 'From', value: `${displayName}${company}`, inline: true },
        { name: 'Conversation', value: conversation_id ? `\`${conversation_id.slice(0, 8)}…\`` : '—', inline: true },
      ],
      footer: { text: 'Global Access · Support inbox' },
      timestamp: created_at || new Date().toISOString(),
    };

    if (siteUrl) {
      embed.fields.push({
        name: 'Open portal',
        value: `[View Messages](${siteUrl})`,
        inline: false,
      });
    }

    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Global Access',
        embeds: [embed],
      }),
    });

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      throw new Error(`Discord webhook failed: ${discordRes.status} ${errText}`);
    }

    return new Response(JSON.stringify({ ok: true, message_id: id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('notify-discord error:', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
