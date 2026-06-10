import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { portalType } from '../lib/portalCopy';

export function PortalPageHeader({ title, subtitle, size = 28, style = {} }) {
  const { t } = useTheme();
  return (
    <div style={style}>
      <div style={{ ...(size >= 34 ? portalType.pageTitle(size) : portalType.pageTitleSm), color: t.text }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ ...portalType.pageSubtitle, color: t.textMuted, marginTop: 6 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

export function PortalSectionLabel({ children, style = {} }) {
  const { t } = useTheme();
  return (
    <div style={{ ...portalType.sectionLabel, color: t.textFaint, marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}

export function PortalCallout({ children, accentColor, style = {} }) {
  const { t } = useTheme();
  const border = accentColor ? `${accentColor}33` : t.borderHairlineLight;
  const bg = accentColor ? `${accentColor}12` : t.bgMuted;
  return (
    <div style={{
      ...portalType.callout,
      background: bg,
      border: `0.5px solid ${border}`,
      borderRadius: 10,
      padding: '11px 14px',
      color: t.textSecondary,
      ...style,
    }}>
      {children}
    </div>
  );
}
