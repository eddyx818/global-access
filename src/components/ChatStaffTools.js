import React, { useState } from 'react';
import { QUICK_REPLIES, suggestReplyToCustomer } from '../lib/chatAssist';
import { useTheme } from '../context/ThemeContext';

export default function ChatStaffTools({
  customerName,
  assistMessages,
  inquiryNotes,
  onInsertText,
}) {
  const { t } = useTheme();
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

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
      padding: '10px 14px',
      borderTop: t.borderHairlineLight,
      background: t.bgMuted,
      flexShrink: 0,
    }}>
      <div style={{ fontSize: 10, color: t.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        Quick replies
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {QUICK_REPLIES.map((text) => (
          <button
            key={text.slice(0, 24)}
            type="button"
            onClick={() => onInsertText?.(text)}
            style={{
              background: t.bgElevated,
              border: t.borderHairline,
              borderRadius: 16,
              padding: '6px 10px',
              fontSize: 11,
              color: t.textSecondary,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
              maxWidth: '100%',
            }}
          >
            {text.length > 56 ? `${text.slice(0, 56)}…` : text}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={handleAiSuggest}
        disabled={aiLoading}
        style={{
          background: aiLoading ? t.border : t.goldBg,
          color: aiLoading ? t.textFaint : t.gold,
          border: `0.5px solid ${t.gold}`,
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 600,
          cursor: aiLoading ? 'wait' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {aiLoading ? 'Drafting reply…' : '✨ AI suggest reply'}
      </button>
      {aiError && (
        <div style={{ fontSize: 11, color: t.errorText, marginTop: 8 }}>{aiError}</div>
      )}
    </div>
  );
}
