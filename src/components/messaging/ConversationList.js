import React from 'react';
import { getConversationTitle, getCustomerParticipantId } from '../../lib/community';
import { CustomerNameWithBadges } from '../CustomerBadges';
import { useTheme } from '../../context/ThemeContext';

export default function ConversationList({ conversations, profiles, currentUserId, isStaff = false, onSelect, onMessageSupport, isMobile = false }) {
  const { t } = useTheme();

  if (!conversations.length) {
    return (
      <div style={{ padding: isMobile ? '2rem 1.25rem' : 24, textAlign: 'center', fontSize: isMobile ? 14 : 13, color: t.textFaint, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {isStaff ? (
          'No conversations yet. Message a customer from the Customers tab.'
        ) : (
          <>
            <div style={{ marginBottom: 20, lineHeight: 1.6, maxWidth: 280 }}>Questions about products, pricing, or orders? Our team is here to help.</div>
            {onMessageSupport && (
              <button type="button" onClick={onMessageSupport}
                style={{ background: t.accent, color: '#FFF', border: 'none', borderRadius: 12, padding: isMobile ? '14px 24px' : '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 48 }}>
                Message Global Access
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {!isStaff && onMessageSupport && (
        <div style={{ padding: '12px 14px', borderBottom: `0.5px solid ${t.borderSubtle}` }}>
          <button onClick={onMessageSupport}
            style={{ width: '100%', background: t.bgMuted, color: t.text, border: t.borderHairline, borderRadius: 10, padding: '10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + New message to Global Access
          </button>
        </div>
      )}
      {conversations.map(convo => {
        const label = getConversationTitle(convo, profiles, currentUserId, { isAdmin: isStaff, isSalesRep: isStaff });
        const customerId = isStaff ? getCustomerParticipantId(convo, profiles) : null;
        const p = profiles[customerId || convo.participant_user_ids.find(id => id !== currentUserId)] || {};
        const subtitle = isStaff
          ? (p.company || p.role || 'Customer')
          : 'Direct message';

        return (
          <button key={convo.id} type="button" onClick={() => onSelect(convo)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '14px 16px' : '12px 14px', border: 'none', borderBottom: `0.5px solid ${t.borderSubtle}`, background: t.bgElevated, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', minHeight: isMobile ? 64 : undefined }}>
            <div style={{ width: isMobile ? 44 : 36, height: isMobile ? 44 : 36, borderRadius: '50%', background: t.bgSubtle, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 16 : 14, color: t.textMuted }}>
              {p.profile_avatar_url ? <img src={p.profile_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (label[0] || '?').toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: t.text }}>
                {isStaff ? (
                  <CustomerNameWithBadges profile={p} name={label} size="sm" nameStyle={{ fontSize: 13 }} />
                ) : (
                  <span style={{ fontWeight: 600 }}>{label}</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: t.textFaint, marginTop: isStaff ? 4 : 0 }}>{subtitle}</div>
            </div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.status === 'online' ? t.accent : t.border }} />
          </button>
        );
      })}
    </div>
  );
}
