import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchConversations, fetchMessages, sendMessage, markMessagesRead,
  getOrCreateDirectConversation, getOrCreateSupportConversation, subscribeToMessages, getUnreadCount,
  fetchContactableUsers, getConversationTitle, isGroupConversation,
  getCustomerParticipantId, confirmConversationContact,
  joinStaffToConversation, updateCustomerAppointment, sendMessage as sendChatMessage,
} from '../../lib/community';
import { filterAndSortConversations, loadConvoPrefs, pinConversation, unpinConversation, hideConversation } from '../../lib/conversationPrefs';
import { validateAppointmentSlot, minAppointmentDateStr } from '../../lib/appointments';
import { getNotificationPrefs, requestNotificationPermission } from '../../lib/notificationPrefs';
import { subscribeToPushNotifications } from '../../lib/pushNotifications';
import { supabase } from '../../lib/supabase';
import {
  fetchCustomerStaffNotes, saveCustomerStaffNotes,
} from '../../lib/customerTransfer';
import {
  fetchLatestInquiryForUser, updateInquiryQuoteStatus, QUOTE_STATUSES,
} from '../../lib/inquiries';
import { messagesToAssistFormat } from '../../lib/chatAssist';
import ConversationList from './ConversationList';
import MessageThread from './MessageThread';
import MessageInput from './MessageInput';
import UserList from './UserList';
import CustomerBadges from '../CustomerBadges';
import StaffNotesCell from '../StaffNotesCell';
import QuoteStatusBadge from '../QuoteStatusBadge';
import ChatStaffTools from '../ChatStaffTools';
import ScheduleCallRequest from '../ScheduleCallRequest';
import StaffWhatsAppCallButton from './StaffWhatsAppCallButton';
import { useTheme } from '../../context/ThemeContext';

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
  isAdmin = false,
  isSalesRep = false,
  variant = 'sidebar',
  onUnreadChange,
  profileComplete = true,
  onRequireProfile,
  openSupportOnLoad = 0,
  customerChatLabel = 'Trade Desk',
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
    try {
      setLoadError('');
      const [convos, contacts, count] = await Promise.all([
        fetchConversations(user.id, { isAdmin, isSalesRep }),
        fetchContactableUsers(user.id, { isAdmin, isSalesRep }),
        getUnreadCount(user.id, { isAdmin, isSalesRep }),
      ]);
      setConversations(filterAndSortConversations(convos, user.id));
      setConvoPrefs(loadConvoPrefs(user.id));
      setContactableUsers(contacts);
      setUnread(count);
      onUnreadChange?.(count);
      await mergeProfiles(convos);
    } catch (err) {
      setLoadError(err?.message || 'Could not load messages. Pull down to refresh or try again.');
    }
  }, [user?.id, isAdmin, isSalesRep, onUnreadChange]);

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
    if (!activeConvo?.id) return;
    setLoading(true);
    fetchMessages(activeConvo.id).then(async (msgs) => {
      setMessages(msgs);
      await mergeProfiles([activeConvo], msgs);
      if (!isGroupConversation(activeConvo)) {
        await markMessagesRead(activeConvo.id, user.id, { isAdmin, isSalesRep });
        refresh();
      }
      setLoading(false);
    });
    if (subRef.current) subRef.current.unsubscribe();
    subRef.current = subscribeToMessages(activeConvo.id, async (msg) => {
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
      await mergeProfiles([], [msg]);
      if (!isGroupConversation(activeConvo)) {
        const shouldMark = isStaff
          ? !profiles[msg.from_user_id]?.is_portal_admin
          : msg.to_user_id === user.id;
        if (shouldMark) {
          await markMessagesRead(activeConvo.id, user.id, { isAdmin, isSalesRep });
          refresh();
        }
      }
    });
    return () => subRef.current?.unsubscribe();
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

  const handleDeleteConvo = (convoId) => {
    if (!window.confirm('Hide this chat from your inbox? You can start a new message anytime.')) return;
    const next = hideConversation(user.id, convoId);
    setConvoPrefs(next);
    if (activeConvo?.id === convoId) setActiveConvo(null);
    setConversations(prev => filterAndSortConversations(prev, user.id));
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
    setActiveConvo(convo);
    setTab('chats');
    await refresh();
  };

  const openSupportChat = async () => {
    if (!isStaff && !profileComplete) {
      onRequireProfile?.();
      return;
    }
    setSupportError('');
    try {
      const convo = await getOrCreateSupportConversation(user.id);
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
    openSupportChat().catch(() => {});
  }, [openSupportOnLoad]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (activeConvo) {
      setActiveConvo(null);
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
    : (isStaff && activeConvo ? 'Customer conversation' : (isPage && !activeConvo ? 'Chat with our team' : null));

  if (!open && !isPage) return null;

  const panelStyle = isPage
    ? {
        width: '100%',
        height: '100%',
        background: t.bgElevated,
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        width: 360,
        maxWidth: '100vw',
        height: '100%',
        background: t.bgElevated,
        borderLeft: t.borderHairlineLight,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: `-8px 0 32px ${t.shadow}`,
      };

  const showPageHeader = !isPage || activeConvo;

  const inner = (
    <div style={panelStyle}>
      {showPageHeader && (
      <div style={{
        padding: isPage ? '8px 12px' : '12px 14px',
        paddingTop: isPage ? 'max(8px, var(--ga-inset-top))' : undefined,
        borderBottom: t.borderHairlineLight,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: t.headerBg,
        flexShrink: 0,
      }}>
        {activeConvo && (
          <button
            type="button"
            onClick={handleClose}
            style={{ background: 'none', border: 'none', color: t.headerText, cursor: 'pointer', fontSize: 22, padding: '4px 8px 4px 0', fontFamily: 'inherit', lineHeight: 1 }}
            aria-label="Back"
          >
            ‹
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: isPage ? 15 : 13, fontWeight: 600, color: t.headerText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{headerTitle}</div>
          {isStaff && activeCustomerProfile && (
            <div style={{ marginTop: 6 }}>
              <CustomerBadges profile={activeCustomerProfile} size="sm" />
            </div>
          )}
          {headerSub && <div style={{ fontSize: 11, color: t.headerMuted, marginTop: 2 }}>{headerSub}</div>}
          {!isStaff && customerInquiry && (
            <div style={{ marginTop: 6 }}>
              <QuoteStatusBadge status={customerInquiry.quote_status || 'new'} size="sm" />
            </div>
          )}
        </div>
        {!isPage && (
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: t.headerMuted, cursor: 'pointer', fontSize: 22, fontFamily: 'inherit', padding: 4 }}>×</button>
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
        <div style={{ display: 'flex', borderBottom: t.borderHairlineLight, flexShrink: 0 }}>
          {[['chats', 'Inbox'], ['people', 'Customers']].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              style={{ flex: 1, padding: '12px 6px', border: 'none', background: tab === id ? t.bgMuted : t.bgElevated, fontSize: 12, fontWeight: tab === id ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', color: tab === id ? t.text : t.textMuted }}>
              {label}{id === 'chats' && unread ? ` (${unread})` : ''}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeConvo ? (
          <>
            {!activeIsGroup && isStaff && (
              <div style={{
                padding: '8px 12px',
                borderBottom: t.borderHairlineLight,
                background: t.bgHover,
                fontSize: 12,
                color: t.textSecondary,
                lineHeight: 1.45,
                flexShrink: 0,
                maxHeight: isPage ? 140 : 200,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}>
                {staffCustomerProfile && (
                  <div style={{ marginBottom: contactRevealed ? 10 : 0 }}>
                    <div style={{ fontSize: 10, color: t.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Customer (team only)</div>
                    <div style={{ fontWeight: 600, color: t.text, marginBottom: 4 }}>{staffCustomerProfile.name || 'Unnamed'}{staffCustomerProfile.company ? ` · ${staffCustomerProfile.company}` : ''}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                      {staffCustomerProfile.email && <span>📧 {staffCustomerProfile.email}</span>}
                      {staffCustomerProfile.phone && (
                        <span style={{ fontSize: 12, color: t.textSecondary }}>📱 {staffCustomerProfile.phone}</span>
                      )}
                      {isAdmin && customerInquiry && (
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
                    {!isAdmin && customerInquiry && (
                      <div style={{ marginTop: 8 }}>
                        <QuoteStatusBadge status={customerInquiry.quote_status || 'new'} />
                      </div>
                    )}
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
                      style={{ background: t.accent, color: '#FFF', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: joiningConvo ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
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
                {!contactRevealed && (
                  <>
                    {isAdmin ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: staffCustomerProfile ? 10 : 0, paddingTop: staffCustomerProfile ? 10 : 0, borderTop: staffCustomerProfile ? t.borderHairline : 'none' }}>
                        <span>Confirm when you are ready to proceed. Customers stay in {customerChatLabel} — your personal email is never shared.</span>
                        <button type="button" onClick={handleConfirmContact} disabled={confirming}
                          style={{ alignSelf: 'flex-start', background: t.accent, color: '#FFF', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: confirming ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                          {confirming ? 'Confirming…' : 'Confirm inquiry for customer'}
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
                {contactRevealed && isAdmin && (
                  <div style={{ fontSize: 11, color: t.successText, marginTop: 8 }}>Inquiry confirmed for this customer. Their contact info remains visible to your team only.</div>
                )}
              </div>
            )}
            {!activeIsGroup && !isStaff && (
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
            <MessageThread messages={messages} currentUserId={user.id} profiles={profiles} loading={loading} isGroup={activeIsGroup} showStaffNames={isStaff} />
            {!isStaff && activeConvo && (
              <ScheduleCallRequest
                user={user}
                isMobile={isPage}
                chatLabel={customerChatLabel}
                onSendMessage={(text) => handleSend(text)}
              />
            )}
            {isStaff && !activeIsGroup && staffCustomerProfile && (
              <div style={{
                padding: isPage ? '8px 14px 0' : '8px 12px 0',
                borderTop: t.borderHairlineLight,
                background: t.bgMuted,
                flexShrink: 0,
              }}>
                <StaffWhatsAppCallButton
                  phone={staffCustomerProfile.phone}
                  customerName={staffCustomerProfile.name}
                  isMobile={isPage}
                  inline
                />
              </div>
            )}
            <MessageInput
              onSend={handleSend}
              placeholder={isStaff ? 'Reply to customer...' : 'Type a message...'}
              isMobile={isPage}
              conversationId={activeConvo.id}
              userId={user.id}
              suggestedText={suggestedReply}
              onSuggestedTextApplied={() => setSuggestedReply('')}
            />
            {isStaff && !activeIsGroup && (
              <ChatStaffTools
                customerName={activeCustomerProfile?.name}
                assistMessages={messagesToAssistFormat(messages, customerUserId)}
                inquiryNotes={customerInquiry?.notes}
                onInsertText={(text) => setSuggestedReply(text)}
                isMobile={isPage}
              />
            )}
          </>
        ) : tab === 'chats' || !isStaff ? (
          <ConversationList
            conversations={conversations}
            profiles={profiles}
            currentUserId={user.id}
            isStaff={isStaff}
            onSelect={setActiveConvo}
            onMessageSupport={!isStaff ? openSupportChat : null}
            isMobile={isPage}
            customerChatLabel={customerChatLabel}
            pinnedIds={convoPrefs.pinned}
            onPin={(id) => handlePinConvo(id, true)}
            onUnpin={(id) => handlePinConvo(id, false)}
            onDelete={handleDeleteConvo}
          />
        ) : (
          <UserList users={contactableUsers} onSelect={(u) => openChatWith(u.user_id)} emptyLabel={isSalesRep ? 'No assigned customers yet. Share your rep code when signing people up.' : 'No customers yet.'} />
        )}
      </div>
    </div>
  );

  if (isPage) return inner;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ flex: 1, background: t.overlayLight }} role="presentation" />
      {inner}
    </div>
  );
}
