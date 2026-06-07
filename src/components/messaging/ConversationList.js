import React from 'react';
import { getConversationTitle, getCustomerParticipantId } from '../../lib/community';

export default function ConversationList({ conversations, profiles, currentUserId, isAdmin, onSelect, onMessageSupport }) {
  if (!conversations.length) {
    return (
      <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#AAA' }}>
        {isAdmin ? (
          'No conversations yet. Message a customer from the Customers tab.'
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>No messages yet. Reach out to our team if you have questions about products or orders.</div>
            {onMessageSupport && (
              <button onClick={onMessageSupport}
                style={{ background: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Message Global Access
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {!isAdmin && onMessageSupport && (
        <div style={{ padding: '12px 14px', borderBottom: '0.5px solid #F0EDE8' }}>
          <button onClick={onMessageSupport}
            style={{ width: '100%', background: '#F8F6F3', color: '#1A1A1A', border: '0.5px solid #E0DDD8', borderRadius: 10, padding: '10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + New message to Global Access
          </button>
        </div>
      )}
      {conversations.map(convo => {
        const label = getConversationTitle(convo, profiles, currentUserId, { isAdmin });
        const customerId = isAdmin ? getCustomerParticipantId(convo, profiles) : null;
        const p = profiles[customerId || convo.participant_user_ids.find(id => id !== currentUserId)] || {};
        const subtitle = isAdmin
          ? (p.company || p.role || 'Customer')
          : 'Direct message';

        return (
          <button key={convo.id} onClick={() => onSelect(convo)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: 'none', borderBottom: '0.5px solid #F0EDE8', background: '#FFF', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#F0EDE8', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#888' }}>
              {p.profile_avatar_url ? <img src={p.profile_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (label[0] || '?').toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{label}</div>
              <div style={{ fontSize: 11, color: '#AAA' }}>{subtitle}</div>
            </div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.status === 'online' ? '#4CAF7D' : '#DDD' }} />
          </button>
        );
      })}
    </div>
  );
}
