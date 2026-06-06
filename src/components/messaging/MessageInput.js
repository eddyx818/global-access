import React, { useState } from 'react';

export default function MessageInput({ onSend }) {
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
    <div style={{ padding: '10px 12px', borderTop: '0.5px solid #E8E4DF', display: 'flex', gap: 8, background: '#FFF' }}>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
        placeholder="Type a message..."
        style={{ flex: 1, background: '#F8F6F3', border: '0.5px solid #E0DDD8', borderRadius: 10, padding: '10px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
      />
      <button onClick={handleSend} disabled={!text.trim() || sending}
        style={{ width: 40, height: 40, background: text.trim() ? '#1A1A1A' : '#E0DDD8', border: 'none', borderRadius: 10, color: '#FFF', cursor: text.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontSize: 16 }}>
        →
      </button>
    </div>
  );
}
