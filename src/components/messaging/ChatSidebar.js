import React, { useState, useEffect, useRef } from 'react';
import {
  fetchConversations, fetchMessages, sendMessage, markMessagesRead,
  getOrCreateDirectConversation, subscribeToMessages, getUnreadCount, fetchOnlineUsers,
} from '../../lib/community';
import { supabase } from '../../lib/supabase';
import ConversationList from './ConversationList';
import MessageThread from './MessageThread';
import MessageInput from './MessageInput';
import UserList from './UserList';

export default function ChatSidebar({ user, open, onClose }) {
  const [tab, setTab] = useState('chats');
  const [conversations, setConversations] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const subRef = useRef(null);

  const loadProfiles = async (convos) => {
    const ids = new Set();
    convos.forEach(c => c.participant_user_ids.forEach(id => ids.add(id)));
    if (!ids.size) return;
    const { data } = await supabase.from('user_profiles').select('user_id, username, name, company, profile_avatar_url, status').in('user_id', [...ids]);
    const m = {};
    (data || []).forEach(p => { m[p.user_id] = p; });
    setProfiles(m);
  };

  const refresh = async () => {
    if (!user?.id) return;
    const [convos, online, count] = await Promise.all([
      fetchConversations(user.id),
      fetchOnlineUsers(),
      getUnreadCount(user.id),
    ]);
    setConversations(convos);
    setOnlineUsers(online.filter(u => u.user_id !== user.id));
    setUnread(count);
    await loadProfiles(convos);
  };

  useEffect(() => {
    if (open && user?.id) refresh();
  }, [open, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeConvo?.id) return;
    setLoading(true);
    fetchMessages(activeConvo.id).then(msgs => {
      setMessages(msgs);
      markMessagesRead(activeConvo.id, user.id);
      setLoading(false);
    });
    if (subRef.current) subRef.current.unsubscribe();
    subRef.current = subscribeToMessages(activeConvo.id, (msg) => {
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
      if (msg.to_user_id === user.id) markMessagesRead(activeConvo.id, user.id);
    });
    return () => subRef.current?.unsubscribe();
  }, [activeConvo?.id, user.id]);

  const openChatWith = async (otherUserId) => {
    const convo = await getOrCreateDirectConversation(user.id, otherUserId);
    setActiveConvo(convo);
    setTab('chats');
    await refresh();
  };

  const handleSend = async (text) => {
    if (!activeConvo) return;
    const otherId = activeConvo.participant_user_ids.find(id => id !== user.id);
    await sendMessage({
      conversationId: activeConvo.id,
      fromUserId: user.id,
      toUserId: otherId,
      content: text,
    });
  };

  const otherParticipant = (convo) => {
    const oid = convo.participant_user_ids.find(id => id !== user.id);
    return profiles[oid] || { name: 'User', user_id: oid };
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.25)' }} />
      <div style={{ width: 360, maxWidth: '100vw', height: '100%', background: '#FFF', borderLeft: '0.5px solid #E0DDD8', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '12px 14px', borderBottom: '0.5px solid #E8E4DF', display: 'flex', alignItems: 'center', gap: 8, background: '#1A1A1A' }}>
          {activeConvo ? (
            <button onClick={() => setActiveConvo(null)} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', fontSize: 18, padding: 0, fontFamily: 'inherit' }}>‹</button>
          ) : null}
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#FFF' }}>
            {activeConvo ? (otherParticipant(activeConvo).username || otherParticipant(activeConvo).name || 'Chat') : `Messages${unread ? ` (${unread})` : ''}`}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20, fontFamily: 'inherit' }}>×</button>
        </div>

        {!activeConvo && (
          <div style={{ display: 'flex', borderBottom: '0.5px solid #E8E4DF' }}>
            {[['chats', 'Chats'], ['people', 'Online']].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                style={{ flex: 1, padding: '10px', border: 'none', background: tab === id ? '#F8F6F3' : '#FFF', fontSize: 12, fontWeight: tab === id ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', color: tab === id ? '#1A1A1A' : '#888' }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {activeConvo ? (
          <>
            <MessageThread messages={messages} currentUserId={user.id} profiles={profiles} loading={loading} />
            <MessageInput onSend={handleSend} />
          </>
        ) : tab === 'chats' ? (
          <ConversationList conversations={conversations} profiles={profiles} currentUserId={user.id} onSelect={setActiveConvo} />
        ) : (
          <UserList users={onlineUsers} onSelect={(u) => openChatWith(u.user_id)} />
        )}
      </div>
    </div>
  );
}
