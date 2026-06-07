import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fetchLobbyLeaderboard, submitLobbyScore } from '../lib/lobbyGameScores';

const LIVES = 3;
const GRAVITY = 0.55;
const JUMP = -9.5;
const GROUND = 0.78;

const PRODUCTS = ['📦', '🌿', '💨', '🍬', '🔋', '☕'];
const REP_LABELS = ['SPECIAL?', 'BULK?', 'NEW SKU?'];

function spawnEntity(speed, distance) {
  const roll = Math.random();
  if (roll < 0.42) {
    return {
      type: 'product',
      emoji: PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)],
      x: 1.15,
      y: GROUND - 0.12 - Math.random() * 0.08,
      w: 0.06,
      h: 0.06,
      collected: false,
    };
  }
  if (roll < 0.72) {
    const tall = Math.random() > 0.45;
    return {
      type: 'rep',
      label: REP_LABELS[Math.floor(Math.random() * REP_LABELS.length)],
      x: 1.12,
      y: tall ? GROUND - 0.22 : GROUND - 0.14,
      w: 0.07,
      h: tall ? 0.22 : 0.14,
      tall,
    };
  }
  return {
    type: 'shelf',
    x: 1.1,
    y: GROUND - 0.08,
    w: 0.05 + Math.random() * 0.04,
    h: 0.08,
  };
}

export default function LobbyRunnerGame({ playerName = 'Guest', onGameOver, theme }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const themeRef = useRef(theme);
  const hudSnapshotRef = useRef({ score: -1, lives: -1, products: -1 });
  const endedRef = useRef(false);
  themeRef.current = theme;
  const [hud, setHud] = useState({ score: 0, lives: LIVES, products: 0, phase: 'ready' });
  const [leaderboard, setLeaderboard] = useState([]);
  const [lastRun, setLastRun] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadBoard = useCallback(async () => {
    const result = await fetchLobbyLeaderboard(8);
    if (result.ok) setLeaderboard(result.rows);
  }, []);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  const resetGame = useCallback(() => {
    stateRef.current = {
      playerY: GROUND - 0.16,
      vy: 0,
      grounded: true,
      entities: [],
      spawnTimer: 0,
      speed: 0.006,
      distance: 0,
      score: 0,
      products: 0,
      lives: LIVES,
      invuln: 0,
      flash: 0,
      running: true,
      cleared: 0,
    };
    hudSnapshotRef.current = { score: -1, lives: -1, products: -1 };
    endedRef.current = false;
    setHud({ score: 0, lives: LIVES, products: 0, phase: 'playing' });
    setLastRun(null);
  }, []);

  const endGame = useCallback(async (finalState) => {
    if (endedRef.current) return;
    endedRef.current = true;
    finalState.running = false;
    const run = {
      score: Math.floor(finalState.score),
      products: finalState.products,
    };
    setLastRun(run);
    setHud(h => ({ ...h, phase: 'over', score: run.score, products: run.products, lives: 0 }));
    onGameOver?.(run);
    setSubmitting(true);
    await submitLobbyScore({
      playerName,
      score: run.score,
      productsCollected: run.products,
    });
    setSubmitting(false);
    loadBoard();
  }, [loadBoard, onGameOver, playerName]);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (!s?.running) {
      resetGame();
      return;
    }
    if (s.grounded) {
      s.vy = JUMP;
      s.grounded = false;
    }
  }, [resetGame]);

  useEffect(() => {
    resetGame();
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    let last = performance.now();

    const draw = (now) => {
      const dt = Math.min(32, now - last);
      last = now;
      const s = stateRef.current;
      const palette = themeRef.current;
      if (!s || !ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const px = (n) => n * w;
      const py = (n) => n * h;

      ctx.clearRect(0, 0, w, h);

      // Aisle background
      ctx.fillStyle = palette?.aisleBg || '#F3F0EA';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = palette?.aisleLine || 'rgba(0,0,0,0.06)';
      for (let i = 0; i < 8; i += 1) {
        const x = ((i * 0.18 - (s.distance * 0.3) % 0.18) + 0.18) % 1.2;
        ctx.beginPath();
        ctx.moveTo(px(x), py(GROUND - 0.02));
        ctx.lineTo(px(x - 0.08), h);
        ctx.stroke();
      }

      // Shelves top
      ctx.fillStyle = palette?.shelf || '#E8E4DC';
      ctx.fillRect(0, py(0.08), w, py(0.12));

      // Floor
      ctx.fillStyle = palette?.floor || '#DED8CE';
      ctx.fillRect(0, py(GROUND), w, h - py(GROUND));

      if (s.running) {
        s.spawnTimer += dt;
        if (s.spawnTimer > 900 - Math.min(400, s.distance * 2)) {
          s.spawnTimer = 0;
          s.entities.push(spawnEntity(s.speed, s.distance));
        }

        s.vy += GRAVITY * (dt / 16);
        s.playerY += s.vy * (dt / 16) * 0.012;
        if (s.playerY >= GROUND - 0.16) {
          s.playerY = GROUND - 0.16;
          s.vy = 0;
          s.grounded = true;
        }

        s.distance += s.speed * dt;
        s.speed = Math.min(0.011, 0.006 + s.distance * 0.000002);
        s.score += dt * 0.04 * (1 + s.products * 0.02);
        if (s.invuln > 0) s.invuln -= dt;
        if (s.flash > 0) s.flash -= dt;

        const playerBox = { x: 0.12, y: s.playerY, w: 0.07, h: 0.16 };

        s.entities = s.entities.filter((e) => {
          e.x -= s.speed * dt * 1.4;
          if (e.x < -0.15) return false;

          if (e.type === 'product' && !e.collected) {
            if (hit(playerBox, e)) {
              e.collected = true;
              s.products += 1;
              s.score += 80;
              s.flash = 300;
              return false;
            }
          }

          if ((e.type === 'rep' || e.type === 'shelf') && s.invuln <= 0) {
            if (hit(playerBox, e)) {
              s.lives -= 1;
              s.invuln = 1200;
              if (s.lives <= 0) {
                endGame(s);
              }
            }
          }
          return true;
        });

        if (Math.floor(s.score / 500) > s.cleared) {
          s.cleared = Math.floor(s.score / 500);
          s.flash = 500;
        }

        const scoreInt = Math.floor(s.score);
        const snap = hudSnapshotRef.current;
        if (scoreInt !== snap.score || s.lives !== snap.lives || s.products !== snap.products) {
          hudSnapshotRef.current = { score: scoreInt, lives: s.lives, products: s.products };
          setHud({ score: scoreInt, lives: s.lives, products: s.products, phase: s.running ? 'playing' : 'over' });
        }
      }

      // Entities
      s.entities.forEach((e) => {
        if (e.type === 'product') {
          ctx.font = `${Math.floor(py(0.07))}px serif`;
          ctx.fillText(e.emoji, px(e.x), py(e.y + 0.05));
        } else if (e.type === 'rep') {
          ctx.fillStyle = palette?.repBg || '#1A1A1A';
          ctx.fillRect(px(e.x), py(e.y), px(e.w), py(e.h));
          ctx.font = `600 ${Math.max(10, Math.floor(py(0.025)))}px sans-serif`;
          ctx.fillStyle = '#FFF';
          ctx.fillText('🧑‍💼', px(e.x + 0.01), py(e.y + (e.tall ? 0.12 : 0.08)));
          ctx.font = `600 ${Math.max(8, Math.floor(py(0.018)))}px sans-serif`;
          ctx.fillStyle = palette?.repLabel || '#C9A84C';
          ctx.fillText(e.label, px(e.x - 0.01), py(e.y - 0.02));
        } else {
          ctx.fillStyle = palette?.obstacle || '#B8A898';
          ctx.fillRect(px(e.x), py(e.y), px(e.w), py(e.h));
        }
      });

      // Cash register goal marker
      const registerX = 0.88 - ((s.distance * 0.05) % 1);
      ctx.font = `${Math.floor(py(0.06))}px serif`;
      ctx.fillText('🛒', px(registerX), py(GROUND - 0.02));

      // Player
      ctx.globalAlpha = s.invuln > 0 && Math.floor(s.invuln / 100) % 2 ? 0.45 : 1;
      ctx.font = `${Math.floor(py(0.09))}px serif`;
      ctx.fillText('🏃', px(0.1), py(s.playerY + 0.12));
      ctx.globalAlpha = 1;

      if (s.flash > 0 && s.cleared > 0) {
        ctx.fillStyle = 'rgba(201,168,76,0.85)';
        ctx.font = `600 ${Math.max(12, Math.floor(py(0.04)))}px sans-serif`;
        ctx.fillText('AISLE CLEARED → CASH REGISTER', px(0.08), py(0.22));
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [endGame, resetGame]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jump]);

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        fontSize: 11,
        color: theme?.textMuted || '#888',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        fontWeight: 600,
      }}>
        <span>Score {hud.score}</span>
        <span>📦 {hud.products}</span>
        <span>{'❤️'.repeat(Math.max(0, hud.lives)) || '💀'}</span>
      </div>

      <button
        type="button"
        onClick={jump}
        style={{
          width: '100%',
          padding: 0,
          border: `0.5px solid ${theme?.border || '#E0DDD8'}`,
          borderRadius: 12,
          overflow: 'hidden',
          cursor: 'pointer',
          background: theme?.canvasBg || '#FFF',
          touchAction: 'manipulation',
        }}
        aria-label="Tap to jump — dodge sales reps, grab products"
      >
        <canvas
          ref={canvasRef}
          width={360}
          height={200}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      </button>

      <p style={{ fontSize: 11, color: theme?.textFaint || '#AAA', margin: '8px 0 0', lineHeight: 1.45, textAlign: 'center' }}>
        Tap to jump · Dodge pushy reps · Snag products · 3 lives
      </p>

      {hud.phase === 'over' && lastRun && (
        <div style={{
          marginTop: 10,
          padding: '10px 12px',
          borderRadius: 10,
          background: theme?.mutedBg || '#F8F6F3',
          border: `0.5px solid ${theme?.border || '#E0DDD8'}`,
          fontSize: 12,
          color: theme?.textSecondary || '#555',
          textAlign: 'center',
        }}>
          Game over — {lastRun.score} pts · {lastRun.products} products
          {submitting ? ' · Saving score…' : ' · Tap to play again'}
        </div>
      )}

      {leaderboard.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme?.textFaint || '#AAA', marginBottom: 6, fontWeight: 600 }}>
            Lobby high scores
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {leaderboard.map((row, i) => (
              <div key={`${row.player_name}-${row.created_at}-${i}`} style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: theme?.textMuted || '#777',
              }}>
                <span>{i + 1}. {row.player_name}</span>
                <span>{row.score} · 📦{row.products_collected}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
