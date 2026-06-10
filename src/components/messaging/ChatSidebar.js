import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  fetchConversations, fetchMessages, sendMessage, markMessagesRead,
  getOrCreateDirectConversation, getOrCreateSupportConversation, subscribeToMessages, getUnreadCount,
  fetchContactableUsers, getConversationTitle, isGroupConversation,
  getCustomerParticipantId, confirmConversationContact,
  joinStaffToConversation, updateCustomerAppointment, sendMessage as sendChatMessage,
  softDeleteMessage, isMessageHiddenForUser, filterMessagesForCustomerView, isSupportConversation,
} from '../../lib/community';
import {
  filterAndSortConversations, loadConvoPrefs, pinConversation, unpinConversation, hideConversation,
  ensureConversationVisible, startConversationSession, getConversationSessionStart,
  dedupeCustomerSupportInbox, MAX_CUSTOMER_SUPPORT_CHATS,
} from '../../lib/conversationPrefs';
import { validateAppointmentSlot, minAppointmentDateStr } from '../../lib/appointments';
import { formatPhoneDisplay } from '../../lib/whatsapp';
import { getNotificationPrefs, requestNotificationPermission } from '../../lib/notificationPrefs';
import { subscribeToPushNotifications } from '../../lib/pushNotifications';
import { supabase } from '../../lib/supabase';
import {
  fetchCustomerStaffNotes, saveCustomerStaffNotes,
} from '../../lib/customerTransfer';
import {
  fetchLatestInquiryForUser, updateInquiryQuoteStatus, QUOTE_STATUSES,
} from '../../lib/inquiries';
import { messagesToAssistFormat, suggestReplyToCustomer } from '../../lib/chatAssist';
import ConversationList from './ConversationList';
import MessageThread from './MessageThread';
import MessageInput from './MessageInput';
import UserList from './UserList';
import CustomerBadges from '../CustomerBadges';
import StaffNotesCell from '../StaffNotesCell';
import QuoteStatusBadge from '../QuoteStatusBadge';
import QuoteBuilderPanel from '../QuoteBuilderPanel';
import ChatStaffTools from '../ChatStaffTools';
import ScheduleCallRequest from '../ScheduleCallRequest';
import StaffWhatsAppCallButton from './StaffWhatsAppCallButton';
import ChatPriceCheckPanel from '../ChatPriceCheckPanel';
import { useTheme } from '../../context/ThemeContext';
import useVisualViewportInset from '../../hooks/useVisualViewportInset';

async function loadProfileMap(userIds) {
  if (!userIds.length) return {};
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .in('user_id', userIds);
  if (error) return {};
  const m = {};
  (data || []).forEach(p => { m[p.user_id] = p; });
  return m;
}

export default function ChatSidebar({
  user,
  open,
  onClose,
  onThreadChange = null,
  isAdmin = false,
  isSalesRep = false,
  variant = 'sidebar',
  onUnreadChange,
  profileComplete = true,
  onRequireProfile,
  openSupportOnLoad = 0,
  openSupportFreshSession = false,
  onSupportOpened = null,
  customerChatLabel = 'Trade Desk',
  onPriceCheckSubmitted = null,
  desktopFloat = false,
}) {
  const { t } = useTheme();
  const isStaff = isAdmin || isSalesRep;
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
  const [supportError, setSupportError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [staffNotes, setStaffNotes] = useState('');
  const [customerInquiry, setCustomerInquiry] = useState(null);
  const [suggestedReply, setSuggestedReply] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [convoPrefs, setConvoPrefs] = useState({ pinned: [], hidden: [] });
  const [joiningConvo, setJoiningConvo] = useState(false);
  const [counterDate, setCounterDate] = useState('');
  const [counterTime, setCounterTime] = useState('');
  const [appointmentBusy, setAppointmentBusy] = useState(false);
  const [staffActionsOpen, setStaffActionsOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [minimized, setMinimized] = useState(false);
  const subRef = useRef(null);
  const keyboardInset = useVisualViewportInset(isPage);

  const mergeProfiles = async (convos, msgs = []) => {
    const ids = new Set();
    convos.forEach(c => c.participant_user_ids.forEach(id => ids.add(id)));
    msgs.forEach(m => ids.add(m.from_user_id));
    const loaded = await loadProfileMap([...ids]);
    setProfiles(prev => ({ ...prev, ...loaded }));
  };

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoadError('');
      const [convos, contacts, count] = await Promise.all([
        fetchConversations(user.id, { isAdmin, isSalesRep }),
        fetchContactableUsers(user.id, { isAdmin, isSalesRep }),
        getUnreadCount(user.id, { isAdmin, isSalesRep }),
      ]);
      const ids = new Set();
      convos.forEach(c => c.participant_user_ids.forEach(id => ids.add(id)));
      const loadedProfiles = ids.size ? await loadProfileMap([...ids]) : {};
      setProfiles(prev => ({ ...prev, ...loadedProfiles }));
      let visible = filterAndSortConversations(convos, user.id);
      if (isAdmin || isSalesRep) {
        visible = visible.filter(c => !!getCustomerParticipantId(c, loadedProfiles));
      }
      if (!isAdmin && !isSalesRep) {
        visible = dedupeCustomerSupportInbox(visible, loadedProfiles, user.id);
      }
      setConversations(visible);
      setConvoPrefs(loadConvoPrefs(user.id));
      setContactableUsers(contacts);
      setUnread(count);
      onUnreadChange?.(count);
    } catch (err) {
      setLoadError(err?.message || 'Could not load messages. Pull down to refresh or try again.');
    }
  }, [user?.id, isAdmin, isSalesRep, onUnreadChange]);

  useEffect(() => {
    if (!open && !isPage) setMinimized(false);
  }, [open, isPage]);

  useEffect(() => {
    if (!(open || isPage) || !user?.id) return;
    refresh();
    const prefs = getNotificationPrefs();
    if (typeof Notification !== 'undefined') {
      if (prefs.notifications && Notification.permission === 'default') {
        requestNotificationPermission().then((perm) => {
          if (perm === 'granted') subscribeToPushNotifications(user.id);
        });
      } else if (Notification.permission === 'granted') {
        subscribeToPushNotifications(user.id);
      }
    }
  }, [open, isPage, user?.id, refresh]);

  useEffect(() => {
    if (!isPage) return;
    setActiveConvo(null);
    setTab('chats');
  }, [isPage]);

  useEffect(() => {
    const convoId = activeConvo?.id;
    if (!convoId) {
      setMessages([]);
      setLoading(false);
      return undefined;
    }

    setMessages([]);
    setLoading(true);
    let cancelled = false;

    fetchMessages(convoId).then(async (msgs) => {
      if (cancelled) return;
      setMessages(msgs);
      await mergeProfiles([activeConvo], msgs);
      if (!isGroupConversation(activeConvo)) {
        await markMessagesRead(convoId, user.id, { isAdmin, isSalesRep });
        refresh();
      }
      if (!cancelled) setLoading(false);
    });

    if (subRef.current) subRef.current.unsubscribe();
    subRef.current = subscribeToMessages(
      convoId,
      async (msg) => {
        if (cancelled) return;
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        await mergeProfiles([], [msg]);
        if (!isGroupConversation(activeConvo)) {
          const shouldMark = isStaff
            ? !profiles[msg.from_user_id]?.is_portal_admin
            : msg.to_user_id === user.id;
          if (shouldMark) {
            await markMessagesRead(convoId, user.id, { isAdmin, isSalesRep });
            refresh();
          }
        }
      },
      async (msg) => {
        if (cancelled) return;
        if (isMessageHiddenForUser(msg, user.id, { isPortalAdmin: isAdmin })) {
          setMessages(prev => prev.filter(m => m.id !== msg.id));
          return;
        }
        setMessages(prev => prev.map(m => (m.id === msg.id ? msg : m)));
      },
    );

    return () => {
      cancelled = true;
      subRef.current?.unsubscribe();
    };
  }, [activeConvo?.id, user.id, isStaff]); // eslint-disable-line react-hooks/exhaustive-deps

  const customerUserId = activeConvo && isStaff && !isGroupConversation(activeConvo)
    ? getCustomerParticipantId(activeConvo, profiles)
    : (!isStaff ? user.id : null);

  useEffect(() => {
    if (!customerUserId) {
      setStaffNotes('');
      setCustomerInquiry(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [notes, inquiry] = await Promise.all([
        isStaff ? fetchCustomerStaffNotes(customerUserId) : Promise.resolve(''),
        fetchLatestInquiryForUser(customerUserId),
      ]);
      if (cancelled) return;
      setStaffNotes(notes);
      setCustomerInquiry(inquiry);
    })();
    return () => { cancelled = true; };
  }, [customerUserId, isStaff]);

  const handleSaveStaffNotes = async (notes) => {
    if (!customerUserId) return false;
    const result = await saveCustomerStaffNotes(customerUserId, notes);
    if (result.ok) setStaffNotes(notes || '');
    return result.ok;
  };

  const handlePinConvo = (convoId, pinned) => {
    const next = pinned ? pinConversation(user.id, convoId) : unpinConversation(user.id, convoId);
    setConvoPrefs(next);
    setConversations(prev => filterAndSortConversations(prev, user.id));
  };

  const handleDeleteConvo = async (convoId) => {
    const label = isStaff
      ? 'Remove this chat from your inbox? It clears automatically after 48 hours without activity.'
      : 'Archive this chat? It will leave your inbox. Message Trade Desk again anytime to start fresh.';
    if (!window.confirm(label)) return;

    let next = hideConversation(user.id, convoId);

    if (!isStaff) {
      try {
        const allConvos = await fetchConversations(user.id, { isAdmin: false, isSalesRep: false });
        const ids = new Set();
        allConvos.forEach(c => c.participant_user_ids.forEach(id => ids.add(id)));
        const profileMap = ids.size ? await loadProfileMap([...ids]) : {};
        for (const c of allConvos) {
          if (isSupportConversation(c, profileMap, user.id)) {
            next = hideConversation(user.id, c.id);
            next = startConversationSession(user.id, c.id);
          }
        }
      } catch (_) {}
    }

    setConvoPrefs(next);
    if (activeConvo?.id === convoId || (!isStaff && activeConvo && isSupportConversation(activeConvo, profiles, user.id))) {
      setActiveConvo(null);
      setMessages([]);
    }
    setConversations(prev => prev.filter(c => !next.hidden.includes(c.id)));
    try {
      const count = await getUnreadCount(user.id, { isAdmin, isSalesRep });
      setUnread(count);
      onUnreadChange?.(count);
    } catch (_) {}
  };

  const handleSelectConvo = (convo) => {
    setMessages([]);
    setActiveConvo(convo);
  };

  const handleJoinConvo = async () => {
    if (!activeConvo?.id || !isStaff) return;
    setJoiningConvo(true);
    try {
      const updated = await joinStaffToConversation(activeConvo.id, user.id);
      setActiveConvo(updated);
      await refresh();
    } catch (_) {}
    setJoiningConvo(false);
  };

  const handleAcceptAppointment = async () => {
    if (!customerUserId || !staffCustomerProfile?.preferred_appointment_at) return;
    setAppointmentBusy(true);
    await updateCustomerAppointment(customerUserId, {
      appointment_status: 'accepted',
      preferred_appointment_at: staffCustomerProfile.preferred_appointment_at,
    }, {
      sendMessageFn: (text) => sendChatMessage({
        conversationId: activeConvo.id,
        fromUserId: user.id,
        toUserId: customerUserId,
        content: text,
      }),
    });
    await mergeProfiles([activeConvo]);
    const loaded = await loadProfileMap([customerUserId]);
    setProfiles(prev => ({ ...prev, ...loaded }));
    setAppointmentBusy(false);
  };

  const handleCounterAppointment = async () => {
    if (!customerUserId) return;
    const check = validateAppointmentSlot(counterDate, counterTime);
    if (!check.ok) { window.alert(check.error); return; }
    setAppointmentBusy(true);
    await updateCustomerAppointment(customerUserId, {
      appointment_status: 'countered',
      appointment_counter_at: check.iso,
      preferred_appointment_at: check.iso,
    }, {
      sendMessageFn: (text) => sendChatMessage({
        conversationId: activeConvo.id,
        fromUserId: user.id,
        toUserId: customerUserId,
        content: text,
      }),
    });
    setCounterDate('');
    setCounterTime('');
    const loaded = await loadProfileMap([customerUserId]);
    setProfiles(prev => ({ ...prev, ...loaded }));
    setAppointmentBusy(false);
  };

  const isParticipant = activeConvo?.participant_user_ids?.includes(user.id);

  const handleQuoteStatusChange = async (status) => {
    if (!customerInquiry?.id || status === customerInquiry.quote_status) return;
    setStatusUpdating(true);
    const result = await updateInquiryQuoteStatus(customerInquiry.id, status);
    if (result.ok) {
      setCustomerInquiry(prev => ({ ...prev, quote_status: status }));
    }
    setStatusUpdating(false);
  };

  const openChatWith = async (otherUserId) => {
    const convo = await getOrCreateDirectConversation(user.id, otherUserId);
    const next = ensureConversationVisible(user.id, convo.id);
    setConvoPrefs(next);
    setActiveConvo(convo);
    setTab('chats');
    await refresh();
  };

  const openSupportChat = async ({ freshSession = false } = {}) => {
    if (!isStaff && !profileComplete) {
      onRequireProfile?.();
      return;
    }
    setSupportError('');
    try {
      const convo = await getOrCreateSupportConversation(user.id);
      const prefs = loadConvoPrefs(user.id);
      const visibleSupport = conversations.filter(c =>
        isSupportConversation(c, profiles, user.id) && !prefs.hidden.includes(c.id)
      );

      if (!isStaff && freshSession) {
        if (visibleSupport.length >= MAX_CUSTOMER_SUPPORT_CHATS && !visibleSupport.some(c => c.id === convo.id)) {
          setSupportError(`You can keep up to ${MAX_CUSTOMER_SUPPORT_CHATS} active chats. Archive one before starting another.`);
          return;
        }
      }

      let next = loadConvoPrefs(user.id);
      if (!isStaff && freshSession) {
        next = ensureConversationVisible(user.id, convo.id);
        next = startConversationSession(user.id, convo.id);
      }
      setConvoPrefs(next);

      setMessages([]);
      setActiveConvo(convo);
      setTab('chats');
      await refresh();
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('not available')) {
        setSupportError('Support chat is not set up yet. Please try again later or submit an access request.');
      } else {
        setSupportError(msg || 'Could not open Support chat. Please try again.');
      }
    }
  };

  useEffect(() => {
    if (!openSupportOnLoad || !user?.id || isStaff) return;
    if (!(open || isPage) || !profileComplete) return;
    openSupportChat({ freshSession: !!openSupportFreshSession })
      .catch(() => {})
      .finally(() => onSupportOpened?.());
  }, [openSupportOnLoad]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteMessage = async (messageId, scope) => {
    const label = scope === 'customer'
      ? 'Hide this message from the customer? Your team and admins can still see it.'
      : 'Delete this message for you?';
    if (!window.confirm(label)) return;
    const result = await softDeleteMessage(messageId, scope);
    if (!result.ok) {
      window.alert(result.error || 'Could not delete message.');
      return;
    }
    const msgs = await fetchMessages(activeConvo.id);
    setMessages(msgs);
  };

  const handleSend = async (text, attachment = null) => {
    if (!activeConvo) return;
    if (!isStaff && !profileComplete) {
      onRequireProfile?.();
      return;
    }
    const isGroup = isGroupConversation(activeConvo);
    let otherId = null;
    if (!isGroup) {
      if (isStaff) {
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
      attachment,
      isGroup,
    });
    const next = ensureConversationVisible(user.id, activeConvo.id);
    setConvoPrefs(next);
    await refresh();
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
    if (activeConvo) {
      setActiveConvo(null);
      setMessages([]);
      refresh();
      return;
    }
    onClose?.();
  };

  const activeIsGroup = isGroupConversation(activeConvo);
  const contactRevealed = !!activeConvo?.contact_revealed;

  const activeCustomerProfile = activeConvo && isStaff && !activeIsGroup
    ? profiles[getCustomerParticipantId(activeConvo, profiles)]
    : null;
  const staffCustomerProfile = isStaff && activeCustomerProfile ? activeCustomerProfile : null;

  const headerTitle = activeConvo
    ? getConversationTitle(activeConvo, profiles, user.id, { isAdmin, isSalesRep, customerChatLabel })
    : (isStaff ? `Messages${unread ? ` (${unread})` : ''}` : customerChatLabel);
  const headerSub = activeIsGroup
    ? `${(activeConvo.participant_user_ids || []).length} members`
    : (isStaff && activeConvo && !isPage ? 'Customer conversation' : (isPage && !activeConvo ? 'Chat with our team' : null));

  useEffect(() => {
    onThreadChange?.(!!activeConvo);
    return () => onThreadChange?.(false);
  }, [activeConvo, onThreadChange]);

  useEffect(() => {
    setStaffActionsOpen(false);
    setAiError('');
  }, [activeConvo?.id]);

  const handleAiSuggest = async () => {
    if (!isStaff || activeIsGroup) return;
    setAiLoading(true);
    setAiError('');
    const result = await suggestReplyToCustomer({
      customerName: activeCustomerProfile?.name,
      messages: messagesToAssistFormat(messages, customerUserId),
      inquiryNotes: customerInquiry?.notes,
    });
    setAiLoading(false);
    if (!result.ok) {
      setAiError(result.error || 'Could not generate suggestion.');
      return;
    }
    setSuggestedReply(result.text);
  };

  const displayMessages = useMemo(() => {
    if (isStaff || !activeConvo?.id) return messages;
    const sessionStart = getConversationSessionStart(user.id, activeConvo.id);
    return filterMessagesForCustomerView(messages, user.id, sessionStart);
  }, [messages, isStaff, activeConvo?.id, user.id, convoPrefs]);

  const renderStaffConversationTools = () => (
    <>
      {staffCustomerProfile && (
        <div style={{ marginBottom: contactRevealed ? 10 : 0 }}>
          <div style={{ fontSize: 10, color: t.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Customer (team only)</div>
          <div style={{ fontWeight: 600, color: t.text, marginBottom: 4 }}>{staffCustomerProfile.name || 'Unnamed'}{staffCustomerProfile.company ? ` · ${staffCustomerProfile.company}` : ''}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            {staffCustomerProfile.email && <span>📧 {staffCustomerProfile.email}</span>}
            {staffCustomerProfile.phone && (
              <span style={{ fontSize: 12, color: t.textSecondary }}>📱 {formatPhoneDisplay(staffCustomerProfile.phone)}</span>
            )}
            {isStaff && customerInquiry && (
              <select
                value={customerInquiry.quote_status || 'new'}
                disabled={statusUpdating}
                onChange={(e) => handleQuoteStatusChange(e.target.value)}
                style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, border: t.borderHairline, background: t.bgElevated, fontFamily: 'inherit', cursor: statusUpdating ? 'wait' : 'pointer' }}
              >
                {QUOTE_STATUSES.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            )}
          </div>
          {staffCustomerProfile.referral_code_used && (
            <div style={{ fontSize: 11, color: t.gold, marginTop: 6 }}>Signed up with code: {staffCustomerProfile.referral_code_used}</div>
          )}
          <StaffWhatsAppCallButton
            phone={staffCustomerProfile.phone}
            customerName={staffCustomerProfile.name}
            isMobile={isPage}
          />
        </div>
      )}
      {isStaff && activeConvo && !isParticipant && (
        <div style={{ marginBottom: 10 }}>
          <button type="button" onClick={handleJoinConvo} disabled={joiningConvo}
            style={{ width: isPage ? '100%' : undefined, background: t.accent, color: '#FFF', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: joiningConvo ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
            {joiningConvo ? 'Joining…' : 'Join this conversation'}
          </button>
        </div>
      )}
      {isStaff && staffCustomerProfile?.preferred_appointment_at && (staffCustomerProfile.appointment_status === 'pending' || !staffCustomerProfile.appointment_status || staffCustomerProfile.appointment_status === 'none') && (
        <div style={{ marginBottom: 10, padding: 10, background: t.bgMuted, borderRadius: 10, border: t.borderHairlineLight }}>
          <div style={{ fontSize: 10, color: t.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Call request</div>
          <div style={{ fontSize: 12, color: t.text, marginBottom: 8 }}>
            {new Date(staffCustomerProfile.preferred_appointment_at).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <button type="button" onClick={handleAcceptAppointment} disabled={appointmentBusy}
              style={{ background: t.successBg, color: t.successText, border: `0.5px solid ${t.successBorder}`, borderRadius: 8, padding: '8px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Accept
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input type="date" value={counterDate} min={minAppointmentDateStr()} onChange={e => setCounterDate(e.target.value)} style={{ fontSize: 14, padding: '8px', borderRadius: 8, border: t.borderHairline, fontFamily: 'inherit' }} />
            <input type="time" value={counterTime} onChange={e => setCounterTime(e.target.value)} style={{ fontSize: 14, padding: '8px', borderRadius: 8, border: t.borderHairline, fontFamily: 'inherit' }} />
          </div>
          <button type="button" onClick={handleCounterAppointment} disabled={appointmentBusy}
            style={{ background: t.bgElevated, color: t.text, border: t.borderHairline, borderRadius: 8, padding: '8px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Propose different time
          </button>
        </div>
      )}
      {isStaff && customerUserId && activeConvo && (
        <ChatPriceCheckPanel
          staffUserId={user.id}
          customerProfile={staffCustomerProfile}
          customerUserId={customerUserId}
          conversationId={activeConvo.id}
          customerInquiry={customerInquiry}
          lastCustomerMessage={[...messages].reverse().find(m => m.from_user_id === customerUserId && m.content && !m.is_system)?.content || ''}
          onSubmitted={() => onPriceCheckSubmitted?.()}
        />
      )}
      {isStaff && customerInquiry && (
        <QuoteBuilderPanel
          inquiry={customerInquiry}
          staffUserId={user.id}
          customerUserId={customerUserId}
          compact
          onUpdated={(updated) => setCustomerInquiry(updated)}
          onSent={async (updated) => {
            setCustomerInquiry(updated);
            if (activeConvo?.id) {
              const msgs = await fetchMessages(activeConvo.id);
              setMessages(msgs);
            }
          }}
        />
      )}
      {isStaff && customerUserId && (
        <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: t.borderHairlineLight }}>
          <div style={{ fontSize: 10, color: t.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Staff notes (internal)</div>
          <StaffNotesCell
            value={staffNotes}
            onSave={handleSaveStaffNotes}
            placeholder="Notes visible to admins and reps only…"
          />
        </div>
      )}
      {!contactRevealed && isAdmin ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: staffCustomerProfile ? 10 : 0, paddingTop: staffCustomerProfile ? 10 : 0, borderTop: staffCustomerProfile ? t.borderHairline : 'none' }}>
          <span>Confirm when you are ready to proceed. Customers stay in {customerChatLabel} — your personal email is never shared.</span>
          <button type="button" onClick={handleConfirmContact} disabled={confirming}
            style={{ alignSelf: isPage ? 'stretch' : 'flex-start', background: t.accent, color: '#FFF', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: confirming ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {confirming ? 'Confirming…' : 'Confirm inquiry for customer'}
          </button>
        </div>
      ) : null}
      {contactRevealed && isAdmin && (
        <div style={{ fontSize: 11, color: t.successText, marginTop: 8 }}>Inquiry confirmed for this customer. Their contact info remains visible to your team only.</div>
      )}
    </>
  );

  if (!open && !isPage) return null;

  const inMobileThread = isPage && !!activeConvo;
  const isFloatDesktop = desktopFloat && !isPage;

  const panelStyle = isPage
    ? {
        width: '100%',
        height: inMobileThread ? '100dvh' : '100%',
        background: t.bgElevated,
        display: 'flex',
        flexDirection: 'column',
        ...(inMobileThread ? { position: 'fixed', inset: 0, zIndex: 450 } : {}),
      }
    : {
        width: '100%',
        height: '100%',
        background: t.bgElevated,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      };

  const showPageHeader = !isPage || activeConvo || isPage;

  const inner = (
    <div className={isPage ? `chat-page-panel${inMobileThread ? ' chat-thread-panel' : ''}` : (isFloatDesktop ? 'chat-float-panel' : undefined)} style={panelStyle}>
      {showPageHeader && (
      <div
        className={isFloatDesktop ? 'chat-float-header' : undefined}
        style={{
        padding: isPage ? '6px 10px' : (isFloatDesktop ? undefined : '12px 14px'),
        paddingTop: isPage && activeConvo ? 'max(6px, env(safe-area-inset-top, 0px))' : (isPage ? 6 : undefined),
        borderBottom: isFloatDesktop ? undefined : t.borderHairlineLight,
        display: 'flex',
        alignItems: 'center',
        gap: isPage ? 6 : 8,
        background: isFloatDesktop ? undefined : t.headerBg,
        flexShrink: 0,
        minHeight: isPage ? undefined : undefined,
      }}>
        {isPage && activeConvo && (
          <button
            type="button"
            onClick={handleClose}
            style={{ background: 'none', border: 'none', color: t.headerText, cursor: 'pointer', fontSize: 26, padding: '2px 6px 2px 0', fontFamily: 'inherit', lineHeight: 1, flexShrink: 0 }}
            aria-label="Back to inbox"
          >
            ‹
          </button>
        )}
        {!isPage && activeConvo && (
          <button
            type="button"
            className={isFloatDesktop ? 'chat-float-back-btn' : undefined}
            onClick={() => { setActiveConvo(null); setMessages([]); }}
            style={{ background: isFloatDesktop ? undefined : 'none', border: 'none', color: isFloatDesktop ? undefined : t.headerText, cursor: 'pointer', fontSize: 22, padding: '2px 6px 2px 0', fontFamily: 'inherit', lineHeight: 1, flexShrink: 0 }}
            aria-label="Back to inbox"
          >
            ‹
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={isFloatDesktop ? 'chat-float-title' : undefined} style={{ fontSize: isPage ? 14 : 13, fontWeight: 600, color: isFloatDesktop ? undefined : t.headerText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.25 }}>{headerTitle}</div>
          {isStaff && activeCustomerProfile && !isPage && (
            <div style={{ marginTop: 6 }}>
              <CustomerBadges profile={activeCustomerProfile} size="sm" />
            </div>
          )}
          {headerSub && <div className={isFloatDesktop ? 'chat-float-sub' : undefined} style={{ fontSize: 11, color: isFloatDesktop ? undefined : t.headerMuted, marginTop: 2 }}>{headerSub}</div>}
          {!isStaff && customerInquiry && !isPage && (
            <div style={{ marginTop: 6 }}>
              <QuoteStatusBadge status={customerInquiry.quote_status || 'new'} size="sm" />
            </div>
          )}
        </div>
        {!isPage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {isFloatDesktop && (
              <button
                type="button"
                className={isFloatDesktop ? 'chat-float-minimize-btn' : undefined}
                onClick={() => setMinimized(true)}
                aria-label="Minimize chat"
                title="Minimize"
              >
                ─
              </button>
            )}
            <button type="button" className={isFloatDesktop ? 'chat-float-close-btn' : undefined} onClick={onClose} style={{ background: isFloatDesktop ? undefined : 'none', border: 'none', color: isFloatDesktop ? undefined : t.headerMuted, cursor: 'pointer', fontSize: 22, fontFamily: 'inherit', padding: isFloatDesktop ? undefined : 4 }} aria-label="Close chat">×</button>
          </div>
        )}
      </div>
      )}

      {supportError && (
        <div style={{ padding: '10px 14px', background: t.errorBg, borderBottom: `0.5px solid ${t.errorBorder}`, fontSize: 12, color: t.errorText, lineHeight: 1.5, flexShrink: 0 }}>
          {supportError}
          <button type="button" onClick={() => setSupportError('')} style={{ background: 'none', border: 'none', color: t.errorText, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, marginLeft: 8 }}>×</button>
        </div>
      )}

      {loadError && (
        <div style={{ padding: '10px 14px', background: t.errorBg, borderBottom: `0.5px solid ${t.errorBorder}`, fontSize: 12, color: t.errorText, lineHeight: 1.5, flexShrink: 0 }}>
          {loadError}
          <button type="button" onClick={() => refresh()} style={{ background: 'none', border: 'none', color: t.errorText, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, marginLeft: 8, textDecoration: 'underline' }}>Retry</button>
        </div>
      )}

      {!activeConvo && isStaff && (
        <div className={isFloatDesktop ? 'chat-float-tabs' : undefined} style={{ display: 'flex', borderBottom: isFloatDesktop ? undefined : t.borderHairlineLight, flexShrink: 0, flexDirection: 'column' }}>
          <div style={{ display: 'flex', width: '100%' }}>
          {[['chats', 'Inbox'], ['people', 'Customers']].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={isFloatDesktop ? (tab === id ? 'chat-float-tab chat-float-tab--active' : 'chat-float-tab') : undefined}
              style={{ flex: 1, padding: '12px 6px', border: 'none', background: isFloatDesktop ? undefined : (tab === id ? t.bgMuted : t.bgElevated), fontSize: 12, fontWeight: tab === id ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', color: isFloatDesktop ? undefined : (tab === id ? t.text : t.textMuted) }}>
              {label}{id === 'chats' && unread ? ` (${unread})` : ''}
            </button>
          ))}
          </div>
          {tab === 'chats' && (
            <div className="chat-inbox-hint">Active threads from the last 48 hours — includes messages you send and receive.</div>
          )}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeConvo ? (
          <>
            {!activeIsGroup && isStaff && (
                <div
                  className={isFloatDesktop ? 'chat-staff-actions-bar' : undefined}
                  style={{ flexShrink: 0, borderBottom: t.borderHairlineLight, background: t.bgHover }}
                >
                  <button
                    type="button"
                    onClick={() => setStaffActionsOpen(v => !v)}
                    className={isFloatDesktop ? 'chat-staff-actions-toggle' : undefined}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: isFloatDesktop ? '8px 14px' : '9px 12px',
                      background: 'none',
                      border: 'none',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                      {staffActionsOpen ? '▲ Hide actions' : '▼ Actions & tools'}
                    </span>
                    {!staffActionsOpen && (
                      <span style={{ fontSize: 10, color: t.textFaint, flexShrink: 0 }}>
                        WhatsApp · call · price check · notes
                      </span>
                    )}
                  </button>
                  {staffActionsOpen && (
                    <div
                      className="chat-staff-actions-scroll"
                      style={{
                        padding: isFloatDesktop ? '0 14px 12px' : '0 12px 12px',
                        maxHeight: isFloatDesktop ? 'min(40vh, 280px)' : '36vh',
                        overflowY: 'auto',
                        WebkitOverflowScrolling: 'touch',
                        fontSize: 12,
                        color: t.textSecondary,
                        lineHeight: 1.45,
                      }}
                    >
                      {renderStaffConversationTools()}
                    </div>
                  )}
                </div>
            )}
            {!activeIsGroup && !isStaff && !isPage && (
              <div style={{
                padding: '8px 12px',
                borderBottom: t.borderHairlineLight,
                background: t.bgHover,
                fontSize: 12,
                color: t.textSecondary,
                flexShrink: 0,
              }}>
                {!contactRevealed && (
                  <span>Our team will confirm your inquiry in chat. You can message us here anytime.</span>
                )}
                {contactRevealed && (
                  <div style={{ fontSize: 12, color: t.successText, fontWeight: 600 }}>
                    Your inquiry is confirmed — continue in {customerChatLabel}.
                  </div>
                )}
              </div>
            )}
            <MessageThread
              messages={displayMessages}
              currentUserId={user.id}
              profiles={profiles}
              loading={loading}
              isGroup={activeIsGroup}
              showStaffNames={isStaff}
              isStaff={isStaff}
              customerUserId={customerUserId}
              onDeleteMessage={isStaff ? handleDeleteMessage : null}
            />
            {!isStaff && activeConvo && (
              <ScheduleCallRequest
                user={user}
                isMobile={isPage}
                chatLabel={customerChatLabel}
                onSendMessage={(text) => handleSend(text)}
              />
            )}
            <div
              className={`chat-compose-bar${isFloatDesktop ? ' chat-float-compose' : ''}`}
              style={{
                flexShrink: 0,
                background: isFloatDesktop ? undefined : t.bgElevated,
                paddingBottom: keyboardInset > 0 ? keyboardInset : undefined,
              }}
            >
              {isStaff && !activeIsGroup && !isPage && (
                <ChatStaffTools
                  customerName={activeCustomerProfile?.name}
                  assistMessages={messagesToAssistFormat(messages, customerUserId)}
                  inquiryNotes={customerInquiry?.notes}
                  onInsertText={(text) => setSuggestedReply(text)}
                  isMobile={isPage}
                />
              )}
              <MessageInput
                onSend={handleSend}
                placeholder={isStaff ? 'Reply to customer...' : 'Type a message...'}
                isMobile={isPage}
                conversationId={activeConvo.id}
                userId={user.id}
                suggestedText={suggestedReply}
                onSuggestedTextApplied={() => setSuggestedReply('')}
                keyboardInset={keyboardInset}
                showAiSuggest={isStaff && !activeIsGroup && isPage}
                onAiSuggest={handleAiSuggest}
                aiSuggestLoading={aiLoading}
                aiError={aiError}
                onComposeFocus={() => {
                  if (isPage || isFloatDesktop) setStaffActionsOpen(false);
                }}
              />
            </div>
          </>
        ) : tab === 'chats' || !isStaff ? (
          <ConversationList
            conversations={conversations}
            profiles={profiles}
            currentUserId={user.id}
            isStaff={isStaff}
            onSelect={handleSelectConvo}
            onMessageSupport={!isStaff ? () => openSupportChat({ freshSession: true }) : null}
            isMobile={isPage}
            customerChatLabel={customerChatLabel}
            pinnedIds={convoPrefs.pinned}
            onPin={(id) => handlePinConvo(id, true)}
            onUnpin={(id) => handlePinConvo(id, false)}
            onDelete={handleDeleteConvo}
            compactInbox={isPage}
          />
        ) : (
          <UserList users={contactableUsers} onSelect={(u) => openChatWith(u.user_id)} emptyLabel={isSalesRep ? 'No assigned customers yet. Share your rep code when signing people up.' : 'No customers yet.'} />
        )}
      </div>
    </div>
  );

  if (isPage) return inner;

  if (desktopFloat && minimized) {
    return (
      <button
        type="button"
        className="chat-float-minimized"
        onClick={() => setMinimized(false)}
        aria-label="Open messages"
      >
        <span className="chat-float-minimized__icon" aria-hidden>💬</span>
        <span className="chat-float-minimized__label">{isStaff ? 'Messages' : customerChatLabel}</span>
        {unread > 0 && (
          <span className="chat-float-minimized__badge">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>
    );
  }

  if (desktopFloat) {
    return (
      <div className="chat-float-widget">
        {inner}
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ flex: 1, background: t.overlayLight }} role="presentation" />
      <div style={{
        width: 360,
        maxWidth: '100vw',
        height: '100%',
        background: t.bgElevated,
        borderLeft: t.borderHairlineLight,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: `-8px 0 32px ${t.shadow}`,
        overflow: 'hidden',
      }}>
        {inner}
      </div>
    </div>
  );
}
