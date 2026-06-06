import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ContentEditor from './ContentEditor';
import ContactMap from './ContactMap';
import BrandManager from './BrandManager';
import UserManager from './UserManager';

export default function AdminDashboard({ onLogout, onViewPortal }) {
  const [tab, setTab] = useState('overview');
  const [brandOverrides, setBrandOverrides] = useState({});
  const [productOverrides, setProductOverrides] = useState({});

  const loadContentOverrides = async () => {
    const [{ data: brands }, { data: products }] = await Promise.all([
      supabase.from('brand_content').select('*'),
      supabase.from('product_content').select('*'),
    ]);
    if (brands) { const m = {}; brands.forEach(b => { m[b.brand_id] = b; }); setBrandOverrides(m); }
    if (products) { const m = {}; products.forEach(p => { m[p.sku] = p; }); setProductOverrides(m); }
  };
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0, thisHour: 0 });
  const [requests, setRequests] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [topPages, setTopPages] = useState([]);
  const [topClicks, setTopClicks] = useState([]);
  const [avgTimes, setAvgTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);

  useEffect(() => { loadAll(); loadContentOverrides(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadStats(), loadRequests(), loadInquiries(), loadTopPages(), loadTopClicks(), loadAvgTimes()]);
    setLoading(false);
  };

  const loadStats = async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now - 7 * 86400000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const hourAgo = new Date(now - 3600000).toISOString();
    const twoHoursAgo = new Date(now - 7200000).toISOString();
    const [t, w, m, h, ph] = await Promise.all([
      supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view').gte('created_at', todayStart),
      supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view').gte('created_at', weekStart),
      supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view').gte('created_at', monthStart),
      supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view').gte('created_at', hourAgo),
      supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view').gte('created_at', twoHoursAgo).lt('created_at', hourAgo),
    ]);
    const thisHour = h.count || 0;
    const lastHour = ph.count || 0;
    if (lastHour > 0 && thisHour > lastHour * 1.5) setAlert(`Traffic spike! ${thisHour} visits this hour vs ${lastHour} last hour.`);
    setStats({ today: t.count || 0, week: w.count || 0, month: m.count || 0, thisHour });
  };

  const loadTopPages = async () => {
    const { data } = await supabase.from('analytics_events').select('page').eq('event_type', 'page_view').limit(500);
    if (!data) return;
    const counts = {};
    data.forEach(r => { counts[r.page] = (counts[r.page] || 0) + 1; });
    setTopPages(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10));
  };

  const loadTopClicks = async () => {
    const { data } = await supabase.from('analytics_events').select('element').eq('event_type', 'click').limit(500);
    if (!data) return;
    const counts = {};
    data.forEach(r => { if (r.element) counts[r.element] = (counts[r.element] || 0) + 1; });
    setTopClicks(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15));
  };

  const loadAvgTimes = async () => {
    const { data } = await supabase.from('analytics_events').select('page, value').eq('event_type', 'time_on_page').limit(500);
    if (!data) return;
    const times = {}; const cnts = {};
    data.forEach(r => { if (!r.value) return; times[r.page] = (times[r.page] || 0) + r.value; cnts[r.page] = (cnts[r.page] || 0) + 1; });
    setAvgTimes(Object.entries(times).map(([p, t]) => [p, Math.round(t / cnts[p])]).sort((a, b) => b[1] - a[1]));
  };

  const loadRequests = async () => {
    const { data } = await supabase.from('access_requests').select('*').order('created_at', { ascending: false }).limit(50);
    setRequests(data || []);
  };

  const loadInquiries = async () => {
    const { data } = await supabase.from('inquiries').select('*').order('created_at', { ascending: false }).limit(50);
    setInquiries(data || []);
  };

  const handleApprove = async (req) => {
    const tempPass = Math.random().toString(36).slice(2, 10);
    const msg = encodeURIComponent(`Hi ${req.name}! Your Global Access portal account is approved.\n\nURL: ${window.location.origin}\nEmail: ${req.email}\nTemp password: ${tempPass}\n\nPlease log in and change your password!`);
    window.open(`https://wa.me/${req.phone ? req.phone.replace(/\D/g, '') : ''}?text=${msg}`, '_blank');
    await supabase.from('access_requests').update({ status: 'approved' }).eq('id', req.id);
    loadRequests();
  };

  const handleDeny = async (req) => {
    await supabase.from('access_requests').update({ status: 'denied' }).eq('id', req.id);
    loadRequests();
  };

  const pending = requests.filter(r => r.status === 'pending');
  const card = { background: '#FFF', border: '0.5px solid #E8E4DF', borderRadius: 12, padding: '1.25rem' };
  const tabBtn = (t) => ({ background: tab === t ? '#1A1A1A' : 'none', color: tab === t ? '#FFF' : '#888', border: `0.5px solid ${tab === t ? '#1A1A1A' : '#E0DDD8'}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: tab === t ? 600 : 400 });

  return (
    <div style={{ minHeight: '100vh', background: '#F5F2ED', fontFamily: "'DM Sans', sans-serif", color: '#1A1A1A' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Bebas+Neue&display=swap" rel="stylesheet" />
      <div style={{ background: '#FFF', borderBottom: '0.5px solid #E0DDD8', padding: '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.1em' }}>Global Access <span style={{ fontSize: 13, color: '#C9A84C' }}>Admin</span></div>
        <button onClick={onViewPortal} style={{ background: "#C9A84C", color: "#1A1A1A", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>View Portal</button><button onClick={onLogout} style={{ background: "none", border: "0.5px solid #E0DDD8", borderRadius: 6, padding: "5px 12px", fontSize: 12, color: "#AAA", cursor: "pointer", fontFamily: "inherit" }}>Sign out</button>
      </div>
      {alert && <div style={{ background: '#FEF3C7', border: '0.5px solid #FCD34D', padding: '12px 1.5rem', fontSize: 13, color: '#92400E', display: 'flex', justifyContent: 'space-between' }}>{alert}<button onClick={() => setAlert(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#92400E' }}>×</button></div>}
      <div style={{ padding: '1.5rem', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {['overview','pages','clicks','requests','inquiries','content','users','map','brands'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={tabBtn(t)}>{t === 'requests' && pending.length > 0 ? `Requests (${pending.length})` : t.charAt(0).toUpperCase() + t.slice(1)}</button>
          ))}
          <button onClick={loadAll} style={{ ...tabBtn(''), marginLeft: 'auto' }}>↻ Refresh</button>
        </div>
        {loading && <div style={{ color: '#AAA', fontSize: 13 }}>Loading...</div>}
        {!loading && tab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: '1.5rem' }}>
              {[['Today', stats.today, 'page views'],['This week', stats.week, 'page views'],['This month', stats.month, 'page views'],['Last hour', stats.thisHour, 'page views'],['Pending', pending.length, 'access requests'],['Inquiries', inquiries.length, 'total submitted']].map(([label, val, sub]) => (
                <div key={label} style={{ background: '#FFF', border: '0.5px solid #E8E4DF', borderRadius: 12, padding: '1rem' }}>
                  <div style={{ fontSize: 11, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 500, color: '#1A1A1A', lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 12, color: '#BBB', marginTop: 4 }}>{sub}</div>
                </div>
              ))}
            </div>
            <div style={card}>
              <div style={{ fontSize: 12, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Recent inquiries</div>
              {inquiries.slice(0, 5).map(inq => (
                <div key={inq.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid #F0EDE8', fontSize: 13 }}>
                  <div><div style={{ fontWeight: 500 }}>{inq.name} — {inq.company}</div><div style={{ color: '#AAA', fontSize: 12, marginTop: 2 }}>{(inq.interests || []).length} items</div></div>
                  <div style={{ fontSize: 11, color: '#BBB' }}>{new Date(inq.created_at).toLocaleDateString()}</div>
                </div>
              ))}
              {inquiries.length === 0 && <div style={{ fontSize: 13, color: '#CCC' }}>No inquiries yet.</div>}
            </div>
          </div>
        )}
        {!loading && tab === 'pages' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={card}>
              <div style={{ fontSize: 12, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Top pages by views</div>
              {topPages.map(([page, count]) => (<div key={page} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid #F0EDE8', fontSize: 13 }}><span>{page}</span><span style={{ fontWeight: 500, color: '#C9A84C' }}>{count}</span></div>))}
              {topPages.length === 0 && <div style={{ fontSize: 13, color: '#CCC' }}>No data yet.</div>}
            </div>
            <div style={card}>
              <div style={{ fontSize: 12, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Average time on page (seconds)</div>
              {avgTimes.map(([page, avg]) => (<div key={page} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid #F0EDE8', fontSize: 13 }}><span>{page}</span><span style={{ fontWeight: 500, color: '#4CAF7D' }}>{avg}s</span></div>))}
              {avgTimes.length === 0 && <div style={{ fontSize: 13, color: '#CCC' }}>No data yet.</div>}
            </div>
          </div>
        )}
        {!loading && tab === 'clicks' && (
          <div style={card}>
            <div style={{ fontSize: 12, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Top clicked elements</div>
            {topClicks.map(([element, count]) => { const max = topClicks[0]?.[1] || 1; return (
              <div key={element} style={{ padding: '10px 0', borderBottom: '0.5px solid #F0EDE8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 13 }}>{element}</span><span style={{ fontSize: 13, fontWeight: 500 }}>{count}</span></div>
                <div style={{ height: 4, background: '#F0EDE8', borderRadius: 2 }}><div style={{ height: '100%', width: `${(count / max) * 100}%`, background: '#C9A84C', borderRadius: 2 }} /></div>
              </div>
            ); })}
            {topClicks.length === 0 && <div style={{ fontSize: 13, color: '#CCC' }}>No data yet.</div>}
          </div>
        )}
        {!loading && tab === 'requests' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.length === 0 && <div style={{ fontSize: 13, color: '#AAA' }}>No access requests yet.</div>}
            {requests.map(req => (
              <div key={req.id} style={{ ...card, borderLeft: `3px solid ${req.status === 'pending' ? '#C9A84C' : req.status === 'approved' ? '#4CAF7D' : '#E05A5A'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div><div style={{ fontWeight: 500, fontSize: 15 }}>{req.name} — {req.company}</div><div style={{ fontSize: 12, color: '#AAA', marginTop: 2 }}>{req.email} · {req.phone}</div></div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: req.status === 'pending' ? '#FDF6E3' : req.status === 'approved' ? '#F0FAF4' : '#FEF0F0', color: req.status === 'pending' ? '#A07A20' : req.status === 'approved' ? '#2D7A50' : '#C53030', fontWeight: 500, textTransform: 'uppercase' }}>{req.status}</span>
                    {req.status === 'pending' && <>
                      <button onClick={() => handleApprove(req)} style={{ background: '#4CAF7D', color: '#FFF', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>Approve</button>
                      <button onClick={() => handleDeny(req)} style={{ background: '#E05A5A', color: '#FFF', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>Deny</button>
                    </>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && tab === 'inquiries' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {inquiries.length === 0 && <div style={{ fontSize: 13, color: '#AAA' }}>No inquiries yet.</div>}
            {inquiries.map(inq => (
              <div key={inq.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap' }}>
                  <div><div style={{ fontWeight: 500, fontSize: 15 }}>{inq.name} — {inq.company}</div><div style={{ fontSize: 12, color: '#AAA', marginTop: 2 }}>{inq.phone || '—'} · {inq.email || '—'}</div></div>
                  <div style={{ fontSize: 11, color: '#BBB' }}>{new Date(inq.created_at).toLocaleString()}</div>
                </div>
                {(inq.interests || []).map(i => (<div key={i.key} style={{ fontSize: 12, color: '#555', padding: '4px 0', borderBottom: '0.5px solid #F5F2ED' }}>{i.brandName} — {i.productName} · {i.flavor}</div>))}
                {inq.notes && <div style={{ fontSize: 12, color: '#888', background: '#F8F6F3', borderRadius: 6, padding: '8px 10px', marginTop: 8 }}>"{inq.notes}"</div>}
              </div>
            ))}
          </div>
        )}
      {!loading && tab === 'content' && (
        <ContentEditor
          brandOverrides={brandOverrides}
          productOverrides={productOverrides}
          onSaved={loadContentOverrides}
        />
      )}
      {!loading && tab === 'users' && (
        <UserManager />
      )}
      {tab === 'map' && (
        <ContactMap />
      )}
      {tab === 'brands' && (
        <BrandManager onSaved={loadContentOverrides} />
      )}
      </div>
    </div>
  );
}

