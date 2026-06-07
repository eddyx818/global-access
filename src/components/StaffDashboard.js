import React, { useState } from 'react';
import ChatSidebar from './messaging/ChatSidebar';
import CustomerDirectory from './CustomerDirectory';
import ContactImportPanel from './ContactImportPanel';
import ReferralTracker from './ReferralTracker';
import DashboardProfilePanel from './DashboardProfilePanel';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { useTheme } from '../context/ThemeContext';

const tabBtn = (active, theme) => ({
  background: active ? theme.btnPrimaryBg : theme.bgElevated,
  color: active ? theme.btnPrimaryText : theme.textSecondary,
  border: theme.borderHairline,
  borderRadius: 8,
  padding: '8px 14px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: active ? 600 : 400,
});

export default function StaffDashboard({ user, profile, onLogout, onViewCatalog, initialTab = 'messages' }) {
  const { t } = useTheme();
  const [tab, setTab] = useState(initialTab);
  const { unread, refresh: refreshUnread } = useUnreadCount(user?.id, {
    isSalesRep: true,
    enabled: !!user?.id,
  });

  return (
    <div className="app-no-select app-dashboard-shell" style={{ minHeight: '100vh', background: t.bg, fontFamily: "'DM Sans', sans-serif", color: t.text, transition: 'background 0.35s ease' }}>
      <div className="app-safe-top-chrome" style={{ '--app-chrome-pad-top': '12px', background: t.headerBg, paddingLeft: '1.25rem', paddingRight: '1.25rem', paddingBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: t.headerMuted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Sales</div>
          <div style={{ fontSize: 16, color: t.headerText, fontWeight: 600 }}>{profile?.name || user?.email}</div>
          {profile?.rep_code && (
            <div style={{ fontSize: 11, color: t.gold, marginTop: 4 }}>
              Your code: <strong>{profile.rep_code}</strong> — share when signing up retailers
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {onViewCatalog && (
            <button
              type="button"
              onClick={onViewCatalog}
              style={{ background: t.gold, color: '#1A1A1A', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Price check catalog
            </button>
          )}
          <button onClick={onLogout} style={{ background: 'transparent', border: `0.5px solid ${t.border}`, color: t.headerMuted, borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ padding: '1rem 1.25rem', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
          {[
            ['profile', 'Profile'],
            ['messages', unread > 0 ? `Messages (${unread})` : 'Messages'],
            ['signups', 'Sign-up progress'],
            ['customers', 'My customers'],
            ['contacts', 'Contact list'],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={tabBtn(tab === key, t)}>{label}</button>
          ))}
        </div>

        {tab === 'profile' && (
          <DashboardProfilePanel user={user} isStaff />
        )}

        {tab === 'messages' && (
          <div style={{ background: t.bgElevated, border: t.borderHairlineLight, borderRadius: 12, minHeight: 480, overflow: 'hidden' }}>
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

        {tab === 'signups' && (
          <div style={{ background: t.bgElevated, border: t.borderHairlineLight, borderRadius: 12, padding: '1.25rem' }}>
            <ReferralTracker currentUserId={user?.id} />
          </div>
        )}

        {tab === 'customers' && (
          <div style={{ background: t.bgElevated, border: t.borderHairlineLight, borderRadius: 12, padding: '1.25rem' }}>
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
