// Global Access — Send Email Edge Function
// Fires when admin approves a marketing draft
// Sends via Resend to selected contacts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const { draft_id, subject_choice, audience } = await req.json();
    // subject_choice: 'a' or 'b'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    // Get the draft
    const { data: draft, error: draftErr } = await supabase
      .from('email_drafts')
      .select('*')
      .eq('id', draft_id)
      .single();

    if (draftErr || !draft) throw new Error('Draft not found');
    if (draft.status === 'sent') throw new Error('Already sent');

    // Get contacts to send to
    let query = supabase
      .from('access_requests')
      .select('name, email, account_type')
      .eq('status', 'approved')
      .not('email', 'is', null);

    if (audience === 'distributor') query = query.eq('account_type', 'distributor');
    if (audience === 'retailer') query = query.eq('account_type', 'retailer');

    const { data: contacts } = await query;
    if (!contacts || contacts.length === 0) throw new Error('No contacts found');

    const subject = subject_choice === 'b' ? draft.subject_b : draft.subject_a;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM') || 'Global Access <edward@churroslocos.shop>';
    const replyTo = Deno.env.get('RESEND_REPLY_TO') || 'edward@churroslocos.shop';

    // Send emails via Resend
    let sent = 0;
    let failed = 0;

    for (const contact of contacts) {
      if (!contact.email) continue;

      // Personalize the email
      const personalizedHtml = draft.html_content
        .replace(/Hi there/g, `Hi ${contact.name?.split(' ')[0] || 'there'}`);

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            reply_to: replyTo,
            to: contact.email,
            subject,
            html: personalizedHtml,
          }),
        });

        if (res.ok) sent++;
        else failed++;
      } catch {
        failed++;
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 100));
    }

    // Mark draft as sent
    await supabase.from('email_drafts').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_count: sent,
      subject_used: subject,
    }).eq('id', draft_id);

    // Log campaign
    await supabase.from('email_campaigns').insert({
      draft_id,
      brand_id: draft.brand_id,
      subject,
      sent_count: sent,
      failed_count: failed,
      audience,
      sent_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      success: true,
      sent,
      failed,
      subject,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
