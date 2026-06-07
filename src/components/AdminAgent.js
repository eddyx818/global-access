import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BRANDS } from '../lib/data';
import { executeAdminAction, isDesignAction } from '../lib/adminActions';
import {
  executeExtendedAction,
  isExtendedAction,
} from '../lib/adminProductActions';
import {
  uploadAdminFile,
  isImageFile,
  readFileAsText,
  callAdminAnalyze,
} from '../lib/adminUpload';
import { callGenerateMedia, buildBrandContext } from '../lib/adminMediaGenerate';
import DesignPreview from './DesignPreview';

const EXTENDED_PROMPT = `
Extended capabilities (file uploads, products, analytics):
- create_product: Add a new product. data: {brand_id, sku, name, detail?, category?, price_retail?, price_wholesale?, flavors_retail?, flavors_distro?, images?, source_file_id?}
- bulk_import: Import multiple products. data: {products: [...], overwrite_existing?: boolean, source_file_id?}
- analyze_image: Analyze a product photo (informational). data: {file_url, purpose?: 'product_info'|'brand_asset'|'inspiration'}
- parse_document: Extract product data from CSV/PDF/text. data: {file_url?, text_content?, doc_type?: 'spec_sheet'|'price_list'|'catalog'|'general'}
- query_database: Read-only analytics. data: {query_type: 'analytics'|'inventory'|'orders'|'users', date_range?: {start, end}}
- check_system: Health check. data: {components?: ['server','database','cdn','api']}
- generate_preview: Visual mockup only (no save). data: {preview_type: 'brand_page'|'product_card'|'hero_section', changes: {...}, device?: 'desktop'|'tablet'|'mobile'}
- generate_media: Create a high-definition professional photo or video render. data: {media_type: 'photo'|'video', prompt: 'detailed description of the render', reference_url?, aspect_ratio?: 'square'|'landscape'|'portrait', brand_id?, sku?, apply_to?: {asset_type: 'product'|'hero'|'gallery', brand_id, sku?}}
- apply_generated_media: Save a generated render to the live site. data: {file_url?, media_type?, apply_to: {asset_type, brand_id, sku?}} — omit file_url if a render was just generated in this chat.

When the user asks for product photos, hero images, lifestyle shots, or short product videos, use generate_media with a detailed commercial photography / cinematography prompt. Include brand_id and sku when known. Set apply_to when they want it on the site (product = product card image, hero/gallery = brand photos section).

When the user attaches a file, use file_url and analysis context from their message. For product photos, prefer create_product after analysis. For CSV/catalogs, prefer bulk_import. For "make this look professional" or "HD render of this product", use generate_media with reference_url from the attachment.
Categories: whipped cream, disposables, devices, accessories, etc.`;

const SYSTEM_PROMPT = `You are an AI admin assistant for Global Access, a B2B trade portal for alternative products. You help the admin manage the site.

You have access to these actions. When the user asks you to do something, respond with a JSON object in this exact format:
{
  "message": "Your conversational response explaining what you'll do",
  "action": "action_name or null if no action needed",
  "preview": "Human readable description of the change for confirmation",
  "data": { ...action specific data }
}

Available actions:
- update_brand_content: Update brand tagline, description, color. data: {brand_id, tagline?, description?, color?}
- update_product_content: Update product name, detail, flavors. data: {brand_id, sku, name?, detail?, flavors_retail?, flavors_distro?}
- toggle_flavor_soldout: Mark a flavor sold out or in stock. data: {brand_id, sku, flavor, flavor_type, sold_out}
- add_flavor: Add a new flavor to a product. data: {brand_id, sku, flavor, flavor_type}
- remove_flavor: Remove a flavor from a product. data: {brand_id, sku, flavor, flavor_type}
- generate_email: Generate a marketing email draft. data: {brand_id?, audience?}
- hide_brand: Hide a brand from the portal. data: {brand_id}
- show_brand: Show a hidden brand. data: {brand_id}
- update_hero_section: Modify homepage hero. data: {section: 'home', background_color?, headline?, subheadline?, cta_text?, cta_color?}
- update_global_styles: Site-wide theme. data: {primary_color?, secondary_color?, font_family?, button_style?} — font_family: modern|bold|elegant|playful, button_style: rounded|pill|square
- update_brand_page_layout: Brand page layout. data: {brand_id, header_style?, grid_columns?, card_style?} — header_style: hero|compact|minimal, grid_columns: 1|2|3, card_style: flat|elevated|bordered
- upload_brand_asset: Replace a brand visual by URL. data: {brand_id, asset_type: 'logo'|'hero'|'product', file_url, sku?}
- update_navigation: Edit nav menu. data: {action: 'add'|'remove'|'reorder', item_id?, label?, url?, position?}
${EXTENDED_PROMPT}
- null: Just answer the question, no action needed

Brands available: ${BRANDS.map(b => `${b.id} (${b.name})`).join(', ')}

Always be helpful, professional, and confirm before making changes (except query_database and check_system which run immediately). If the user's request is unclear, ask for clarification.

RESPONSE RULES (critical):
- Output ONLY one raw JSON object. No markdown code fences. No text before or after the JSON.
- The "message" field must be plain, readable English for the admin (short paragraphs, bullets with •). Never put JSON inside "message".
- For questions with no site change, set "action": null and put the full answer in "message".
- You CANNOT access GitHub, edit source code, or create pull requests. You manage live site content via actions only. For code changes, tell the admin to use Cursor IDE (or paste fixes you suggest as plain instructions in "message").
- Do NOT invent GitHub bot accounts, PAT tokens, or repo setup unless building a real integrated feature.`;

function parseAgentResponse(rawText) {
  const text = (rawText || '').trim();
  if (!text) return { message: "I didn't get a response. Please try again.", action: null };

  let cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const tryParse = (str) => {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  };

  let parsed = tryParse(cleaned);
  if (!parsed) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) parsed = tryParse(match[0]);
  }

  if (parsed && typeof parsed === 'object') {
    const action = parsed.action === 'null' || parsed.action === null || parsed.action === undefined
      ? null
      : parsed.action;
    let message = typeof parsed.message === 'string' ? parsed.message.trim() : '';
    if (!message) {
      message = action
        ? 'I can make that change — please review the preview and confirm.'
        : 'How can I help you next?';
    }
    return { message, action, preview: parsed.preview, data: parsed.data };
  }

  if (cleaned.startsWith('{') && cleaned.includes('"message"')) {
    const msgMatch = cleaned.match(/"message"\s*:\s*"((?:\\.|[^"\\])*)"/s);
    if (msgMatch) {
      const unescaped = msgMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
      return { message: unescaped, action: null };
    }
  }

  if (cleaned.startsWith('{')) {
    return {
      message: 'I had trouble formatting that reply. Please ask again, or use Cursor for code and deployment questions.',
      action: null,
    };
  }

  return { message: cleaned, action: null };
}

const IMMEDIATE_ACTIONS = ['query_database', 'check_system'];
const ANALYSIS_ACTIONS = ['analyze_image', 'parse_document'];

function hasVisualPreview(action) {
  return isDesignAction(action) || ['create_product', 'bulk_import', 'generate_preview', 'generate_media', 'apply_generated_media'].includes(action);
}

function formatAnalysisSummary(analysis) {
  if (!analysis) return '';
  const lines = [];
  if (analysis.summary) lines.push(analysis.summary);
  if (analysis.detected_name) lines.push(`Name: ${analysis.detected_name}`);
  if (analysis.detected_sku) lines.push(`SKU: ${analysis.detected_sku}`);
  if (analysis.product_type) lines.push(`Type: ${analysis.product_type}`);
  if (analysis.flavors?.length) lines.push(`Flavors: ${analysis.flavors.join(', ')}`);
  if (analysis.brand_colors?.length) lines.push(`Colors: ${analysis.brand_colors.join(', ')}`);
  if (analysis.products?.length) lines.push(`Found ${analysis.products.length} product(s) in document`);
  return lines.join('\n');
}

export default function AdminAgent() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hi! I'm your Global Access admin assistant. I can update content, change site design, create products from photos or CSVs, generate HD product photos and videos, run analytics, and more. Attach a product photo or catalog file, or tell me what you'd like to do.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastGeneratedRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role, text, extra = {}) => {
    setMessages(prev => [...prev, { role, text, ...extra }]);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const record = await uploadAdminFile(file, { userId: user?.id });
      let analysis = null;

      if (isImageFile(file)) {
        const res = await callAdminAnalyze({
          type: 'analyze_image',
          file_url: record.file_url,
          purpose: 'product_info',
        });
        analysis = res.analysis;
      } else if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
        const text = await readFileAsText(file);
        const res = await callAdminAnalyze({
          type: 'parse_document',
          file_url: record.file_url,
          doc_type: 'catalog',
          text_content: text,
        });
        analysis = res.analysis;
      } else if (file.type === 'text/plain' || /\.txt$/i.test(file.name) || /\.json$/i.test(file.name)) {
        const text = await readFileAsText(file);
        const res = await callAdminAnalyze({
          type: 'parse_document',
          file_url: record.file_url,
          doc_type: 'general',
          text_content: text,
        });
        analysis = res.analysis;
      }

      setAttachment({ file, record, analysis });
      const summary = formatAnalysisSummary(analysis);
      addMessage(
        'assistant',
        `📎 Uploaded **${file.name}**${summary ? `\n\n${summary}` : ''}\n\nDescribe what you'd like me to do with this file, or I'll suggest an action.`,
      );

      if (analysis?.suggested_action === 'create_product' && analysis.suggested_data) {
        const data = {
          ...analysis.suggested_data,
          images: [record.file_url],
          source_file_id: record.id,
        };
        setPending({
          action: 'create_product',
          message: 'Create product from uploaded image?',
          preview: `Create product: ${data.name || data.sku}`,
          data,
        });
        addMessage('assistant', `**Suggested:** Create product from this image.\n\nShall I go ahead?`, { isConfirm: true });
      } else if (analysis?.suggested_action === 'bulk_import' && analysis.products?.length) {
        setPending({
          action: 'bulk_import',
          message: 'Import products from document?',
          preview: `Import ${analysis.products.length} product(s)`,
          data: { products: analysis.products, source_file_id: record.id },
        });
        addMessage('assistant', `**Suggested:** Import ${analysis.products.length} product(s) from this file.\n\nShall I go ahead?`, { isConfirm: true });
      }
    } catch (err) {
      addMessage('assistant', `Upload failed: ${err.message}`);
    }
    setUploading(false);
  };

  const runAnalysisAction = async (action, data) => {
    if (action === 'analyze_image') {
      const res = await callAdminAnalyze({
        type: 'analyze_image',
        file_url: data.file_url,
        purpose: data.purpose || 'product_info',
      });
      return res.analysis;
    }
    const res = await callAdminAnalyze({
      type: 'parse_document',
      file_url: data.file_url,
      doc_type: data.doc_type || 'general',
      text_content: data.text_content,
    });
    return res.analysis;
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachment) || loading) return;

    let userMessage = input.trim();
    if (attachment) {
      const ctx = [
        `[Attached file: ${attachment.file.name}]`,
        `URL: ${attachment.record.file_url}`,
        attachment.analysis ? `Analysis: ${JSON.stringify(attachment.analysis)}` : null,
      ].filter(Boolean).join('\n');
      userMessage = userMessage ? `${userMessage}\n\n${ctx}` : ctx;
    }

    setInput('');
    addMessage('user', userMessage.replace(/\n\n\[Attached file:[\s\S]*/, attachment ? `📎 ${attachment.file.name}${input.trim() ? `\n${input.trim()}` : ''}` : userMessage));
    setLoading(true);

    const currentAttachment = attachment;
    setAttachment(null);

    try {
      const history = messages
        .filter(m => !m.isConfirm)
        .map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.text,
        }));
      history.push({ role: 'user', content: userMessage });

      const images = currentAttachment && isImageFile(currentAttachment.file)
        ? [{ url: currentAttachment.record.file_url }]
        : undefined;

      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/claude-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ system: SYSTEM_PROMPT, messages: history, images }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assistant request failed');

      const rawText = data.content?.[0]?.text || '{}';
      const parsed = parseAgentResponse(rawText);

      addMessage('assistant', parsed.message);

      if (!parsed.action || parsed.action === 'null') {
        setLoading(false);
        return;
      }

      if (IMMEDIATE_ACTIONS.includes(parsed.action)) {
        const result = await executeExtendedAction(parsed.action, parsed.data || {});
        const summary = typeof result === 'object'
          ? Object.entries(result).map(([k, v]) => `${k}: ${v}`).join('\n')
          : String(result);
        addMessage('assistant', summary);
        setLoading(false);
        return;
      }

      if (ANALYSIS_ACTIONS.includes(parsed.action)) {
        const analysis = await runAnalysisAction(parsed.action, parsed.data || {});
        addMessage('assistant', formatAnalysisSummary(analysis) || JSON.stringify(analysis, null, 2));

        if (analysis.suggested_action === 'create_product' && analysis.suggested_data) {
          setPending({
            ...parsed,
            action: 'create_product',
            preview: `Create product: ${analysis.suggested_data.name || analysis.suggested_data.sku}`,
            data: {
              ...analysis.suggested_data,
              images: parsed.data?.file_url ? [parsed.data.file_url] : undefined,
            },
          });
          addMessage('assistant', '**Suggested next step:** Create this product.\n\nShall I go ahead?', { isConfirm: true });
        } else if (analysis.suggested_action === 'bulk_import' && analysis.products?.length) {
          setPending({
            ...parsed,
            action: 'bulk_import',
            preview: `Import ${analysis.products.length} product(s)`,
            data: { products: analysis.products },
          });
          addMessage('assistant', `**Suggested next step:** Import ${analysis.products.length} product(s).\n\nShall I go ahead?`, { isConfirm: true });
        }
        setLoading(false);
        return;
      }

      if (parsed.action === 'generate_preview') {
        setPending(parsed);
        addMessage('assistant', `**Preview:** ${parsed.preview || 'Visual mockup'}\n\nThis is a preview only — no changes will be saved.`, { isConfirm: true });
        setLoading(false);
        return;
      }

      if (parsed.action === 'apply_generated_media') {
        const applyData = { ...(parsed.data || {}) };
        if (!applyData.file_url && lastGeneratedRef.current?.file_url) {
          applyData.file_url = lastGeneratedRef.current.file_url;
          applyData.media_type = applyData.media_type || lastGeneratedRef.current.media_type;
        }
        if (!applyData.file_url) {
          addMessage('assistant', 'No generated render on file — ask me to generate a photo or video first.');
          setLoading(false);
          return;
        }
        setPending({ ...parsed, data: applyData });
        addMessage('assistant', `**Apply render:** ${parsed.preview || applyData.apply_to?.asset_type || 'upload to site'}\n\nShall I go ahead?`, { isConfirm: true });
        setLoading(false);
        return;
      }

      if (parsed.action === 'generate_media') {
        const mediaData = { ...(parsed.data || {}) };
        if (!mediaData.reference_url && currentAttachment && isImageFile(currentAttachment.file)) {
          mediaData.reference_url = currentAttachment.record.file_url;
        }
        if (mediaData.brand_id && !mediaData.brand_name) {
          Object.assign(mediaData, buildBrandContext(mediaData.brand_id, mediaData.sku));
        }
        setPending({ ...parsed, data: mediaData });
        const typeLabel = mediaData.media_type === 'video' ? 'video' : 'HD photo';
        addMessage('assistant', `**Generate ${typeLabel}:** ${parsed.preview || mediaData.prompt?.slice(0, 80)}\n\nThis uses AI image/video generation (may take 1–3 minutes). Proceed?`, { isConfirm: true });
        setLoading(false);
        return;
      }

      setPending(parsed);
      addMessage('assistant', `**Preview:** ${parsed.preview}\n\nShall I go ahead with this change?`, { isConfirm: true });
    } catch (err) {
      addMessage('assistant', `Sorry, I ran into an error: ${err.message}`);
      if (currentAttachment) setAttachment(currentAttachment);
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (!pending) return;

    if (pending.action === 'generate_media') {
      setLoading(true);
      setGenerating(true);
      const { data } = pending;
      setPending(null);

      try {
        const ctx = buildBrandContext(data.brand_id, data.sku);
        const result = await callGenerateMedia({
          media_type: data.media_type || 'photo',
          prompt: data.prompt,
          reference_url: data.reference_url,
          aspect_ratio: data.aspect_ratio || 'square',
          ...ctx,
        });

        const generated = {
          file_url: result.file_url,
          file_id: result.file_id,
          media_type: data.media_type || 'photo',
          apply_to: data.apply_to,
        };
        lastGeneratedRef.current = generated;

        addMessage('assistant', `✨ **HD ${generated.media_type} ready!**${data.apply_to ? '\n\nApply this to the live site?' : '\n\nTell me where to use it (product photo, gallery, etc.) or confirm if apply_to was set.'}`);

        setPending({
          action: 'apply_generated_media',
          preview: `Generated ${generated.media_type}`,
          data: generated,
        });
        if (data.apply_to) {
          addMessage('assistant', `**Apply to site:** ${data.apply_to.asset_type} on ${data.apply_to.brand_id}${data.apply_to.sku ? ` (${data.apply_to.sku})` : ''}`, { isConfirm: true });
        } else {
          addMessage('assistant', '**Your render:**', { isConfirm: true, showGeneratedOnly: true });
        }
      } catch (err) {
        addMessage('assistant', `❌ Generation failed: ${err.message}\n\nEnsure OPENAI_API_KEY (photos) and/or REPLICATE_API_TOKEN (videos) are set in Supabase Edge Function secrets, and deploy admin-generate-media.`);
      }
      setGenerating(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { action, data } = pending;
    setPending(null);

    try {
      if (action === 'generate_preview') {
        addMessage('assistant', 'Preview shown above — no changes were saved. Want me to apply any of these changes?');
        setLoading(false);
        return;
      }

      if (action === 'apply_generated_media') {
        if (!data.apply_to) {
          addMessage('assistant', 'Tell me where to use this — e.g. "set as product photo for numbz NB-100" or "add to good-spirits gallery".');
          setLoading(false);
          return;
        }
        await executeExtendedAction(action, data);
        window.dispatchEvent(new CustomEvent('ga-content-updated'));
        addMessage('assistant', '✅ Done! The render is live on the site.');
        setLoading(false);
        return;
      }

      const result = await executeAction(action, data);
      window.dispatchEvent(new CustomEvent('ga-content-updated'));

      if (action === 'bulk_import' && result) {
        addMessage('assistant', `✅ Done! Created ${result.created} product(s)${result.skipped ? `, skipped ${result.skipped}` : ''}.`);
      } else {
        addMessage('assistant', '✅ Done! The change has been saved and is live on the site.');
      }
    } catch (err) {
      addMessage('assistant', `❌ Something went wrong: ${err.message}`);
    }
    setLoading(false);
  };

  const handleCancel = () => {
    setPending(null);
    addMessage('assistant', 'No problem — change cancelled. What else can I help with?');
  };

  const executeAction = async (action, data) => {
    if (isDesignAction(action)) {
      await executeAdminAction(action, data);
      return;
    }
    if (isExtendedAction(action)) {
      return executeExtendedAction(action, data);
    }

    switch (action) {
      case 'update_brand_content': {
        const { error } = await supabase.from('brand_content').upsert({
          brand_id: data.brand_id,
          ...(data.tagline && { tagline: data.tagline }),
          ...(data.description && { description: data.description }),
          ...(data.color && { color: data.color }),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'brand_id' });
        if (error) throw new Error(error.message);
        break;
      }

      case 'update_product_content': {
        const payload = { brand_id: data.brand_id, sku: data.sku, updated_at: new Date().toISOString() };
        if (data.name) payload.name = data.name;
        if (data.detail) payload.detail = data.detail;
        if (data.flavors_retail) payload.flavors_retail = JSON.stringify(data.flavors_retail);
        if (data.flavors_distro) payload.flavors_distro = JSON.stringify(data.flavors_distro);
        const { error } = await supabase.from('product_content').upsert(payload, { onConflict: 'sku' });
        if (error) throw new Error(error.message);
        break;
      }

      case 'toggle_flavor_soldout':
      case 'add_flavor':
      case 'remove_flavor': {
        const { data: existing } = await supabase.from('product_content').select('*').eq('sku', data.sku).single();
        const flavorKey = data.flavor_type === 'retail' ? 'flavors_retail' : 'flavors_distro';
        let flavors = existing?.[flavorKey] ? JSON.parse(existing[flavorKey]) : [];
        const brand = BRANDS.find(b => b.id === data.brand_id);
        const product = brand?.products.find(p => p.sku === data.sku);
        if (!flavors.length && product) flavors = [...(product[flavorKey] || [])];

        if (action === 'add_flavor') flavors.push(data.flavor);
        else if (action === 'remove_flavor') flavors = flavors.filter(f => f.replace(' — SOLD OUT', '') !== data.flavor.replace(' — SOLD OUT', ''));
        else if (action === 'toggle_flavor_soldout') {
          flavors = flavors.map(f => {
            const clean = f.replace(' — SOLD OUT', '');
            if (clean === data.flavor.replace(' — SOLD OUT', '')) return data.sold_out ? clean + ' — SOLD OUT' : clean;
            return f;
          });
        }

        const { error } = await supabase.from('product_content').upsert({
          brand_id: data.brand_id, sku: data.sku,
          [flavorKey]: JSON.stringify(flavors),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'sku' });
        if (error) throw new Error(error.message);
        break;
      }

      case 'generate_email': {
        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
        await fetch(`${supabaseUrl}/functions/v1/marketing-agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseKey}` },
          body: JSON.stringify({ brand_id: data.brand_id || null, audience: data.audience || 'both' }),
        });
        break;
      }

      case 'hide_brand':
      case 'show_brand': {
        const { data: settings } = await supabase.from('site_settings').select('value').eq('key', 'hidden_brands').single();
        let hidden = settings?.value ? JSON.parse(settings.value) : [];
        if (action === 'hide_brand') hidden = [...new Set([...hidden, data.brand_id])];
        else hidden = hidden.filter(id => id !== data.brand_id);
        const { error } = await supabase.from('site_settings').upsert({ key: 'hidden_brands', value: JSON.stringify(hidden) }, { onConflict: 'key' });
        if (error) throw new Error(error.message);
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  };

  const msgStyle = (role) => ({
    display: 'flex',
    justifyContent: role === 'user' ? 'flex-end' : 'flex-start',
    marginBottom: 10,
  });

  const bubbleStyle = (role) => ({
    maxWidth: '80%',
    padding: '10px 14px',
    borderRadius: role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
    background: role === 'user' ? '#1A1A1A' : '#F8F6F3',
    color: role === 'user' ? '#FFF' : '#1A1A1A',
    fontSize: 13,
    lineHeight: 1.5,
    border: role === 'user' ? 'none' : '0.5px solid #E0DDD8',
    whiteSpace: 'pre-wrap',
  });

  const canSend = (input.trim() || attachment) && !loading && !uploading;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.csv,.txt,.json"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      <button onClick={() => setOpen(o => !o)}
        style={{ position: 'fixed', bottom: 24, right: 24, width: 52, height: 52, borderRadius: '50%', background: '#1A1A1A', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 999, transition: 'all 0.2s' }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
        {open ? '×' : '✦'}
      </button>

      {open && (
        <div style={{ position: 'fixed', bottom: 88, right: 24, width: 380, height: 520, background: '#FFF', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.15)', border: '0.5px solid #E0DDD8', display: 'flex', flexDirection: 'column', zIndex: 998, overflow: 'hidden' }}>
          <div style={{ background: '#1A1A1A', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4CAF7D' }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: '#FFF', letterSpacing: '0.04em' }}>Admin Assistant</div>
            <div style={{ fontSize: 11, color: '#888', marginLeft: 'auto' }}>Powered by Claude</div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', scrollbarWidth: 'none' }}>
            {messages.map((msg, i) => (
              <div key={i} style={msgStyle(msg.role)}>
                {msg.isConfirm ? (
                  <div style={{ maxWidth: '95%' }}>
                    <div style={{ ...bubbleStyle('assistant'), marginBottom: 8 }}>{msg.text}</div>
                    {pending && hasVisualPreview(pending.action) && (
                      <DesignPreview action={pending.action} data={pending.data} />
                    )}
                    {pending && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        {pending.action === 'generate_media' ? (
                          <button onClick={handleConfirm} style={{ flex: 1, background: '#4CAF7D', color: '#FFF', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Generate render</button>
                        ) : pending.action === 'apply_generated_media' && pending.data?.apply_to ? (
                          <button onClick={handleConfirm} style={{ flex: 1, background: '#4CAF7D', color: '#FFF', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Apply to site</button>
                        ) : !msg.showGeneratedOnly ? (
                          <button onClick={handleConfirm} style={{ flex: 1, background: '#4CAF7D', color: '#FFF', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Yes, do it</button>
                        ) : null}
                        {(pending.action !== 'apply_generated_media' || pending.data?.apply_to) && !msg.showGeneratedOnly && (
                          <button onClick={handleCancel} style={{ flex: 1, background: '#F8F6F3', color: '#555', border: '0.5px solid #E0DDD8', borderRadius: 8, padding: '8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✗ Cancel</button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={bubbleStyle(msg.role)}>{msg.text}</div>
                )}
              </div>
            ))}
            {(loading || uploading || generating) && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
                <div style={{ ...bubbleStyle('assistant'), color: '#AAA' }}>
                  {generating ? 'generating HD render (1–3 min)…' : uploading ? 'uploading & analyzing...' : 'thinking...'}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {attachment && (
            <div style={{ padding: '6px 12px', borderTop: '0.5px solid #F0EDE8', display: 'flex', alignItems: 'center', gap: 8, background: '#FAFAF8' }}>
              {isImageFile(attachment.file) && (
                <img src={attachment.record.file_url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />
              )}
              <span style={{ fontSize: 11, color: '#666', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.file.name}</span>
              <button onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#AAA', fontSize: 14 }}>×</button>
            </div>
          )}

          <div style={{ padding: '0.75rem', borderTop: '0.5px solid #F0EDE8', display: 'flex', gap: 8 }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || uploading}
              title="Attach image or document"
              style={{ width: 36, height: 36, background: '#F8F6F3', border: '0.5px solid #E0DDD8', borderRadius: 10, cursor: loading || uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
              📎
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask me to update anything..."
              style={{ flex: 1, background: '#F8F6F3', border: '0.5px solid #E0DDD8', borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', color: '#1A1A1A' }}
              disabled={loading || uploading}
            />
            <button onClick={handleSend} disabled={!canSend}
              style={{ width: 36, height: 36, background: canSend ? '#1A1A1A' : '#E0DDD8', border: 'none', borderRadius: 10, cursor: canSend ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#FFF', transition: 'all 0.15s', flexShrink: 0 }}>
              →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
