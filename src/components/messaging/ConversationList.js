import React from 'react';
import { getConversationTitle, getCustomerParticipantId } from '../../lib/community';
import { CustomerNameWithBadges } from '../CustomerBadges';
import { useTheme } from '../../context/ThemeContext';

export default function ConversationList({
  conversations,
  profiles,
  currentUserId,
  isStaff = false,
  onSelect,
  onMessageSupport,
  isMobile = false,
  customerChatLabel = 'Trade Desk',
  pinnedIds = [],
  onPin,
  onUnpin,
  onDelete,
}) {
  const { t } = useTheme();
  const pinnedSet = new Set(pinnedIds);

  if (!conversations.length) {
    return (
      <div style={{ padding: isMobile ? 'max(12px, var(--ga-inset-top)) 1.25rem 2rem' : 24, textAlign: 'center', fontSize: isMobile ? 14 : 13, color: t.textFaint, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {isStaff ? (
          'No conversations yet. Message a customer from the Customers tab.'
        ) : (
          <>
            <div style={{ marginBottom: 20, lineHeight: 1.6, maxWidth: 280 }}>Questions about products, pricing, or orders? Our team is here to help.</div>
            {onMessageSupport && (
              <button type="button" onClick={onMessageSupport}
                style={{ background: t.accent, color: '#FFF', border: 'none', borderRadius: 12, padding: isMobile ? '14px 24px' : '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 48 }}>
                Message {customerChatLabel}
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingTop: isMobile ? 'max(8px, var(--ga-inset-top))' : 0 }}>
      {!isStaff && onMessageSupport && (
        <div style={{ padding: '12px 14px', borderBottom: `0.5px solid ${t.borderSubtle}` }}>
          <button onClick={onMessageSupport}
            style={{ width: '100%', background: t.bgMuted, color: t.text, border: t.borderHairline, borderRadius: 10, padding: '10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + New message to {customerChatLabel}
          </button>
        </div>
      )}
      {conversations.map(convo => {
        const label = getConversationTitle(convo, profiles, currentUserId, { isAdmin: isStaff, isSalesRep: isStaff, customerChatLabel });
        const customerId = isStaff ? getCustomerParticipantId(convo, profiles) : null;
        const p = profiles[customerId || convo.participant_user_ids.find(id => id !== currentUserId)] || {};
        const subtitle = isStaff
          ? (p.company || p.role || 'Customer')
          : 'Direct message';
        const isPinned = pinnedSet.has(convo.id);

        return (
          <div key={convo.id} style={{ display: 'flex', alignItems: 'stretch', borderBottom: `0.5px solid ${t.borderSubtle}`, background: isPinned ? t.bgMuted : t.bgElevated }}>
            <button type="button" onClick={() => onSelect(convo)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '14px 16px' : '12px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', minHeight: isMobile ? 64 : undefined }}>
              <div style={{ width: isMobile ? 44 : 36, height: isMobile ? 44 : 36, borderRadius: '50%', background: t.bgSubtle, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 16 : 14, color: t.textMuted }}>
                {p.profile_avatar_url ? <img src={p.profile_avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (label[0] || '?').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isPinned && <span style={{ fontSize: 10, color: t.gold }}>★</span>}
                  {isStaff ? (
                    <CustomerNameWithBadges profile={p} name={label} size="sm" nameStyle={{ fontSize: 13 }} />
                  ) : (
                    <span style={{ fontWeight: 600 }}>{label}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: t.textFaint, marginTop: isStaff ? 4 : 0 }}>{subtitle}</div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.status === 'online' ? t.accent : t.border, flexShrink: 0 }} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, paddingRight: 8 }}>
              <button type="button" title={isPinned ? 'Unpin' : 'Pin to top'} onClick={() => (isPinned ? onUnpin?.(convo.id) : onPin?.(convo.id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4, opacity: 0.7, fontFamily: 'inherit' }}>
                {isPinned ? '★' : '☆'}
              </button>
              <button type="button" title="Remove from inbox" onClick={() => onDelete?.(convo.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 4, color: t.errorText, opacity: 0.75, fontFamily: 'inherit' }}>
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
