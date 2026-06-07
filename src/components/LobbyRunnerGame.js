import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { fetchLobbyLeaderboard, submitLobbyScore } from '../lib/lobbyGameScores';
import {
  BOOTH_STYLES,
  CHECKOUT_GOAL,
  GLOBAL_ACCESS_BRANDS,
  SHOW_AISLES,
  aisleIndexFromProgress,
  brandCrateStyle,
  chaseTierFromProgress,
  randomBoothStyle,
  randomKnockoffBrand,
  randomObstaclePitch,
  randomSecurityPitch,
  repLinesForTier,
} from '../lib/lobbyGame/champsShowData';

const LIVES = 3;
const GRAVITY = 0.38;
const JUMP_V = -7.9;
const GROUND = 0.86;
const PLAYER_X = 0.2;
const PLAYER_H = 0.21;
const PLAYER_W = 0.2;
/** Character draw scale — tuned for desktop + mobile readability. */
const CHAR_SCALE = 0.19;
/** Low counter / table obstacles in the aisle — jumpable. */
const LANE_OBSTACLE_H = 0.11;
const LANE_OBSTACLE_Y = GROUND - LANE_OBSTACLE_H;
const CANVAS_W = 360;
const CANVAS_H = 320;

/** Block iOS/Android copy-paste highlight & callout on the play surface. */
const GAME_SURFACE_STYLE = {
  width: '100%',
  padding: 0,
  borderRadius: 12,
  overflow: 'hidden',
  cursor: 'pointer',
  background: '#0a0a10',
  touchAction: 'none',
  outline: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  MozUserSelect: 'none',
  msUserSelect: 'none',
  WebkitTouchCallout: 'none',
  WebkitTapHighlightColor: 'transparent',
};

const CANVAS_STYLE = {
  display: 'block',
  width: '100%',
  height: 'auto',
  aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
  minHeight: 200,
  maxHeight: 420,
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'none',
  pointerEvents: 'none',
};

function characterScale(canvasH, mult = 1) {
  return canvasH * CHAR_SCALE * mult;
}

function spawnEntity(aisleId, progressRatio = 0) {
  const p = Math.min(1, Math.max(0, progressRatio));
  const roll = Math.random();
  const knockoff = randomKnockoffBrand();
  const boothStyle = randomBoothStyle(aisleId);
  const chineseHeavy = aisleId === 'vape' || boothStyle.id === 'knockoff_import';
  const brandCut = Math.max(0.06, 0.16 - p * 0.1);
  const boothCut = Math.min(0.58, 0.44 + p * 0.14);
  const securityCut = Math.min(0.74, 0.58 + p * 0.12);

  if (roll < brandCut) {
    return {
      type: 'brand',
      brand: GLOBAL_ACCESS_BRANDS[Math.floor(Math.random() * GLOBAL_ACCESS_BRANDS.length)],
      x: 1.06,
      y: 0.38 + Math.random() * 0.1,
      w: 0.15,
      h: 0.07,
      bob: Math.random() * Math.PI * 2,
    };
  }
  if (roll < boothCut) {
    const chinese = Math.random() < (chineseHeavy ? 0.5 : 0.25);
    return {
      type: 'booth',
      knockoff: boothStyle.id === 'knockoff_import' ? knockoff : null,
      boothStyle,
      chinese,
      pitch: randomObstaclePitch(aisleId, boothStyle, knockoff, chinese),
      x: 1.08,
      y: LANE_OBSTACLE_Y,
      w: 0.13,
      h: LANE_OBSTACLE_H,
    };
  }
  if (roll < securityCut) {
    return {
      type: 'security',
      pitch: randomSecurityPitch(),
      x: 1.04,
      y: GROUND - 0.15,
      w: 0.11,
      h: 0.15,
    };
  }
  const chinese = Math.random() < (chineseHeavy ? 0.45 : 0.22);
  return {
    type: 'vendor',
    knockoff: aisleId === 'vape' ? knockoff : null,
    boothStyle,
    chinese,
    pitch: randomObstaclePitch(aisleId, boothStyle, knockoff, chinese),
    x: 1.04,
    y: GROUND - 0.16,
    w: 0.11,
    h: 0.16,
  };
}

function drawHuman(ctx, footX, footY, scale, facing, walkPhase, opts = {}) {
  const {
    shirt = '#444', pants = '#222', skin = '#c68642', hair = '#222',
    alpha = 1, tie = null, badge = false, securityVest = false,
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
  if (securityVest) {
    ctx.fillStyle = '#F1C40F';
    ctx.fillRect(footX + scale * 0.04, footY - scale * 0.5, scale * 0.26, scale * 0.24);
    ctx.fillStyle = '#111';
    ctx.font = `700 ${Math.max(5, scale * 0.055)}px sans-serif`;
    ctx.fillText('SEC', footX + scale * 0.1, footY - scale * 0.34);
  }
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
    ctx.fillRect(footX + scale * 0.2, footY - scale * 0.46, scale * 0.07, scale * 0.09);
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.max(7, scale * 0.065)}px sans-serif`;
    ctx.fillText('GA', footX + scale * 0.205, footY - scale * 0.395);
  }
  ctx.fillStyle = shirt;
  ctx.fillRect(footX + scale * 0.22, footY - scale * 0.44, scale * 0.12, scale * 0.05);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(footX + scale * 0.32, footY - scale * 0.4, scale * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(footX + scale * 0.17, footY - scale * 0.6, scale * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(footX + scale * 0.17, footY - scale * 0.64, scale * 0.105, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(footX + scale * 0.21, footY - scale * 0.62, scale * 0.022, scale * 0.022);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawCart(ctx, handleX, footY, scale, alpha) {
  ctx.globalAlpha = alpha;
  const basketLeft = handleX + scale * 0.02;
  const basketW = scale * 0.42;
  const basketTop = footY - scale * 0.42;

  ctx.strokeStyle = '#666';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(handleX - scale * 0.02, footY - scale * 0.78);
  ctx.lineTo(handleX + scale * 0.14, footY - scale * 0.78);
  ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.moveTo(basketLeft, basketTop + scale * 0.08);
  ctx.lineTo(basketLeft + basketW, basketTop + scale * 0.08);
  ctx.lineTo(basketLeft + basketW * 0.92, footY - scale * 0.06);
  ctx.lineTo(basketLeft + basketW * 0.08, footY - scale * 0.06);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#C9A84C';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(basketLeft, basketTop);
  ctx.lineTo(basketLeft + basketW * 0.08, footY - scale * 0.06);
  ctx.lineTo(basketLeft + basketW * 0.92, footY - scale * 0.06);
  ctx.lineTo(basketLeft + basketW, basketTop);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(201,168,76,0.45)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    const t = i / 4;
    ctx.beginPath();
    ctx.moveTo(basketLeft + basketW * t, basketTop + scale * 0.04);
    ctx.lineTo(basketLeft + basketW * (0.08 + t * 0.84), footY - scale * 0.08);
    ctx.stroke();
  }

  ctx.fillStyle = '#FFD700';
  ctx.fillRect(basketLeft + scale * 0.06, basketTop + scale * 0.12, scale * 0.1, scale * 0.08);
  ctx.fillStyle = '#7B68EE';
  ctx.fillRect(basketLeft + scale * 0.18, basketTop + scale * 0.14, scale * 0.09, scale * 0.07);
  ctx.fillStyle = '#FF6B35';
  ctx.fillRect(basketLeft + scale * 0.29, basketTop + scale * 0.11, scale * 0.08, scale * 0.09);

  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(basketLeft + scale * 0.12, footY - 4, 4, 0, Math.PI * 2);
  ctx.arc(basketLeft + basketW * 0.78, footY - 4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBuyer(ctx, xNorm, yNorm, w, h, walkPhase, alpha) {
  const footY = yNorm * h + PLAYER_H * h;
  const scale = characterScale(h, 1.05);
  const footX = xNorm * w;
  const cartHandleX = footX + scale * 0.24;
  drawHuman(ctx, footX, footY, scale, 'right', walkPhase, {
    shirt: '#2563eb', pants: '#1e3a5f', skin: '#d4a574', hair: '#3d2314', badge: true, alpha,
  });
  drawCart(ctx, cartHandleX, footY, scale, alpha);
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

function drawSmileyPattern(ctx, bx, by, bw, bh) {
  const cols = 4;
  const rows = 3;
  const colors = ['#FFD700', '#FF69B4', '#00CED1', '#ADFF2F', '#FF6347'];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cx = bx + (c + 0.5) * (bw / cols);
      const cy = by + bh * 0.35 + r * (bh * 0.12);
      ctx.fillStyle = colors[(r + c) % colors.length];
      ctx.beginPath();
      ctx.arc(cx, cy, bw * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(cx - 2, cy - 1, 1, 0, Math.PI * 2);
      ctx.arc(cx + 2, cy - 1, 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + 1, 3, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }
  }
}

function drawNeonSilhouette(ctx, bx, by, bw, bh) {
  ctx.fillStyle = '#ADFF2F';
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.3, by + bh * 0.55);
  ctx.lineTo(bx + bw * 0.5, by + bh * 0.25);
  ctx.lineTo(bx + bw * 0.7, by + bh * 0.55);
  ctx.lineTo(bx + bw * 0.65, by + bh * 0.7);
  ctx.lineTo(bx + bw * 0.35, by + bh * 0.7);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawMushroomIcon(ctx, cx, cy, size) {
  ctx.fillStyle = '#FF69B4';
  ctx.beginPath();
  ctx.ellipse(cx, cy - size * 0.2, size * 0.5, size * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx - size * 0.15, cy - size * 0.25, size * 0.06, 0, Math.PI * 2);
  ctx.arc(cx + size * 0.1, cy - size * 0.3, size * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F5DEB3';
  ctx.fillRect(cx - size * 0.12, cy - size * 0.05, size * 0.24, size * 0.45);
}

function drawStyledBoothWall(ctx, bx, by, bw, bh, style, time, { backdrop = false } = {}) {
  const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
  grad.addColorStop(0, style.top);
  grad.addColorStop(0.5, style.mid);
  grad.addColorStop(1, style.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(bx, by, bw, bh);

  if (!backdrop) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  }

  if (style.id === 'smiley_wall' && !backdrop) drawSmileyPattern(ctx, bx, by, bw, bh);
  if (style.id === 'neon_beast' && !backdrop) drawNeonSilhouette(ctx, bx, by, bw, bh * 0.5);
  if (style.id === 'mushroom_psyche' && !backdrop) {
    drawMushroomIcon(ctx, bx + bw * 0.5, by + bh * 0.35, bw * 0.22);
  }

  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.max(6, bw * (backdrop ? 0.07 : 0.09))}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(style.title, bx + bw / 2, by + bh * (backdrop ? 0.12 : 0.2));
  if (!backdrop) {
    ctx.font = '600 5px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(style.subtitle, bx + bw / 2, by + bh * 0.28);
  }
  ctx.textAlign = 'start';

  ctx.fillStyle = style.counter;
  ctx.fillRect(bx + 2, by + bh - bh * 0.12, bw - 4, bh * 0.12);
}

const AISLE_BOOTH_STYLE_KEYS = {
  tobacco: ['sunset_tower', 'knockoff_import'],
  glass: ['preroll_lab', 'sunset_tower'],
  beverage: ['mushroom_psyche', 'smiley_wall'],
  thc: ['seven_oh', 'euphoric_blend', 'mushroom_psyche'],
  vape: ['neon_beast', 'knockoff_import'],
  home: ['seven_oh', 'preroll_lab'],
};

/** Background parallax — keep slower than obstacle speed so the hall feels like a walk, not a slide. */
const BG_SCROLL_WALK = 0.38;
const BG_SCROLL_PROGRESS = 0.12;
const BG_BOOTH_PARALLAX = 0.42;
const BG_FLOOR_PARALLAX = 0.65;
const BG_CEILING_PARALLAX = 0.1;

/** Varied far-wall booth silhouettes (width/height ratios relative to a base unit). */
const FAR_WALL_BOOTH_LAYOUT = [
  { w: 0.92, h: 0.86, variant: 'standard', gap: 0.06 },
  { w: 1.18, h: 1.0, variant: 'tower', gap: 0.04 },
  { w: 0.72, h: 0.68, variant: 'compact', gap: 0.07 },
  { w: 1.32, h: 0.92, variant: 'wide', gap: 0.03 },
  { w: 0.88, h: 0.78, variant: 'awning', gap: 0.05 },
  { w: 1.05, h: 0.94, variant: 'split', gap: 0.04 },
  { w: 0.8, h: 0.72, variant: 'popup', gap: 0.06 },
  { w: 1.15, h: 0.88, variant: 'ledge', gap: 0.04 },
];

function drawVariedBoothFront(ctx, bx, by, bw, bh, style, variant) {
  const pad = Math.max(1, bw * 0.04);
  const innerX = bx + pad;
  const innerW = bw - pad * 2;
  const signH = bh * (variant === 'compact' ? 0.14 : variant === 'tower' ? 0.22 : 0.18);
  const bodyTop = by + signH;
  const bodyH = bh - signH - bh * 0.22;
  const counterH = bh * (variant === 'wide' ? 0.16 : 0.22);
  const counterY = by + bh - counterH;

  ctx.fillStyle = '#252530';
  ctx.fillRect(bx, by, bw, bh);

  if (variant === 'awning') {
    ctx.fillStyle = style.top;
    ctx.beginPath();
    ctx.moveTo(bx, by + signH * 0.35);
    ctx.lineTo(bx + bw * 0.5, by);
    ctx.lineTo(bx + bw, by + signH * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = style.mid;
    ctx.fillRect(innerX, bodyTop, innerW, bodyH);
  } else if (variant === 'tower') {
    ctx.fillStyle = style.top;
    ctx.fillRect(innerX, by + bh * 0.02, innerW * 0.72, signH);
    ctx.fillStyle = style.mid;
    ctx.fillRect(innerX + innerW * 0.08, bodyTop, innerW * 0.84, bodyH * 1.05);
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = style.led?.[i % 3] || style.top;
      ctx.fillRect(innerX + innerW * 0.12, bodyTop + bodyH * 0.12 + i * bodyH * 0.22, innerW * 0.76, bodyH * 0.08);
    }
  } else if (variant === 'wide') {
    ctx.fillStyle = style.top;
    ctx.fillRect(bx, by + bh * 0.04, bw, signH * 0.85);
    ctx.fillStyle = style.mid;
    ctx.fillRect(innerX, bodyTop, innerW, bodyH * 0.92);
    ctx.fillStyle = style.bottom || style.mid;
    ctx.fillRect(innerX + innerW * 0.08, bodyTop + bodyH * 0.15, innerW * 0.84, bodyH * 0.55);
  } else if (variant === 'split') {
    ctx.fillStyle = style.top;
    ctx.fillRect(innerX, by + bh * 0.03, innerW, signH);
    const colW = innerW * 0.46;
    ctx.fillStyle = style.mid;
    ctx.fillRect(innerX, bodyTop, colW, bodyH);
    ctx.fillStyle = style.bottom || style.counter;
    ctx.fillRect(innerX + innerW * 0.54, bodyTop, colW, bodyH);
  } else if (variant === 'compact') {
    ctx.fillStyle = style.top;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(innerX, by + bh * 0.06, innerW, signH, 3);
    else ctx.rect(innerX, by + bh * 0.06, innerW, signH);
    ctx.fill();
    ctx.fillStyle = style.mid;
    ctx.fillRect(innerX + innerW * 0.1, bodyTop, innerW * 0.8, bodyH * 0.85);
  } else if (variant === 'popup') {
    ctx.fillStyle = '#d8d8dc';
    ctx.fillRect(innerX, bodyTop + bodyH * 0.08, innerW, bodyH * 0.78);
    ctx.strokeStyle = '#888';
    ctx.strokeRect(innerX, bodyTop + bodyH * 0.08, innerW, bodyH * 0.78);
    ctx.fillStyle = style.top;
    ctx.fillRect(innerX - pad * 0.5, by + bh * 0.05, innerW + pad, signH);
  } else if (variant === 'ledge') {
    ctx.fillStyle = style.top;
    ctx.fillRect(innerX, by + bh * 0.03, innerW, signH);
    ctx.fillStyle = style.mid;
    ctx.fillRect(innerX, bodyTop, innerW, bodyH);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(innerX, bodyTop + bodyH * 0.62, innerW, bodyH * 0.12);
  } else {
    ctx.fillStyle = style.top;
    ctx.fillRect(innerX, by + bh * 0.03, innerW, signH * 0.9);
    ctx.fillStyle = style.mid;
    ctx.fillRect(innerX, bodyTop, innerW, bodyH);
  }

  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.max(5, Math.min(9, bw * 0.085))}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  const title = style.title.length > 12 ? `${style.title.slice(0, 11)}…` : style.title;
  ctx.fillText(title, bx + bw / 2, by + signH * 0.72);

  ctx.fillStyle = style.counter;
  if (variant === 'split') {
    ctx.fillRect(innerX, counterY, innerW * 0.46, counterH);
    ctx.fillRect(innerX + innerW * 0.54, counterY, innerW * 0.46, counterH);
  } else {
    ctx.fillRect(innerX, counterY, innerW, counterH);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(innerX + 2, counterY + counterH * 0.15, innerW - 4, counterH * 0.22);
  ctx.textAlign = 'start';
}

const boothPoolCache = {};
function boothStylePool(aisleId) {
  if (boothPoolCache[aisleId]) return boothPoolCache[aisleId];
  const keys = AISLE_BOOTH_STYLE_KEYS[aisleId] || ['sunset_tower'];
  const extra = ['preroll_lab', 'smiley_wall', 'seven_oh', 'neon_beast'];
  const merged = [...new Set([...keys, ...extra])];
  boothPoolCache[aisleId] = merged.map((k) => BOOTH_STYLES[k]).filter(Boolean);
  return boothPoolCache[aisleId];
}

const boothStripCache = new Map();

function getHorizontalBoothStrip(aisleId, baseBoothW, wallH, styles) {
  const key = `${aisleId}:v2:${Math.round(baseBoothW)}:${Math.round(wallH)}`;
  if (boothStripCache.has(key)) return boothStripCache.get(key);

  let stripW = 0;
  FAR_WALL_BOOTH_LAYOUT.forEach((slot) => {
    stripW += baseBoothW * slot.w + baseBoothW * slot.gap;
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(stripW));
  canvas.height = Math.max(1, Math.ceil(wallH));
  const sctx = canvas.getContext('2d');
  if (sctx) {
    let x = 0;
    FAR_WALL_BOOTH_LAYOUT.forEach((slot, i) => {
      const bw = baseBoothW * slot.w;
      const bh = wallH * slot.h;
      const by = wallH - bh;
      const style = styles[i % styles.length];
      drawVariedBoothFront(sctx, x, by, bw, bh, style, slot.variant);
      x += bw + baseBoothW * slot.gap;
    });
  }
  const strip = { key, canvas, stripW, stripH: wallH };
  boothStripCache.set(key, strip);
  if (boothStripCache.size > 8) {
    const oldest = boothStripCache.keys().next().value;
    boothStripCache.delete(oldest);
  }
  return strip;
}

function drawConventionCeiling(ctx, w, h, scroll) {
  ctx.fillStyle = '#2a2a30';
  ctx.fillRect(0, 0, w, h * 0.12);
  const trussOffset = (scroll * BG_CEILING_PARALLAX) % (w / 4);
  ctx.fillStyle = '#383840';
  for (let i = -1; i < 7; i += 1) {
    ctx.fillRect(i * (w / 4) - trussOffset, 0, w * 0.035, h * 0.12);
  }
  for (let i = 0; i < 5; i += 1) {
    const lx = ((i * (w / 4.5) - scroll * BG_CEILING_PARALLAX * 0.65) % (w + 40)) - 20;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(lx, 8, 36, 4);
  }
}

function blitHorizontalStrip(ctx, strip, destX, destY, destW, destH, offset) {
  if (!strip?.canvas || strip.stripW <= 0) return;
  const sx = offset % strip.stripW;
  const sw = Math.min(destW, strip.stripW - sx);
  ctx.drawImage(strip.canvas, sx, 0, sw, strip.stripH, destX, destY, sw, destH);
  const remain = destW - sw;
  if (remain > 0) {
    ctx.drawImage(strip.canvas, 0, 0, remain, strip.stripH, destX + sw, destY, remain, destH);
  }
}

/** Far side of aisle — booth fronts facing the player (scrolls horizontally as you run forward). */
function drawFarBoothWall(ctx, w, h, scroll, aisle) {
  const wallTop = h * 0.12;
  const wallBottom = h * 0.5;
  const wallH = wallBottom - wallTop;

  ctx.fillStyle = '#2e2e36';
  ctx.fillRect(0, wallTop, w, wallH);

  const styles = boothStylePool(aisle.id);
  const baseBoothW = w * 0.24;
  const strip = getHorizontalBoothStrip(aisle.id, baseBoothW, wallH, styles);
  blitHorizontalStrip(ctx, strip, 0, wallTop, w, wallH, scroll * BG_BOOTH_PARALLAX);

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, wallBottom - 4, w, 4);
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, wallBottom);
  ctx.lineTo(w, wallBottom);
  ctx.stroke();
}

/** Aisle floor — flat side-on plane; dashes scroll left as you run forward down the hall. */
function drawAisleFloor(ctx, w, h, scroll) {
  const floorTop = h * 0.5;
  const floorBottom = GROUND * h;
  const floorH = floorBottom - floorTop;

  const floorGrad = ctx.createLinearGradient(0, floorTop, 0, floorBottom);
  floorGrad.addColorStop(0, '#64646e');
  floorGrad.addColorStop(1, '#4e4e58');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, floorTop, w, floorH);

  // Near-side curb (camera side of aisle)
  ctx.fillStyle = '#3a3a44';
  ctx.fillRect(0, floorTop, w * 0.06, floorH);
  ctx.strokeStyle = 'rgba(201,168,76,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.06, floorTop);
  ctx.lineTo(w * 0.06, floorBottom);
  ctx.stroke();

  // Far-side curb under booth wall
  ctx.fillStyle = '#35353d';
  ctx.fillRect(w * 0.94, floorTop, w * 0.06, floorH);
  ctx.strokeStyle = 'rgba(201,168,76,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.94, floorTop);
  ctx.lineTo(w * 0.94, floorBottom);
  ctx.stroke();

  const dashW = w * 0.08;
  const lineY = floorTop + floorH * 0.62;
  for (let t = -1; t < 16; t += 1) {
    const tx = ((t * dashW * 1.55 - scroll * BG_FLOOR_PARALLAX) % (w + dashW * 2) + w + dashW * 2) % (w + dashW * 2) - dashW;
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, lineY);
    ctx.lineTo(tx + dashW, lineY);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(201,168,76,0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(w * 0.06, floorTop + floorH * 0.22);
  ctx.lineTo(w * 0.94, floorTop + floorH * 0.22);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#32323a';
  ctx.fillRect(0, floorBottom, w, h - floorBottom);
}

function drawShowFloor(ctx, w, h, aisle, scroll) {
  const py = (n) => n * h;

  drawConventionCeiling(ctx, w, h, scroll);
  drawFarBoothWall(ctx, w, h, scroll, aisle);
  drawAisleFloor(ctx, w, h, scroll);

  ctx.fillStyle = '#2e2e34';
  ctx.fillRect(w * 0.04, py(0.125), w * 0.92, py(0.028));
  ctx.fillStyle = aisle.neon;
  ctx.globalAlpha = 0.22;
  ctx.fillRect(w * 0.04, py(0.125), w * 0.92, py(0.028));
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#eee';
  ctx.font = '600 9px "Bebas Neue", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(aisle.bannerText, w / 2, py(0.146));
  ctx.textAlign = 'start';
}

/** Scroll distance — gentle parallax, slower than lane obstacles. */
function aisleScrollDistance(s) {
  return s.registerProgress * BG_SCROLL_PROGRESS + s.walkPhase * BG_SCROLL_WALK;
}

function playerCollisionBox(s) {
  return {
    x: PLAYER_X + 0.012,
    y: s.playerY + 0.06,
    w: 0.072,
    h: PLAYER_H - 0.12,
  };
}

function drawGlobalAccessBooth(ctx, xNorm, w, h, glow, progress) {
  const wallTop = h * 0.12;
  const wallBottom = h * 0.5;
  const wallH = wallBottom - wallTop;
  const rx = xNorm * w;
  const bw = w * 0.32;
  const bh = wallH * 0.92;
  const by = wallTop + (wallH - bh) * 0.5;
  const footY = by + bh - 2;
  const prog = Math.min(1, progress / CHECKOUT_GOAL);

  ctx.fillStyle = '#1a1a1e';
  ctx.fillRect(rx, by, bw, bh);
  ctx.strokeStyle = glow ? '#C9A84C' : '#666';
  ctx.lineWidth = glow ? 3 : 1.5;
  ctx.strokeRect(rx, by, bw, bh);

  ctx.fillStyle = '#C9A84C';
  ctx.fillRect(rx + 4, by + 6, bw - 8, bh * 0.14);
  ctx.fillStyle = '#111';
  ctx.font = '700 13px "Bebas Neue", sans-serif';
  ctx.fillText('GLOBAL ACCESS', rx + bw * 0.07, by + bh * 0.12);
  ctx.font = '600 7px sans-serif';
  ctx.fillStyle = '#444';
  ctx.fillText('REAL BRANDS · LEGIT DISTRIBUTOR', rx + bw * 0.08, by + bh * 0.22);

  ctx.fillStyle = '#2a2a30';
  ctx.fillRect(rx + 6, by + bh * 0.28, bw - 12, bh * 0.48);

  for (let i = 0; i < 2; i += 1) {
    drawHuman(ctx, rx + bw * (0.15 + i * 0.38), footY - bh * 0.08, characterScale(h, 0.75), 'left', i * 20, {
      shirt: i === 0 ? '#C9A84C' : '#2563eb', pants: '#111', skin: '#8d5524',
    });
  }
  ctx.font = '700 8px sans-serif';
  ctx.fillStyle = '#C9A84C';
  ctx.fillText('YOU MADE IT →', rx + bw * 0.24, by + bh * 0.92);

  if (prog > 0.45) {
    ctx.font = '700 9px "Bebas Neue", sans-serif';
    ctx.fillStyle = '#8bc34a';
    ctx.fillText(`${Math.round(prog * 100)}%`, rx + bw * 0.82, by + bh * 0.38);
  }
}

function drawSecurityGuard(ctx, e, w, h, walkPhase) {
  const footX = e.x * w;
  const footY = (e.y + e.h) * h;
  const scale = characterScale(h);
  drawHuman(ctx, footX, footY, scale, 'left', walkPhase + e.x * 100, {
    shirt: '#2c3e50', pants: '#1a1a1a', skin: '#c68642', securityVest: true,
  });
  drawSpeechBubble(ctx, footX, footY - scale * 1.05, e.pitch, 108, '#2c3e50');
  ctx.font = '700 7px sans-serif';
  ctx.fillStyle = '#F1C40F';
  ctx.fillText('CHAMPS SECURITY', footX, footY + 4);
}

function drawVendorRep(ctx, e, w, h, walkPhase, aisle) {
  const footX = e.x * w;
  const footY = (e.y + e.h) * h;
  const scale = characterScale(h);
  drawHuman(ctx, footX, footY, scale, 'left', walkPhase + e.x * 100, {
    shirt: e.chinese ? '#c0392b' : aisle.vendorShirt,
    pants: '#222', skin: '#c68642', tie: aisle.neon,
  });
  drawSpeechBubble(ctx, footX, footY - scale * 1.05, e.pitch, 108, e.chinese ? '#e74c3c' : aisle.neon);
  ctx.font = '700 7px sans-serif';
  ctx.fillStyle = e.chinese ? '#e74c3c' : aisle.neon;
  ctx.fillText(e.chinese ? 'OVERSEAS VENDOR' : 'VENDOR REP', footX, footY + 4);
  if (e.knockoff) {
    ctx.font = '600 6px sans-serif';
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText(`"${e.knockoff.name}"`, footX, footY + 12);
  }
}

function drawKnockoffBooth(ctx, e, w, h, aisle, time) {
  const bx = e.x * w;
  const cy = e.y * h;
  const cw = e.w * w;
  const ch = e.h * h;
  const style = e.boothStyle || BOOTH_STYLES.knockoff_import;
  const signH = h * 0.13;

  ctx.fillStyle = style.top;
  ctx.fillRect(bx - cw * 0.06, cy - signH, cw * 1.12, signH);
  ctx.strokeStyle = '#444';
  ctx.strokeRect(bx - cw * 0.06, cy - signH, cw * 1.12, signH);
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.max(7, cw * 0.09)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(style.title, bx + cw / 2, cy - signH * 0.35);
  ctx.font = '600 5px sans-serif';
  ctx.fillText('POP-UP BOOTH', bx + cw / 2, cy - signH * 0.12);
  ctx.textAlign = 'start';

  ctx.fillStyle = '#d8d8dc';
  ctx.fillRect(bx, cy, cw, ch);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, cy, cw, ch);
  ctx.fillStyle = '#aaa';
  ctx.fillRect(bx + 3, cy + 2, cw - 6, ch * 0.35);

  if (e.knockoff) {
    ctx.font = '600 6px sans-serif';
    ctx.fillStyle = '#c0392b';
    ctx.textAlign = 'center';
    ctx.fillText(`fake ${e.knockoff.name}`, bx + cw / 2, cy + ch * 0.55);
    ctx.textAlign = 'start';
  }

  drawSpeechBubble(ctx, bx, cy - 4, e.pitch, 100, '#888');
}

function drawChasingRep(ctx, footX, footY, scale, walkPhase, line) {
  drawSpeechBubble(ctx, footX, footY - scale * 1.05, line, 112, '#888');
  drawHuman(ctx, footX, footY, scale, 'right', walkPhase + 30, {
    shirt: '#444', pants: '#222', skin: '#c68642', tie: '#a93226',
  });
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.arc(footX + scale * 0.16, footY - scale * 0.52, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '700 7px sans-serif';
  ctx.fillStyle = '#888';
  ctx.fillText('SALES REP', footX, footY + 4);
}

function drawBrandPickup(ctx, brand, x, y, bob, w, h, time, aisle) {
  const px = (n) => n * w;
  const py = (n) => n * h;
  const fy = y + Math.sin(time * 0.0028 + bob) * 0.012;
  const style = brandCrateStyle(brand);
  const bw = px(0.15);
  const bh = py(0.068);

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(px(x + 0.008), py(fy + 0.006), bw, bh);

  ctx.fillStyle = style.fill;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(px(x), py(fy), bw, bh, 5);
  else ctx.rect(px(x), py(fy), bw, bh);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px(x + 0.012), py(fy + 0.018));
  ctx.lineTo(px(x + 0.138), py(fy + 0.018));
  ctx.stroke();

  ctx.font = '700 9px "DM Sans", sans-serif';
  ctx.fillStyle = style.label;
  const label = brand.length > 10 ? `${brand.slice(0, 9)}…` : brand;
  ctx.fillText(label, px(x + 0.014), py(fy + 0.045));

  ctx.fillStyle = aisle.neon;
  ctx.globalAlpha = 0.5 + Math.sin(time * 0.005 + bob) * 0.3;
  ctx.beginPath();
  ctx.arc(px(x + 0.132), py(fy + 0.012), 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function obstacleBox(e) {
  if (e.type === 'booth') {
    return { x: e.x + 0.012, y: e.y + e.h * 0.2, w: e.w - 0.024, h: e.h * 0.78 };
  }
  if (e.type === 'vendor' || e.type === 'security') {
    return { x: e.x + 0.02, y: e.y + e.h * 0.58, w: e.w - 0.04, h: e.h * 0.4 };
  }
  return { x: e.x + 0.01, y: e.y + 0.01, w: e.w - 0.02, h: e.h - 0.02 };
}

function isJumpingOver(playerBox, obsBox, grounded) {
  if (grounded) return false;
  const feetY = playerBox.y + playerBox.h;
  return feetY <= obsBox.y + 0.008;
}

function handleObstacleCollision(s, e, playerBox) {
  if (s.invuln > 0) return false;
  const box = obstacleBox(e);
  if (!hit(playerBox, box)) return false;
  if (isJumpingOver(playerBox, box, s.grounded)) return false;

  s.lives -= 1;
  s.invuln = 2000;
  s.chaserOffset += 0.045;
  s.flash = 350;
  if (e.type === 'booth') {
    s.flashText = e.knockoff
      ? `Fake ${e.knockoff.name} booth!`
      : `${e.boothStyle?.title || 'Vendor'} — jump!`;
  } else if (e.type === 'security') {
    s.flashText = 'Security caught you — no vaping!';
  } else if (e.chinese) {
    s.flashText = 'Import vendor blocked you!';
  } else {
    s.flashText = e.boothStyle?.id === 'seven_oh'
      ? '7-OH rep got you — bans be damned!'
      : e.boothStyle?.id === 'euphoric_blend'
        ? 'Euphoric Blend ambush!'
        : e.boothStyle?.id === 'mushroom_psyche'
      ? 'Shroom rep got you!'
      : e.boothStyle?.id === 'preroll_lab'
        ? 'Pre-roll demo ambush!'
        : 'Vendor caught you — jump!';
  }
  return s.lives <= 0;
}

function LivesDisplay({ lives, max = LIVES, color = '#C9A84C', emptyColor = '#555' }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: i < lives ? color : emptyColor,
            boxShadow: i < lives ? `0 0 6px ${color}` : 'none',
            display: 'inline-block',
          }}
        />
      ))}
      {lives <= 0 && (
        <span style={{ fontSize: 9, marginLeft: 2, color: emptyColor }}>OUT</span>
      )}
    </span>
  );
}

export default function LobbyRunnerGame({ playerName = 'Guest', onGameOver, theme }) {
  const canvasRef = useRef(null);
  const gameSurfaceRef = useRef(null);
  const touchTapRef = useRef(false);
  const stateRef = useRef(null);
  const rafRef = useRef(null);
  const hudSnapshotRef = useRef({ score: -1, lives: -1, products: -1, aisle: 0 });
  const endedRef = useRef(false);
  const endGameRef = useRef(null);
  const mountedRef = useRef(true);

  const [hud, setHud] = useState({ score: 0, lives: LIVES, products: 0, aisle: 0, phase: 'ready' });
  const [leaderboard, setLeaderboard] = useState([]);
  const [lastRun, setLastRun] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadBoard = useCallback(async () => {
    const r = await fetchLobbyLeaderboard(8);
    if (r.ok) setLeaderboard(r.rows);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
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
    setSubmitting(false);
    setHud({ score: 0, lives: LIVES, products: 0, aisle: 0, phase: 'playing' });
    setLastRun(null);
  }, []);

  const endGame = useCallback(async (finalState, reason = 'caught') => {
    if (endedRef.current) return;
    endedRef.current = true;
    finalState.running = false;
    finalState.flashText = reason === 'checkout'
      ? 'You made it — real brands at Global Access!'
      : 'Knockoff vendors caught you!';
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
    try {
      await submitLobbyScore({ playerName, score: run.score, productsCollected: run.products });
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
    if (mountedRef.current) loadBoard();
  }, [loadBoard, onGameOver, playerName]);

  endGameRef.current = endGame;

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (!s?.running) { resetGame(); return; }
    if (s.grounded) { s.vy = JUMP_V; s.grounded = false; }
  }, [resetGame]);

  const handleGameTouchStart = useCallback((e) => {
    e.preventDefault();
    touchTapRef.current = true;
    jump();
  }, [jump]);

  const handleGameClick = useCallback((e) => {
    if (touchTapRef.current) {
      touchTapRef.current = false;
      e.preventDefault();
      return;
    }
    jump();
  }, [jump]);

  useEffect(() => {
    const el = gameSurfaceRef.current;
    if (!el) return undefined;
    const blockTouchMove = (e) => e.preventDefault();
    const blockContextMenu = (e) => e.preventDefault();
    const blockSelectStart = (e) => e.preventDefault();
    el.addEventListener('touchmove', blockTouchMove, { passive: false });
    el.addEventListener('contextmenu', blockContextMenu);
    el.addEventListener('selectstart', blockSelectStart);
    return () => {
      el.removeEventListener('touchmove', blockTouchMove);
      el.removeEventListener('contextmenu', blockContextMenu);
      el.removeEventListener('selectstart', blockSelectStart);
    };
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return undefined;

    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    resetGame();
    let last = performance.now();
    let alive = true;

    const draw = (now) => {
      if (!alive) return;
      rafRef.current = requestAnimationFrame(draw);

      const dt = Math.min(22, now - last);
      last = now;
      const s = stateRef.current;
      if (!s) return;

      const w = CANVAS_W;
      const h = CANVAS_H;
      const px = (n) => n * w;
      const py = (n) => n * h;
      const aisle = SHOW_AISLES[s.aisleIdx] || SHOW_AISLES[0];

      if (s.running) {
        s.walkPhase += dt * (s.grounded ? 0.32 : 0.08);
        s.registerProgress += dt * 0.021;
        s.distance += s.speed * dt;
      }

      const scroll = aisleScrollDistance(s);
      ctx.clearRect(0, 0, w, h);
      drawShowFloor(ctx, w, h, aisle, scroll);

      const progRatio = Math.min(1, s.registerProgress / CHECKOUT_GOAL);
      const boothX = 0.62 + (1 - progRatio) * 0.42;
      const nearBooth = progRatio > 0.72;
      drawGlobalAccessBooth(ctx, boothX, w, h, nearBooth, s.registerProgress);

      ctx.font = '700 10px "Bebas Neue", sans-serif';
      ctx.fillStyle = '#C9A84C';
      ctx.textAlign = 'right';
      ctx.fillText('GA BOOTH →', w - 8, py(0.075));
      ctx.textAlign = 'start';

      if (s.running) {
        s.spawnTimer += dt;
        const progressRatio = s.registerProgress / CHECKOUT_GOAL;
        const spawnGap = Math.max(1300, 2800 - progressRatio * 1100 - s.aisleIdx * 45);
        const minSpacing = Math.max(0.5, 0.74 - progressRatio * 0.18);
        if (s.spawnTimer >= spawnGap) {
          s.spawnTimer = 0;
          const lastEnt = s.entities[s.entities.length - 1];
          if (!lastEnt || lastEnt.x < minSpacing) {
            s.entities.push(spawnEntity(aisle.id, progressRatio));
          }
        }

        s.vy += GRAVITY * (dt / 16);
        s.playerY += s.vy * (dt / 16) * 0.0095;
        const floorY = GROUND - PLAYER_H;
        if (s.playerY >= floorY) { s.playerY = floorY; s.vy = 0; s.grounded = true; }

        s.speed = Math.min(0.00105, 0.00062 + s.aisleIdx * 0.000035 + progressRatio * 0.0002);
        s.score += dt * 0.022;
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

        const playerBox = playerCollisionBox(s);

        s.entities = s.entities.filter((e) => {
          if (!s.running) return true;
          e.x -= s.speed * dt * 0.82;
          if (e.x < -0.22) return false;
          if (e.type === 'brand' && hit(playerBox, e)) {
            s.products += 1;
            s.score += 120;
            s.flash = 450;
            s.flashText = `+ ${e.brand}`;
            s.chaserOffset = Math.max(0, s.chaserOffset - 0.02);
            return false;
          }
          if (e.type === 'vendor' || e.type === 'booth' || e.type === 'security') {
            const fatal = handleObstacleCollision(s, e, playerBox);
            if (fatal) {
              endGameRef.current?.(s, 'caught');
              return false;
            }
          }
          return true;
        });

        if (s.running && s.registerProgress >= CHECKOUT_GOAL) {
          s.score += 600;
          endGameRef.current?.(s, 'checkout');
        }

        if (s.running) {
          const scoreInt = Math.floor(s.score);
          const snap = hudSnapshotRef.current;
          if (scoreInt !== snap.score || s.lives !== snap.lives || s.products !== snap.products || s.aisleIdx !== snap.aisle) {
            hudSnapshotRef.current = { score: scoreInt, lives: s.lives, products: s.products, aisle: s.aisleIdx };
            setHud({ score: scoreInt, lives: s.lives, products: s.products, aisle: s.aisleIdx, phase: 'playing' });
          }
        }
      }

      s.entities.forEach((e) => {
        if (e.type === 'brand') drawBrandPickup(ctx, e.brand, e.x, e.y, e.bob, w, h, now, aisle);
        else if (e.type === 'booth') drawKnockoffBooth(ctx, e, w, h, aisle, now);
        else if (e.type === 'security') drawSecurityGuard(ctx, e, w, h, s.walkPhase);
        else drawVendorRep(ctx, e, w, h, s.walkPhase, aisle);
      });

      const chaserFootX = s.chaserOffset * w;
      const chaserFootYpx = py(GROUND - 0.01);
      drawChasingRep(ctx, chaserFootX, chaserFootYpx, characterScale(h, 0.95), s.walkPhase, s.chaserLine);

      const pa = s.invuln > 0 && Math.floor(s.invuln / 130) % 2 ? 0.4 : 1;
      drawBuyer(ctx, PLAYER_X, s.playerY, w, h, s.walkPhase, pa);

      if (s.flash > 0 && s.flashText) {
        ctx.fillStyle = aisle.neon;
        ctx.globalAlpha = 0.92;
        ctx.fillRect(px(0.12), py(0.28), px(0.76), py(0.055));
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#111';
        ctx.font = '700 12px "DM Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(s.flashText, w / 2, py(0.315));
        ctx.textAlign = 'start';
      }

      const prog = Math.min(100, Math.round((s.registerProgress / CHECKOUT_GOAL) * 100));
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(px(0.05), py(0.035), px(0.9), py(0.028));
      const barGrad = ctx.createLinearGradient(px(0.05), 0, px(0.95), 0);
      barGrad.addColorStop(0, aisle.lane);
      barGrad.addColorStop(1, aisle.neon);
      ctx.fillStyle = barGrad;
      ctx.fillRect(px(0.05), py(0.035), px(0.9 * (prog / 100)), py(0.028));
      ctx.font = '700 9px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(`${aisle.name}  ·  → GA Booth ${prog}%`, w / 2, py(0.054));
      ctx.textAlign = 'start';
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [resetGame]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jump]);

  const aisleName = SHOW_AISLES[hud.aisle]?.name || SHOW_AISLES[0].name;
  const aisleColor = SHOW_AISLES[hud.aisle]?.neon || '#C9A84C';

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8, fontSize: 10, color: theme?.textMuted || '#888',
        letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600, gap: 6, flexWrap: 'wrap',
      }}>
        <span style={{ color: aisleColor }}>{aisleName}</span>
        <span>Score {hud.score}</span>
        <span>Brands {hud.products}</span>
        <LivesDisplay lives={hud.lives} color={aisleColor} />
      </div>

      <div
        ref={gameSurfaceRef}
        role="button"
        tabIndex={0}
        onTouchStart={handleGameTouchStart}
        onClick={handleGameClick}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') {
            e.preventDefault();
            jump();
          }
        }}
        style={{
          ...GAME_SURFACE_STYLE,
          border: `2px solid ${aisleColor}`,
          boxShadow: `0 4px 20px ${aisleColor}33`,
        }}
        aria-label="Champs trade show runner — tap to jump"
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={CANVAS_STYLE}
        />
      </div>

      <p style={{ fontSize: 11, color: theme?.textFaint || '#AAA', margin: '8px 0 0', lineHeight: 1.45, textAlign: 'center' }}>
        Walk the aisle toward Global Access · Booths ahead · Jump counters & reps · Reach GA on the right
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
                <span>{row.score} pts · {row.products_collected} brands</span>
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
