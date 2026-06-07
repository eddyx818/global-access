import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { getAdminUi } from '../lib/theme';

const BRANDS = [
  { id: 'churros-locos', name: 'Churros Locos', color: '#F5943A' },
  { id: 'goldwhip', name: 'GoldWhip', color: '#C9A84C' },
  { id: 'luxgas', name: 'LuxGas', color: '#2C2C2C' },
  { id: 'sokka', name: 'Sokka', color: '#9B59B6' },
  { id: 'numbz', name: 'numbz', color: '#4CAF7D' },
  { id: 'rise', name: 'Rise', color: '#E85D4A' },
  { id: 'blizzy', name: 'Blizzy', color: '#7B6CF6' },
  { id: 'good-spirits', name: 'Good Spirits', color: '#C0392B' },
];

export default function MarketingDashboard({ isMobile = false }) {
  const { t } = useTheme();
  const ui = getAdminUi();
  const [drafts, setDrafts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(null);
  const [preview, setPreview] = useState(null);
  const [genForm, setGenForm] = useState({ brand_id: '', audience: 'both' });
  const [subjectChoice, setSubjectChoice] = useState('a');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: d }, { data: c }] = await Promise.all([
      supabase.from('email_drafts').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('email_campaigns').select('*').order('sent_at', { ascending: false }).limit(10),
    ]);
    setDrafts(d || []);
    setCampaigns(c || []);
    setLoading(false);
  };

  const handleGenerate = async () => {
    setGenerating(true); setError('');
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/marketing-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ brand_id: genForm.brand_id || null, audience: genForm.audience }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSaved(`Draft created for ${data.brand || 'brand'}! Check below to review.`);
      setTimeout(() => setSaved(''), 4000);
      loadData();
    } catch (err) {
      setError(`Error: ${err.message || JSON.stringify(err)}`);
    }
    setGenerating(false);
  };

  const handleApprove = async (draft) => {
    setSending(draft.id); setError('');
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ draft_id: draft.id, subject_choice: subjectChoice, audience: draft.audience }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSaved(`Sent to ${data.sent} contacts! Subject: "${data.subject}"`);
      setTimeout(() => setSaved(''), 5000);
      setPreview(null);
      loadData();
    } catch (err) {
      setError('Send failed. Check Resend API key in Vercel env vars.');
    }
    setSending(null);
  };

  const handleDiscard = async (draftId) => {
    await supabase.from('email_drafts').update({ status: 'discarded' }).eq('id', draftId);
    setPreview(null);
    loadData();
  };

  const pendingDrafts = drafts.filter(d => d.status === 'pending');
  const sentDrafts = drafts.filter(d => d.status === 'sent');

  const card = {
    ...ui.card,
    marginBottom: isMobile ? 16 : 12,
    padding: isMobile ? '1.5rem' : '1.25rem',
  };
  const inputStyle = {
    ...ui.input,
    minHeight: 50,
    fontSize: 16,
    borderRadius: 10,
    padding: '12px 14px',
  };
  const labelStyle = {
    fontSize: 11,
    color: t.textFaint,
    display: 'block',
    marginBottom: 8,
    letterSpacing: '0.08em',
    lineHeight: 1.25,
    textTransform: 'uppercase',
  };
  const metricCards = [
    ['Pending Review', pendingDrafts.length, '#C9A84C'],
    ['Sent Campaigns', sentDrafts.length, '#4CAF7D'],
    ['Total Reached', campaigns.reduce((s, c) => s + (c.sent_count || 0), 0), '#7B6CF6'],
  ];

  return (
    <div>
      {saved && <div style={{ background: '#F0FAF4', border: '0.5px solid #C6EDD7', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#2D7A50', marginBottom: 16 }}>{saved}</div>}
      {error && <div style={{ background: '#FEF0F0', border: '0.5px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#C53030', marginBottom: 16 }}>{error}<button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C53030', marginLeft: 8, fontFamily: 'inherit' }}>×</button></div>}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fit, minmax(96px, 1fr))' : 'repeat(auto-fit, minmax(130px, 1fr))', gap: isMobile ? 10 : 12, marginBottom: isMobile ? '1.75rem' : '1.5rem' }}>
        {metricCards.map(([label, val, color]) => (
          <div key={label} style={{ ...ui.statCard, padding: isMobile ? '14px 12px' : '1rem', minHeight: isMobile ? 86 : undefined }}>
            <div style={{ fontSize: isMobile ? 10 : 11, color: t.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, lineHeight: 1.25 }}>{label}</div>
            <div style={{ fontSize: isMobile ? 30 : 28, fontWeight: 500, color, lineHeight: 1 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Generate new draft */}
      <div style={card}>
        <div style={{ fontSize: 12, color: t.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: isMobile ? 18 : 14, fontWeight: 600 }}>Generate New Email Draft</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 14 : 10, marginBottom: isMobile ? 18 : 14 }}>
          <div>
            <label style={labelStyle}>Feature Brand (or leave blank for auto)</label>
            <select value={genForm.brand_id} onChange={e => setGenForm(f => ({ ...f, brand_id: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">Auto-select next brand</option>
              {BRANDS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Send To</label>
            <select value={genForm.audience} onChange={e => setGenForm(f => ({ ...f, audience: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="both">All contacts</option>
              <option value="distributor">Distributors only</option>
              <option value="retailer">Retailers only</option>
            </select>
          </div>
        </div>
        <button onClick={handleGenerate} disabled={generating}
          style={{ width: '100%', background: generating ? t.bgSubtle : t.btnPrimaryBg, color: generating ? t.textDisabled : t.btnPrimaryText, border: 'none', borderRadius: 12, padding: isMobile ? '15px 14px' : '13px', fontSize: 13, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {generating ? '✦ Claude is writing your email...' : '✦ Generate AI Email Draft'}
        </button>
        <div style={{ fontSize: 12, color: t.textMuted, textAlign: 'center', margin: '10px auto 0', maxWidth: 300, lineHeight: 1.35 }}>Claude will write professional copy — you review before anything is sent</div>
      </div>

      {/* Pending drafts */}
      {pendingDrafts.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: '#C9A84C', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>⏳ Awaiting Your Approval ({pendingDrafts.length})</div>
          {pendingDrafts.map(draft => (
            <div key={draft.id} style={{ ...card, borderLeft: '3px solid #C9A84C' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{draft.brand_name}</div>
                  <div style={{ fontSize: 12, color: '#AAA' }}>{new Date(draft.created_at).toLocaleString()} · {draft.audience}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setPreview(preview?.id === draft.id ? null : draft)}
                    style={{ background: '#F8F6F3', border: '0.5px solid #E0DDD8', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#555' }}>
                    {preview?.id === draft.id ? 'Hide Preview' : 'Preview'}
                  </button>
                  <button onClick={() => handleDiscard(draft.id)}
                    style={{ background: '#FEF0F0', border: '0.5px solid #FECACA', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#C53030' }}>
                    Discard
                  </button>
                </div>
              </div>

              {/* Subject lines */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#AAA', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Choose Subject Line:</div>
                {[['a', draft.subject_a], ['b', draft.subject_b]].map(([key, subj]) => (
                  <div key={key} onClick={() => setSubjectChoice(key)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `0.5px solid ${subjectChoice === key ? '#C9A84C' : '#E0DDD8'}`, background: subjectChoice === key ? 'rgba(201,168,76,0.08)' : '#F8F6F3', cursor: 'pointer', marginBottom: 6 }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${subjectChoice === key ? '#C9A84C' : '#DDD'}`, background: subjectChoice === key ? '#C9A84C' : 'transparent', flexShrink: 0 }} />
                    <div>
                      <span style={{ fontSize: 10, color: '#C9A84C', fontWeight: 700, marginRight: 8, textTransform: 'uppercase' }}>Option {key.toUpperCase()}</span>
                      <span style={{ fontSize: 13, color: '#333' }}>{subj}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Approve button */}
              <button onClick={() => handleApprove(draft)} disabled={sending === draft.id}
                style={{ width: '100%', background: sending === draft.id ? '#E0DDD8' : '#4CAF7D', color: sending === draft.id ? '#AAA' : '#FFF', border: 'none', borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 700, cursor: sending === draft.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {sending === draft.id ? 'Sending...' : '✓ Approve & Send →'}
              </button>

              {/* Preview */}
              {preview?.id === draft.id && (
                <div style={{ marginTop: 16, border: '0.5px solid #E0DDD8', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ background: '#F8F6F3', padding: '8px 14px', fontSize: 11, color: '#AAA', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Email Preview</div>
                  <iframe srcDoc={draft.html_content} style={{ width: '100%', height: 600, border: 'none' }} title="Email preview" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sent campaigns */}
      {sentDrafts.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12, fontWeight: 500 }}>Sent Campaigns</div>
          {sentDrafts.map(draft => (
            <div key={draft.id} style={{ ...card, opacity: 0.7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{draft.brand_name}</div>
                  <div style={{ fontSize: 12, color: '#AAA', marginTop: 2 }}>{draft.subject_used || draft.subject_a}</div>
                  <div style={{ fontSize: 11, color: '#CCC', marginTop: 2 }}>{new Date(draft.sent_at || draft.created_at).toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#4CAF7D' }}>{draft.sent_count || 0} sent</div>
                  <div style={{ fontSize: 10, color: '#CCC', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{draft.audience}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && drafts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', fontSize: 13, color: '#CCC' }}>
          No drafts yet. Generate your first AI email above!
        </div>
      )}
    </div>
  );
}
