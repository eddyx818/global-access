import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { getUnreadCount, subscribeToMessages } from '../lib/community';
import { debounce } from '../lib/debounce';

export function useUnreadCount(userId, { isAdmin = false, isSalesRep = false, enabled = true } = {}) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId || !enabled) return;
    const count = await getUnreadCount(userId, { isAdmin, isSalesRep });
    setUnread(count);
  }, [userId, isAdmin, isSalesRep, enabled]);

  const debouncedRefresh = useMemo(() => debounce(() => { refresh(); }, 600), [refresh]);

  useEffect(() => () => debouncedRefresh.cancel(), [debouncedRefresh]);

  useEffect(() => {
    if (!userId || !enabled) {
      setUnread(0);
      return;
    }
    refresh();
    const interval = setInterval(refresh, 60000);
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
      }, debouncedRefresh)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
      }, debouncedRefresh)
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
      }, debouncedRefresh)
      .subscribe();

    return () => {
      debouncedRefresh.cancel();
      supabase.removeChannel(channel);
    };
  }, [userId, enabled, debouncedRefresh]);

  return { unread, refresh };
}

export { subscribeToMessages };
