import React from 'react';

export default function ConversationList({ conversations, profiles, currentUserId, onSelect }) {
  if (!conversations.length) {
    return <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#AAA' }}>No conversations yet. Message someone from the Online tab.</div>;
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {conversations.map(convo => {
        const otherId = convo.participant_user_ids.find(id => id !== currentUserId);
        const p = profiles[otherId] || {};
        const label = convo.is_group ? (convo.group_name || 'Group') : (p.username || p.name || 'User');
        return (
          <button key={convo.id} onClick={() => onSelect(convo)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: 'none', borderBottom: '0.5px solid #F0EDE8', background: '#FFF', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#F0EDE8', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#888' }}>
              {p.profile_avatar_url ? <img src={p.profile_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (label[0] || '?').toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{label}</div>
              <div style={{ fontSize: 11, color: '#AAA' }}>{p.company || 'Direct message'}</div>
            </div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.status === 'online' ? '#4CAF7D' : '#DDD' }} />
          </button>
        );
      })}
    </div>
  );
}
