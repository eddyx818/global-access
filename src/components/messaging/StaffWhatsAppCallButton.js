import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { whatsAppContactUrl, hasCallablePhone } from '../../lib/whatsapp';

/** Staff-only — opens customer's WhatsApp; rep/admin taps call inside WhatsApp. */
export default function StaffWhatsAppCallButton({
  phone,
  customerName = '',
  isMobile = false,
  inline = false,
}) {
  const { t } = useTheme();

  if (!hasCallablePhone(phone)) {
    return (
      <span style={{ fontSize: 11, color: t.textFaint, fontStyle: 'italic' }}>
        No phone on file — ask customer to add one in their profile.
      </span>
    );
  }

  const url = whatsAppContactUrl(phone);
  const label = customerName ? `Call ${customerName.split(' ')[0]} on WhatsApp` : 'Call on WhatsApp';

  if (inline) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: '#25D366',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 11,
          fontWeight: 700,
          fontFamily: 'inherit',
        }}
      >
        <span aria-hidden>📞</span>
        {label}
      </a>
    );
  }

  return (
    <div style={{
      marginTop: 8,
      padding: isMobile ? '10px 0 0' : '8px 0 0',
      borderTop: t.borderHairlineLight,
    }}>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          boxSizing: 'border-box',
          background: '#25D366',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: 10,
          padding: isMobile ? '12px 14px' : '10px 14px',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'inherit',
          boxShadow: '0 2px 10px rgba(37,211,102,0.35)',
        }}
      >
        <span style={{ fontSize: 18 }} aria-hidden>📞</span>
        {label}
      </a>
      <p style={{
        margin: '6px 0 0',
        fontSize: 10,
        color: t.textFaint,
        lineHeight: 1.45,
        textAlign: 'center',
      }}>
        Opens WhatsApp on your phone — tap the voice call icon there. Customer stays in portal chat.
      </p>
    </div>
  );
}
