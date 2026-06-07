import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fetchLobbyLeaderboard, submitLobbyScore } from '../lib/lobbyGameScores';

const LIVES = 3;
const GRAVITY = 0.38;
const JUMP_V = -5.8;
const GROUND = 0.84;
const PLAYER_X = 0.15;
const PLAYER_H = 0.13;
const PLAYER_W = 0.11;

const BRAND_TAGS = ['GoldWhip', 'LuxGas', 'Sokka', 'numbz', 'Blizzy', 'Rise', 'Churros', 'Good Spirits'];
const CHASE_LINES = [
  'Hey! Wanna know more about my product?',
  'Wait — special pricing on cases!',
  'Can I tell you about our new SKU?',
  'Hold up! Bulk deal if you stay!',
  'You NEED to hear about this brand!',
  'Quick demo? Just 30 seconds!',
];

function spawnEntity(distance) {
  const roll = Math.random();
  if (roll < 0.48) {
    return {
      type: 'product',
      brand: BRAND_TAGS[Math.floor(Math.random() * BRAND_TAGS.length)],
      x: 1.08,
      y: 0.52 + Math.random() * 0.08,
      w: 0.14,
      h: 0.07,
      bob: Math.random() * Math.PI * 2,
    };
  }
  if (roll < 0.78) {
    return {
      type: 'employee',
      x: 1.06,
      y: GROUND - 0.12,
      w: 0.07,
      h: 0.12,
    };
  }
  return {
    type: 'pallet',
    x: 1.05,
    y: GROUND - 0.09,
    w: 0.09,
    h: 0.09,
  };
}

function drawWarehouseBg(ctx, w, h, scroll, palette) {
  const py = (n) => n * h;

  // Ceiling
  const ceilGrad = ctx.createLinearGradient(0, 0, 0, py(0.2));
  ceilGrad.addColorStop(0, '#2a2a2e');
  ceilGrad.addColorStop(1, '#3d3d42');
  ctx.fillStyle = ceilGrad;
  ctx.fillRect(0, 0, w, py(0.2));

  // Fluorescent lights
  ctx.fillStyle = 'rgba(255,255,240,0.35)';
  for (let i = 0; i < 4; i += 1) {
    const lx = ((i * 0.28 - scroll * 0.00008) % 1.2) * w;
    ctx.fillRect(lx, py(0.04), w * 0.12, py(0.018));
  }

  // Back wall / aisle depth
  ctx.fillStyle = palette?.aisleBg || '#c8c4bc';
  ctx.fillRect(0, py(0.18), w, py(GROUND - 0.18));

  // Side racking
  ctx.fillStyle = '#6b6560';
  ctx.fillRect(0, py(0.22), w * 0.08, py(GROUND - 0.22));
  ctx.fillRect(w * 0.92, py(0.22), w * 0.08, py(GROUND - 0.22));

  // Pallet stacks (parallax sides)
  const scrollPx = scroll * 0.00015;
  for (let side = 0; side < 2; side += 1) {
    const baseX = side === 0 ? 0.02 : 0.88;
    for (let i = 0; i < 3; i += 1) {
      const ox = ((i * 0.35 - scrollPx) % 1.05);
      drawPallet(ctx, w * (baseX + ox * 0.05), py(GROUND - 0.11), w * 0.07, py(0.1), '#8B7355');
    }
  }

  // Floor
  ctx.fillStyle = palette?.floor || '#9a9590';
  ctx.fillRect(0, py(GROUND), w, h - py(GROUND));

  // Aisle yellow lines
  ctx.strokeStyle = '#d4a017';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(w * 0.12, py(GROUND + 0.01));
  ctx.lineTo(w * 0.12, h);
  ctx.moveTo(w * 0.88, py(GROUND + 0.01));
  ctx.lineTo(w * 0.88, h);
  ctx.stroke();
  ctx.setLineDash([]);

  // Floor perspective lines
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i += 1) {
    const fx = ((i * 0.2 - scroll * 0.0002) % 1.2);
    ctx.beginPath();
    ctx.moveTo(w * fx, py(GROUND));
    ctx.lineTo(w * (fx - 0.06), h);
    ctx.stroke();
  }
}

function drawPallet(ctx, x, y, pw, ph, color = '#A08060') {
  ctx.fillStyle = color;
  ctx.fillRect(x, y - ph, pw, ph);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(x, y - ph * 0.15, pw, ph * 0.12);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y - ph, pw, ph);
}

function drawSpeechBubble(ctx, x, y, text, maxW) {
  ctx.font = '600 9px "DM Sans", sans-serif';
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);

  const lineH = 11;
  const pad = 6;
  const bw = Math.min(maxW + pad * 2, maxW + 20);
  const bh = lines.length * lineH + pad * 2;

  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#C9A84C';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y - bh, bw, bh, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#333';
  ctx.textAlign = 'left';
  lines.forEach((ln, i) => {
    ctx.fillText(ln, x + pad, y - bh + pad + 10 + i * lineH);
  });
  ctx.textAlign = 'start';
}

function drawChaserRep(ctx, x, y, line, w, h) {
  const px = (n) => n * w;
  const py = (n) => n * h;

  drawSpeechBubble(ctx, px(x), py(y - 0.02), line, 120);

  ctx.font = `${Math.floor(py(0.1))}px serif`;
  ctx.fillText('🧑‍💼', px(x + 0.01), py(y + 0.1));

  ctx.font = '600 8px sans-serif';
  ctx.fillStyle = '#C0392B';
  ctx.fillText('SALES REP', px(x), py(y + 0.13));
}

function drawPlayerCart(ctx, x, y, w, h, alpha = 1) {
  const px = (n) => n * w;
  const py = (n) => n * h;
  ctx.globalAlpha = alpha;

  // Cart
  ctx.font = `${Math.floor(py(0.085))}px serif`;
  ctx.fillText('🛒', px(x + 0.04), py(y + 0.11));

  // Shopper
  ctx.fillText('🧑', px(x - 0.01), py(y + 0.11));

  ctx.globalAlpha = 1;
}

function drawProductTag(ctx, brand, x, y, bob, w, h, time) {
  const px = (n) => n * w;
  const py = (n) => n * h;
  const floatY = y + Math.sin(time * 0.003 + bob) * 0.012;

  ctx.fillStyle = 'rgba(201,168,76,0.25)';
  ctx.beginPath();
  ctx.roundRect(px(x), py(floatY), px(0.14), py(0.065), 4);
  ctx.fill();

  ctx.strokeStyle = '#C9A84C';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = '600 9px "DM Sans", sans-serif';
  ctx.fillStyle = '#5c4a1a';
  ctx.fillText('📦', px(x + 0.01), py(floatY + 0.045));
  ctx.fillText(brand.length > 11 ? `${brand.slice(0, 10)}…` : brand, px(x + 0.035), py(floatY + 0.045));
}

function drawEmployee(ctx, x, y, ew, eh, w, h) {
  const px = (n) => n * w;
  const py = (n) => n * h;

  ctx.fillStyle = '#4a6741';
  ctx.fillRect(px(x), py(y), px(ew), py(eh * 0.55));
  ctx.font = `${Math.floor(py(0.08))}px serif`;
  ctx.fillText('👷', px(x + 0.005), py(y + eh * 0.85));
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
      playerY: GROUND - PLAYER_H,
      vy: 0,
      grounded: true,
      entities: [],
      spawnTimer: 800,
      speed: 0.00085,
      distance: 0,
      score: 0,
      products: 0,
      lives: LIVES,
      invuln: 0,
      flash: 0,
      flashText: '',
      running: true,
      chaserLine: CHASE_LINES[0],
      chaserLineAt: 0,
      chaserOffset: 0,
      registerProgress: 0,
    };
    hudSnapshotRef.current = { score: -1, lives: -1, products: -1 };
    endedRef.current = false;
    setHud({ score: 0, lives: LIVES, products: 0, phase: 'playing' });
    setLastRun(null);
  }, []);

  const endGame = useCallback(async (finalState, reason = 'caught') => {
    if (endedRef.current) return;
    endedRef.current = true;
    finalState.running = false;
    finalState.flashText = reason === 'checkout' ? 'YOU MADE IT TO CHECKOUT!' : 'CAUGHT BY THE REP!';
    const run = {
      score: Math.floor(finalState.score),
      products: finalState.products,
      won: reason === 'checkout',
    };
    setLastRun(run);
    setHud(h => ({
      ...h,
      phase: 'over',
      score: run.score,
      products: run.products,
      lives: reason === 'checkout' ? h.lives : 0,
    }));
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
      s.vy = JUMP_V;
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
      const dt = Math.min(24, now - last);
      last = now;
      const s = stateRef.current;
      const palette = themeRef.current;
      if (!s || !ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const px = (n) => n * w;
      const py = (n) => n * h;

      ctx.clearRect(0, 0, w, h);
      drawWarehouseBg(ctx, w, h, s.distance, palette);

      // Checkout counter ahead
      const registerX = 0.72 + (1 - Math.min(1, s.registerProgress / 1200)) * 0.35;
      ctx.fillStyle = '#3d3d42';
      ctx.fillRect(px(registerX), py(0.35), px(0.22), py(GROUND - 0.35));
      ctx.fillStyle = '#C9A84C';
      ctx.font = '600 10px sans-serif';
      ctx.fillText('CHECKOUT', px(registerX + 0.03), py(0.42));
      ctx.font = `${Math.floor(py(0.07))}px serif`;
      ctx.fillText('🛎️', px(registerX + 0.08), py(GROUND - 0.04));

      if (s.running) {
        s.spawnTimer += dt;
        const spawnGap = Math.max(1400, 2200 - s.distance * 0.08);
        if (s.spawnTimer >= spawnGap) {
          s.spawnTimer = 0;
          const lastOb = s.entities[s.entities.length - 1];
          if (!lastOb || lastOb.x < 0.72) {
            s.entities.push(spawnEntity(s.distance));
          }
        }

        s.vy += GRAVITY * (dt / 16);
        s.playerY += s.vy * (dt / 16) * 0.009;
        const floorY = GROUND - PLAYER_H;
        if (s.playerY >= floorY) {
          s.playerY = floorY;
          s.vy = 0;
          s.grounded = true;
        }

        s.distance += s.speed * dt;
        s.speed = Math.min(0.00135, 0.00085 + s.distance * 0.00000035);
        s.score += dt * 0.025;
        s.registerProgress += dt * 0.04;
        if (s.invuln > 0) s.invuln -= dt;
        if (s.flash > 0) s.flash -= dt;

        // Chaser rep dialogue
        s.chaserLineAt += dt;
        if (s.chaserLineAt > 3200) {
          s.chaserLineAt = 0;
          s.chaserLine = CHASE_LINES[Math.floor(Math.random() * CHASE_LINES.length)];
        }
        const targetChaser = 0.02 + (LIVES - s.lives) * 0.025 + (s.invuln > 0 ? 0.04 : 0);
        s.chaserOffset += (targetChaser - s.chaserOffset) * 0.02;

        const playerBox = {
          x: PLAYER_X + 0.02,
          y: s.playerY + 0.03,
          w: PLAYER_W - 0.03,
          h: PLAYER_H - 0.04,
        };

        s.entities = s.entities.filter((e) => {
          e.x -= s.speed * dt * 0.95;
          if (e.x < -0.2) return false;

          if (e.type === 'product') {
            if (hit(playerBox, { x: e.x, y: e.y, w: e.w, h: e.h })) {
              s.products += 1;
              s.score += 100;
              s.flash = 400;
              s.flashText = `+ ${e.brand}`;
              s.chaserOffset = Math.max(0, s.chaserOffset - 0.015);
              return false;
            }
          }

          if ((e.type === 'employee' || e.type === 'pallet') && s.invuln <= 0) {
            const box = { x: e.x + 0.01, y: e.y, w: e.w - 0.02, h: e.h };
            if (hit(playerBox, box)) {
              s.lives -= 1;
              s.invuln = 1800;
              s.chaserOffset += 0.035;
              s.flash = 300;
              s.flashText = 'Oof!';
              if (s.lives <= 0) {
                endGame(s, 'caught');
              }
            }
          }
          return true;
        });

        if (s.registerProgress >= 1200) {
          s.score += 500;
          endGame(s, 'checkout');
        }

        const scoreInt = Math.floor(s.score);
        const snap = hudSnapshotRef.current;
        if (scoreInt !== snap.score || s.lives !== snap.lives || s.products !== snap.products) {
          hudSnapshotRef.current = { score: scoreInt, lives: s.lives, products: s.products };
          setHud({ score: scoreInt, lives: s.lives, products: s.products, phase: 'playing' });
        }
      }

      // Obstacles & collectibles
      s.entities.forEach((e) => {
        if (e.type === 'product') {
          drawProductTag(ctx, e.brand, e.x, e.y, e.bob, w, h, now);
        } else if (e.type === 'employee') {
          drawEmployee(ctx, e.x, e.y, e.w, e.h, w, h);
        } else if (e.type === 'pallet') {
          drawPallet(ctx, px(e.x), py(e.y), px(e.w), py(e.h));
        }
      });

      // Chasing sales rep (behind player)
      drawChaserRep(ctx, s.chaserOffset, GROUND - 0.14, s.chaserLine, w, h);

      // Player + cart
      const playerAlpha = s.invuln > 0 && Math.floor(s.invuln / 120) % 2 ? 0.5 : 1;
      drawPlayerCart(ctx, PLAYER_X, s.playerY, w, h, playerAlpha);

      if (s.flash > 0 && s.flashText) {
        ctx.fillStyle = 'rgba(201,168,76,0.9)';
        ctx.font = '600 11px "DM Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(s.flashText, w / 2, py(0.28));
        ctx.textAlign = 'start';
      }

      // Progress to checkout
      const prog = Math.min(100, Math.round((s.registerProgress / 1200) * 100));
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(px(0.1), py(0.16), px(0.8), py(0.022));
      ctx.fillStyle = '#C9A84C';
      ctx.fillRect(px(0.1), py(0.16), px(0.8 * (prog / 100)), py(0.022));
      ctx.font = '600 8px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(`To checkout ${prog}%`, w / 2, py(0.175));
      ctx.textAlign = 'start';

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
        <span>Brands {hud.products}</span>
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
          background: '#3d3d42',
          touchAction: 'manipulation',
        }}
        aria-label="Tap to jump — grab brands, dodge workers, reach checkout before the rep catches you"
      >
        <canvas
          ref={canvasRef}
          width={360}
          height={220}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      </button>

      <p style={{ fontSize: 11, color: theme?.textFaint || '#AAA', margin: '8px 0 0', lineHeight: 1.45, textAlign: 'center' }}>
        Push your cart · Tap to hop for brands · Jump workers & pallets · Outrun the rep to checkout
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
          {lastRun.won ? 'Made it to checkout! ' : 'Rep got you! '}
          {lastRun.score} pts · {lastRun.products} brands
          {submitting ? ' · Saving…' : ' · Tap to play again'}
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
