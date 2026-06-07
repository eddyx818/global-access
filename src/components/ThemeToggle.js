import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { THEMES } from '../lib/theme';

export default function ThemeToggle({ compact = false, fullWidth = false }) {
  const { t, theme, setTheme } = useTheme();

  return (
    <div style={{
      display: 'flex',
      gap: compact ? 6 : 8,
      justifyContent: fullWidth ? 'stretch' : 'center',
      ...(compact || fullWidth ? {} : { marginTop: '1.25rem' }),
    }}>
      {[
        { id: THEMES.DAY, label: 'Day', icon: '☀' },
        { id: THEMES.NIGHT, label: 'Night', icon: '🌙' },
      ].map(({ id, label, icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setTheme(id)}
          aria-pressed={theme === id}
          style={{
            flex: fullWidth ? 1 : undefined,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: compact ? 4 : 6,
            background: theme === id ? t.btnPrimaryBg : t.bgElevated,
            color: theme === id ? t.btnPrimaryText : t.textMuted,
            border: theme === id ? `1.5px solid ${t.accent}` : t.borderHairline,
            borderRadius: compact ? 8 : 10,
            padding: compact ? '8px 10px' : fullWidth ? '11px 10px' : '8px 16px',
            fontSize: compact ? 12 : 13,
            minHeight: fullWidth ? 44 : undefined,
            fontWeight: theme === id ? 600 : 400,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: compact ? 14 : 16 }}>{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
}
