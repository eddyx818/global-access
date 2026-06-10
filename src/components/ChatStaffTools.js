import React, { useState } from 'react';
import { QUICK_REPLIES, MAX_QUICK_REPLIES_SHOWN, suggestReplyToCustomer } from '../lib/chatAssist';

export default function ChatStaffTools({
  customerName,
  assistMessages,
  inquiryNotes,
  onInsertText,
  isMobile = false,
}) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [expanded, setExpanded] = useState(!isMobile);

  const quickReplies = QUICK_REPLIES.slice(0, MAX_QUICK_REPLIES_SHOWN);

  const handleAiSuggest = async () => {
    setAiLoading(true);
    setAiError('');
    const result = await suggestReplyToCustomer({
      customerName,
      messages: assistMessages,
      inquiryNotes,
    });
    setAiLoading(false);
    if (!result.ok) {
      setAiError(result.error || 'Could not generate suggestion.');
      return;
    }
    onInsertText?.(result.text);
  };

  return (
    <div className={`chat-reply-helpers${expanded ? ' chat-reply-helpers--open' : ''}`}>
      <div className="chat-reply-helpers__head">
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="chat-reply-helpers__toggle"
          aria-expanded={expanded}
        >
          <span className="chat-reply-helpers__label">Quick replies</span>
          <span
            className={`chat-staff-actions-chevron${expanded ? ' chat-staff-actions-chevron--open' : ''}`}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={handleAiSuggest}
          disabled={aiLoading}
          className="chat-reply-helpers__ai"
        >
          {aiLoading ? 'Drafting…' : '✨ AI suggest'}
        </button>
      </div>

      <div className="chat-reply-helpers__panel">
        <div className="chat-reply-helpers__panel-inner">
          <div className="chat-reply-helpers__chips">
            {quickReplies.map((text) => (
              <button
                key={text.slice(0, 24)}
                type="button"
                onClick={() => onInsertText?.(text)}
                className="chat-reply-helpers__chip"
                title={text}
              >
                {text.length > 48 ? `${text.slice(0, 48)}…` : text}
              </button>
            ))}
          </div>
          {aiError && (
            <div className="chat-reply-helpers__error">{aiError}</div>
          )}
        </div>
      </div>
    </div>
  );
}
