import React, { useEffect, useRef } from 'react';
import { isChatImage } from '../../lib/chatAttachments';
import { getChatDisplayName, isMessageHiddenFromCustomer } from '../../lib/community';
import CustomerBadges from '../CustomerBadges';
import { useTheme } from '../../context/ThemeContext';

export default function MessageThread({
  messages,
  currentUserId,
  profiles,
  loading,
  isGroup = false,
  showStaffNames = false,
  isStaff = false,
  customerUserId = null,
}) {
  const { t } = useTheme();
  const endRef = useRef(null);
  const threadRef = useRef(null);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    if (nearBottom) {
      endRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages]);

  if (loading) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textFaint, fontSize: 13 }}>Loading...</div>;
  }

  const senderName = (userId) => {
    const p = profiles[userId] || {};
    return getChatDisplayName(p, { viewerIsStaff: isStaff });
  };

  const renderAttachment = (msg, mine, muted) => {
    if (!msg.attachment_url) return null;
    const name = msg.attachment_name || 'Attachment';
    const isImage = isChatImage(msg.attachment_type, name);
    if (isImage) {
      return (
        <a href={msg.attachment_url} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: msg.content && !msg.content.startsWith('📎 ') ? 8 : 0, opacity: muted ? 0.65 : 1 }}>
          <img
            src={msg.attachment_url}
            alt={name}
            style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 14, display: 'block' }}
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
          borderRadius: 12,
          background: mine ? 'rgba(255,255,255,0.12)' : t.bgMuted,
          color: mine ? '#FFF' : t.text,
          textDecoration: 'none',
          fontSize: 13,
          fontWeight: 500,
          opacity: muted ? 0.65 : 1,
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
    <div ref={threadRef} className="chat-message-thread" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: t.bgHover, minHeight: 0, minWidth: 0 }}>
      {messages.map(msg => {
        if (msg.is_system) {
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
              <div className="chat-bubble chat-bubble--system" style={{
                maxWidth: '92%', padding: '10px 14px',
                background: t.bgMuted, border: t.borderHairlineLight,
                fontSize: 13, lineHeight: 1.5, color: t.textSecondary, textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, color: t.gold, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Global Access Support</div>
                {msg.content}
              </div>
            </div>
          );
        }
        const mine = msg.from_user_id === currentUserId;
        const fromProfile = profiles[msg.from_user_id] || {};
        const showName = (isGroup || showStaffNames) && !mine;
        const isCustomerSender = showStaffNames && !fromProfile.is_portal_admin && !fromProfile.is_sales_rep;
        const staffLabel = fromProfile.is_portal_admin ? (fromProfile.name || 'Team') : senderName(msg.from_user_id);
        const body = displayContent(msg);
        const hiddenFromCustomer = isStaff && isMessageHiddenFromCustomer(msg, customerUserId);

        return (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', position: 'relative' }}>
            {showName && (
              <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 3, marginLeft: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <span>{staffLabel}</span>
                {isCustomerSender && <CustomerBadges profile={fromProfile} size="sm" />}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: 'row', maxWidth: '100%', minWidth: 0, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div className={`chat-bubble${mine ? ' chat-bubble--mine' : ' chat-bubble--other'}`} style={{
                maxWidth: '85%', minWidth: 0, padding: '10px 14px',
                background: mine ? t.bubbleMineBg : t.bubbleOtherBg, color: mine ? t.bubbleMineText : t.bubbleOtherText,
                fontSize: 15, lineHeight: 1.45, border: hiddenFromCustomer ? `1px dashed ${t.warningBorder}` : (mine ? 'none' : t.borderHairlineLight),
                boxShadow: mine ? 'none' : `0 1px 4px ${t.shadow}`,
                opacity: hiddenFromCustomer ? 0.92 : 1,
              }}>
                {hiddenFromCustomer && (
                  <div style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: t.warningText,
                    marginBottom: 6,
                  }}>
                    Hidden from customer
                  </div>
                )}
                {renderAttachment(msg, mine, hiddenFromCustomer)}
                {body && (
                  <span className="allow-text-select chat-bubble-text" style={{ opacity: hiddenFromCustomer ? 0.85 : 1, whiteSpace: 'pre-wrap' }}>
                    {body}
                  </span>
                )}
                <div style={{ fontSize: 9, color: mine ? 'rgba(255,255,255,0.45)' : t.textDisabled, marginTop: 4, textAlign: 'right' }}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {mine && !isGroup && msg.read_status ? ' · read' : ''}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {!messages.length && !loading && (
        <div style={{ textAlign: 'center', color: t.textDisabled, fontSize: 12, marginTop: 24 }}>No messages yet — say hello!</div>
      )}
      <div ref={endRef} />
    </div>
  );
}
