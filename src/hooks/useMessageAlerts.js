import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getNotificationPrefs } from '../lib/notificationPrefs';
import { alertIncomingMessage, setAppBadgeCount } from '../lib/messageAlerts';

async function getSenderProfile(userId) {
  const { data } = await supabase
    .from('user_profiles')
    .select('name, company, username, is_portal_admin, role')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

function senderLabel(profile) {
  if (!profile) return 'Someone';
  return profile.name || profile.username || profile.company || 'Someone';
}

export function useMessageAlerts({
  userId,
  isAdmin = false,
  enabled = true,
  unread = 0,
  chatActive = false,
  onOpenChat,
}) {
  const chatActiveRef = useRef(chatActive);
  chatActiveRef.current = chatActive;
  const onOpenChatRef = useRef(onOpenChat);
  onOpenChatRef.current = onOpenChat;

  useEffect(() => {
    if (!enabled) {
      setAppBadgeCount(0);
      return;
    }
    const prefs = getNotificationPrefs();
    if (prefs.badge) setAppBadgeCount(unread);
    else setAppBadgeCount(0);
  }, [unread, enabled]);

  useEffect(() => {
    if (!userId || !enabled) return;

    const channel = supabase
      .channel(`message-alerts:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, async (payload) => {
        const msg = payload.new;
        if (!msg || msg.from_user_id === userId) return;

        if (isAdmin) {
          const sender = await getSenderProfile(msg.from_user_id);
          if (sender?.is_portal_admin || sender?.role === 'admin') return;
          const label = senderLabel(sender);
          const company = sender?.company ? ` (${sender.company})` : '';
          alertIncomingMessage({
            title: `New message from ${label}${company}`,
            body: msg.content,
            conversationId: msg.conversation_id,
            onClick: () => onOpenChatRef.current?.(),
            chatFocused: chatActiveRef.current && !document.hidden,
          });
          return;
        }

        if (msg.to_user_id && msg.to_user_id !== userId) return;

        const sender = await getSenderProfile(msg.from_user_id);
        if (sender?.is_portal_admin || sender?.role === 'admin') {
          alertIncomingMessage({
            title: 'Reply from Global Access',
            body: msg.content,
            conversationId: msg.conversation_id,
            onClick: () => onOpenChatRef.current?.(),
            chatFocused: chatActiveRef.current && !document.hidden,
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isAdmin, enabled]);

  useEffect(() => () => setAppBadgeCount(0), []);
}
