import React, { useState, useEffect } from 'react';
import { fetchRecentActivity, fetchOnlineUsers } from '../lib/community';
import { useTheme } from '../context/ThemeContext';
import { getAdminUi } from '../lib/theme';

const EVENT_LABELS = {
  page_view: 'Viewed page',
  click: 'Clicked',
  time_on_page: 'Time on page',
  message_send: 'Sent message',
};

export default function ActivityFeed() {
  const { t } = useTheme();
  const ui = getAdminUi();
  const [activity, setActivity] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [acts, online] = await Promise.all([fetchRecentActivity(40), fetchOnlineUsers()]);
    setActivity(acts);
    setOnlineCount(online.length);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ ...ui.statCard, flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 10, color: t.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Online now</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: t.accent }}>{onlineCount}</div>
        </div>
        <button onClick={load} style={{ ...ui.tabBtn(true), alignSelf: 'center' }}>↻ Refresh</button>
      </div>

      {loading && <div style={{ fontSize: 13, color: t.textFaint }}>Loading activity...</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {activity.map(a => (
          <div key={a.id} style={{ ...ui.card, marginBottom: 0, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>
                {EVENT_LABELS[a.event_type] || a.event_type}
                {a.page_url && <span style={{ color: t.textMuted, fontWeight: 400 }}> · {a.page_url}</span>}
              </div>
              {a.metadata?.element && <div style={{ fontSize: 11, color: t.textFaint, marginTop: 2 }}>{a.metadata.element}</div>}
            </div>
            <div style={{ fontSize: 11, color: t.textDisabled, whiteSpace: 'nowrap' }}>
              {new Date(a.created_at).toLocaleString()}
            </div>
          </div>
        ))}
        {!loading && !activity.length && (
          <div style={{ fontSize: 13, color: t.textFaint, textAlign: 'center', padding: 24 }}>No activity recorded yet. Run the Phase 1 SQL migration first.</div>
        )}
      </div>
    </div>
  );
}
