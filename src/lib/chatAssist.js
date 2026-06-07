export const QUICK_REPLIES = [
  'Thanks for your quote request! Our team is reviewing your list and will follow up shortly.',
  'Got it — could you confirm quantities for each line item?',
  'We are preparing pricing for your request and will send details soon.',
  'Your quote is ready. Please check the details above and let us know if you would like to proceed.',
  'Thanks for your patience — we will reach out by end of day with next steps.',
];

export async function suggestReplyToCustomer({ customerName, messages, inquiryNotes }) {
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, error: 'App not configured for AI assist.' };
  }

  const transcript = (messages || [])
    .slice(-12)
    .map(m => `${m.role === 'staff' ? 'Staff' : 'Customer'}: ${m.content}`)
    .join('\n');

  const system = `You are a helpful B2B sales assistant for Global Access (alternative products wholesale portal).
Write a short, professional, friendly reply to the customer (2-4 sentences max).
Be concrete and actionable. Do not use markdown. Do not include placeholders like [name].
Sign off simply as the Global Access team only if it fits naturally.`;

  const userPrompt = [
    customerName ? `Customer name: ${customerName}` : '',
    inquiryNotes ? `Latest inquiry notes: ${inquiryNotes}` : '',
    'Recent chat:',
    transcript || '(No messages yet)',
    '',
    'Draft the next staff reply to the customer:',
  ].filter(Boolean).join('\n');

  const res = await fetch(`${supabaseUrl}/functions/v1/claude-agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      system,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return { ok: false, error: data.error || 'AI assist failed' };
  }

  const text = (data.content?.[0]?.text || '').trim();
  if (!text) {
    return { ok: false, error: 'No suggestion returned.' };
  }
  return { ok: true, text };
}

export function messagesToAssistFormat(messages, customerUserId) {
  return (messages || [])
    .filter(m => !m.is_system && m.content)
    .map(m => ({
      role: m.from_user_id === customerUserId ? 'customer' : 'staff',
      content: m.content,
    }));
}
