import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getUnreadCount, subscribeToMessages } from '../lib/community';

export function useUnreadCount(userId, { isAdmin = false, enabled = true } = {}) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId || !enabled) return;
    const count = await getUnreadCount(userId, { isAdmin });
    setUnread(count);
  }, [userId, isAdmin, enabled]);

  useEffect(() => {
    if (!userId || !enabled) {
      setUnread(0);
      return;
    }
    refresh();
    const interval = setInterval(refresh, 45000);
    return () => clearInterval(interval);
  }, [userId, enabled, refresh]);

  useEffect(() => {
    if (!userId || !enabled) return;

    const channel = supabase
      .channel(`unread:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, () => refresh())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
      }, () => refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, enabled, refresh]);

  return { unread, refresh };
}

export { subscribeToMessages };
