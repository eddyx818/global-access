import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ASPECT_SIZES: Record<string, string> = {
  square: '1024x1024',
  landscape: '1792x1024',
  portrait: '1024x1792',
};

async function enhancePrompt(
  apiKey: string,
  prompt: string,
  context: { brand_id?: string; brand_name?: string; sku?: string; product_name?: string; media_type?: string },
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `You write image/video generation prompts for a B2B trade portal selling premium alternative products (edibles, beverages, gas chargers, papers, tablets).

User request: ${prompt}
Brand: ${context.brand_name || context.brand_id || 'unspecified'}
Product: ${context.product_name || context.sku || 'unspecified'}
Media type: ${context.media_type || 'photo'}

Write ONE detailed prompt for a high-definition professional ${context.media_type === 'video' ? 'product video (5-8 second cinematic loop)' : 'product photograph'}.
Requirements:
- Studio or lifestyle commercial quality, sharp focus, professional lighting
- Clean background unless user asked for lifestyle/scene
- No text overlays, watermarks, or fake logos unless user requested
- Accurate product representation for B2B buyers
- Photorealistic, not illustration

Return ONLY the prompt text, no quotes or explanation.`,
      }],
    }),
  });

  const data = await res.json();
  if (!res.ok) return prompt;
  return (data.content?.[0]?.text || prompt).trim();
}

async function generatePhotoOpenAI(
  apiKey: string,
  prompt: string,
  aspect: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const size = ASPECT_SIZES[aspect] || ASPECT_SIZES.square;
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt.slice(0, 4000),
      n: 1,
      size,
      quality: 'hd',
      response_format: 'b64_json',
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'OpenAI image generation failed');

  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image returned from OpenAI');

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType: 'image/png' };
}

async function generatePhotoReplicate(
  token: string,
  prompt: string,
  aspect: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const aspectMap: Record<string, string> = {
    square: '1:1',
    landscape: '16:9',
    portrait: '9:16',
  };

  const createRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      input: {
        prompt: prompt.slice(0, 4000),
        aspect_ratio: aspectMap[aspect] || '1:1',
        output_format: 'png',
        output_quality: 95,
      },
    }),
  });

  const createData = await createRes.json();
  if (!createRes.ok) throw new Error(createData.detail || 'Replicate image generation failed');

  let prediction = createData;
  const deadline = Date.now() + 120000;
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
    if (Date.now() > deadline) throw new Error('Image generation timed out');
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    prediction = await pollRes.json();
  }

  if (prediction.status !== 'succeeded') {
    throw new Error(prediction.error || 'Replicate image generation failed');
  }

  const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  const imgRes = await fetch(outputUrl);
  if (!imgRes.ok) throw new Error('Could not download generated image');
  const buf = await imgRes.arrayBuffer();
  return { bytes: new Uint8Array(buf), contentType: imgRes.headers.get('content-type') || 'image/png' };
}

async function generateVideoReplicate(
  token: string,
  prompt: string,
  referenceUrl?: string,
): Promise<{ bytes: Uint8Array; contentType: string; externalUrl?: string }> {
  const input: Record<string, unknown> = {
    prompt: prompt.slice(0, 2000),
    duration: 5,
    aspect_ratio: '16:9',
  };
  if (referenceUrl) input.start_image = referenceUrl;

  const createRes = await fetch('https://api.replicate.com/v1/models/minimax/video-01/predictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ input }),
  });

  const createData = await createRes.json();
  if (!createRes.ok) throw new Error(createData.detail || 'Replicate video generation failed');

  let prediction = createData;
  const deadline = Date.now() + 300000;
  while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
    if (Date.now() > deadline) throw new Error('Video generation timed out (5 min)');
    await new Promise(r => setTimeout(r, 3000));
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    prediction = await pollRes.json();
  }

  if (prediction.status !== 'succeeded') {
    throw new Error(prediction.error || 'Video generation failed');
  }

  const outputUrl = prediction.output;
  const videoRes = await fetch(outputUrl);
  if (!videoRes.ok) {
    return { bytes: new Uint8Array(), contentType: 'video/mp4', externalUrl: outputUrl };
  }

  const buf = await videoRes.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.length > 48 * 1024 * 1024) {
    return { bytes: new Uint8Array(), contentType: 'video/mp4', externalUrl: outputUrl };
  }
  return { bytes, contentType: videoRes.headers.get('content-type') || 'video/mp4' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      media_type = 'photo',
      prompt,
      reference_url,
      aspect_ratio = 'square',
      brand_id,
      brand_name,
      sku,
      product_name,
      user_id,
    } = body;

    if (!prompt?.trim()) throw new Error('prompt is required');

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
    const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
    const replicateToken = Deno.env.get('REPLICATE_API_TOKEN') ?? '';

    const enhancedPrompt = anthropicKey
      ? await enhancePrompt(anthropicKey, prompt, { brand_id, brand_name, sku, product_name, media_type })
      : prompt;

    let bytes: Uint8Array;
    let contentType: string;
    let externalUrl: string | undefined;
    let provider: string;

    if (media_type === 'video') {
      if (!replicateToken) {
        throw new Error('Video generation requires REPLICATE_API_TOKEN in Supabase Edge Function secrets');
      }
      const result = await generateVideoReplicate(replicateToken, enhancedPrompt, reference_url);
      bytes = result.bytes;
      contentType = result.contentType;
      externalUrl = result.externalUrl;
      provider = 'replicate/minimax-video-01';
    } else {
      if (openaiKey) {
        const result = await generatePhotoOpenAI(openaiKey, enhancedPrompt, aspect_ratio);
        bytes = result.bytes;
        contentType = result.contentType;
        provider = 'openai/dall-e-3-hd';
      } else if (replicateToken) {
        const result = await generatePhotoReplicate(replicateToken, enhancedPrompt, aspect_ratio);
        bytes = result.bytes;
        contentType = result.contentType;
        provider = 'replicate/flux-1.1-pro';
      } else {
        throw new Error('Photo generation requires OPENAI_API_KEY or REPLICATE_API_TOKEN in Supabase Edge Function secrets');
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let fileUrl = externalUrl;
    let storagePath: string | undefined;

    if (bytes.length > 0) {
      const ext = contentType.includes('video') ? 'mp4' : 'png';
      storagePath = `generated/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('admin-uploads')
        .upload(storagePath, bytes, { contentType, upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage.from('admin-uploads').getPublicUrl(storagePath);
      fileUrl = urlData.publicUrl;
    }

    if (!fileUrl) throw new Error('Generation succeeded but no file URL available');

    const { data: record, error: dbError } = await supabase
      .from('uploaded_files')
      .insert({
        file_url: fileUrl,
        file_name: `ai-${media_type}-${Date.now()}.${contentType.includes('video') ? 'mp4' : 'png'}`,
        file_type: contentType,
        file_size: bytes.length || null,
        uploaded_by: user_id || null,
        associated_brand: brand_id || null,
        associated_sku: sku || null,
        metadata: {
          generated: true,
          provider,
          prompt: prompt.trim(),
          enhanced_prompt: enhancedPrompt,
          media_type,
          aspect_ratio,
          reference_url: reference_url || null,
          storage_path: storagePath || null,
        },
      })
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    return new Response(JSON.stringify({
      success: true,
      file_url: fileUrl,
      file_id: record.id,
      media_type,
      provider,
      enhanced_prompt: enhancedPrompt,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
