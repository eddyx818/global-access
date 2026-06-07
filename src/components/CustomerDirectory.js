import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fetchAllProfiles } from '../lib/community';

const STATUS_COLOR = { online: '#4CAF7D', away: '#C9A84C', offline: '#CCC' };

export default function CustomerDirectory({ repUserId = null }) {
  const [users, setUsers] = useState([]);
  const [repNames, setRepNames] = useState({});
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState('last_active_at');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [repUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    const profiles = await fetchAllProfiles();
    const reps = {};
    profiles.forEach(p => {
      if (p.rep_code || p.is_sales_rep) reps[p.user_id] = p.name || p.company || p.email;
    });
    setRepNames(reps);

    const { data: activityCounts } = await supabase.from('user_activity').select('user_id');
    const { data: messageCounts } = await supabase.from('messages').select('from_user_id');

    const actMap = {};
    (activityCounts || []).forEach(r => { if (r.user_id) actMap[r.user_id] = (actMap[r.user_id] || 0) + 1; });
    const msgMap = {};
    (messageCounts || []).forEach(r => { if (r.from_user_id) msgMap[r.from_user_id] = (msgMap[r.from_user_id] || 0) + 1; });

    let customerProfiles = profiles.filter(p => !p.is_portal_admin && !p.is_sales_rep);
    if (repUserId) {
      customerProfiles = customerProfiles.filter(p => p.referred_by_user_id === repUserId);
    }

    const merged = customerProfiles.map(p => ({
      ...p,
      pages_viewed: actMap[p.user_id] || 0,
      messages_sent: msgMap[p.user_id] || 0,
      signed_up_by: reps[p.referred_by_user_id] || (p.referral_code_used ? `Code: ${p.referral_code_used}` : '—'),
    }));

    setUsers(merged);
    setStats({ total: merged.length, online: merged.filter(u => u.status === 'online').length });
    setLoading(false);
  };

  const filtered = users
    .filter(u => {
      const q = filter.toLowerCase();
      if (!q) return true;
      return [u.username, u.name, u.email, u.company, u.role, u.signed_up_by, u.referral_code_used].some(v => (v || '').toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const av = a[sortKey] || '';
      const bv = b[sortKey] || '';
      return av > bv ? -1 : av < bv ? 1 : 0;
    });

  const exportCsv = () => {
    const headers = ['username', 'name', 'email', 'company', 'role', 'status', 'signed_up_by', 'referral_code', 'pages_viewed', 'messages_sent', 'last_active_at'];
    const rows = filtered.map(u => headers.map(h => {
      const val = h === 'signed_up_by' ? u.signed_up_by : h === 'referral_code' ? u.referral_code_used : u[h];
      return `"${(val ?? '').toString().replace(/"/g, '""')}"`;
    }).join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = repUserId ? 'my-customers.csv' : 'global-access-users.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const th = (key, label) => (
    <th key={key} onClick={() => setSortKey(key)} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: sortKey === key ? '#1A1A1A' : '#AAA', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: sortKey === key ? 600 : 400, borderBottom: '0.5px solid #E8E4DF' }}>{label}</th>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: '#666' }}>{stats.total || 0} users · {stats.online || 0} online</div>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search users..."
          style={{ flex: 1, minWidth: 160, background: '#FFF', border: '0.5px solid #E0DDD8', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
        <button onClick={exportCsv} style={{ background: '#FFF', border: '0.5px solid #E0DDD8', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Export CSV</button>
        <button onClick={load} style={{ background: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>↻</button>
      </div>

      {loading ? <div style={{ fontSize: 13, color: '#AAA' }}>Loading...</div> : (
        <div style={{ overflowX: 'auto', background: '#FFF', border: '0.5px solid #E8E4DF', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#FAFAF8' }}>
                {th('username', 'Username')}
                {th('company', 'Company')}
                {th('role', 'Role')}
                {!repUserId && th('signed_up_by', 'Signed up by')}
                {th('status', 'Status')}
                {th('pages_viewed', 'Pages')}
                {th('messages_sent', 'Messages')}
                {th('last_active_at', 'Last active')}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id || u.user_id}>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #F5F2ED' }}>
                    <div style={{ fontWeight: 500 }}>{u.username || u.name || '—'}</div>
                    <div style={{ fontSize: 11, color: '#AAA' }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #F5F2ED', color: '#666' }}>{u.company || '—'}</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #F5F2ED', textTransform: 'capitalize', color: '#666' }}>{u.role || u.user_type || '—'}</td>
                  {!repUserId && (
                    <td style={{ padding: '10px', borderBottom: '0.5px solid #F5F2ED', fontSize: 12, color: '#666' }}>
                      {u.signed_up_by}
                      {u.referral_code_used && u.signed_up_by !== `Code: ${u.referral_code_used}` && (
                        <div style={{ fontSize: 10, color: '#AAA' }}>{u.referral_code_used}</div>
                      )}
                    </td>
                  )}
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #F5F2ED' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[u.status] || STATUS_COLOR.offline }} />
                      {u.status || 'offline'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #F5F2ED', color: '#666' }}>{u.pages_viewed}</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #F5F2ED', color: '#666' }}>{u.messages_sent}</td>
                  <td style={{ padding: '10px', borderBottom: '0.5px solid #F5F2ED', fontSize: 11, color: '#AAA' }}>
                    {u.last_active_at ? new Date(u.last_active_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <div style={{ padding: 24, textAlign: 'center', color: '#AAA', fontSize: 13 }}>No users found.</div>}
        </div>
      )}
    </div>
  );
}
