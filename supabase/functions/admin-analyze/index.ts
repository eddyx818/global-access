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

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch document: ${res.status}`);
  return res.text();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const body = await req.json();
    const { type, file_url, purpose = 'product_info', doc_type = 'general', text_content } = body;

    if (!file_url && !text_content) throw new Error('file_url or text_content required');

    let userContent: unknown[] = [];

    if (type === 'analyze_image') {
      const img = await fetchImageBase64(file_url);
      userContent = [
        {
          type: 'image',
          source: { type: 'base64', media_type: img.media_type, data: img.data },
        },
        {
          type: 'text',
          text: `Analyze this product/brand image for a B2B trade portal (Global Access).
Purpose: ${purpose}

Return ONLY valid JSON:
{
  "summary": "brief description",
  "product_type": "category guess",
  "detected_name": "product name if visible",
  "detected_sku": "SKU if visible or null",
  "flavors": ["list of flavors/variants if visible"],
  "brand_colors": ["#hex colors detected"],
  "suggested_brand_id": "slug guess or null",
  "suggested_action": "create_product | upload_brand_asset | update_brand_content | null",
  "suggested_data": { "brand_id": "", "sku": "", "name": "", "detail": "", "category": "", "color": "", "flavors_retail": [] }
}`,
        },
      ];
    } else if (type === 'parse_document') {
      const text = text_content || await fetchText(file_url);
      const truncated = text.slice(0, 120000);
      userContent = [{
        type: 'text',
        text: `Parse this ${doc_type} document for Global Access B2B portal product data.

Document content:
---
${truncated}
---

Return ONLY valid JSON:
{
  "summary": "what this document contains",
  "products": [
    {
      "brand_id": "slug",
      "sku": "SKU",
      "name": "Product name",
      "detail": "pack size info",
      "category": "category",
      "price_retail": null,
      "price_wholesale": null,
      "flavors_retail": [],
      "flavors_distro": []
    }
  ],
  "suggested_action": "bulk_import | create_product | null"
}`,
      }];
    } else {
      throw new Error('type must be analyze_image or parse_document');
    }

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
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    const claudeData = await claudeRes.json();
    if (!claudeRes.ok) throw new Error(claudeData.error?.message || 'Claude API error');

    const rawText = claudeData.content?.[0]?.text || '{}';
    let analysis;
    try {
      analysis = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    } catch {
      analysis = { summary: rawText, parse_error: true };
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
