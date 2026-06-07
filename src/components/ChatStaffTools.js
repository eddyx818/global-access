import React, { useState } from 'react';
import { QUICK_REPLIES, MAX_QUICK_REPLIES_SHOWN, suggestReplyToCustomer } from '../lib/chatAssist';
import { useTheme } from '../context/ThemeContext';

export default function ChatStaffTools({
  customerName,
  assistMessages,
  inquiryNotes,
  onInsertText,
  isMobile = false,
}) {
  const { t } = useTheme();
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
    <div style={{
      padding: isMobile ? '8px 12px' : '10px 14px',
      borderTop: t.borderHairlineLight,
      background: t.bgMuted,
      flexShrink: 0,
      maxHeight: expanded ? (isMobile ? 132 : 148) : 44,
      overflow: 'hidden',
      transition: 'max-height 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: expanded ? 8 : 0 }}>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 10,
            color: t.textFaint,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          Reply helpers {expanded ? '▲' : '▼'}
        </button>
        <button
          type="button"
          onClick={handleAiSuggest}
          disabled={aiLoading}
          style={{
            background: aiLoading ? t.border : t.goldBg,
            color: aiLoading ? t.textFaint : t.gold,
            border: `0.5px solid ${t.gold}`,
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 600,
            cursor: aiLoading ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {aiLoading ? 'Drafting…' : '✨ AI suggest'}
        </button>
      </div>

      {expanded && (
        <>
          <div style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 2,
            scrollbarWidth: 'none',
          }}>
            {quickReplies.map((text) => (
              <button
                key={text.slice(0, 24)}
                type="button"
                onClick={() => onInsertText?.(text)}
                style={{
                  flexShrink: 0,
                  maxWidth: isMobile ? 220 : 260,
                  background: t.bgElevated,
                  border: t.borderHairline,
                  borderRadius: 16,
                  padding: '6px 10px',
                  fontSize: 11,
                  color: t.textSecondary,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  lineHeight: 1.35,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={text}
              >
                {text.length > 48 ? `${text.slice(0, 48)}…` : text}
              </button>
            ))}
          </div>
          {aiError && (
            <div style={{ fontSize: 11, color: t.errorText, marginTop: 6 }}>{aiError}</div>
          )}
        </>
      )}
    </div>
  );
}
