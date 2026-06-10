import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { uploadChatAttachment, validateChatFile } from '../../lib/chatAttachments';
import { useTheme } from '../../context/ThemeContext';

const FILE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf';

function composeHeights(isMobile, expanded) {
  const lineHeight = 1.4;
  const fontSize = 16;
  const padY = isMobile ? 10 : 8;
  const linePx = fontSize * lineHeight;
  const visibleLines = expanded ? 14 : (isMobile ? 5 : 4);
  const expandedCap = isMobile ? Math.round(window.innerHeight * 0.38) : 280;
  const maxFromLines = Math.round(linePx * visibleLines + padY * 2);
  return {
    minH: Math.round(linePx + padY * 2),
    maxH: expanded ? Math.max(maxFromLines, expandedCap) : maxFromLines,
  };
}

export default function MessageInput({
  onSend,
  placeholder = 'Type a message...',
  isMobile = false,
  conversationId,
  userId,
  suggestedText = '',
  onSuggestedTextApplied,
  showAiSuggest = false,
  onAiSuggest,
  aiSuggestLoading = false,
  aiError = '',
  onComposeFocus,
  onComposeBlur,
}) {
  const { t } = useTheme();
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [error, setError] = useState('');

  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const { minH, maxH } = composeHeights(isMobile, expanded);
    el.style.height = '0px';
    const contentH = el.scrollHeight;
    const next = Math.max(minH, Math.min(contentH, maxH));
    el.style.height = `${next}px`;
    el.style.overflowY = contentH > maxH ? 'auto' : 'hidden';
    if (contentH > maxH) {
      el.scrollTop = el.scrollHeight;
    }
  }, [isMobile, expanded]);

  useLayoutEffect(() => {
    autoResize();
  }, [text, autoResize]);

  useEffect(() => {
    if (!expanded) return undefined;
    const onResize = () => autoResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [expanded, autoResize]);

  useEffect(() => {
    if (!suggestedText) return;
    setText(suggestedText);
    onSuggestedTextApplied?.();
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      autoResize();
    });
  }, [suggestedText]); // eslint-disable-line react-hooks/exhaustive-deps

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
    input.tabIndex = -1;
    input.style.cssText = 'position:fixed;left:-9999px;opacity:0;width:1px;height:1px;';
    input.addEventListener('change', (e) => {
      handlePickFile(e);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
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
      setExpanded(false);
      requestAnimationFrame(() => autoResize());
    } catch (err) {
      setError(err?.message || 'Could not send message.');
    }
    setSending(false);
  };

  const canSend = (text.trim() || pendingFile) && !sending;
  const mobileTabSkip = isMobile ? { tabIndex: -1 } : {};

  const handleFocus = () => {
    onComposeFocus?.();
  };

  const handleBlur = () => {
    onComposeBlur?.();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !expanded) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleExpanded = () => {
    setExpanded(v => !v);
    requestAnimationFrame(() => {
      autoResize();
      inputRef.current?.focus();
    });
  };

  const mobileFieldNavProps = isMobile
    ? { enterKeyHint: 'send', inputMode: 'text' }
    : { enterKeyHint: 'send' };

  return (
    <div
      className={[
        'chat-compose',
        isMobile ? 'chat-compose--mobile' : '',
        expanded ? 'chat-compose--expanded' : '',
      ].filter(Boolean).join(' ')}
      style={{
        borderTop: t.borderHairlineLight,
        background: t.bgElevated,
        flexShrink: 0,
        minWidth: 0,
      }}
    >
      {pendingFile && (
        <div className="chat-compose-attachment">
          <span className="chat-compose-attachment__name">📎 {pendingFile.name}</span>
          <button type="button" onClick={() => setPendingFile(null)} className="chat-compose-attachment__remove" style={{ color: t.errorText }} {...mobileTabSkip}>
            Remove
          </button>
        </div>
      )}
      {(error || aiError) && (
        <div className="chat-compose-error" style={{ color: t.errorText }}>{error || aiError}</div>
      )}
      <div
        className="chat-compose-row"
        style={{
          padding: isMobile
            ? '10px 14px max(10px, env(safe-area-inset-bottom, 0px))'
            : '10px 12px',
        }}
      >
        <div
          className="chat-compose-shell"
          style={{
            background: t.inputBg,
            border: t.borderHairline,
          }}
        >
          <div className="chat-compose-editor">
            <textarea
              ref={inputRef}
              className="chat-compose-field"
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={placeholder}
              autoComplete="off"
              autoCorrect="on"
              spellCheck
              aria-label={placeholder}
              style={{ color: t.text }}
              {...mobileFieldNavProps}
            />
            {isMobile && (
              <button
                type="button"
                className="chat-compose-expand"
                onClick={toggleExpanded}
                aria-label={expanded ? 'Collapse message box' : 'Expand message box'}
                title={expanded ? 'Collapse' : 'Expand'}
                {...mobileTabSkip}
              >
                <span className={`chat-compose-expand-icon${expanded ? ' chat-compose-expand-icon--expanded' : ''}`} aria-hidden />
              </button>
            )}
          </div>
          <div className="chat-compose-toolbar">
            <button
              type="button"
              className="chat-compose-tool"
              onClick={handleAttachClick}
              disabled={sending}
              title="Attach photo or document"
              aria-label="Attach file"
              {...mobileTabSkip}
            >
              📎
            </button>
            {showAiSuggest && (
              <button
                type="button"
                className="chat-compose-tool chat-compose-tool--ai"
                onClick={onAiSuggest}
                disabled={aiSuggestLoading || sending}
                title="AI suggest reply"
                aria-label="AI suggest reply"
                {...mobileTabSkip}
                style={{ color: t.gold }}
              >
                {aiSuggestLoading ? '…' : '✨'}
              </button>
            )}
            <div className="chat-compose-toolbar__spacer" />
            <button
              type="button"
              className={`chat-compose-send${canSend ? ' chat-compose-send--active' : ''}`}
              onClick={handleSend}
              disabled={!canSend}
              aria-label="Send message"
              {...mobileTabSkip}
              style={{
                color: canSend ? t.btnPrimaryText : t.textDisabled,
                background: canSend ? t.btnPrimaryBg : 'transparent',
              }}
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
