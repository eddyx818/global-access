import React, { useState } from 'react';

export default function MessageInput({ onSend, placeholder = 'Type a message...', isMobile = false }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onSend(text);
      setText('');
    } catch (_) {}
    setSending(false);
  };

  return (
    <div style={{
      padding: isMobile ? '10px 14px max(10px, env(safe-area-inset-bottom))' : '10px 12px',
      borderTop: '0.5px solid #E8E4DF',
      display: 'flex',
      gap: 10,
      background: '#FFF',
      flexShrink: 0,
    }}>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
        placeholder={placeholder}
        style={{
          flex: 1,
          background: '#F8F6F3',
          border: '0.5px solid #E0DDD8',
          borderRadius: isMobile ? 12 : 10,
          padding: isMobile ? '12px 14px' : '10px 12px',
          fontSize: 16,
          outline: 'none',
          fontFamily: 'inherit',
          minHeight: isMobile ? 44 : undefined,
        }}
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!text.trim() || sending}
        style={{
          width: isMobile ? 48 : 40,
          height: isMobile ? 48 : 40,
          background: text.trim() ? '#1A1A1A' : '#E0DDD8',
          border: 'none',
          borderRadius: isMobile ? 12 : 10,
          color: '#FFF',
          cursor: text.trim() ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        →
      </button>
    </div>
  );
}
