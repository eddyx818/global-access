import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  categoryLabel,
  FALLBACK_INDUSTRY_FACTS,
  fetchActiveIndustryFacts,
  shuffleFacts,
} from '../lib/industryFacts';

const ROTATE_MS = 9000;
const REFRESH_MS = 180000;

export default function AccessWaitingFacts({ theme }) {
  const [facts, setFacts] = useState([]);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const fadeTimerRef = useRef(null);

  const loadFacts = useCallback(async () => {
    const r = await fetchActiveIndustryFacts();
    if (!mountedRef.current) return;
    const rows = shuffleFacts(r.rows?.length ? r.rows : FALLBACK_INDUSTRY_FACTS);
    setFacts(rows);
    setIdx((prev) => (rows.length ? Math.min(prev, rows.length - 1) : 0));
    setVisible(true);
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
        setVisible(true);
      }, 420);
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
        borderRadius: 12,
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
      borderRadius: 12,
      overflow: 'hidden',
      border: `0.5px solid ${border}`,
      background: mutedBg,
    }}>
      <style>{`
        @keyframes waitingFactIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: `0.5px solid ${border}`,
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
          <div style={{ fontSize: 10, color: textFaint }}>
            {idx + 1} / {facts.length}
          </div>
        )}
      </div>
      <div
        key={fact.id || idx}
        style={{
          padding: '16px 16px 18px',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.4s ease',
          animation: visible ? 'waitingFactIn 0.45s ease' : 'none',
          minHeight: 120,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          <span style={{
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: gold,
            background: `${gold}18`,
            border: `1px solid ${gold}44`,
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
              background: 'rgba(0,0,0,0.04)',
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
      {facts.length > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 5,
          paddingBottom: 12,
        }}>
          {facts.map((f, i) => (
            <span
              key={f.id || i}
              style={{
                width: i === idx ? 16 : 5,
                height: 5,
                borderRadius: 99,
                background: i === idx ? gold : `${gold}44`,
                transition: 'width 0.25s ease, background 0.25s ease',
              }}
            />
          ))}
        </div>
      )}
      <p style={{
        margin: 0,
        padding: '0 16px 12px',
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
