import React, { useState } from 'react';
import ChatSidebar from './messaging/ChatSidebar';
import CustomerDirectory from './CustomerDirectory';
import ContactImportPanel from './ContactImportPanel';
import { useUnreadCount } from '../hooks/useUnreadCount';

const tabBtn = (active) => ({
  background: active ? '#1A1A1A' : '#FFF',
  color: active ? '#FFF' : '#666',
  border: '0.5px solid #E0DDD8',
  borderRadius: 8,
  padding: '8px 14px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: active ? 600 : 400,
});

export default function StaffDashboard({ user, profile, onLogout }) {
  const [tab, setTab] = useState('messages');
  const { unread, refresh: refreshUnread } = useUnreadCount(user?.id, {
    isSalesRep: true,
    enabled: !!user?.id,
  });

  return (
    <div style={{ minHeight: '100vh', background: '#F5F2ED', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ background: '#1A1A1A', padding: '12px 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: '#888', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Sales</div>
          <div style={{ fontSize: 16, color: '#FFF', fontWeight: 600 }}>{profile?.name || user?.email}</div>
          {profile?.rep_code && (
            <div style={{ fontSize: 11, color: '#C9A84C', marginTop: 4 }}>
              Your code: <strong>{profile.rep_code}</strong> — share when signing up retailers
            </div>
          )}
        </div>
        <button onClick={onLogout} style={{ background: 'transparent', border: '0.5px solid #555', color: '#CCC', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          Sign out
        </button>
      </div>

      <div style={{ padding: '1rem 1.25rem', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
          {[
            ['messages', unread > 0 ? `Messages (${unread})` : 'Messages'],
            ['customers', 'My customers'],
            ['contacts', 'Contact list'],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={tabBtn(tab === key)}>{label}</button>
          ))}
        </div>

        {tab === 'messages' && (
          <div style={{ background: '#FFF', border: '0.5px solid #E8E4DF', borderRadius: 12, minHeight: 480, overflow: 'hidden' }}>
            <ChatSidebar
              user={user}
              open
              variant="page"
              isSalesRep
              onUnreadChange={refreshUnread}
              profileComplete
            />
          </div>
        )}

        {tab === 'customers' && (
          <div style={{ background: '#FFF', border: '0.5px solid #E8E4DF', borderRadius: 12, padding: '1.25rem' }}>
            <CustomerDirectory repUserId={user?.id} />
          </div>
        )}

        {tab === 'contacts' && (
          <ContactImportPanel
            userId={user?.id}
            isAdmin={false}
            isSalesRep
            defaultRepId={user?.id}
          />
        )}
      </div>
    </div>
  );
}
