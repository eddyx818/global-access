import React, { useRef, useState, useEffect } from 'react';
import { uploadChatAttachment, validateChatFile } from '../../lib/chatAttachments';
import { useTheme } from '../../context/ThemeContext';

const FILE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf';

export default function MessageInput({
  onSend,
  placeholder = 'Type a message...',
  isMobile = false,
  conversationId,
  userId,
  suggestedText = '',
  onSuggestedTextApplied,
  keyboardInset = 0,
  showAiSuggest = false,
  onAiSuggest,
  aiSuggestLoading = false,
  aiError = '',
  onComposeFocus,
}) {
  const { t } = useTheme();
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!suggestedText) return;
    setText(suggestedText);
    onSuggestedTextApplied?.();
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      if (isMobile) {
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
      }
    });
  }, [suggestedText]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [error, setError] = useState('');

  const handlePickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      validateChatFile(file);
      setPendingFile(file);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAttachClick = () => {
    if (sending) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = FILE_ACCEPT;
    input.style.cssText = 'position:fixed;left:-9999px;opacity:0;width:1px;height:1px;';
    input.addEventListener('change', (e) => {
      handlePickFile(e);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  };

  const autoResize = () => {
    const el = inputRef.current;
    if (!el || !isMobile) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
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
      if (inputRef.current && isMobile) {
        inputRef.current.style.height = 'auto';
      }
    } catch (err) {
      setError(err?.message || 'Could not send message.');
    }
    setSending(false);
  };

  const canSend = (text.trim() || pendingFile) && !sending;

  const fieldStyle = {
    flex: 1,
    background: t.inputBg,
    border: t.borderHairline,
    borderRadius: isMobile ? 12 : 10,
    padding: isMobile ? '12px 14px' : '10px 12px',
    fontSize: 16,
    outline: 'none',
    fontFamily: 'inherit',
    minHeight: isMobile ? 44 : undefined,
    maxHeight: isMobile ? 120 : undefined,
    color: t.text,
    resize: 'none',
    lineHeight: 1.35,
    boxSizing: 'border-box',
  };

  const handleFocus = () => {
    onComposeFocus?.();
    if (!isMobile) return;
    requestAnimationFrame(() => {
      inputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
      {(error || aiError) && (
        <div style={{ padding: '6px 14px 0', fontSize: 11, color: t.errorText }}>{error || aiError}</div>
      )}
      <div style={{
        padding: isMobile
          ? `10px 14px ${keyboardInset > 0 ? 10 : 'max(10px, env(safe-area-inset-bottom, 0px))'}`
          : '10px 12px',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
      }}>
        <button
          type="button"
          onClick={handleAttachClick}
          disabled={sending}
          title="Attach photo or document"
          tabIndex={-1}
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
        {showAiSuggest && (
          <button
            type="button"
            onClick={onAiSuggest}
            disabled={aiSuggestLoading || sending}
            title="AI suggest reply"
            style={{
              width: isMobile ? 44 : 40,
              height: isMobile ? 44 : 40,
              background: aiSuggestLoading ? t.border : t.goldBg,
              border: `0.5px solid ${t.gold}`,
              borderRadius: isMobile ? 12 : 10,
              cursor: aiSuggestLoading ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              fontSize: 18,
              flexShrink: 0,
              color: t.gold,
            }}
          >
            {aiSuggestLoading ? '…' : '✨'}
          </button>
        )}
        {isMobile ? (
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => { setText(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder={placeholder}
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="on"
            spellCheck
            aria-label={placeholder}
            style={fieldStyle}
          />
        ) : (
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            onFocus={handleFocus}
            placeholder={placeholder}
            style={fieldStyle}
          />
        )}
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
