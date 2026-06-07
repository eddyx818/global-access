import React, { useState, useEffect } from 'react';
import { fetchReferralLeaderboard, getReferralTotals } from '../lib/referralStats';
import { useTheme } from '../context/ThemeContext';
import { getAdminUi } from '../lib/theme';

export default function ReferralTracker({ currentUserId = null, isAdmin = false, compact = false }) {
  const { t } = useTheme();
  const ui = getAdminUi();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchReferralLeaderboard({ isAdmin });
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load referral stats.');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  const totals = getReferralTotals(rows);
  const maxTotal = Math.max(1, ...rows.map(r => Number(r.signups_total || 0)));
  const myRow = rows.find(r => r.rep_user_id === currentUserId);

  const thStyle = {
    textAlign: 'left',
    padding: '8px 10px',
    fontSize: 10,
    color: t.textFaint,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    borderBottom: t.borderHairline,
  };

  const tdStyle = {
    padding: '10px',
    borderBottom: `0.5px solid ${t.borderSubtle}`,
    fontSize: 13,
  };

  if (loading) {
    return <div style={{ fontSize: 13, color: t.textFaint }}>Loading sign-up progress…</div>;
  }

  if (error) {
    return (
      <div style={{ background: t.warningBg, border: `0.5px solid ${t.warningBorder}`, borderRadius: 8, padding: '12px 14px', fontSize: 13, color: t.warningText, lineHeight: 1.5 }}>
        {error}
      </div>
    );
  }

  return (
    <div>
      {!compact && (
        <p style={{ fontSize: 13, color: t.textSecondary, marginBottom: '1rem', lineHeight: 1.5 }}>
          Accounts created or access requests submitted with each rep&apos;s personal access code. Compare progress across the team.
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: compact ? '1rem' : '1.25rem' }}>
        {[
          ['Total sign-ups', totals.signups],
          ['This month', totals.month],
          ['This week', totals.week],
          ['Pending requests', totals.pending],
        ].map(([label, val]) => (
          <div key={label} style={ui.statCard}>
            <div style={{ fontSize: 10, color: t.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: t.text }}>{val}</div>
          </div>
        ))}
      </div>

      {myRow && (
        <div style={{ ...ui.card, marginBottom: '1rem', borderLeft: `3px solid ${t.gold}` }}>
          <div style={{ fontSize: 11, color: t.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Your progress</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px', alignItems: 'baseline' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{myRow.rep_name}</div>
            <div style={{ fontSize: 12, color: t.gold, fontWeight: 600 }}>Code: {myRow.rep_code}</div>
            <div style={{ fontSize: 13, color: t.textSecondary }}>
              {myRow.signups_total} signed up · {myRow.signups_this_month} this month · {myRow.pending_requests} pending
            </div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: t.textDisabled }}>No reps with access codes yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: t.bgMuted }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Rep</th>
                <th style={thStyle}>Access code</th>
                <th style={thStyle}>Total</th>
                <th style={thStyle}>Month</th>
                <th style={thStyle}>Week</th>
                <th style={thStyle}>Pending</th>
                {!compact && <th style={{ ...thStyle, minWidth: 120 }}>Progress</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const isMe = row.rep_user_id === currentUserId;
                const total = Number(row.signups_total || 0);
                return (
                  <tr key={row.rep_user_id} style={{ background: isMe ? t.goldBg : 'transparent' }}>
                    <td style={{ ...tdStyle, color: t.textFaint, fontWeight: 600 }}>{index + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: isMe ? 600 : 500 }}>
                      {row.rep_name}
                      {isMe && <span style={{ marginLeft: 6, fontSize: 10, color: t.gold, fontWeight: 600 }}>YOU</span>}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: t.gold }}>{row.rep_code}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{row.signups_total}</td>
                    <td style={tdStyle}>{row.signups_this_month}</td>
                    <td style={tdStyle}>{row.signups_this_week}</td>
                    <td style={{ ...tdStyle, color: row.pending_requests > 0 ? t.warningText : t.textSecondary }}>{row.pending_requests}</td>
                    {!compact && (
                      <td style={tdStyle}>
                        <div style={{ height: 6, background: t.bgSubtle, borderRadius: 3, minWidth: 80 }}>
                          <div style={{ height: '100%', width: `${(total / maxTotal) * 100}%`, background: isMe ? t.gold : t.accent, borderRadius: 3 }} />
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
