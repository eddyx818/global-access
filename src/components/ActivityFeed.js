import React, { useState, useEffect } from 'react';
import { fetchRecentActivity, fetchOnlineUsers } from '../lib/community';

const EVENT_LABELS = {
  page_view: 'Viewed page',
  click: 'Clicked',
  time_on_page: 'Time on page',
  message_send: 'Sent message',
};

export default function ActivityFeed() {
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
        <div style={{ background: '#FFF', border: '0.5px solid #E8E4DF', borderRadius: 10, padding: '12px 16px', flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 10, color: '#AAA', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Online now</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#4CAF7D' }}>{onlineCount}</div>
        </div>
        <button onClick={load} style={{ background: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center' }}>↻ Refresh</button>
      </div>

      {loading && <div style={{ fontSize: 13, color: '#AAA' }}>Loading activity...</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {activity.map(a => (
          <div key={a.id} style={{ background: '#FFF', border: '0.5px solid #E8E4DF', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 500 }}>
                {EVENT_LABELS[a.event_type] || a.event_type}
                {a.page_url && <span style={{ color: '#888', fontWeight: 400 }}> · {a.page_url}</span>}
              </div>
              {a.metadata?.element && <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>{a.metadata.element}</div>}
            </div>
            <div style={{ fontSize: 11, color: '#BBB', whiteSpace: 'nowrap' }}>
              {new Date(a.created_at).toLocaleString()}
            </div>
          </div>
        ))}
        {!loading && !activity.length && (
          <div style={{ fontSize: 13, color: '#AAA', textAlign: 'center', padding: 24 }}>No activity recorded yet. Run the Phase 1 SQL migration first.</div>
        )}
      </div>
    </div>
  );
}
