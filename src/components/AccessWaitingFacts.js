import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  categoryLabel,
  FALLBACK_INDUSTRY_FACTS,
  fetchActiveIndustryFacts,
  shuffleFacts,
} from '../lib/industryFacts';

const ROTATE_MS = 9000;
const REFRESH_MS = 180000;
const FADE_MS = 520;

export default function AccessWaitingFacts({ theme }) {
  const [facts, setFacts] = useState([]);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [progressKey, setProgressKey] = useState(0);
  const mountedRef = useRef(true);
  const fadeTimerRef = useRef(null);

  const loadFacts = useCallback(async () => {
    const r = await fetchActiveIndustryFacts();
    if (!mountedRef.current) return;
    const rows = shuffleFacts(r.rows?.length ? r.rows : FALLBACK_INDUSTRY_FACTS);
    setFacts(rows);
    setIdx((prev) => (rows.length ? Math.min(prev, rows.length - 1) : 0));
    setVisible(true);
    setProgressKey((k) => k + 1);
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadFacts();
    const refreshId = setInterval(loadFacts, REFRESH_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(refreshId);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [loadFacts]);

  useEffect(() => {
    if (facts.length <= 1) return undefined;
    const id = setInterval(() => {
      setVisible(false);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        setIdx((i) => (facts.length ? (i + 1) % facts.length : 0));
        setProgressKey((k) => k + 1);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => {
      clearInterval(id);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [facts.length]);

  const fact = facts[idx] || facts[0];
  const gold = theme?.gold || '#C9A84C';
  const border = theme?.border || '#E0DDD8';
  const mutedBg = theme?.mutedBg || theme?.bgMuted || '#F8F6F3';
  const textSecondary = theme?.textSecondary || '#555';
  const textFaint = theme?.textFaint || '#AAA';

  if (loading) {
    return (
      <div style={{
        padding: '20px 16px',
        borderRadius: 14,
        background: mutedBg,
        border: `0.5px solid ${border}`,
        fontSize: 13,
        color: textFaint,
        textAlign: 'center',
      }}>
        Loading industry updates…
      </div>
    );
  }

  if (!fact) return null;

  return (
    <div style={{
      borderRadius: 14,
      overflow: 'hidden',
      border: `0.5px solid ${border}`,
      background: mutedBg,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <style>{`
        @keyframes waitingFactProgress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .waiting-fact-content { transition: none !important; }
          .waiting-fact-progress-fill { animation: none !important; transform: scaleX(1) !important; }
        }
      `}</style>

      <div style={{
        padding: '14px 16px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: gold,
          fontWeight: 600,
        }}>
          Industry brief · while you wait
        </div>
        {facts.length > 1 && (
          <div style={{ fontSize: 10, color: textFaint, fontVariantNumeric: 'tabular-nums' }}>
            {idx + 1} / {facts.length}
          </div>
        )}
      </div>

      {facts.length > 1 && (
        <div style={{
          margin: '0 16px 4px',
          height: 2,
          borderRadius: 99,
          background: `${gold}20`,
          overflow: 'hidden',
        }}>
          <div
            key={progressKey}
            className="waiting-fact-progress-fill"
            style={{
              height: '100%',
              width: '100%',
              borderRadius: 99,
              background: `linear-gradient(90deg, ${gold}99, ${gold})`,
              transformOrigin: 'left center',
              animation: `waitingFactProgress ${ROTATE_MS}ms linear forwards`,
            }}
          />
        </div>
      )}

      <div style={{ minHeight: 132, position: 'relative' }}>
        <div
          className="waiting-fact-content"
          key={fact.id || idx}
          style={{
            padding: '14px 16px 16px',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(8px)',
            transition: `opacity ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1), transform ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            willChange: 'opacity, transform',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            <span style={{
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: gold,
              background: `${gold}14`,
              border: `1px solid ${gold}33`,
              borderRadius: 20,
              padding: '4px 10px',
            }}>
              {categoryLabel(fact.category)}
            </span>
            {fact.state_code && (
              <span style={{
                fontSize: 9,
                letterSpacing: '0.1em',
                fontWeight: 700,
                color: textSecondary,
                background: 'rgba(0,0,0,0.03)',
                border: `0.5px solid ${border}`,
                borderRadius: 20,
                padding: '4px 10px',
              }}>
                {fact.state_code}
              </span>
            )}
          </div>
          {fact.title && (
            <div style={{
              fontSize: 15,
              fontWeight: 600,
              color: theme?.text || '#1A1A1A',
              marginBottom: 8,
              lineHeight: 1.35,
            }}>
              {fact.title}
            </div>
          )}
          <p style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.65,
            color: textSecondary,
          }}>
            {fact.body}
          </p>
          {fact.source_url && /^https?:\/\//i.test(fact.source_url) && (
            <a
              href={fact.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'inline-block',
                marginTop: 12,
                fontSize: 11,
                color: gold,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Source →
            </a>
          )}
        </div>
      </div>

      <p style={{
        margin: 0,
        padding: '0 16px 14px',
        fontSize: 10,
        color: textFaint,
        lineHeight: 1.45,
        textAlign: 'center',
      }}>
        Not legal advice — verify rules for your state and product category.
      </p>
    </div>
  );
}
