import React, { useState, useEffect, useRef } from 'react';
import {
  fetchConversations, fetchMessages, sendMessage, markMessagesRead,
  getOrCreateDirectConversation, getOrCreateSupportConversation, subscribeToMessages, getUnreadCount,
  fetchContactableUsers, getConversationTitle, isGroupConversation,
  getCustomerParticipantId,
} from '../../lib/community';
import { supabase } from '../../lib/supabase';
import ConversationList from './ConversationList';
import MessageThread from './MessageThread';
import MessageInput from './MessageInput';
import UserList from './UserList';

async function loadProfileMap(userIds) {
  if (!userIds.length) return {};
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, username, name, company, profile_avatar_url, status, is_portal_admin')
    .in('user_id', userIds);
  const m = {};
  (data || []).forEach(p => { m[p.user_id] = p; });
  return m;
}

export default function ChatSidebar({ user, open, onClose, isAdmin = false }) {
  const [tab, setTab] = useState('chats');
  const [conversations, setConversations] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [contactableUsers, setContactableUsers] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const subRef = useRef(null);

  const mergeProfiles = async (convos, msgs = []) => {
    const ids = new Set();
    convos.forEach(c => c.participant_user_ids.forEach(id => ids.add(id)));
    msgs.forEach(m => ids.add(m.from_user_id));
    const loaded = await loadProfileMap([...ids]);
    setProfiles(prev => ({ ...prev, ...loaded }));
  };

  const refresh = async () => {
    if (!user?.id) return;
    const [convos, contacts, count] = await Promise.all([
      fetchConversations(user.id, { isAdmin }),
      fetchContactableUsers(user.id, isAdmin),
      getUnreadCount(user.id, { isAdmin }),
    ]);
    setConversations(convos);
    setContactableUsers(contacts);
    setUnread(count);
    await mergeProfiles(convos);
  };

  useEffect(() => {
    if (open && user?.id) refresh();
  }, [open, user?.id, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeConvo?.id) return;
    setLoading(true);
    fetchMessages(activeConvo.id).then(async (msgs) => {
      setMessages(msgs);
      await mergeProfiles([activeConvo], msgs);
      if (!isGroupConversation(activeConvo)) {
        await markMessagesRead(activeConvo.id, user.id, { isAdmin });
        if (isAdmin) refresh();
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
          if (isAdmin) refresh();
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
    if (isAdmin) refresh();
  };

  const activeIsGroup = isGroupConversation(activeConvo);
  const headerTitle = activeConvo
    ? getConversationTitle(activeConvo, profiles, user.id, { isAdmin })
    : (isAdmin ? `Messages${unread ? ` (${unread})` : ''}` : 'Support');
  const headerSub = activeIsGroup
    ? `${activeConvo.participant_user_ids.length} members`
    : (isAdmin && activeConvo ? 'Shared support thread' : null);

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.25)' }} />
      <div style={{ width: 360, maxWidth: '100vw', height: '100%', background: '#FFF', borderLeft: '0.5px solid #E0DDD8', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '12px 14px', borderBottom: '0.5px solid #E8E4DF', display: 'flex', alignItems: 'center', gap: 8, background: '#1A1A1A' }}>
          {activeConvo ? (
            <button onClick={() => setActiveConvo(null)} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', fontSize: 18, padding: 0, fontFamily: 'inherit' }}>‹</button>
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{headerTitle}</div>
            {headerSub && <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{headerSub}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20, fontFamily: 'inherit' }}>×</button>
        </div>

        {!activeConvo && isAdmin && (
          <div style={{ display: 'flex', borderBottom: '0.5px solid #E8E4DF' }}>
            {[['chats', 'Inbox'], ['people', 'Customers']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                style={{ flex: 1, padding: '10px 6px', border: 'none', background: tab === id ? '#F8F6F3' : '#FFF', fontSize: 11, fontWeight: tab === id ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', color: tab === id ? '#1A1A1A' : '#888' }}>
                {label}{id === 'chats' && unread ? ` (${unread})` : ''}
              </button>
            ))}
          </div>
        )}

        {activeConvo ? (
          <>
            <MessageThread messages={messages} currentUserId={user.id} profiles={profiles} loading={loading} isGroup={activeIsGroup} showStaffNames={isAdmin} />
            <MessageInput onSend={handleSend} placeholder={isAdmin ? 'Reply to customer...' : 'Type a message...'} />
          </>
        ) : tab === 'chats' || !isAdmin ? (
          <ConversationList
            conversations={conversations}
            profiles={profiles}
            currentUserId={user.id}
            isAdmin={isAdmin}
            onSelect={setActiveConvo}
            onMessageSupport={!isAdmin ? openSupportChat : null}
          />
        ) : (
          <UserList users={contactableUsers} onSelect={(u) => openChatWith(u.user_id)} emptyLabel="No customers yet." />
        )}
      </div>
    </div>
  );
}
