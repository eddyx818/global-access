import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BRANDS = [
  { id: 'churros-locos', name: 'Churros Locos', category: 'Functional Edibles', color: '#F5943A', highlight: 'Mushroom 5,000mg & Mad Honey 10,000mg functional churro bites. 40 pieces per jar, 10 jars per case.' },
  { id: 'goldwhip', name: 'GoldWhip', category: 'Catering Gas', color: '#C9A84C', highlight: 'Premium food-grade N2O cream chargers. Gold Edition and fruit, tropical, dessert variety cases. 200g through 4000g.' },
  { id: 'luxgas', name: 'LuxGas', category: 'Catering Gas', color: '#2C2C2C', highlight: 'Sleek matte black cream chargers. Natural and four bold flavors. 700g and 2100g, pallet orders only.' },
  { id: 'sokka', name: 'Sokka', category: 'Catering Gas', color: '#9B59B6', highlight: 'Bold pop-art cream chargers. Three sizes, vivid flavors including Watermelon Bubble Gum and Rainbow Candy.' },
  { id: 'numbz', name: 'numbz', category: 'Tablets', color: '#4CAF7D', highlight: '7-OH chewable tablets in 5 strength tiers — 100mg through 1000mg. 10+ bold flavors. 20 boxes per master case.' },
  { id: 'rise', name: 'Rise', category: 'Tablets', color: '#E85D4A', highlight: 'Premium 7-OH Rise chewables. New to the Global Access lineup.' },
  { id: 'blizzy', name: 'Blizzy', category: 'Papers', color: '#7B6CF6', highlight: 'Cone Woods king-size cones with Hot Skull Fronto leaf in 10 flavors, and Flat Wraps in 6 varieties including Buck-Oh Red Ohio Limited Edition.' },
  { id: 'good-spirits', name: 'Good Spirits', category: 'Beverages', color: '#C0392B', highlight: 'Craft non-alcoholic beverages from Austin TX. Three lines: Functional (nationwide), THC 1.5mg (restricted), THC 5mg.' },
];

Deno.serve(async (req) => {
  // Always handle OPTIONS first — this is the CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json().catch(() => ({}));
    const brandId = body.brand_id || null;
    const targetAudience = body.audience || 'both';

    // Pick brand
    let brand;
    if (brandId) {
      brand = BRANDS.find(b => b.id === brandId) || BRANDS[0];
    } else {
      const { data: lastDraft } = await supabase
        .from('email_drafts')
        .select('brand_id')
        .order('created_at', { ascending: false })
        .limit(1);
      const lastIdx = lastDraft?.[0] ? BRANDS.findIndex(b => b.id === lastDraft[0].brand_id) : -1;
      brand = BRANDS[(lastIdx + 1) % BRANDS.length];
    }

    // Call Claude API
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `You are a professional B2B marketing copywriter for Global Access, a premium alternative products distributor based in Los Angeles.

Write a professional marketing email featuring: ${brand.name} (${brand.category})
Product info: ${brand.highlight}
Target audience: ${targetAudience === 'both' ? 'Trade buyers — both distributors and retailers' : targetAudience + 's'}

Return ONLY valid JSON, no markdown:
{"subject_a":"subject line A","subject_b":"subject line B","preheader":"preview text max 90 chars","headline":"hero headline max 8 words","subheadline":"supporting line max 15 words","body_paragraph_1":"hook paragraph 2-3 sentences","body_paragraph_2":"product details 2-3 sentences","body_paragraph_3":"urgency angle 1-2 sentences","cta_text":"button text max 5 words","ps_line":"P.S. line 1 sentence"}`
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || '{}';
    let copy;
    try {
      copy = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    } catch {
      copy = { subject_a: `New from Global Access: ${brand.name}`, subject_b: `${brand.name} — Now Available`, headline: brand.name, body_paragraph_1: brand.highlight, cta_text: 'View Products' };
    }

    // Build HTML
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:sans-serif;background:#F5F2ED;margin:0}.wrap{max-width:600px;margin:0 auto}.hero{background:#0D0D0D;padding:48px 40px;text-align:center}.pill{display:inline-block;background:${brand.color}28;border:1px solid ${brand.color}66;border-radius:20px;padding:5px 16px;font-size:11px;color:${brand.color};letter-spacing:.2em;text-transform:uppercase;margin-bottom:16px;font-weight:700}.h1{font-size:42px;font-weight:800;color:#FFF;line-height:1;margin-bottom:12px}.sub{font-size:16px;color:rgba(255,255,255,.55);margin-bottom:32px}.btn{display:inline-block;background:${brand.color};color:#FFF;text-decoration:none;padding:16px 36px;border-radius:12px;font-size:15px;font-weight:700}.body{background:#FFF;margin:24px;border-radius:16px;padding:40px}.p{font-size:16px;line-height:1.75;color:#444;margin-bottom:20px}.box{background:${brand.color}0D;border:1px solid ${brand.color}33;border-radius:12px;padding:20px 24px;margin:24px 0}.footer{text-align:center;padding:32px 24px;font-size:12px;color:#BBB}</style></head><body><div class="wrap"><div class="hero"><div class="pill">${brand.category}</div><div class="h1">${copy.headline||brand.name}</div><div class="sub">${copy.subheadline||''}</div><a href="https://global-access.vercel.app/#${brand.id}" class="btn">${copy.cta_text||'View Products'} →</a></div><div class="body"><p class="p">${copy.body_paragraph_1||''}</p><div class="box"><div style="font-size:10px;color:${brand.color};font-weight:700;text-transform:uppercase;letter-spacing:.15em;margin-bottom:8px">Featured — ${brand.name}</div><div style="font-size:15px;color:#333">${brand.highlight}</div></div><p class="p">${copy.body_paragraph_2||''}</p><p class="p" style="font-weight:600;color:#1A1A1A">${copy.body_paragraph_3||''}</p><div style="text-align:center;margin-top:24px"><a href="https://global-access.vercel.app/#${brand.id}" class="btn">${copy.cta_text||'View Products'} →</a></div>${copy.ps_line?`<p style="font-size:14px;color:#888;font-style:italic;margin-top:28px">P.S. ${copy.ps_line}</p>`:''}</div><div class="footer"><div style="font-size:20px;font-weight:800;letter-spacing:.1em;color:#1A1A1A;margin-bottom:8px">GLOBAL ACCESS</div>Trade portal · Invite only<br><a href="https://wa.me/18183199888" style="color:#C9A84C">+1 (818) 319-9888</a> · <a href="mailto:edward@churroslocos.shop" style="color:#C9A84C">edward@churroslocos.shop</a></div></div></body></html>`;

    // Save draft
    const { data: draft, error } = await supabase.from('email_drafts').insert({
      brand_id: brand.id,
      brand_name: brand.name,
      subject_a: copy.subject_a,
      subject_b: copy.subject_b,
      preheader: copy.preheader,
      html_content: html,
      copy_json: JSON.stringify(copy),
      audience: targetAudience,
      status: 'pending',
      created_at: new Date().toISOString(),
    }).select().single();

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({
      success: true,
      draft_id: draft.id,
      brand: brand.name,
      subject_a: copy.subject_a,
      subject_b: copy.subject_b,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
