import React from 'react';
import { getConversationTitle } from '../../lib/community';

export default function ConversationList({ conversations, profiles, currentUserId, onSelect }) {
  if (!conversations.length) {
    return <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#AAA' }}>No direct messages yet. Message someone from Online, or open a group from Groups.</div>;
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {conversations.map(convo => {
        const otherId = convo.participant_user_ids.find(id => id !== currentUserId);
        const p = profiles[otherId] || {};
        const label = getConversationTitle(convo, profiles, currentUserId);
        const subtitle = convo.is_group
          ? `${convo.participant_user_ids.length} members`
          : (p.company || 'Direct message');

        return (
          <button key={convo.id} onClick={() => onSelect(convo)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: 'none', borderBottom: '0.5px solid #F0EDE8', background: '#FFF', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
            <div style={{ width: 36, height: 36, borderRadius: convo.is_group ? 10 : '50%', background: convo.is_group ? '#E8E4DF' : '#F0EDE8', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: convo.is_group ? 16 : 14, color: '#888' }}>
              {convo.is_group ? '👥' : (
                p.profile_avatar_url ? <img src={p.profile_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (label[0] || '?').toUpperCase()
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{label}</div>
              <div style={{ fontSize: 11, color: '#AAA' }}>{subtitle}</div>
            </div>
            {!convo.is_group && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.status === 'online' ? '#4CAF7D' : '#DDD' }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
