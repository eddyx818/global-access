import React, { useRef, useState, useEffect } from 'react';
import { uploadChatAttachment, validateChatFile } from '../../lib/chatAttachments';
import { useTheme } from '../../context/ThemeContext';

export default function MessageInput({
  onSend,
  placeholder = 'Type a message...',
  isMobile = false,
  conversationId,
  userId,
  suggestedText = '',
  onSuggestedTextApplied,
}) {
  const { t } = useTheme();
  const [text, setText] = useState('');

  useEffect(() => {
    if (!suggestedText) return;
    setText(suggestedText);
    onSuggestedTextApplied?.();
  }, [suggestedText]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handlePickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      validateChatFile(file);
      setPendingFile(file);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSend = async () => {
    if ((!text.trim() && !pendingFile) || sending) return;
    setSending(true);
    setError('');
    try {
      let attachment = null;
      if (pendingFile) {
        attachment = await uploadChatAttachment(pendingFile, { conversationId, userId });
      }
      await onSend(text, attachment);
      setText('');
      setPendingFile(null);
    } catch (err) {
      setError(err?.message || 'Could not send message.');
    }
    setSending(false);
  };

  const canSend = (text.trim() || pendingFile) && !sending;

  return (
    <div style={{
      borderTop: t.borderHairlineLight,
      background: t.bgElevated,
      flexShrink: 0,
    }}>
      {pendingFile && (
        <div style={{
          padding: '8px 14px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: t.textSecondary,
        }}>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📎 {pendingFile.name}
          </span>
          <button type="button" onClick={() => setPendingFile(null)}
            style={{ background: 'none', border: 'none', color: t.errorText, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
            Remove
          </button>
        </div>
      )}
      {error && (
        <div style={{ padding: '6px 14px 0', fontSize: 11, color: t.errorText }}>{error}</div>
      )}
      <div style={{
        padding: isMobile ? '10px 14px max(10px, env(safe-area-inset-bottom))' : '10px 12px',
        display: 'flex',
        gap: 8,
      }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          style={{ display: 'none' }}
          onChange={handlePickFile}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          title="Attach photo or document"
          style={{
            width: isMobile ? 44 : 40,
            height: isMobile ? 44 : 40,
            background: t.inputBg,
            border: t.borderHairline,
            borderRadius: isMobile ? 12 : 10,
            cursor: sending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          📎
        </button>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: t.inputBg,
            border: t.borderHairline,
            borderRadius: isMobile ? 12 : 10,
            padding: isMobile ? '12px 14px' : '10px 12px',
            fontSize: 16,
            outline: 'none',
            fontFamily: 'inherit',
            minHeight: isMobile ? 44 : undefined,
            color: t.text,
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          style={{
            width: isMobile ? 48 : 40,
            height: isMobile ? 48 : 40,
            background: canSend ? t.btnPrimaryBg : t.border,
            border: 'none',
            borderRadius: isMobile ? 12 : 10,
            color: canSend ? t.btnPrimaryText : t.textDisabled,
            cursor: canSend ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}
