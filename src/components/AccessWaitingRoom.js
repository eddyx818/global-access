import React, { useEffect, useState, useCallback, useMemo } from 'react';
import LobbyRunnerGame from './LobbyRunnerGame';
import { fetchAccessRequestStatus, clearPendingAccess } from '../lib/accessRequestGate';

const POLL_MS = 20000;

export default function AccessWaitingRoom({
  email,
  name,
  onApproved,
  onDenied,
  onBack,
  theme,
}) {
  const [status, setStatus] = useState('pending');
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    const result = await fetchAccessRequestStatus(email);
    setChecking(false);
    setLastCheck(new Date());
    if (!result.ok) return;
    if (!result.status) {
      setStatus('pending');
      return;
    }
    setStatus(result.status);
    if (result.status === 'approved') {
      clearPendingAccess();
      onApproved?.();
    }
    if (result.status === 'denied') {
      clearPendingAccess();
      onDenied?.();
    }
  }, [email, onApproved, onDenied]);

  useEffect(() => {
    checkStatus();
    const id = setInterval(checkStatus, POLL_MS);
    return () => clearInterval(id);
  }, [checkStatus]);

  const firstName = (name || 'there').split(' ')[0];
  const gameTheme = useMemo(() => ({
    aisleBg: theme?.bgMuted || '#F3F0EA',
    aisleLine: theme?.borderSubtle || 'rgba(0,0,0,0.06)',
    shelf: theme?.border || '#E8E4DC',
    floor: theme?.bgMuted || '#DED8CE',
    repBg: theme?.btnPrimaryBg || '#1A1A1A',
    repLabel: theme?.gold || '#C9A84C',
    obstacle: '#B8A898',
    canvasBg: theme?.bgElevated || '#FFF',
    border: theme?.border || '#E0DDD8',
    mutedBg: theme?.bgMuted || '#F8F6F3',
    textMuted: theme?.textMuted || '#888',
    textFaint: theme?.textFaint || '#AAA',
    textSecondary: theme?.textSecondary || '#555',
  }), [
    theme?.bgMuted,
    theme?.borderSubtle,
    theme?.border,
    theme?.btnPrimaryBg,
    theme?.gold,
    theme?.bgElevated,
    theme?.textMuted,
    theme?.textFaint,
    theme?.textSecondary,
  ]);

  return (
    <div>
      {status === 'pending' && (
        <>
          <p style={{ fontSize: 13, color: theme?.textMuted || '#888', marginBottom: '1rem', lineHeight: 1.6 }}>
            Thanks, {firstName}! Your request is in review. We&apos;ll email you when you&apos;re approved — usually within 1 business day.
          </p>
          <div style={{
            fontSize: 11,
            color: theme?.textFaint || '#AAA',
            marginBottom: '1rem',
            padding: '8px 10px',
            borderRadius: 8,
            background: theme?.bgMuted || '#F8F6F3',
            border: theme?.borderHairline || '0.5px solid #E0DDD8',
          }}>
            {checking ? 'Checking status…' : lastCheck
              ? `Last checked ${lastCheck.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · auto-refreshes`
              : 'Waiting for admin review…'}
          </div>
          <div style={{
            marginBottom: '1rem',
            padding: '12px 0 0',
            borderTop: theme?.borderHairline || '0.5px solid #E0DDD8',
          }}>
            <div style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: theme?.gold || '#C9A84C',
              fontWeight: 600,
              marginBottom: 10,
            }}>
              While you wait — Champs Show Runner™
            </div>
            <LobbyRunnerGame playerName={firstName} theme={gameTheme} />
          </div>
        </>
      )}

      {status === 'approved' && (
        <div style={{
          background: 'var(--ga-success-bg)',
          border: '0.5px solid var(--ga-success-border)',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: '1rem',
          fontSize: 13,
          color: 'var(--ga-success-text)',
          lineHeight: 1.55,
        }}>
          You&apos;re approved! Check your email for login details, then sign in below.
        </div>
      )}

      {status === 'denied' && (
        <div style={{
          background: 'var(--ga-error-bg)',
          border: '0.5px solid var(--ga-error-border)',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: '1rem',
          fontSize: 13,
          color: 'var(--ga-error-text)',
          lineHeight: 1.55,
        }}>
          We weren&apos;t able to approve this request. Contact our team if you think this was a mistake.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {status === 'pending' && (
          <button
            type="button"
            onClick={checkStatus}
            disabled={checking}
            style={{
              width: '100%',
              background: theme?.bgElevated || '#FFF',
              color: theme?.text || '#1A1A1A',
              border: theme?.borderHairline || '0.5px solid #E0DDD8',
              borderRadius: 8,
              padding: '11px',
              fontSize: 12,
              fontWeight: 600,
              cursor: checking ? 'wait' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {checking ? 'Checking…' : 'Refresh status'}
          </button>
        )}
        {(status === 'approved' || status === 'denied') && (
          <button
            type="button"
            onClick={() => { onBack?.(status); }}
            style={{
              width: '100%',
              background: theme?.btnPrimaryBg || '#1A1A1A',
              color: theme?.btnPrimaryText || '#FFF',
              border: 'none',
              borderRadius: 8,
              padding: '12px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {status === 'approved' ? 'Go to sign in →' : 'Back'}
          </button>
        )}
        {status === 'pending' && (
          <button type="button" onClick={() => onBack?.('pending')} style={{
            background: 'none',
            border: 'none',
            fontSize: 12,
            color: theme?.textFaint || '#AAA',
            cursor: 'pointer',
            padding: 0,
            fontFamily: 'inherit',
          }}>
            ← Back to login
          </button>
        )}
      </div>
    </div>
  );
}
