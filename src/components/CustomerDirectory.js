import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fetchAllProfiles } from '../lib/community';
import { formatRoleLabel } from '../lib/roles';
import { getAccountBadges } from '../lib/accountBadges';
import { fetchRepRoster } from '../lib/repCodes';
import {
  transferSignedUpCustomer,
  bulkTransferSignedUpCustomers,
  saveCustomerStaffNotes,
  fetchCustomerStaffNotesMap,
  repDisplayName,
  buildRepOptions,
} from '../lib/customerTransfer';
import CustomerBadges from './CustomerBadges';
import BulkTransferBar from './BulkTransferBar';
import StaffNotesCell from './StaffNotesCell';
import { useTheme } from '../context/ThemeContext';
import { getAdminUi } from '../lib/theme';
import { whatsAppUrl } from '../lib/whatsapp';

const STATUS_COLOR = { online: '#4CAF7D', away: '#C9A84C', offline: '#CCC' };

export default function CustomerDirectory({ repUserId = null, canTransfer = true }) {
  const { t } = useTheme();
  const ui = getAdminUi();
  const [users, setUsers] = useState([]);
  const [repNames, setRepNames] = useState({});
  const [reps, setReps] = useState([]);
  const [stats, setStats] = useState({});
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState('last_active_at');
  const [loading, setLoading] = useState(true);
  const [transferringId, setTransferringId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => { load(); }, [repUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!canTransfer) return;
    fetchRepRoster().then(setReps);
  }, [canTransfer]);

  const load = async () => {
    setLoading(true);
    setSelected(new Set());
    const [profiles, notesMap] = await Promise.all([
      fetchAllProfiles(),
      fetchCustomerStaffNotesMap(),
    ]);
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
      staff_notes: notesMap[p.user_id] || '',
      pages_viewed: actMap[p.user_id] || 0,
      messages_sent: msgMap[p.user_id] || 0,
      signed_up_by: reps[p.referred_by_user_id] || (p.referral_code_used ? `Code: ${p.referral_code_used}` : '—'),
    }));

    setUsers(merged);
    setStats({ total: merged.length, online: merged.filter(u => u.status === 'online').length });
    setLoading(false);
  };

  const repOptions = buildRepOptions(reps);

  const handleTransfer = async (customerUserId, newRepUserId, customerName, currentRepUserId) => {
    if (String(newRepUserId || '') === String(currentRepUserId || '')) return;
    const targetLabel = newRepUserId
      ? repDisplayName(repOptions.find(r => r.user_id === newRepUserId))
      : 'Unassigned';
    if (!window.confirm(`Transfer ${customerName || 'this customer'} to ${targetLabel}?`)) return;

    setTransferringId(customerUserId);
    setTransferError('');
    const result = await transferSignedUpCustomer(customerUserId, newRepUserId || null);
    if (!result.ok) {
      setTransferError(result.error || 'Transfer failed.');
    } else {
      await load();
    }
    setTransferringId(null);
  };

  const handleBulkTransfer = async (newRepUserId) => {
    const ids = [...selected];
    if (!ids.length) return;
    const targetLabel = newRepUserId
      ? repDisplayName(repOptions.find(r => r.user_id === newRepUserId))
      : 'Unassigned';
    if (!window.confirm(`Transfer ${ids.length} customer(s) to ${targetLabel}?`)) return;

    setBulkBusy(true);
    setTransferError('');
    const result = await bulkTransferSignedUpCustomers(ids, newRepUserId || null);
    if (!result.ok) {
      setTransferError(result.error || 'Bulk transfer failed.');
    } else {
      setTransferError('');
      await load();
    }
    setBulkBusy(false);
  };

  const handleSaveNotes = async (customerUserId, notes) => {
    const result = await saveCustomerStaffNotes(customerUserId, notes);
    if (result.ok) {
      setUsers(prev => prev.map(u => (
        u.user_id === customerUserId ? { ...u, staff_notes: notes || '' } : u
      )));
    }
    return result.ok;
  };

  const filtered = users
    .filter(u => {
      const q = filter.toLowerCase();
      if (!q) return true;
      return [u.username, u.name, u.email, u.company, u.role, u.signed_up_by, u.referral_code_used, u.staff_notes].some(v => (v || '').toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const av = a[sortKey] || '';
      const bv = b[sortKey] || '';
      return av > bv ? -1 : av < bv ? 1 : 0;
    });

  const filteredIds = filtered.map(u => u.user_id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selected.has(id));

  const toggleSelect = (userId) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredIds.forEach(id => next.delete(id));
      } else {
        filteredIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const exportCsv = () => {
    const headers = ['username', 'name', 'email', 'company', 'role', 'badges', 'status', 'signed_up_by', 'referral_code', 'staff_notes', 'pages_viewed', 'messages_sent', 'last_active_at'];
    const rows = filtered.map(u => headers.map(h => {
      if (h === 'badges') return `"${getAccountBadges(u).map(b => b.label).join('; ').replace(/"/g, '""')}"`;
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
          style={{ flex: 1, minWidth: 160, ...ui.input, fontSize: 13 }} />
        <button onClick={exportCsv} style={{ background: t.bgElevated, border: t.borderHairline, borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: t.text }}>Export CSV</button>
        <button onClick={load} style={{ ...ui.tabBtn(true) }}>↻</button>
      </div>

      {canTransfer && (
        <BulkTransferBar
          selectedCount={selected.size}
          repOptions={repOptions}
          onTransfer={handleBulkTransfer}
          onClear={() => setSelected(new Set())}
          busy={bulkBusy}
        />
      )}

      {transferError && (
        <div style={{ background: t.errorBg, border: `0.5px solid ${t.errorBorder}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: t.errorText, marginBottom: 12 }}>
          {transferError}
          <button type="button" onClick={() => setTransferError('')} style={{ background: 'none', border: 'none', color: t.errorText, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 8 }}>×</button>
        </div>
      )}

      {loading ? <div style={{ fontSize: 13, color: '#AAA' }}>Loading...</div> : (
        <div style={{ overflowX: 'auto', ...ui.card, padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#FAFAF8' }}>
                {canTransfer && (
                  <th style={{ padding: '8px 10px', borderBottom: '0.5px solid #E8E4DF', width: 36 }}>
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAllFiltered} aria-label="Select all" />
                  </th>
                )}
                {th('username', 'Username')}
                {th('company', 'Company')}
                {th('role', 'Role')}
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: '#AAA', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '0.5px solid #E8E4DF' }}>Tags</th>
                {!repUserId && th('signed_up_by', 'Signed up by')}
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: '#AAA', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '0.5px solid #E8E4DF' }}>Staff notes</th>
                {th('status', 'Status')}
                {th('pages_viewed', 'Pages')}
                {th('messages_sent', 'Messages')}
                {th('last_active_at', 'Last active')}
                {canTransfer && (
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, color: '#AAA', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '0.5px solid #E8E4DF' }}>Transfer to</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id || u.user_id}>
                  {canTransfer && (
                    <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}` }}>
                      <input type="checkbox" checked={selected.has(u.user_id)} onChange={() => toggleSelect(u.user_id)} aria-label={`Select ${u.name || u.email}`} />
                    </td>
                  )}
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}` }}>
                    <div style={{ fontWeight: 500 }}>{u.username || u.name || '—'}</div>
                    <div style={{ fontSize: 11, color: '#AAA' }}>{u.email}</div>
                    {u.phone && whatsAppUrl(u.phone) && (
                      <a href={whatsAppUrl(u.phone)} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: t.accent, textDecoration: 'none', fontWeight: 600 }}>
                        WhatsApp
                      </a>
                    )}
                  </td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, color: t.textSecondary }}>{u.company || '—'}</td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, color: t.textSecondary }}>{formatRoleLabel(u.role || u.user_type)}</td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}` }}>
                    <CustomerBadges profile={u} />
                  </td>
                  {!repUserId && (
                    <td style={{ padding: '10px', borderBottom: '0.5px solid #F5F2ED', fontSize: 12, color: '#666' }}>
                      {u.signed_up_by}
                      {u.referral_code_used && u.signed_up_by !== `Code: ${u.referral_code_used}` && (
                        <div style={{ fontSize: 10, color: '#AAA' }}>{u.referral_code_used}</div>
                      )}
                    </td>
                  )}
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, verticalAlign: 'top' }}>
                    <StaffNotesCell
                      value={u.staff_notes}
                      onSave={(notes) => handleSaveNotes(u.user_id, notes)}
                      placeholder="Internal notes (staff only)…"
                    />
                  </td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}` }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[u.status] || STATUS_COLOR.offline }} />
                      {u.status || 'offline'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, color: t.textSecondary }}>{u.pages_viewed}</td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, color: t.textSecondary }}>{u.messages_sent}</td>
                  <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, fontSize: 11, color: t.textFaint }}>
                    {u.last_active_at ? new Date(u.last_active_at).toLocaleString() : '—'}
                  </td>
                  {canTransfer && (
                    <td style={{ padding: '10px', borderBottom: `0.5px solid ${t.borderSubtle}`, minWidth: 160 }}>
                      <select
                        value={u.referred_by_user_id || ''}
                        disabled={transferringId === u.user_id || bulkBusy}
                        onChange={(e) => handleTransfer(u.user_id, e.target.value || null, u.name || u.email, u.referred_by_user_id)}
                        style={{ ...ui.input, fontSize: 12, padding: '6px 8px', width: '100%', cursor: transferringId === u.user_id ? 'wait' : 'pointer' }}
                      >
                        <option value="">Unassigned</option>
                        {repOptions.map(r => (
                          <option key={r.user_id} value={r.user_id}>
                            {repDisplayName(r)}{r.rep_code ? ` (${r.rep_code})` : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
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
