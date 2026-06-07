const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function fetchImageBase64(url: string): Promise<{ media_type: string; data: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch image: ${res.status}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const data = btoa(binary);
  const ct = res.headers.get('content-type') || 'image/jpeg';
  return { media_type: ct.split(';')[0], data };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const body = await req.json();
    const { system, messages, images } = body;

    const claudeMessages = await Promise.all((messages || []).map(async (msg, idx) => {
      const isLastUser = idx === messages.length - 1 && msg.role === 'user';
      if (isLastUser && images?.length) {
        const content: unknown[] = [{ type: 'text', text: msg.content }];
        for (const img of images) {
          const b64 = await fetchImageBase64(img.url);
          content.push({
            type: 'image',
            source: { type: 'base64', media_type: b64.media_type, data: b64.data },
          });
        }
        return { role: msg.role, content };
      }
      return { role: msg.role, content: msg.content };
    }));

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: system || 'You are a helpful assistant.',
        messages: claudeMessages,
      }),
    });

    const claudeData = await claudeRes.json();
    if (!claudeRes.ok) {
      throw new Error(claudeData.error?.message || JSON.stringify(claudeData));
    }

    return new Response(JSON.stringify(claudeData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
