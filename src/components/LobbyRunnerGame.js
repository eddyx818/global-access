import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fetchLobbyLeaderboard, submitLobbyScore } from '../lib/lobbyGameScores';
import {
  CHECKOUT_GOAL,
  GLOBAL_ACCESS_BRANDS,
  SHOW_AISLES,
  aisleIndexFromProgress,
  chaseTierFromProgress,
  repLinesForTier,
  randomVendorPitch,
} from '../lib/lobbyGame/champsShowData';

const LIVES = 3;
const GRAVITY = 0.36;
const JUMP_V = -5.4;
const GROUND = 0.87;
const PLAYER_X = 0.1;
const PLAYER_H = 0.14;
const PLAYER_W = 0.17;

function spawnEntity(aisleId) {
  const roll = Math.random();
  if (roll < 0.44) {
    return {
      type: 'brand',
      brand: GLOBAL_ACCESS_BRANDS[Math.floor(Math.random() * GLOBAL_ACCESS_BRANDS.length)],
      x: 1.06,
      y: 0.48 + Math.random() * 0.1,
      w: 0.15,
      h: 0.065,
      bob: Math.random() * Math.PI * 2,
    };
  }
  return {
    type: 'vendor',
    pitch: randomVendorPitch(aisleId),
    x: 1.04,
    y: GROUND - 0.13,
    w: 0.1,
    h: 0.13,
  };
}

function drawHuman(ctx, footX, footY, scale, facing, walkPhase, opts = {}) {
  const {
    shirt = '#444', pants = '#222', skin = '#c68642', hair = '#222',
    alpha = 1, tie = null, badge = false,
  } = opts;
  const dir = facing === 'left' ? -1 : 1;
  const legSwing = Math.sin(walkPhase * 0.011) * scale * 0.07;
  ctx.globalAlpha = alpha;
  ctx.save();
  if (dir < 0) {
    ctx.translate(footX, 0);
    ctx.scale(-1, 1);
    ctx.translate(-footX, 0);
  }
  ctx.fillStyle = pants;
  ctx.fillRect(footX + scale * 0.08, footY - scale * 0.22, scale * 0.07, scale * 0.22 + legSwing);
  ctx.fillRect(footX + scale * 0.2, footY - scale * 0.22, scale * 0.07, scale * 0.22 - legSwing);
  ctx.fillStyle = '#111';
  ctx.fillRect(footX + scale * 0.06, footY - 4, scale * 0.1, 4);
  ctx.fillRect(footX + scale * 0.18, footY - 4, scale * 0.1, 4);
  ctx.fillStyle = shirt;
  ctx.fillRect(footX + scale * 0.06, footY - scale * 0.52, scale * 0.22, scale * 0.32);
  if (tie) {
    ctx.fillStyle = tie;
    ctx.beginPath();
    ctx.moveTo(footX + scale * 0.17, footY - scale * 0.5);
    ctx.lineTo(footX + scale * 0.14, footY - scale * 0.28);
    ctx.lineTo(footX + scale * 0.2, footY - scale * 0.28);
    ctx.fill();
  }
  if (badge) {
    ctx.fillStyle = '#C9A84C';
    ctx.fillRect(footX + scale * 0.2, footY - scale * 0.46, scale * 0.06, scale * 0.08);
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.max(6, scale * 0.06)}px sans-serif`;
    ctx.fillText('GA', footX + scale * 0.205, footY - scale * 0.4);
  }
  ctx.fillStyle = shirt;
  ctx.fillRect(footX + scale * 0.22, footY - scale * 0.44, scale * 0.12, scale * 0.05);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(footX + scale * 0.32, footY - scale * 0.4, scale * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(footX + scale * 0.17, footY - scale * 0.6, scale * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(footX + scale * 0.17, footY - scale * 0.64, scale * 0.095, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(footX + scale * 0.21, footY - scale * 0.62, scale * 0.02, scale * 0.02);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawCart(ctx, x, footY, scale, alpha) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - scale * 0.06, footY - scale * 0.82);
  ctx.lineTo(x + scale * 0.2, footY - scale * 0.82);
  ctx.stroke();
  ctx.strokeStyle = '#999';
  ctx.beginPath();
  ctx.moveTo(x + scale * 0.04, footY - scale * 0.72);
  ctx.lineTo(x + scale * 0.1, footY - scale * 0.38);
  ctx.lineTo(x + scale * 0.55, footY - scale * 0.38);
  ctx.lineTo(x + scale * 0.62, footY - scale * 0.72);
  ctx.stroke();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(x + scale * 0.18, footY - 5, 5, 0, Math.PI * 2);
  ctx.arc(x + scale * 0.5, footY - 5, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBuyer(ctx, xNorm, yNorm, w, h, walkPhase, alpha) {
  const footY = yNorm * h + PLAYER_H * h;
  const scale = h * 0.105;
  const footX = xNorm * w;
  drawCart(ctx, footX + scale * 0.95, footY, scale, alpha);
  drawHuman(ctx, footX, footY, scale, 'right', walkPhase, {
    shirt: '#2c5282', pants: '#1a365d', skin: '#d4a574', badge: true, alpha,
  });
}

function drawSpeechBubble(ctx, x, y, text, maxW, accent = '#C9A84C') {
  ctx.font = '600 8px "DM Sans", Arial, sans-serif';
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = test;
  });
  if (line) lines.push(line);
  const lineH = 10;
  const pad = 6;
  const bw = maxW + pad * 2;
  const bh = lines.length * lineH + pad * 2;
  ctx.fillStyle = '#fffef5';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y - bh, bw, bh, 6);
  else ctx.rect(x, y - bh, bw, bh);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a2a2a';
  lines.forEach((ln, i) => ctx.fillText(ln, x + pad, y - bh + pad + 9 + i * lineH));
}

function drawCrowd(ctx, w, h, scroll, aisle) {
  const py = (n) => n * h;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < 12; i += 1) {
    const cx = ((i * 0.11 - scroll * 0.00004 + (i % 3) * 0.02) % 1.15) * w;
    const cy = py(0.28 + (i % 4) * 0.04);
    ctx.beginPath();
    ctx.arc(cx, cy, 4 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 3, cy + 2, 6, 10);
  }
  ctx.fillStyle = aisle.banner;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(0, py(0.2), w, py(0.055));
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.font = '700 10px "Bebas Neue", "DM Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(aisle.bannerText, w / 2, py(0.238));
  ctx.textAlign = 'start';
}

function drawShowFloor(ctx, w, h, aisle, scroll) {
  const py = (n) => n * h;
  const grad = ctx.createLinearGradient(0, 0, 0, py(0.25));
  grad.addColorStop(0, aisle.sky);
  grad.addColorStop(1, aisle.floor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  drawCrowd(ctx, w, h, scroll, aisle);
  ctx.fillStyle = aisle.floor;
  ctx.fillRect(0, py(GROUND), w, h - py(GROUND));
  ctx.strokeStyle = aisle.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 14]);
  ctx.beginPath();
  ctx.moveTo(w * 0.1, py(GROUND + 0.006));
  ctx.lineTo(w * 0.1, h);
  ctx.moveTo(w * 0.9, py(GROUND + 0.006));
  ctx.lineTo(w * 0.9, h);
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < 5; i += 1) {
    const fx = ((i * 0.22 - scroll * 0.00018) % 1.2) * w;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(fx, py(GROUND));
    ctx.lineTo(fx - w * 0.05, h);
    ctx.stroke();
  }
}

function drawGlobalAccessBooth(ctx, xNorm, w, h, glow) {
  const rx = xNorm * w;
  const footY = GROUND * h;
  const bw = w * 0.28;
  const bh = h * 0.42;
  ctx.shadowColor = '#C9A84C';
  ctx.shadowBlur = glow ? 18 : 6;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(rx, footY - bh, bw, bh);
  ctx.fillStyle = '#C9A84C';
  ctx.fillRect(rx + 4, footY - bh + 4, bw - 8, bh * 0.14);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = '700 11px "Bebas Neue", sans-serif';
  ctx.fillText('GLOBAL ACCESS', rx + bw * 0.08, footY - bh * 0.88);
  ctx.font = '600 8px sans-serif';
  ctx.fillStyle = '#ddd';
  ctx.fillText('★ OFFICIAL BOOTH ★', rx + bw * 0.1, footY - bh * 0.72);
  for (let i = 0; i < 3; i += 1) {
    drawHuman(ctx, rx + bw * (0.15 + i * 0.28), footY - bh * 0.08, h * 0.07, 'left', i * 20, {
      shirt: i === 1 ? '#C9A84C' : '#333', pants: '#111', skin: '#8d5524',
    });
  }
  ctx.font = '8px sans-serif';
  ctx.fillStyle = '#C9A84C';
  ctx.fillText('Welcome!', rx + bw * 0.35, footY - bh * 0.05);
}

function drawVendorRep(ctx, e, w, h, walkPhase, aisle) {
  const footX = e.x * w;
  const footY = (e.y + e.h) * h;
  const scale = e.h * h * 0.75;
  drawSpeechBubble(ctx, footX, footY - scale * 1.05, e.pitch, 100, aisle.lane);
  drawHuman(ctx, footX, footY, scale, 'left', walkPhase + e.x * 100, {
    shirt: aisle.vendorShirt, pants: '#222', skin: '#c68642', tie: '#e74c3c',
  });
  ctx.font = '700 7px sans-serif';
  ctx.fillStyle = aisle.lane;
  ctx.fillText('VENDOR', footX, footY + 3);
}

function drawBrandPickup(ctx, brand, x, y, bob, w, h, time, accent) {
  const px = (n) => n * w;
  const py = (n) => n * h;
  const fy = y + Math.sin(time * 0.0028 + bob) * 0.012;
  ctx.fillStyle = 'rgba(201,168,76,0.4)';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(px(x), py(fy), px(0.14), py(0.058), 5);
  else ctx.rect(px(x), py(fy), px(0.14), py(0.058));
  ctx.fill();
  ctx.stroke();
  ctx.font = '700 8px sans-serif';
  ctx.fillStyle = '#fff';
  const label = brand.length > 11 ? `${brand.slice(0, 10)}…` : brand;
  ctx.fillText(`★ ${label}`, px(x + 0.01), py(fy + 0.04));
}

export default function LobbyRunnerGame({ playerName = 'Guest', onGameOver, theme }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const hudSnapshotRef = useRef({ score: -1, lives: -1, products: -1, aisle: 0 });
  const endedRef = useRef(false);

  const [hud, setHud] = useState({ score: 0, lives: LIVES, products: 0, aisle: 0, phase: 'ready' });
  const [leaderboard, setLeaderboard] = useState([]);
  const [lastRun, setLastRun] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadBoard = useCallback(async () => {
    const r = await fetchLobbyLeaderboard(8);
    if (r.ok) setLeaderboard(r.rows);
  }, []);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  const resetGame = useCallback(() => {
    stateRef.current = {
      playerY: GROUND - PLAYER_H,
      vy: 0, grounded: true,
      entities: [], spawnTimer: 1000,
      speed: 0.00075, distance: 0, score: 0, products: 0,
      lives: LIVES, invuln: 0, flash: 0, flashText: '',
      running: true,
      chaserLine: repLinesForTier(1)[0],
      chaserLineAt: 0, chaserOffset: 0,
      registerProgress: 0, aisleIdx: 0, chaseTier: 1, walkPhase: 0,
    };
    hudSnapshotRef.current = { score: -1, lives: -1, products: -1, aisle: 0 };
    endedRef.current = false;
    setHud({ score: 0, lives: LIVES, products: 0, aisle: 0, phase: 'playing' });
    setLastRun(null);
  }, []);

  const endGame = useCallback(async (finalState, reason = 'caught') => {
    if (endedRef.current) return;
    endedRef.current = true;
    finalState.running = false;
    finalState.flashText = reason === 'checkout'
      ? 'You made the Global Access booth!'
      : 'Vendors caught you!';
    const run = {
      score: Math.floor(finalState.score),
      products: finalState.products,
      won: reason === 'checkout',
      aisle: finalState.aisleIdx + 1,
    };
    setLastRun(run);
    setHud(h => ({
      ...h, phase: 'over', score: run.score, products: run.products,
      aisle: finalState.aisleIdx, lives: reason === 'checkout' ? h.lives : 0,
    }));
    onGameOver?.(run);
    setSubmitting(true);
    await submitLobbyScore({ playerName, score: run.score, productsCollected: run.products });
    setSubmitting(false);
    loadBoard();
  }, [loadBoard, onGameOver, playerName]);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (!s?.running) { resetGame(); return; }
    if (s.grounded) { s.vy = JUMP_V; s.grounded = false; }
  }, [resetGame]);

  useEffect(() => {
    resetGame();
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let last = performance.now();

    const draw = (now) => {
      const dt = Math.min(22, now - last);
      last = now;
      const s = stateRef.current;
      if (!s || !ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const px = (n) => n * w;
      const py = (n) => n * h;
      const aisle = SHOW_AISLES[s.aisleIdx] || SHOW_AISLES[0];

      ctx.clearRect(0, 0, w, h);
      drawShowFloor(ctx, w, h, aisle, s.distance);

      const boothX = 0.62 + (1 - Math.min(1, s.registerProgress / CHECKOUT_GOAL)) * 0.42;
      const nearBooth = s.registerProgress / CHECKOUT_GOAL > 0.75;
      drawGlobalAccessBooth(ctx, boothX, w, h, nearBooth);

      if (s.running) {
        s.walkPhase += dt * (s.grounded ? 0.32 : 0.08);
        s.spawnTimer += dt;
        const spawnGap = Math.max(1600, 2400 - s.aisleIdx * 100);
        if (s.spawnTimer >= spawnGap) {
          s.spawnTimer = 0;
          const last = s.entities[s.entities.length - 1];
          if (!last || last.x < 0.68) {
            s.entities.push(spawnEntity(aisle.id));
          }
        }

        s.vy += GRAVITY * (dt / 16);
        s.playerY += s.vy * (dt / 16) * 0.0085;
        const floorY = GROUND - PLAYER_H;
        if (s.playerY >= floorY) { s.playerY = floorY; s.vy = 0; s.grounded = true; }

        s.distance += s.speed * dt;
        s.speed = Math.min(0.00115, 0.00075 + s.aisleIdx * 0.00006);
        s.score += dt * 0.022;
        s.registerProgress += dt * 0.038;
        if (s.invuln > 0) s.invuln -= dt;
        if (s.flash > 0) s.flash -= dt;

        const nextAisle = aisleIndexFromProgress(s.registerProgress);
        if (nextAisle !== s.aisleIdx) {
          s.aisleIdx = nextAisle;
          s.flash = 700;
          s.flashText = `Entering ${SHOW_AISLES[nextAisle].name}`;
        }
        const nextTier = chaseTierFromProgress(s.registerProgress);
        if (nextTier !== s.chaseTier) {
          s.chaseTier = nextTier;
          const pool = repLinesForTier(s.chaseTier);
          s.chaserLine = pool[Math.floor(Math.random() * pool.length)];
        }

        s.chaserLineAt += dt;
        if (s.chaserLineAt > 3600) {
          s.chaserLineAt = 0;
          const pool = repLinesForTier(s.chaseTier);
          s.chaserLine = pool[Math.floor(Math.random() * pool.length)];
        }

        const targetChaser = 0.008 + (LIVES - s.lives) * 0.02 + (s.invuln > 0 ? 0.03 : 0);
        s.chaserOffset += (targetChaser - s.chaserOffset) * 0.016;

        const playerBox = { x: PLAYER_X + 0.05, y: s.playerY + 0.04, w: PLAYER_W - 0.06, h: PLAYER_H - 0.05 };

        s.entities = s.entities.filter((e) => {
          e.x -= s.speed * dt * 0.9;
          if (e.x < -0.22) return false;
          if (e.type === 'brand' && hit(playerBox, e)) {
            s.products += 1;
            s.score += 120;
            s.flash = 450;
            s.flashText = `+ ${e.brand}`;
            s.chaserOffset = Math.max(0, s.chaserOffset - 0.02);
            return false;
          }
          if (e.type === 'vendor' && s.invuln <= 0) {
            const box = { x: e.x + 0.015, y: e.y + 0.01, w: e.w - 0.03, h: e.h - 0.02 };
            if (hit(playerBox, box)) {
              s.lives -= 1;
              s.invuln = 2000;
              s.chaserOffset += 0.045;
              s.flash = 350;
              s.flashText = 'Blocked by a vendor!';
              if (s.lives <= 0) endGame(s, 'caught');
            }
          }
          return true;
        });

        if (s.registerProgress >= CHECKOUT_GOAL) {
          s.score += 600;
          endGame(s, 'checkout');
        }

        const scoreInt = Math.floor(s.score);
        const snap = hudSnapshotRef.current;
        if (scoreInt !== snap.score || s.lives !== snap.lives || s.products !== snap.products || s.aisleIdx !== snap.aisle) {
          hudSnapshotRef.current = { score: scoreInt, lives: s.lives, products: s.products, aisle: s.aisleIdx };
          setHud({ score: scoreInt, lives: s.lives, products: s.products, aisle: s.aisleIdx, phase: 'playing' });
        }
      }

      s.entities.forEach((e) => {
        if (e.type === 'brand') drawBrandPickup(ctx, e.brand, e.x, e.y, e.bob, w, h, now, aisle.lane);
        else drawVendorRep(ctx, e, w, h, s.walkPhase, aisle);
      });

      const chaserFootX = s.chaserOffset * w;
      const chaserFootYpx = py(GROUND - 0.01);
      drawSpeechBubble(ctx, chaserFootX, chaserFootYpx - h * 0.02, s.chaserLine, 118, '#e74c3c');
      drawHuman(ctx, chaserFootX, chaserFootYpx, h * 0.088, 'right', s.walkPhase + 30, {
        shirt: '#222', pants: '#111', skin: '#c68642', tie: '#C0392B',
      });
      ctx.font = '700 7px sans-serif';
      ctx.fillStyle = '#e74c3c';
      ctx.fillText('CHASING REP', chaserFootX, chaserFootYpx + 4);

      const pa = s.invuln > 0 && Math.floor(s.invuln / 130) % 2 ? 0.4 : 1;
      drawBuyer(ctx, PLAYER_X, s.playerY, w, h, s.walkPhase, pa);

      if (s.flash > 0 && s.flashText) {
        ctx.fillStyle = 'rgba(201,168,76,0.93)';
        ctx.font = '700 12px "DM Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(s.flashText, w / 2, py(0.32));
        ctx.textAlign = 'start';
      }

      const prog = Math.min(100, Math.round((s.registerProgress / CHECKOUT_GOAL) * 100));
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(px(0.06), py(0.165), px(0.88), py(0.026));
      ctx.fillStyle = aisle.lane;
      ctx.fillRect(px(0.06), py(0.165), px(0.88 * (prog / 100)), py(0.026));
      ctx.font = '700 9px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(`${aisle.name} · GA Booth ${prog}%`, w / 2, py(0.184));
      ctx.textAlign = 'start';

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [endGame, resetGame]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jump]);

  const aisleName = SHOW_AISLES[hud.aisle]?.name || SHOW_AISLES[0].name;

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8, fontSize: 10, color: theme?.textMuted || '#888',
        letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600, gap: 6, flexWrap: 'wrap',
      }}>
        <span>{aisleName}</span>
        <span>Score {hud.score}</span>
        <span>Brands {hud.products}</span>
        <span>{'❤️'.repeat(Math.max(0, hud.lives)) || '💀'}</span>
      </div>

      <button
        type="button"
        onClick={jump}
        style={{
          width: '100%', padding: 0,
          border: `0.5px solid ${theme?.border || '#E0DDD8'}`,
          borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
          background: '#0f0f12', touchAction: 'manipulation',
        }}
        aria-label="Champs trade show runner — dodge vendors, reach Global Access booth"
      >
        <canvas ref={canvasRef} width={360} height={250} style={{ display: 'block', width: '100%', height: 'auto' }} />
      </button>

      <p style={{ fontSize: 11, color: theme?.textFaint || '#AAA', margin: '8px 0 0', lineHeight: 1.45, textAlign: 'center' }}>
        Champs show floor · Dodge vendor reps · Grab GA brands · Reach the booth
      </p>

      {hud.phase === 'over' && lastRun && (
        <div style={{
          marginTop: 10, padding: '10px 12px', borderRadius: 10,
          background: theme?.mutedBg || '#F8F6F3',
          border: `0.5px solid ${theme?.border || '#E0DDD8'}`,
          fontSize: 12, color: theme?.textSecondary || '#555', textAlign: 'center',
        }}>
          {lastRun.won ? 'Welcome to the Global Access booth! ' : 'Too many vendors! '}
          {lastRun.score} pts · {lastRun.products} brands · Aisle {lastRun.aisle}
          {submitting ? ' · Saving…' : ' · Tap to replay'}
        </div>
      )}

      {leaderboard.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme?.textFaint || '#AAA', marginBottom: 6, fontWeight: 600 }}>
            Show floor high scores
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {leaderboard.map((row, i) => (
              <div key={`${row.player_name}-${row.created_at}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: theme?.textMuted || '#777' }}>
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
