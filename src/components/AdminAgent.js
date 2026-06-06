import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BRANDS } from '../lib/data';
 
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
- null: Just answer the question, no action needed
 
Brands available: ${BRANDS.map(b => `${b.id} (${b.name})`).join(', ')}
 
Always be helpful, professional, and confirm before making changes. If the user's request is unclear, ask for clarification.`;
 
export default function AdminAgent() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm your Global Access admin assistant. I can update brand content, manage flavors, generate marketing emails, and more. What would you like to do?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(null); // pending action waiting for confirmation
  const messagesEndRef = useRef(null);
 
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
 
  const addMessage = (role, text, extra = {}) => {
    setMessages(prev => [...prev, { role, text, ...extra }]);
  };
 
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');
    addMessage('user', userMessage);
    setLoading(true);
 
    try {
      // Build conversation history for Claude
      const history = messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.text
      }));
      history.push({ role: 'user', content: userMessage });
 
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: history,
        }),
      });
 
      const data = await res.json();
      const rawText = data.content?.[0]?.text || '{}';
 
      let parsed;
      try {
        parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      } catch {
        parsed = { message: rawText, action: null };
      }
 
      addMessage('assistant', parsed.message);
 
      if (parsed.action && parsed.action !== 'null') {
        setPending(parsed);
        addMessage('assistant', `**Preview:** ${parsed.preview}\n\nShall I go ahead with this change?`, { isConfirm: true });
      }
 
    } catch (err) {
      addMessage('assistant', `Sorry, I ran into an error: ${err.message}`);
    }
    setLoading(false);
  };
 
  const handleConfirm = async () => {
    if (!pending) return;
    setLoading(true);
    setPending(null);
 
    try {
      await executeAction(pending.action, pending.data);
      addMessage('assistant', '✅ Done! The change has been saved and is live on the site.');
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
    switch (action) {
      case 'update_brand_content':
        await supabase.from('brand_content').upsert({
          brand_id: data.brand_id,
          ...(data.tagline && { tagline: data.tagline }),
          ...(data.description && { description: data.description }),
          ...(data.color && { color: data.color }),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'brand_id' });
        break;
 
      case 'update_product_content': {
        const payload = { brand_id: data.brand_id, sku: data.sku, updated_at: new Date().toISOString() };
        if (data.name) payload.name = data.name;
        if (data.detail) payload.detail = data.detail;
        if (data.flavors_retail) payload.flavors_retail = JSON.stringify(data.flavors_retail);
        if (data.flavors_distro) payload.flavors_distro = JSON.stringify(data.flavors_distro);
        await supabase.from('product_content').upsert(payload, { onConflict: 'sku' });
        break;
      }
 
      case 'toggle_flavor_soldout':
      case 'add_flavor':
      case 'remove_flavor': {
        // Get current flavors
        const { data: existing } = await supabase.from('product_content').select('*').eq('sku', data.sku).single();
        const flavorKey = data.flavor_type === 'retail' ? 'flavors_retail' : 'flavors_distro';
        let flavors = existing?.[flavorKey] ? JSON.parse(existing[flavorKey]) : [];
        const brand = BRANDS.find(b => b.id === data.brand_id);
        const product = brand?.products.find(p => p.sku === data.sku);
        if (!flavors.length && product) flavors = [...(product[flavorKey] || [])];
 
        if (action === 'add_flavor') {
          flavors.push(data.flavor);
        } else if (action === 'remove_flavor') {
          flavors = flavors.filter(f => f.replace(' — SOLD OUT', '') !== data.flavor.replace(' — SOLD OUT', ''));
        } else if (action === 'toggle_flavor_soldout') {
          flavors = flavors.map(f => {
            const clean = f.replace(' — SOLD OUT', '');
            if (clean === data.flavor.replace(' — SOLD OUT', '')) {
              return data.sold_out ? clean + ' — SOLD OUT' : clean;
            }
            return f;
          });
        }
 
        await supabase.from('product_content').upsert({
          brand_id: data.brand_id, sku: data.sku,
          [flavorKey]: JSON.stringify(flavors),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'sku' });
        break;
      }
 
      case 'generate_email': {
        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
        await fetch(`${supabaseUrl}/functions/v1/marketing-agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
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
        await supabase.from('site_settings').upsert({ key: 'hidden_brands', value: JSON.stringify(hidden) }, { onConflict: 'key' });
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
 
  return (
    <>
      {/* Chat bubble button */}
      <button onClick={() => setOpen(o => !o)}
        style={{ position: 'fixed', bottom: 24, right: 24, width: 52, height: 52, borderRadius: '50%', background: '#1A1A1A', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 999, transition: 'all 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
        {open ? '×' : '✦'}
      </button>
 
      {/* Chat window */}
      {open && (
        <div style={{ position: 'fixed', bottom: 88, right: 24, width: 380, height: 520, background: '#FFF', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.15)', border: '0.5px solid #E0DDD8', display: 'flex', flexDirection: 'column', zIndex: 998, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ background: '#1A1A1A', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4CAF7D' }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: '#FFF', letterSpacing: '0.04em' }}>Admin Assistant</div>
            <div style={{ fontSize: 11, color: '#888', marginLeft: 'auto' }}>Powered by Claude</div>
          </div>
 
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', scrollbarWidth: 'none' }}>
            {messages.map((msg, i) => (
              <div key={i} style={msgStyle(msg.role)}>
                {msg.isConfirm ? (
                  <div style={{ maxWidth: '90%' }}>
                    <div style={{ ...bubbleStyle('assistant'), marginBottom: 8 }}>{msg.text}</div>
                    {pending && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={handleConfirm} style={{ flex: 1, background: '#4CAF7D', color: '#FFF', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Yes, do it</button>
                        <button onClick={handleCancel} style={{ flex: 1, background: '#F8F6F3', color: '#555', border: '0.5px solid #E0DDD8', borderRadius: 8, padding: '8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✗ Cancel</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={bubbleStyle(msg.role)}>{msg.text}</div>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
                <div style={{ ...bubbleStyle('assistant'), color: '#AAA' }}>thinking...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
 
          {/* Input */}
          <div style={{ padding: '0.75rem', borderTop: '0.5px solid #F0EDE8', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask me to update anything..."
              style={{ flex: 1, background: '#F8F6F3', border: '0.5px solid #E0DDD8', borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit', color: '#1A1A1A' }}
              disabled={loading}
            />
            <button onClick={handleSend} disabled={loading || !input.trim()}
              style={{ width: 36, height: 36, background: input.trim() ? '#1A1A1A' : '#E0DDD8', border: 'none', borderRadius: 10, cursor: input.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#FFF', transition: 'all 0.15s', flexShrink: 0 }}>
              →
            </button>
          </div>
        </div>
      )}
    </>
  );
}