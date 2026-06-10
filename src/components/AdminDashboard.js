import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ContentEditor from './ContentEditor';
import ContactMap from './ContactMap';
import BrandManager from './BrandManager';
import MarketingDashboard from './MarketingDashboard';
import AdminAgent from './AdminAgent';
import UserManager from './UserManager';
import ActivityFeed from './ActivityFeed';
import CustomerDirectory from './CustomerDirectory';
import ContactImportPanel from './ContactImportPanel';
import ReferralTracker from './ReferralTracker';
import QuoteStatusBadge from './QuoteStatusBadge';
import QuoteBuilderPanel from './QuoteBuilderPanel';
import AdminTabBar from './AdminTabBar';
import { useTheme } from '../context/ThemeContext';
import { getAdminUi } from '../lib/theme';
import { approveAccessRequestAndCreateAccount, denyAccessRequest, deleteAccessRequest, setAccessRequestDismissed } from '../lib/accessApproval';
import { whatsAppUrl } from '../lib/whatsapp';
import { updateInquiryQuoteStatus, QUOTE_STATUSES, deleteInquiry, parseInquiryInterests } from '../lib/inquiries';
import { loadAppNavigation, saveAppNavigationPartial, normalizeAdminTab } from '../lib/appNavigation';
import IndustryFactsPanel from './IndustryFactsPanel';
import DashboardProfilePanel from './DashboardProfilePanel';

export default function AdminDashboard({ user, onLogout, onViewPortal, onOpenMessages, messagesUnread = 0 }) {
  const { t } = useTheme();
  const ui = getAdminUi();
  const [tab, setTab] = useState(() => normalizeAdminTab(loadAppNavigation()?.adminTab));
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
  const [approvingId, setApprovingId] = useState(null);
  const [denyingId, setDenyingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [removingInquiryId, setRemovingInquiryId] = useState(null);
  const [dismissingId, setDismissingId] = useState(null);
  const [approveMsg, setApproveMsg] = useState('');
  const [requestActionMsg, setRequestActionMsg] = useState('');
  const [showDismissedRequests, setShowDismissedRequests] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

  useEffect(() => { loadAll(); loadContentOverrides(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'requests') loadRequests();
  }, [showDismissedRequests, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user?.id) saveAppNavigationPartial({ userId: user.id, adminTab: tab });
  }, [tab, user?.id]);

  useEffect(() => {
    let debounceTimer;
    const refresh = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { loadContentOverrides(); }, 250);
    };
    window.addEventListener('ga-content-updated', refresh);
    let bc;
    try {
      bc = new BroadcastChannel('ga-content-sync');
      bc.onmessage = (ev) => { if (ev.data?.type === 'content-updated') refresh(); };
    } catch (_) {}
    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('ga-content-updated', refresh);
      bc?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    const [tRes, w, m, h, ph] = await Promise.all([
      supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view').gte('created_at', todayStart),
      supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view').gte('created_at', weekStart),
      supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view').gte('created_at', monthStart),
      supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view').gte('created_at', hourAgo),
      supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view').gte('created_at', twoHoursAgo).lt('created_at', hourAgo),
    ]);
    const thisHour = h.count || 0;
    const lastHour = ph.count || 0;
    if (lastHour > 0 && thisHour > lastHour * 1.5) setAlert(`Traffic spike! ${thisHour} visits this hour vs ${lastHour} last hour.`);
    setStats({ today: tRes.count || 0, week: w.count || 0, month: m.count || 0, thisHour });
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
    setAvgTimes(Object.entries(times).map(([p, val]) => [p, Math.round(val / cnts[p])]).sort((a, b) => b[1] - a[1]));
  };

  const loadRequests = async () => {
    let query = supabase
      .from('access_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!showDismissedRequests) {
      query = query.is('dismissed_at', null);
    }
    const { data, error } = await query;
    if (error && error.message?.includes('dismissed_at')) {
      const { data: fallback } = await supabase
        .from('access_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      setRequests(fallback || []);
      return;
    }
    setRequests(data || []);
  };

  const loadInquiries = async () => {
    const { data } = await supabase.from('inquiries').select('*').order('created_at', { ascending: false }).limit(50);
    setInquiries(data || []);
  };

  const handleApprove = async (req) => {
    setApprovingId(req.id);
    setApproveMsg('');
    const result = await approveAccessRequestAndCreateAccount(req);
    setApprovingId(null);
    if (!result.ok) {
      setApproveMsg(result.error || 'Could not create account.');
      return;
    }
    const waUrl = req.phone ? whatsAppUrl(req.phone, result.whatsAppMessage) : null;
    if (waUrl) window.open(waUrl, '_blank');
    if (result.tempPassword) {
      setApproveMsg(`Account created for ${result.email}. Temp password: ${result.tempPassword}${result.welcomeEmailSent ? ' ? welcome email sent.' : result.welcomeEmailError ? ` (email failed: ${result.welcomeEmailError})` : ''}${req.phone ? ' WhatsApp opened if phone was on file.' : ''}`);
    } else {
      setApproveMsg(`Linked existing account for ${result.email}.${result.welcomeEmailSent ? ' Welcome email sent.' : result.welcomeEmailError ? ` Email failed: ${result.welcomeEmailError}` : ''}`);
    }
    loadRequests();
  };

  const handleInquiryStatus = async (inquiryId, status) => {
    setStatusUpdatingId(inquiryId);
    const result = await updateInquiryQuoteStatus(inquiryId, status);
    if (result.ok) {
      setInquiries(prev => prev.map(i => i.id === inquiryId ? { ...i, quote_status: status } : i));
    }
    setStatusUpdatingId(null);
  };

  const handleDeny = async (req) => {
    setDenyingId(req.id);
    setRequestActionMsg('');
    const result = await denyAccessRequest(req);
    setDenyingId(null);
    if (!result.ok) {
      setRequestActionMsg(result.error || 'Could not deny request.');
      return;
    }
    setRequestActionMsg(req.linked_user_id
      ? `Denied ${req.email} and revoked portal access.`
      : `Denied ${req.email}.`);
    loadRequests();
  };

  const handleDismiss = async (req) => {
    setDismissingId(req.id);
    setRequestActionMsg('');
    const result = await setAccessRequestDismissed(req.id, !req.dismissed_at);
    setDismissingId(null);
    if (!result.ok) {
      setRequestActionMsg(result.error || 'Could not update request.');
      return;
    }
    loadRequests();
  };

  const handleRemoveRequest = async (req) => {
    const label = req.email || req.name || 'this request';
    if (!window.confirm(`Remove access request for ${label}? This cannot be undone.`)) return;
    setRemovingId(req.id);
    setRequestActionMsg('');
    const result = await deleteAccessRequest(req.id);
    setRemovingId(null);
    if (!result.ok) {
      setRequestActionMsg(result.error || 'Could not remove request.');
      return;
    }
    loadRequests();
  };

  const handleRemoveInquiry = async (inq) => {
    const label = inq.company || inq.name || 'this quote';
    if (!window.confirm(`Remove quote request for ${label}? This cannot be undone.`)) return;
    setRemovingInquiryId(inq.id);
    const result = await deleteInquiry(inq.id);
    setRemovingInquiryId(null);
    if (!result.ok) {
      setRequestActionMsg(result.error || 'Could not remove quote.');
      return;
    }
    loadInquiries();
  };

  const pending = requests.filter(r => r.status === 'pending' && !r.dismissed_at);
  const [narrowHeader, setNarrowHeader] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = () => setNarrowHeader(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const portalBtnStyle = {
    background: t.gold,
    color: t.btnPrimaryText,
    border: 'none',
    borderRadius: 8,
    padding: narrowHeader ? '11px 12px' : '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    width: narrowHeader ? '100%' : undefined,
  };

  const signOutBtnStyle = {
    background: t.bgMuted,
    border: t.borderHairline,
    borderRadius: 8,
    padding: narrowHeader ? '11px 12px' : '6px 10px',
    fontSize: 12,
    color: t.textMuted,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    width: narrowHeader ? '100%' : undefined,
  };

  const statusStyle = (status) => ({
    fontSize: 11,
    padding: '3px 10px',
    borderRadius: 20,
    fontWeight: 500,
    textTransform: 'uppercase',
    background: status === 'pending' ? t.warningBg : status === 'approved' ? t.successBg : t.errorBg,
    color: status === 'pending' ? t.warningText : status === 'approved' ? t.successText : t.errorText,
  });

  const actionBtn = (bg, color = '#FFF') => ({
    background: bg,
    color,
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
  });

  return (
    <div className="app-no-select app-dashboard-shell" style={ui.page}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Bebas+Neue&display=swap" rel="stylesheet" />
      <div style={{
        ...ui.header,
        ...(narrowHeader ? {
          height: 'auto',
          minHeight: 0,
          flexDirection: 'column',
          alignItems: 'stretch',
          padding: 'max(10px, var(--ga-inset-top)) 1rem 14px',
          gap: 14,
        } : {}),
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: narrowHeader ? 28 : 22,
          letterSpacing: '0.1em',
          color: t.text,
          flexShrink: 0,
          lineHeight: 1,
          textAlign: narrowHeader ? 'center' : 'left',
        }}>
          Global Access{' '}
          <span style={{ fontSize: narrowHeader ? 15 : 13, color: t.gold, letterSpacing: '0.14em' }}>Admin</span>
        </div>
        {narrowHeader ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
            <button type="button" onClick={onViewPortal} style={portalBtnStyle}>Portal</button>
            <button type="button" onClick={onLogout} style={signOutBtnStyle}>Sign out</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {onOpenMessages && (
              <button type="button" onClick={onOpenMessages} style={portalBtnStyle}>
                Messages{messagesUnread > 0 ? ` (${messagesUnread})` : ''}
              </button>
            )}
            <button type="button" onClick={onViewPortal} style={portalBtnStyle}>Portal</button>
            <button type="button" onClick={onLogout} style={signOutBtnStyle}>Sign out</button>
          </div>
        )}
      </div>
      {alert && (
        <div style={{ background: t.warningBg, borderBottom: `0.5px solid ${t.warningBorder}`, padding: '12px 1.5rem', fontSize: 13, color: t.warningText, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          {alert}
          <button onClick={() => setAlert(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: t.warningText }}>?</button>
        </div>
      )}
      {approveMsg && (
        <div style={{ background: t.successBg, borderBottom: `0.5px solid ${t.successBorder}`, padding: '12px 1.5rem', fontSize: 13, color: t.successText, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          {approveMsg}
          <button onClick={() => setApproveMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: t.successText }}>?</button>
        </div>
      )}
      {requestActionMsg && (
        <div style={{ background: t.warningBg, borderBottom: `0.5px solid ${t.warningBorder}`, padding: '12px 1.5rem', fontSize: 13, color: t.warningText, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          {requestActionMsg}
          <button type="button" onClick={() => setRequestActionMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: t.warningText }}>?</button>
        </div>
      )}
      <div style={{ padding: narrowHeader ? '1rem' : '1.5rem', maxWidth: 960, margin: '0 auto', paddingBottom: narrowHeader ? 'max(1rem, var(--ga-inset-bottom))' : '1.5rem' }}>
        <AdminTabBar
          activeTab={tab}
          onTabChange={setTab}
          pendingCount={pending.length}
          onRefresh={loadAll}
        />
        {loading && <div style={{ color: t.textFaint, fontSize: 13 }}>Loading...</div>}
        {tab === 'profile' && (
          <DashboardProfilePanel user={user} isStaff />
        )}
        {!loading && tab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: '1.5rem' }}>
              {[['Today', stats.today, 'page views'],['This week', stats.week, 'page views'],['This month', stats.month, 'page views'],['Last hour', stats.thisHour, 'page views'],['Pending', pending.length, 'access requests'],['Inquiries', inquiries.length, 'total submitted']].map(([label, val, sub]) => (
                <div key={label} style={ui.statCard}>
                  <div style={{ fontSize: 11, color: t.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 500, color: t.text, lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 12, color: t.textDisabled, marginTop: 4 }}>{sub}</div>
                </div>
              ))}
            </div>
            <div style={ui.card}>
              <div style={ui.sectionLabel}>Recent inquiries</div>
              {inquiries.slice(0, 5).map(inq => (
                <div key={inq.id} style={ui.row}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{inq.name} ? {inq.company}</div>
                    <div style={{ color: t.textFaint, fontSize: 12, marginTop: 2 }}>{(inq.interests || []).length} items</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <QuoteStatusBadge status={inq.quote_status || 'new'} />
                    <div style={{ fontSize: 11, color: t.textDisabled }}>{new Date(inq.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
              {inquiries.length === 0 && <div style={{ fontSize: 13, color: t.textDisabled }}>No inquiries yet.</div>}
            </div>
          </div>
        )}
        {!loading && tab === 'contacts' && (
          <ContactImportPanel userId={user?.id} isAdmin defaultRepId={user?.id} />
        )}
        {!loading && tab === 'community' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={ui.card}>
              <div style={ui.sectionLabel}>Access code sign-ups</div>
              <ReferralTracker currentUserId={user?.id} isAdmin compact />
            </div>
            <div style={ui.card}>
              <div style={ui.sectionLabel}>Live activity feed</div>
              <ActivityFeed />
            </div>
            <div style={ui.card}>
              <div style={ui.sectionLabel}>Customer directory</div>
              <CustomerDirectory />
            </div>
          </div>
        )}
        {!loading && tab === 'pages' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={ui.card}>
              <div style={ui.sectionLabel}>Top pages by views</div>
              {topPages.map(([page, count]) => (
                <div key={page} style={ui.row}><span>{page}</span><span style={{ fontWeight: 500, color: t.gold }}>{count}</span></div>
              ))}
              {topPages.length === 0 && <div style={{ fontSize: 13, color: t.textDisabled }}>No data yet.</div>}
            </div>
            <div style={ui.card}>
              <div style={ui.sectionLabel}>Average time on page (seconds)</div>
              {avgTimes.map(([page, avg]) => (
                <div key={page} style={ui.row}><span>{page}</span><span style={{ fontWeight: 500, color: t.accent }}>{avg}s</span></div>
              ))}
              {avgTimes.length === 0 && <div style={{ fontSize: 13, color: t.textDisabled }}>No data yet.</div>}
            </div>
          </div>
        )}
        {!loading && tab === 'clicks' && (
          <div style={ui.card}>
            <div style={ui.sectionLabel}>Top clicked elements</div>
            {topClicks.map(([element, count]) => { const max = topClicks[0]?.[1] || 1; return (
              <div key={element} style={{ padding: '10px 0', borderBottom: `0.5px solid ${t.borderSubtle}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 13 }}>{element}</span><span style={{ fontSize: 13, fontWeight: 500 }}>{count}</span></div>
                <div style={{ height: 4, background: t.bgSubtle, borderRadius: 2 }}><div style={{ height: '100%', width: `${(count / max) * 100}%`, background: t.gold, borderRadius: 2 }} /></div>
              </div>
            ); })}
            {topClicks.length === 0 && <div style={{ fontSize: 13, color: t.textDisabled }}>No data yet.</div>}
          </div>
        )}
        {!loading && tab === 'requests' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 12, color: t.textFaint }}>
                {pending.length} pending ? {requests.length} shown
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.textMuted, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showDismissedRequests}
                  onChange={(e) => setShowDismissedRequests(e.target.checked)}
                />
                Show dismissed
              </label>
            </div>
            {requests.length === 0 && (
              <div style={{ fontSize: 13, color: t.textFaint }}>
                {showDismissedRequests ? 'No dismissed requests.' : 'No active access requests.'}
              </div>
            )}
            {requests.map(req => (
              <div
                key={req.id}
                style={{
                  ...ui.card,
                  position: 'relative',
                  opacity: req.dismissed_at ? 0.7 : 1,
                  borderLeft: `3px solid ${req.status === 'pending' ? t.gold : req.status === 'approved' ? t.accent : t.errorText}`,
                }}
              >
                <button
                  type="button"
                  aria-label="Remove request permanently"
                  title="Remove request permanently"
                  disabled={removingId === req.id || dismissingId === req.id}
                  onClick={() => handleRemoveRequest(req)}
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: t.borderHairline,
                    background: t.bgMuted,
                    color: t.textMuted,
                    fontSize: 18,
                    lineHeight: 1,
                    cursor: (removingId === req.id || dismissingId === req.id) ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  ?
                </button>
                {req.dismissed_at ? (
                  <button
                    type="button"
                    aria-label="Restore request"
                    title="Restore to list"
                    disabled={dismissingId === req.id || removingId === req.id}
                    onClick={() => handleDismiss(req)}
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 44,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: t.borderHairline,
                      background: t.bgMuted,
                      color: t.textFaint,
                      fontSize: 14,
                      lineHeight: 1,
                      cursor: dismissingId === req.id ? 'wait' : 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    ?
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Hide request"
                    title="Hide from list (keep on file)"
                    disabled={dismissingId === req.id || removingId === req.id}
                    onClick={() => handleDismiss(req)}
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 44,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: t.borderHairline,
                      background: t.bgMuted,
                      color: t.textFaint,
                      fontSize: 14,
                      lineHeight: 1,
                      cursor: dismissingId === req.id ? 'wait' : 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    ?
                  </button>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingRight: req.dismissed_at ? 36 : 72 }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 15 }}>{req.name} ? {req.company}</div>
                    <div style={{ fontSize: 12, color: t.textFaint, marginTop: 2 }}>{req.email} ? {req.phone}</div>
                    <div style={{ fontSize: 11, color: t.textDisabled, marginTop: 4 }}>
                      {new Date(req.created_at).toLocaleString()}
                      {req.dismissed_at ? ' ? dismissed' : ''}
                    </div>
                    {req.referral_code_used && <div style={{ fontSize: 11, color: t.gold, marginTop: 4 }}>Rep code: {req.referral_code_used}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={statusStyle(req.status)}>{req.status}</span>
                    {(req.status === 'pending' || req.status === 'denied') && (
                      <button
                        type="button"
                        onClick={() => handleApprove(req)}
                        disabled={approvingId === req.id}
                        style={{ ...actionBtn(t.accent), cursor: approvingId === req.id ? 'wait' : 'pointer' }}
                      >
                        {approvingId === req.id ? 'Creating?' : 'Approve & create account'}
                      </button>
                    )}
                    {(req.status === 'pending' || req.status === 'approved') && (
                      <button
                        type="button"
                        onClick={() => handleDeny(req)}
                        disabled={denyingId === req.id}
                        style={{ ...actionBtn(t.errorText), cursor: denyingId === req.id ? 'wait' : 'pointer' }}
                      >
                        {denyingId === req.id ? 'Denying?' : req.status === 'approved' ? 'Revoke & deny' : 'Deny'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && tab === 'inquiries' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {inquiries.length === 0 && <div style={{ fontSize: 13, color: t.textFaint }}>No inquiries yet.</div>}
            {inquiries.map(inq => (
              <div key={inq.id} style={{ ...ui.card, position: 'relative' }}>
                <button
                  type="button"
                  aria-label="Remove quote request"
                  title="Remove permanently"
                  disabled={removingInquiryId === inq.id}
                  onClick={() => handleRemoveInquiry(inq)}
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: t.borderHairline,
                    background: t.bgMuted,
                    color: t.textMuted,
                    fontSize: 18,
                    lineHeight: 1,
                    cursor: removingInquiryId === inq.id ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  ?
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8, paddingRight: 36 }}>
                  <div><div style={{ fontWeight: 500, fontSize: 15 }}>{inq.name} ? {inq.company}</div><div style={{ fontSize: 12, color: t.textFaint, marginTop: 2 }}>{inq.phone || '?'} ? {inq.email || '?'}</div></div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <select
                      value={inq.quote_status || 'new'}
                      disabled={statusUpdatingId === inq.id}
                      onChange={(e) => handleInquiryStatus(inq.id, e.target.value)}
                      style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, border: t.borderHairline, background: t.bgElevated, fontFamily: 'inherit' }}
                    >
                      {QUOTE_STATUSES.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 11, color: t.textDisabled }}>{new Date(inq.created_at).toLocaleString()}</div>
                  </div>
                </div>
                {parseInquiryInterests(inq.interests).map(i => (
                  <div key={i.key || `${i.sku}-${i.productName}`} style={{ fontSize: 12, color: t.textSecondary, padding: '4px 0', borderBottom: `0.5px solid ${t.borderSubtle}` }}>
                    {i.sku && <span style={{ fontFamily: 'monospace', fontSize: 10, color: t.gold, marginRight: 6 }}>{i.sku}</span>}
                    {i.brandName} ? {i.productName} ? {i.flavor}
                  </div>
                ))}
                {inq.master_pricing_interest && (
                  <div style={{ fontSize: 12, color: t.warningText, padding: '6px 0', fontWeight: 600 }}>
                    ? Flagged for Master Distributor volume review
                  </div>
                )}
                {inq.notes && <div style={{ fontSize: 12, color: t.textMuted, background: t.bgMuted, borderRadius: 6, padding: '8px 10px', marginTop: 8 }}>"{inq.notes}"</div>}
                <QuoteBuilderPanel
                  inquiry={inq}
                  staffUserId={user?.id}
                  customerUserId={inq.user_id}
                  onUpdated={(updated) => setInquiries(prev => prev.map(i => (i.id === updated.id ? { ...i, ...updated } : i)))}
                  onSent={(updated) => setInquiries(prev => prev.map(i => (i.id === updated.id ? { ...i, ...updated } : i)))}
                />
              </div>
            ))}
          </div>
        )}
        {!loading && tab === 'content' && (
          <>
            <IndustryFactsPanel />
            <ContentEditor
              brandOverrides={brandOverrides}
              productOverrides={productOverrides}
              onSaved={loadContentOverrides}
            />
          </>
        )}
        {!loading && tab === 'users' && (
          <UserManager currentUserId={user?.id} />
        )}
        {tab === 'map' && (
          <ContactMap />
        )}
        {tab === 'brands' && (
          <BrandManager onSaved={loadContentOverrides} />
        )}
        {tab === 'marketing' && (
          <MarketingDashboard />
        )}
        <AdminAgent />
      </div>
    </div>
  );
}
