import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchConversations, fetchMessages, sendMessage, markMessagesRead,
  getOrCreateDirectConversation, getOrCreateSupportConversation, subscribeToMessages, getUnreadCount,
  fetchContactableUsers, getConversationTitle, isGroupConversation,
  getCustomerParticipantId, confirmConversationContact, redactProfileContacts,
} from '../../lib/community';
import { getNotificationPrefs, requestNotificationPermission } from '../../lib/notificationPrefs';
import { supabase } from '../../lib/supabase';
import ConversationList from './ConversationList';
import MessageThread from './MessageThread';
import MessageInput from './MessageInput';
import UserList from './UserList';

async function loadProfileMap(userIds) {
  if (!userIds.length) return {};
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, username, name, company, profile_avatar_url, status, is_portal_admin, email, phone')
    .in('user_id', userIds);
  const m = {};
  (data || []).forEach(p => { m[p.user_id] = p; });
  return m;
}

export default function ChatSidebar({
  user,
  open,
  onClose,
  isAdmin = false,
  variant = 'sidebar',
  onUnreadChange,
}) {
  const isPage = variant === 'page';
  const [tab, setTab] = useState('chats');
  const [conversations, setConversations] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [contactableUsers, setContactableUsers] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const subRef = useRef(null);

  const mergeProfiles = async (convos, msgs = []) => {
    const ids = new Set();
    convos.forEach(c => c.participant_user_ids.forEach(id => ids.add(id)));
    msgs.forEach(m => ids.add(m.from_user_id));
    const loaded = await loadProfileMap([...ids]);
    setProfiles(prev => ({ ...prev, ...loaded }));
  };

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    const [convos, contacts, count] = await Promise.all([
      fetchConversations(user.id, { isAdmin }),
      fetchContactableUsers(user.id, isAdmin),
      getUnreadCount(user.id, { isAdmin }),
    ]);
    setConversations(convos);
    setContactableUsers(contacts);
    setUnread(count);
    onUnreadChange?.(count);
    await mergeProfiles(convos);
  }, [user?.id, isAdmin, onUnreadChange]);

  useEffect(() => {
    if ((open || isPage) && user?.id) {
      refresh();
      const prefs = getNotificationPrefs();
      if (prefs.notifications && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        requestNotificationPermission();
      }
    }
  }, [open, isPage, user?.id, refresh]);

  useEffect(() => {
    if (!isPage) return;
    setActiveConvo(null);
    setTab('chats');
  }, [isPage]);

  useEffect(() => {
    if (!activeConvo?.id) return;
    setLoading(true);
    fetchMessages(activeConvo.id).then(async (msgs) => {
      setMessages(msgs);
      await mergeProfiles([activeConvo], msgs);
      if (!isGroupConversation(activeConvo)) {
        await markMessagesRead(activeConvo.id, user.id, { isAdmin });
        refresh();
      }
      setLoading(false);
    });
    if (subRef.current) subRef.current.unsubscribe();
    subRef.current = subscribeToMessages(activeConvo.id, async (msg) => {
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
      await mergeProfiles([], [msg]);
      if (!isGroupConversation(activeConvo)) {
        const shouldMark = isAdmin
          ? !profiles[msg.from_user_id]?.is_portal_admin
          : msg.to_user_id === user.id;
        if (shouldMark) {
          await markMessagesRead(activeConvo.id, user.id, { isAdmin });
          refresh();
        }
      }
    });
    return () => subRef.current?.unsubscribe();
  }, [activeConvo?.id, user.id, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const openChatWith = async (otherUserId) => {
    const convo = await getOrCreateDirectConversation(user.id, otherUserId);
    setActiveConvo(convo);
    setTab('chats');
    await refresh();
  };

  const openSupportChat = async () => {
    try {
      const convo = await getOrCreateSupportConversation(user.id);
      setActiveConvo(convo);
      setTab('chats');
      await refresh();
    } catch (_) {}
  };

  const handleSend = async (text) => {
    if (!activeConvo) return;
    const isGroup = isGroupConversation(activeConvo);
    let otherId = null;
    if (!isGroup) {
      if (isAdmin) {
        otherId = getCustomerParticipantId(activeConvo, profiles)
          || activeConvo.participant_user_ids.find(id => id !== user.id);
      } else {
        otherId = activeConvo.participant_user_ids.find(id => id !== user.id);
      }
    }
    await sendMessage({
      conversationId: activeConvo.id,
      fromUserId: user.id,
      toUserId: otherId,
      content: text,
      isGroup,
    });
    refresh();
  };

  const handleConfirmContact = async () => {
    if (!activeConvo?.id || !isAdmin) return;
    setConfirming(true);
    try {
      const updated = await confirmConversationContact(activeConvo.id, user.id);
      setActiveConvo(updated);
      await refresh();
    } catch (_) {}
    setConfirming(false);
  };

  const handleClose = () => {
    if (activeConvo && isPage) {
      setActiveConvo(null);
      return;
    }
    onClose?.();
  };

  const activeIsGroup = isGroupConversation(activeConvo);
  const contactRevealed = !!activeConvo?.contact_revealed;
  const otherUserId = activeConvo && !activeIsGroup
    ? activeConvo.participant_user_ids.find(id => id !== user.id)
    : null;
  const otherProfile = otherUserId ? profiles[otherUserId] : null;
  const safeOtherProfile = otherProfile
    ? redactProfileContacts(otherProfile, { contactRevealed, isSelf: false })
    : null;

  const headerTitle = activeConvo
    ? getConversationTitle(activeConvo, profiles, user.id, { isAdmin })
    : (isAdmin ? `Messages${unread ? ` (${unread})` : ''}` : 'Support');
  const headerSub = activeIsGroup
    ? `${activeConvo.participant_user_ids.length} members`
    : (isAdmin && activeConvo ? 'Shared support thread' : (isPage && !activeConvo ? 'Chat with our team' : null));

  if (!open && !isPage) return null;

  const panelStyle = isPage
    ? {
        width: '100%',
        height: '100%',
        background: '#FFF',
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        width: 360,
        maxWidth: '100vw',
        height: '100%',
        background: '#FFF',
        borderLeft: '0.5px solid #E0DDD8',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.08)',
      };

  const inner = (
    <div style={panelStyle}>
      <div style={{
        padding: isPage ? '14px 16px' : '12px 14px',
        paddingTop: isPage ? 'max(14px, env(safe-area-inset-top))' : undefined,
        borderBottom: '0.5px solid #E8E4DF',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: '#1A1A1A',
        flexShrink: 0,
      }}>
        {(activeConvo || isPage) ? (
          <button
            type="button"
            onClick={handleClose}
            style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', fontSize: 22, padding: '4px 8px 4px 0', fontFamily: 'inherit', lineHeight: 1 }}
            aria-label="Back"
          >
            ‹
          </button>
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: isPage ? 15 : 13, fontWeight: 600, color: '#FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{headerTitle}</div>
          {headerSub && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{headerSub}</div>}
        </div>
        {!isPage && (
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 22, fontFamily: 'inherit', padding: 4 }}>×</button>
        )}
      </div>

      {!activeConvo && isAdmin && (
        <div style={{ display: 'flex', borderBottom: '0.5px solid #E8E4DF', flexShrink: 0 }}>
          {[['chats', 'Inbox'], ['people', 'Customers']].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              style={{ flex: 1, padding: '12px 6px', border: 'none', background: tab === id ? '#F8F6F3' : '#FFF', fontSize: 12, fontWeight: tab === id ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', color: tab === id ? '#1A1A1A' : '#888' }}>
              {label}{id === 'chats' && unread ? ` (${unread})` : ''}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeConvo ? (
          <>
            {!activeIsGroup && (
              <div style={{ padding: '12px 14px', borderBottom: '0.5px solid #E8E4DF', background: '#FAFAF8', fontSize: 12, color: '#666', lineHeight: 1.5, flexShrink: 0 }}>
                {!contactRevealed && (
                  <>
                    {isAdmin ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span>Contact info is hidden until you confirm this lead.</span>
                        <button type="button" onClick={handleConfirmContact} disabled={confirming}
                          style={{ alignSelf: 'flex-start', background: '#4CAF7D', color: '#FFF', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: confirming ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                          {confirming ? 'Confirming…' : 'Confirm & share contact info'}
                        </button>
                      </div>
                    ) : (
                      <span>Our team will confirm your inquiry in chat before sharing direct contact details.</span>
                    )}
                  </>
                )}
                {contactRevealed && safeOtherProfile && (safeOtherProfile.phone || safeOtherProfile.email) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {safeOtherProfile.email && <span>📧 {safeOtherProfile.email}</span>}
                    {safeOtherProfile.phone && (
                      <a href={`https://wa.me/${safeOtherProfile.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ color: '#4CAF7D', textDecoration: 'none', fontWeight: 600 }}>
                        WhatsApp {safeOtherProfile.phone}
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
            <MessageThread messages={messages} currentUserId={user.id} profiles={profiles} loading={loading} isGroup={activeIsGroup} showStaffNames={isAdmin} />
            <MessageInput onSend={handleSend} placeholder={isAdmin ? 'Reply to customer...' : 'Type a message...'} isMobile={isPage} />
          </>
        ) : tab === 'chats' || !isAdmin ? (
          <ConversationList
            conversations={conversations}
            profiles={profiles}
            currentUserId={user.id}
            isAdmin={isAdmin}
            onSelect={setActiveConvo}
            onMessageSupport={!isAdmin ? openSupportChat : null}
            isMobile={isPage}
          />
        ) : (
          <UserList users={contactableUsers} onSelect={(u) => openChatWith(u.user_id)} emptyLabel="No customers yet." />
        )}
      </div>
    </div>
  );

  if (isPage) return inner;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.25)' }} role="presentation" />
      {inner}
    </div>
  );
}
