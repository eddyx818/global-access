import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { whatsAppUrl, hasCallablePhone } from '../lib/whatsapp';

/**
 * Opens WhatsApp on whoever clicks (staff/admin) — uses their logged-in WhatsApp app.
 * Destination is the customer's number; message is prefilled. No staff numbers in code.
 */
export default function WhatsAppContactButton({
  customerPhone,
  message = '',
  label = 'WhatsApp',
  compact = false,
  fullWidth = true,
  disabledHint = 'No phone on file for this contact.',
}) {
  const { t } = useTheme();

  if (!hasCallablePhone(customerPhone)) {
    return (
      <span style={{ fontSize: 11, color: t.textFaint, fontStyle: 'italic', lineHeight: 1.45 }}>
        {disabledHint}
      </span>
    );
  }

  const url = whatsAppUrl(customerPhone, message);
  if (!url) return null;

  const style = compact
    ? {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      background: '#25D366',
      color: '#fff',
      textDecoration: 'none',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 11,
      fontWeight: 700,
      fontFamily: 'inherit',
    }
    : {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: fullWidth ? '100%' : undefined,
      boxSizing: 'border-box',
      background: '#25D366',
      color: '#fff',
      textDecoration: 'none',
      borderRadius: 10,
      padding: '12px 14px',
      fontSize: 13,
      fontWeight: 700,
      fontFamily: 'inherit',
      boxShadow: '0 2px 10px rgba(37,211,102,0.35)',
    };

  return (
    <a href={url} target="_blank" rel="noreferrer" style={style}>
      <span aria-hidden style={{ fontSize: compact ? 14 : 18 }}>💬</span>
      {label}
    </a>
  );
}
