import React, { useEffect, useRef } from 'react';
import { isChatImage } from '../../lib/chatAttachments';
import CustomerBadges from '../CustomerBadges';

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

  const renderAttachment = (msg, mine) => {
    if (!msg.attachment_url) return null;
    const name = msg.attachment_name || 'Attachment';
    const isImage = isChatImage(msg.attachment_type, name);
    if (isImage) {
      return (
        <a href={msg.attachment_url} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: msg.content && !msg.content.startsWith('📎 ') ? 8 : 0 }}>
          <img
            src={msg.attachment_url}
            alt={name}
            style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 10, display: 'block' }}
          />
        </a>
      );
    }
    return (
      <a
        href={msg.attachment_url}
        target="_blank"
        rel="noreferrer"
        download={name}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 6,
          padding: '8px 10px',
          borderRadius: 8,
          background: mine ? 'rgba(255,255,255,0.12)' : '#F8F6F3',
          color: mine ? '#FFF' : '#1A1A1A',
          textDecoration: 'none',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        📄 {name}
      </a>
    );
  };

  const displayContent = (msg) => {
    if (!msg.content) return null;
    if (msg.attachment_url && msg.content.startsWith('📎 ')) return null;
    return msg.content;
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: '#FAFAF8', minHeight: 0 }}>
      {messages.map(msg => {
        const mine = msg.from_user_id === currentUserId;
        const fromProfile = profiles[msg.from_user_id] || {};
        const showName = (isGroup || showStaffNames) && !mine;
        const isCustomerSender = showStaffNames && !fromProfile.is_portal_admin && !fromProfile.is_sales_rep;
        const staffLabel = fromProfile.is_portal_admin ? (fromProfile.name || 'Team') : senderName(msg.from_user_id);
        const body = displayContent(msg);
        return (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
            {showName && (
              <div style={{ fontSize: 10, color: '#888', marginBottom: 3, marginLeft: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <span>{staffLabel}</span>
                {isCustomerSender && <CustomerBadges profile={fromProfile} size="sm" />}
              </div>
            )}
            <div style={{
              maxWidth: '85%', padding: '10px 14px', borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: mine ? '#1A1A1A' : '#FFF', color: mine ? '#FFF' : '#1A1A1A',
              fontSize: 15, lineHeight: 1.45, border: mine ? 'none' : '0.5px solid #E8E4DF',
              boxShadow: mine ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              {renderAttachment(msg, mine)}
              {body}
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
