import React, { useEffect, useRef } from 'react';

export default function MessageThread({ messages, currentUserId, profiles, loading, isGroup = false, showStaffNames = false }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#AAA', fontSize: 13 }}>Loading...</div>;
  }

  const senderName = (userId) => {
    const p = profiles[userId] || {};
    return p.username || p.name || 'User';
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: '#FAFAF8', minHeight: 0 }}>
      {messages.map(msg => {
        const mine = msg.from_user_id === currentUserId;
        const fromProfile = profiles[msg.from_user_id] || {};
        const showName = (isGroup || showStaffNames) && !mine;
        const staffLabel = fromProfile.is_portal_admin ? (fromProfile.name || 'Team') : senderName(msg.from_user_id);
        return (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
            {showName && (
              <div style={{ fontSize: 10, color: '#888', marginBottom: 3, marginLeft: 4 }}>{staffLabel}</div>
            )}
            <div style={{
              maxWidth: '85%', padding: '10px 14px', borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: mine ? '#1A1A1A' : '#FFF', color: mine ? '#FFF' : '#1A1A1A',
              fontSize: 15, lineHeight: 1.45, border: mine ? 'none' : '0.5px solid #E8E4DF',
              boxShadow: mine ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              {msg.content}
              <div style={{ fontSize: 9, color: mine ? 'rgba(255,255,255,0.45)' : '#CCC', marginTop: 4, textAlign: 'right' }}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {mine && !isGroup && msg.read_status ? ' · read' : ''}
              </div>
            </div>
          </div>
        );
      })}
      {!messages.length && !loading && (
        <div style={{ textAlign: 'center', color: '#CCC', fontSize: 12, marginTop: 24 }}>No messages yet — say hello!</div>
      )}
      <div ref={endRef} />
    </div>
  );
}
