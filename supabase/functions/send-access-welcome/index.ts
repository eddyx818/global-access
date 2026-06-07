// Sends welcome email when admin approves an access request.
// Secrets: RESEND_API_KEY, RESEND_FROM, PORTAL_URL (optional)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Email not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, name, temp_password, portal_url } = await req.json();
    const to = (email || '').trim().toLowerCase();
    if (!to) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firstName = (name || 'there').split(' ')[0];
    const portalUrl = (portal_url || Deno.env.get('PORTAL_URL') || 'https://global-access.vercel.app').replace(/\/$/, '');
    const fromEmail = Deno.env.get('RESEND_FROM') || 'Global Access <edward@churroslocos.shop>';
    const subject = 'Your Global Access account is ready';

    const loginBlock = temp_password
      ? `<p><strong>Email:</strong> ${to}<br/><strong>Temporary password:</strong> ${temp_password}</p>
         <p style="color:#666;font-size:14px">Please sign in and update your password in Profile.</p>`
      : `<p>Sign in with your existing password at the link below.</p>`;

    const html = `
      <div style="font-family:sans-serif;max-width:560px;line-height:1.6;color:#333">
        <h2 style="font-size:20px;margin:0 0 12px;color:#1A1A1A">Welcome to Global Access</h2>
        <p>Hi ${firstName},</p>
        <p>Your wholesale portal access has been approved. You can now browse brands, request quotes, and message our trade desk.</p>
        ${loginBlock}
        <p style="margin:24px 0">
          <a href="${portalUrl}" style="display:inline-block;background:#1A1A1A;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">
            Open Global Access →
          </a>
        </p>
        <p style="font-size:13px;color:#888">Questions? Reply to this email or message us through the portal.</p>
      </div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromEmail, to, subject, html }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ ok: false, error: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
