// Global Access — AI Marketing Agent
// Supabase Edge Function
// Generates professional marketing emails using Claude AI
// Saves drafts for admin approval before sending

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BRANDS = [
  { id: 'churros-locos', name: 'Churros Locos', category: 'Functional Edibles', color: '#F5943A', highlight: 'Mushroom 5,000mg & Mad Honey 10,000mg functional churro bites. 40 pieces per jar, 10 jars per case.' },
  { id: 'goldwhip', name: 'GoldWhip', category: 'Catering Gas', color: '#C9A84C', highlight: 'Premium food-grade N2O cream chargers. Gold Edition and fruit, tropical, dessert variety cases. 200g through 4000g.' },
  { id: 'luxgas', name: 'LuxGas', category: 'Catering Gas', color: '#2C2C2C', highlight: 'Sleek matte black cream chargers. Natural and four bold flavors. 700g and 2100g, pallet orders only.' },
  { id: 'sokka', name: 'Sokka', category: 'Catering Gas', color: '#9B59B6', highlight: 'Bold pop-art cream chargers. Three sizes, vivid flavors including Watermelon Bubble Gum and Rainbow Candy.' },
  { id: 'numbz', name: 'numbz', category: 'Tablets', color: '#4CAF7D', highlight: '7-OH chewable tablets in 5 strength tiers — 100mg through 1000mg. 10+ bold flavors. 20 boxes per master case.' },
  { id: 'rise', name: 'Rise', category: 'Tablets', color: '#E85D4A', highlight: 'Premium 7-OH Rise chewables. New to the Global Access lineup.' },
  { id: 'blizzy', name: 'Blizzy', category: 'Papers', color: '#7B6CF6', highlight: 'Cone Woods king-size cones with Hot Skull Fronto leaf in 10 flavors, and Flat Wraps in 6 varieties including Buck-Oh Red Ohio Limited Edition.' },
  { id: 'good-spirits', name: 'Good Spirits', category: 'Beverages', color: '#C0392B', highlight: 'Craft non-alcoholic beverages from Austin TX. Three lines: Functional (nationwide), THC 1.5mg (restricted), THC 5mg. Real fruit juice, no artificial ingredients.' },
];

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    const body = await req.json().catch(() => ({}));
    const brandId = body.brand_id || null;
    const targetAudience = body.audience || 'both'; // 'retailer' | 'distributor' | 'both'

    // Pick brand to feature (rotate through brands or use specified)
    let brand;
    if (brandId) {
      brand = BRANDS.find(b => b.id === brandId) || BRANDS[0];
    } else {
      // Auto-pick based on what was last featured
      const { data: lastDraft } = await supabase
        .from('email_drafts')
        .select('brand_id')
        .order('created_at', { ascending: false })
        .limit(1);
      const lastIdx = lastDraft?.[0] ? BRANDS.findIndex(b => b.id === lastDraft[0].brand_id) : -1;
      const nextIdx = (lastIdx + 1) % BRANDS.length;
      brand = BRANDS[nextIdx];
    }

    // Generate email with Claude
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `You are a professional B2B marketing copywriter for Global Access, a premium alternative products distributor based in Los Angeles.

Write a professional marketing email featuring: ${brand.name} (${brand.category})
Product info: ${brand.highlight}
Target audience: ${targetAudience === 'both' ? 'Trade buyers — both distributors and retailers' : targetAudience + 's'}
Brand color: ${brand.color}

Return ONLY a JSON object with these exact fields, no markdown, no preamble:
{
  "subject_a": "subject line option A (curiosity/intrigue angle)",
  "subject_b": "subject line option B (direct value angle)",
  "preheader": "preview text shown in inbox (max 90 chars)",
  "headline": "bold hero headline (max 8 words)",
  "subheadline": "supporting line (max 15 words)",
  "body_paragraph_1": "opening paragraph — hook the reader, 2-3 sentences",
  "body_paragraph_2": "product details and why it matters for their business, 2-3 sentences",
  "body_paragraph_3": "urgency or exclusivity angle, 1-2 sentences",
  "cta_text": "call to action button text (max 5 words)",
  "ps_line": "P.S. line — personal, creates urgency (1 sentence)"
}`
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || '{}';
    let copy;
    try {
      copy = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    } catch {
      copy = { subject_a: 'New arrivals from Global Access', subject_b: `Featured: ${brand.name}`, headline: brand.name, body_paragraph_1: brand.highlight, cta_text: 'Learn More' };
    }

    // Build HTML email
    const html = buildEmailHTML(brand, copy, targetAudience);

    // Save draft to Supabase for admin approval
    const { data: draft, error } = await supabase.from('email_drafts').insert({
      brand_id: brand.id,
      brand_name: brand.name,
      subject_a: copy.subject_a,
      subject_b: copy.subject_b,
      preheader: copy.preheader,
      html_content: html,
      copy_json: JSON.stringify(copy),
      audience: targetAudience,
      status: 'pending', // 'pending' | 'approved' | 'sent' | 'discarded'
      created_at: new Date().toISOString(),
    }).select().single();

    if (error) throw error;

    // Send WhatsApp notification to admin
    const waMsg = encodeURIComponent(
      `🎯 *New Marketing Email Draft Ready*\n\n` +
      `Brand: ${brand.name}\n` +
      `Subject A: ${copy.subject_a}\n` +
      `Subject B: ${copy.subject_b}\n\n` +
      `Preview & approve at:\nglobal-access.vercel.app (Admin → Marketing tab)`
    );

    return new Response(JSON.stringify({
      success: true,
      draft_id: draft.id,
      brand: brand.name,
      subject_a: copy.subject_a,
      subject_b: copy.subject_b,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

function buildEmailHTML(brand, copy, audience) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${copy.subject_a}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F5F2ED; color: #1A1A1A; }
  .wrapper { max-width: 600px; margin: 0 auto; }
  .hero { background: #0D0D0D; padding: 48px 40px; text-align: center; border-radius: 0 0 24px 24px; }
  .category-pill { display: inline-block; background: ${brand.color}28; border: 1px solid ${brand.color}66; border-radius: 20px; padding: 5px 16px; font-size: 11px; color: ${brand.color}; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 16px; font-weight: 700; }
  .headline { font-size: 42px; font-weight: 800; color: #FFF; line-height: 1; margin-bottom: 12px; letter-spacing: -0.5px; }
  .subheadline { font-size: 16px; color: rgba(255,255,255,0.55); margin-bottom: 32px; }
  .cta-btn { display: inline-block; background: ${brand.color}; color: #FFF; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-size: 15px; font-weight: 700; letter-spacing: 0.04em; }
  .body-section { background: #FFF; margin: 24px 0; border-radius: 16px; padding: 40px; }
  .body-text { font-size: 16px; line-height: 1.75; color: #444; margin-bottom: 20px; }
  .divider { height: 1px; background: #F0EDE8; margin: 24px 0; }
  .highlight-box { background: ${brand.color}0D; border: 1px solid ${brand.color}33; border-radius: 12px; padding: 20px 24px; margin: 24px 0; }
  .highlight-label { font-size: 10px; color: ${brand.color}; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; }
  .highlight-text { font-size: 15px; color: #333; line-height: 1.6; }
  .ps { font-size: 14px; color: #888; font-style: italic; margin-top: 8px; }
  .footer { text-align: center; padding: 32px 24px; }
  .footer-logo { font-size: 20px; font-weight: 800; letter-spacing: 0.1em; color: #1A1A1A; margin-bottom: 8px; }
  .footer-text { font-size: 12px; color: #BBB; line-height: 1.6; }
  .footer-link { color: #C9A84C; text-decoration: none; }
  @media (max-width: 600px) {
    .hero { padding: 36px 24px; }
    .headline { font-size: 32px; }
    .body-section { padding: 28px 20px; }
  }
</style>
</head>
<body>
<div class="wrapper">
  <!-- Header -->
  <div style="background:#FFF; padding: 16px 24px; display:flex; align-items:center; justify-content:space-between; border-bottom: 1px solid #F0EDE8;">
    <div style="font-size:14px; font-weight:800; letter-spacing:0.08em; color:#1A1A1A;">GLOBAL ACCESS</div>
    <div style="font-size:11px; color:#BBB; letter-spacing:0.08em; text-transform:uppercase;">Trade Portal</div>
  </div>

  <!-- Hero -->
  <div class="hero">
    <div class="category-pill">${brand.category}</div>
    <div class="headline">${copy.headline || brand.name}</div>
    <div class="subheadline">${copy.subheadline || ''}</div>
    <a href="https://global-access.vercel.app/#${brand.id}" class="cta-btn">${copy.cta_text || 'View Products'} →</a>
  </div>

  <!-- Body -->
  <div class="body-section">
    <p class="body-text">${copy.body_paragraph_1 || ''}</p>
    <div class="divider"></div>
    <div class="highlight-box">
      <div class="highlight-label">Featured — ${brand.name}</div>
      <div class="highlight-text">${brand.highlight}</div>
    </div>
    <p class="body-text">${copy.body_paragraph_2 || ''}</p>
    <p class="body-text" style="font-weight:600; color:#1A1A1A;">${copy.body_paragraph_3 || ''}</p>
    <div class="divider"></div>
    <div style="text-align:center; margin-top:24px;">
      <a href="https://global-access.vercel.app/#${brand.id}" class="cta-btn">${copy.cta_text || 'View Products'} →</a>
    </div>
    ${copy.ps_line ? `<p class="ps" style="margin-top:28px;">P.S. ${copy.ps_line}</p>` : ''}
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-logo">GLOBAL ACCESS</div>
    <div class="footer-text">
      Trade portal · Invite only<br>
      <a href="https://wa.me/18183199888" class="footer-link">+1 (818) 319-9888</a> · 
      <a href="mailto:edward@churroslocos.shop" class="footer-link">edward@churroslocos.shop</a>
    </div>
    <div style="margin-top:16px; font-size:11px; color:#DDD;">
      You're receiving this because you have a Global Access trade account.<br>
      <a href="#" style="color:#CCC;">Unsubscribe</a>
    </div>
  </div>
</div>
</body>
</html>`;
}
