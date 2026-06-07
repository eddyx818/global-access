// Emails admins + assigned sales rep when a customer sends a support message.
// Secrets: RESEND_API_KEY, RESEND_FROM, SUPPORT_NOTIFY_SECRET, PORTAL_URL (optional)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function truncate(text: string, max = 500) {
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const secret = Deno.env.get('SUPPORT_NOTIFY_SECRET');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!secret || !resendKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Email notify not configured' }), {
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
    const { from_user_id, content, is_system } = record || {};

    if (!from_user_id || !content || is_system) {
      return new Response(JSON.stringify({ ok: true, skipped: 'not a customer message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: sender } = await supabase
      .from('user_profiles')
      .select('user_id, name, company, email, phone, username, is_portal_admin, is_sales_rep, role, referred_by_user_id, referral_code_used')
      .eq('user_id', from_user_id)
      .maybeSingle();

    if (!sender || sender.is_portal_admin || sender.is_sales_rep || sender.role === 'admin' || sender.role === 'sales_rep') {
      return new Response(JSON.stringify({ ok: true, skipped: 'staff message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: admins } = await supabase
      .from('user_profiles')
      .select('email, name')
      .eq('is_portal_admin', true)
      .not('email', 'is', null);

    let repEmail: string | null = null;
    let repName: string | null = null;

    if (sender.referred_by_user_id) {
      const { data: rep } = await supabase
        .from('user_profiles')
        .select('email, name, company')
        .eq('user_id', sender.referred_by_user_id)
        .maybeSingle();
      repEmail = rep?.email || null;
      repName = rep?.name || rep?.company || null;
    } else if (sender.referral_code_used) {
      const { data: rep } = await supabase
        .from('user_profiles')
        .select('email, name, company')
        .eq('rep_code', sender.referral_code_used)
        .maybeSingle();
      repEmail = rep?.email || null;
      repName = rep?.name || rep?.company || null;
    }

    const recipientSet = new Set<string>();
    (admins || []).forEach((a) => { if (a.email) recipientSet.add(a.email.toLowerCase()); });
    if (repEmail) recipientSet.add(repEmail.toLowerCase());

    const recipients = [...recipientSet];
    if (!recipients.length) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no recipients' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const customerName = sender.name || sender.username || sender.email || 'Customer';
    const company = sender.company ? ` (${sender.company})` : '';
    const portalUrl = (Deno.env.get('PORTAL_URL') || 'https://global-access.vercel.app').replace(/\/$/, '');
    const fromEmail = Deno.env.get('RESEND_FROM') || 'Global Access <edward@churroslocos.shop>';
    const subject = `Support message from ${customerName}${company}`;
    const html = `
      <div style="font-family:sans-serif;max-width:560px;line-height:1.6;color:#333">
        <h2 style="font-size:18px;margin:0 0 12px">New support chat message</h2>
        <p><strong>${customerName}</strong>${company}</p>
        ${sender.email ? `<p>Email: ${sender.email}</p>` : ''}
        ${sender.phone ? `<p>Phone: ${sender.phone}</p>` : ''}
        ${sender.referral_code_used ? `<p>Rep code used: ${sender.referral_code_used}</p>` : ''}
        ${repName ? `<p>Assigned rep: ${repName}</p>` : ''}
        <blockquote style="margin:16px 0;padding:12px 16px;background:#F8F6F3;border-left:3px solid #C9A84C">${truncate(content)}</blockquote>
        <p><a href="${portalUrl}" style="color:#C9A84C;font-weight:600">Open Global Access → Messages</a></p>
      </div>`;

    let sent = 0;
    for (const to of recipients) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: fromEmail, to, subject, html }),
      });
      if (res.ok) sent += 1;
    }

    return new Response(JSON.stringify({ ok: true, sent, recipients: recipients.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('notify-support-email error:', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
