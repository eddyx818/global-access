import React, { useEffect, useRef, useState, useCallback } from 'react';
import { fetchLobbyLeaderboard, submitLobbyScore } from '../lib/lobbyGameScores';
import {
  BOOTH_SIGNAGE,
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
  repLinesForTier,
} from '../lib/lobbyGame/champsShowData';

const LIVES = 3;
const GRAVITY = 0.36;
const JUMP_V = -6.2;
const GROUND = 0.84;
const PLAYER_X = 0.12;
const PLAYER_H = 0.19;
const PLAYER_W = 0.2;

function spawnEntity(aisleId) {
  const roll = Math.random();
  const knockoff = randomKnockoffBrand();
  const boothStyle = randomBoothStyle(aisleId);
  const chineseHeavy = aisleId === 'vape' || boothStyle.id === 'knockoff_import';

  if (roll < 0.2) {
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
  if (roll < 0.58) {
    const chinese = Math.random() < (chineseHeavy ? 0.55 : 0.28);
    return {
      type: 'booth',
      knockoff: boothStyle.id === 'knockoff_import' ? knockoff : null,
      boothStyle,
      chinese,
      pitch: randomObstaclePitch(aisleId, boothStyle, knockoff, chinese),
      x: 1.1,
      y: GROUND - 0.36,
      w: 0.18,
      h: 0.36,
    };
  }
  const chinese = Math.random() < (chineseHeavy ? 0.5 : 0.25);
  return {
    type: 'vendor',
    knockoff: aisleId === 'vape' ? knockoff : null,
    boothStyle,
    chinese,
    pitch: randomObstaclePitch(aisleId, boothStyle, knockoff, chinese),
    x: 1.04,
    y: GROUND - 0.14,
    w: 0.11,
    h: 0.14,
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

function drawCart(ctx, x, footY, scale, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#888';
  ctx.fillRect(x - scale * 0.02, footY - scale * 0.78, scale * 0.04, scale * 0.06);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - scale * 0.06, footY - scale * 0.82);
  ctx.lineTo(x + scale * 0.22, footY - scale * 0.82);
  ctx.stroke();
  ctx.strokeStyle = '#C9A84C';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + scale * 0.04, footY - scale * 0.72);
  ctx.lineTo(x + scale * 0.1, footY - scale * 0.38);
  ctx.lineTo(x + scale * 0.58, footY - scale * 0.38);
  ctx.lineTo(x + scale * 0.65, footY - scale * 0.72);
  ctx.stroke();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(x + scale * 0.2, footY - 5, 5, 0, Math.PI * 2);
  ctx.arc(x + scale * 0.52, footY - 5, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBuyer(ctx, xNorm, yNorm, w, h, walkPhase, alpha) {
  const footY = yNorm * h + PLAYER_H * h;
  const scale = h * 0.135;
  const footX = xNorm * w;
  drawCart(ctx, footX + scale * 0.95, footY, scale, alpha);
  drawHuman(ctx, footX, footY, scale, 'right', walkPhase, {
    shirt: '#2563eb', pants: '#1e3a5f', skin: '#d4a574', hair: '#3d2314', badge: true, alpha,
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

function drawLedStrip(ctx, x, y, w, colors, time) {
  const segW = w / colors.length;
  colors.forEach((color, i) => {
    const pulse = 0.65 + Math.sin(time * 0.004 + i * 1.2) * 0.35;
    ctx.fillStyle = color;
    ctx.globalAlpha = pulse;
    ctx.fillRect(x + i * segW, y, segW + 1, 5);
  });
  ctx.globalAlpha = 1;
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

function drawRingLight(ctx, cx, cy, r, time) {
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.85 + Math.sin(time * 0.006) * 0.15;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
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

function drawStyledBoothWall(ctx, bx, by, bw, bh, style, time) {
  const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
  grad.addColorStop(0, style.top);
  grad.addColorStop(0.45, style.mid);
  grad.addColorStop(1, style.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(bx, by, bw, bh);
  drawLedStrip(ctx, bx, by, bw, style.led, time);

  if (style.id === 'smiley_wall') drawSmileyPattern(ctx, bx, by, bw, bh);
  if (style.id === 'neon_beast') drawNeonSilhouette(ctx, bx, by, bw, bh);
  if (style.id === 'mushroom_psyche') {
    drawMushroomIcon(ctx, bx + bw * 0.5, by + bh * 0.45, bw * 0.35);
  }
  if (style.id === 'preroll_lab') {
    drawRingLight(ctx, bx + bw * 0.5, by + bh * 0.38, bw * 0.14, time);
    ctx.fillStyle = '#00AAFF';
    ctx.globalAlpha = 0.4;
    ctx.fillRect(bx + 4, by + bh - bh * 0.15, bw - 8, 4);
    ctx.globalAlpha = 1;
  }
  if (style.id === 'sunset_tower') {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(bx + bw * 0.75, by + bh * 0.15, bw * 0.18, bh * 0.55);
  }
  if (style.id === 'seven_oh') {
    ctx.font = '600 5px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('hydroxymitragynine', bx + bw / 2, by + bh * 0.32);
    ctx.textAlign = 'start';
  }
  if (style.id === 'euphoric_blend') {
    ctx.font = '700 8px "Bebas Neue", sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.fillText('™', bx + bw * 0.82, by + bh * 0.14);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '600 5px sans-serif';
    ctx.fillText('(rebranded)', bx + bw / 2, by + bh * 0.32);
    ctx.textAlign = 'start';
  }

  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.max(7, bw * 0.09)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(style.title, bx + bw / 2, by + bh * 0.16);
  ctx.font = '600 5px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(style.subtitle, bx + bw / 2, by + bh * 0.24);
  ctx.textAlign = 'start';

  ctx.fillStyle = style.counter;
  ctx.fillRect(bx + 2, by + bh - bh * 0.14, bw - 4, bh * 0.14);
}

function drawExpoBooth(ctx, bx, by, bw, bh, aisle, signage, time, depth = 1) {
  const styleKeys = AISLE_BOOTH_STYLE_KEYS[aisle.id] || ['sunset_tower'];
  const style = BOOTH_STYLES[styleKeys[Math.floor(bx) % styleKeys.length]] || BOOTH_STYLES.sunset_tower;
  ctx.globalAlpha = 0.55 + depth * 0.2;
  drawStyledBoothWall(ctx, bx, by, bw, bh, style, time);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.max(6, bw * 0.09)}px "Bebas Neue", sans-serif`;
  ctx.textAlign = 'center';
  const label = signage.length > 10 ? `${signage.slice(0, 9)}…` : signage;
  ctx.fillText(label, bx + bw / 2, by + bh * 0.97);
  ctx.textAlign = 'start';
}

const AISLE_BOOTH_STYLE_KEYS = {
  tobacco: ['sunset_tower', 'knockoff_import'],
  glass: ['preroll_lab', 'sunset_tower'],
  beverage: ['mushroom_psyche', 'smiley_wall'],
  thc: ['seven_oh', 'euphoric_blend', 'mushroom_psyche'],
  vape: ['neon_beast', 'knockoff_import'],
  home: ['seven_oh', 'preroll_lab'],
};

function drawParallaxBooths(ctx, w, h, scroll, aisle, time) {
  const signs = BOOTH_SIGNAGE[aisle.id] || BOOTH_SIGNAGE.tobacco;
  const layers = [
    { y: 0.08, bh: 0.28, speed: 0.00006, bw: 0.19, alpha: 0.55 },
    { y: 0.14, bh: 0.34, speed: 0.0001, bw: 0.22, alpha: 0.75 },
    { y: 0.2, bh: 0.4, speed: 0.00016, bw: 0.25, alpha: 1 },
  ];

  layers.forEach((layer, li) => {
    const count = 5 + li;
    for (let i = 0; i < count; i += 1) {
      const slot = i / count;
      const offset = (scroll * layer.speed + slot) % 1.15;
      const bx = (offset - 0.08) * w;
      if (bx < -w * layer.bw || bx > w * 1.05) continue;
      const by = layer.y * h;
      const boothH = layer.bh * h;
      const boothW = layer.bw * w;
      ctx.globalAlpha = layer.alpha;
      drawExpoBooth(ctx, bx, by, boothW, boothH, aisle, signs[i % signs.length], time + i * 200, li / 2);
    }
    ctx.globalAlpha = 1;
  });
}

function drawCeiling(ctx, w, h, aisle, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, h * 0.22);
  grad.addColorStop(0, aisle.skyTop);
  grad.addColorStop(1, aisle.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h * 0.22);

  for (let i = 0; i < 6; i += 1) {
    const lx = (i + 0.5) * (w / 6);
    const flicker = 0.7 + Math.sin(time * 0.002 + i) * 0.15;
    ctx.fillStyle = `rgba(255,255,240,${flicker})`;
    ctx.fillRect(lx - w * 0.04, 4, w * 0.08, h * 0.025);
    ctx.fillStyle = aisle.neon;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(lx - w * 0.04, 4, w * 0.08, h * 0.025);
    ctx.globalAlpha = 1;
  }
}

function drawCrowd(ctx, w, h, scroll, aisle) {
  const shirtColors = [...aisle.boothPalette, aisle.neon, '#fff', '#333'];
  for (let i = 0; i < 14; i += 1) {
    const cx = ((i * 0.09 - scroll * 0.00005 + (i % 4) * 0.015) % 1.12) * w;
    const cy = h * (0.52 + (i % 5) * 0.025);
    ctx.fillStyle = shirtColors[i % shirtColors.length];
    ctx.fillRect(cx - 4, cy + 2, 8, 11);
    ctx.fillStyle = '#e8b896';
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawShowFloor(ctx, w, h, aisle, scroll, time) {
  const py = (n) => n * h;

  drawCeiling(ctx, w, h, aisle, time);
  drawParallaxBooths(ctx, w, h, scroll, aisle, time);
  drawCrowd(ctx, w, h, scroll, aisle);

  ctx.fillStyle = aisle.banner;
  ctx.fillRect(0, py(0.58), w, py(0.048));
  ctx.strokeStyle = aisle.neon;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, py(0.58), w, py(0.048));
  ctx.fillStyle = '#fff';
  ctx.font = '700 11px "Bebas Neue", "DM Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(aisle.bannerText, w / 2, py(0.612));
  ctx.textAlign = 'start';

  const carpetGrad = ctx.createLinearGradient(0, py(GROUND - 0.02), 0, h);
  carpetGrad.addColorStop(0, aisle.carpet);
  carpetGrad.addColorStop(0.4, aisle.floor);
  carpetGrad.addColorStop(1, '#1a1a1a');
  ctx.fillStyle = carpetGrad;
  ctx.fillRect(0, py(GROUND - 0.02), w, h - py(GROUND - 0.02));

  ctx.strokeStyle = aisle.lane;
  ctx.lineWidth = 4;
  ctx.setLineDash([18, 12]);
  ctx.beginPath();
  ctx.moveTo(w * 0.08, py(GROUND + 0.004));
  ctx.lineTo(w * 0.08, h);
  ctx.moveTo(w * 0.92, py(GROUND + 0.004));
  ctx.lineTo(w * 0.92, h);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < 6; i += 1) {
    const fx = ((i * 0.2 - scroll * 0.0002) % 1.25) * w;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx, py(GROUND));
    ctx.lineTo(fx - w * 0.06, h);
    ctx.stroke();
  }

  ctx.fillStyle = aisle.neon;
  ctx.globalAlpha = 0.08;
  ctx.fillRect(0, py(GROUND - 0.02), w, py(0.04));
  ctx.globalAlpha = 1;
}

function drawGlobalAccessBooth(ctx, xNorm, w, h, glow, time, progress) {
  const rx = xNorm * w;
  const footY = GROUND * h;
  const bw = w * 0.34;
  const bh = h * 0.5;
  const prog = Math.min(1, progress / CHECKOUT_GOAL);

  ctx.shadowColor = '#C9A84C';
  ctx.shadowBlur = glow ? 28 : 12;
  ctx.fillStyle = '#111';
  ctx.fillRect(rx, footY - bh, bw, bh);
  drawLedStrip(ctx, rx, footY - bh, bw, ['#FFD700', '#C9A84C', '#FFF8DC', '#FFD700'], time);
  ctx.fillStyle = '#C9A84C';
  ctx.fillRect(rx + 4, footY - bh + 8, bw - 8, bh * 0.16);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#111';
  ctx.font = '700 14px "Bebas Neue", sans-serif';
  ctx.fillText('GLOBAL ACCESS', rx + bw * 0.06, footY - bh * 0.86);
  ctx.font = '600 8px sans-serif';
  ctx.fillStyle = '#333';
  ctx.fillText('REAL BRANDS · LEGIT DISTRIBUTOR', rx + bw * 0.07, footY - bh * 0.68);
  ctx.fillStyle = '#FFD700';
  ctx.globalAlpha = 0.35;
  ctx.fillRect(rx + 8, footY - bh * 0.58, bw - 16, bh * 0.3);
  ctx.globalAlpha = 1;
  for (let i = 0; i < 3; i += 1) {
    drawHuman(ctx, rx + bw * (0.1 + i * 0.28), footY - bh * 0.06, h * 0.085, 'left', i * 25 + time * 0.05, {
      shirt: i === 1 ? '#C9A84C' : '#2563eb', pants: '#111', skin: '#8d5524',
    });
  }
  ctx.font = '700 9px sans-serif';
  ctx.fillStyle = '#C9A84C';
  ctx.fillText('YOU MADE IT →', rx + bw * 0.22, footY - bh * 0.04);

  if (prog > 0.5) {
    ctx.font = '700 10px "Bebas Neue", sans-serif';
    ctx.fillStyle = '#2ecc71';
    ctx.fillText(`${Math.round(prog * 100)}%`, rx + bw * 0.78, footY - bh * 0.5);
  }
}

function drawVendorRep(ctx, e, w, h, walkPhase, aisle) {
  const footX = e.x * w;
  const footY = (e.y + e.h) * h;
  const scale = e.h * h * 0.82;
  drawSpeechBubble(ctx, footX, footY - scale * 1.05, e.pitch, 108, e.chinese ? '#e74c3c' : aisle.neon);
  drawHuman(ctx, footX, footY, scale, 'left', walkPhase + e.x * 100, {
    shirt: e.chinese ? '#c0392b' : aisle.vendorShirt,
    pants: '#222', skin: '#c68642', tie: aisle.neon,
  });
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
  const by = e.y * h;
  const bw = e.w * w;
  const bh = e.h * h;
  const footY = GROUND * h;
  const style = e.boothStyle || BOOTH_STYLES.knockoff_import;

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(bx, by, bw, footY - by);
  drawStyledBoothWall(ctx, bx, by, bw, bh * 0.92, style, time);

  if (e.knockoff) {
    ctx.font = '700 7px sans-serif';
    ctx.fillStyle = '#ff6b6b';
    ctx.textAlign = 'center';
    ctx.fillText(`FAKE: ${e.knockoff.name}`, bx + bw / 2, by + bh * 0.72);
    ctx.font = '600 5px sans-serif';
    ctx.fillText(`(not ${e.knockoff.mimics})`, bx + bw / 2, by + bh * 0.8);
    ctx.textAlign = 'start';
  }

  if (style.id === 'preroll_lab') {
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = '#333';
      ctx.fillRect(bx + 4 + i * (bw / 3.2), footY - bh * 0.1, bw / 4, bh * 0.08);
    }
  }

  drawSpeechBubble(ctx, bx, by - 4, e.pitch, 102, style.led[0] || aisle.neon);

  ctx.font = '700 6px sans-serif';
  ctx.fillStyle = style.led[0] || '#ff4757';
  ctx.fillText('JUMP OVER', bx + 4, footY - 2);
}

function drawChasingRep(ctx, footX, footY, scale, walkPhase, line, time, w, h) {
  const pulse = 0.5 + Math.sin(time * 0.012) * 0.5;
  const pulse2 = 0.5 + Math.sin(time * 0.018 + 1) * 0.5;

  ctx.save();
  const beamGrad = ctx.createLinearGradient(0, footY - scale, w * 0.35, footY);
  beamGrad.addColorStop(0, `rgba(255,60,60,${0.35 * pulse})`);
  beamGrad.addColorStop(0.5, `rgba(255,200,0,${0.12 * pulse2})`);
  beamGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.moveTo(0, footY - scale * 0.3);
  ctx.lineTo(footX + scale * 0.5, footY - scale * 0.5);
  ctx.lineTo(footX + scale * 0.5, footY);
  ctx.lineTo(0, footY);
  ctx.fill();
  ctx.restore();

  drawSpeechBubble(ctx, footX, footY - scale * 1.1, line, 118, '#e74c3c');
  drawHuman(ctx, footX, footY, scale, 'right', walkPhase + 30, {
    shirt: '#222', pants: '#111', skin: '#c68642', tie: '#C0392B',
  });

  const lights = ['#ff0000', '#00ff88', '#0088ff', '#ffaa00'];
  lights.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.globalAlpha = i % 2 === 0 ? pulse : pulse2;
    ctx.beginPath();
    ctx.arc(footX + scale * 0.08 + i * scale * 0.05, footY - scale * 0.48, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#FFD700';
  ctx.globalAlpha = pulse;
  ctx.fillRect(footX + scale * 0.14, footY - scale * 0.55, scale * 0.06, scale * 0.04);
  ctx.globalAlpha = 1;

  ctx.font = '700 7px sans-serif';
  ctx.fillStyle = '#e74c3c';
  ctx.fillText('CHASING REP', footX, footY + 4);
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

  ctx.font = '700 8px "DM Sans", sans-serif';
  ctx.fillStyle = style.label;
  const label = brand.length > 10 ? `${brand.slice(0, 9)}…` : brand;
  ctx.fillText(label, px(x + 0.014), py(fy + 0.042));

  ctx.font = '600 6px sans-serif';
  ctx.fillStyle = style.label;
  ctx.globalAlpha = 0.7;
  ctx.fillText('GA BRAND', px(x + 0.014), py(fy + 0.056));
  ctx.globalAlpha = 1;

  ctx.fillStyle = aisle.neon;
  ctx.globalAlpha = 0.5 + Math.sin(time * 0.005 + bob) * 0.3;
  ctx.beginPath();
  ctx.arc(px(x + 0.132), py(fy + 0.012), 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function obstacleBox(e) {
  return { x: e.x + 0.01, y: e.y + 0.01, w: e.w - 0.02, h: e.h - 0.02 };
}

function isJumpingOver(playerY, playerH, obsTop) {
  return (playerY + playerH) < obsTop + 0.03;
}

function handleObstacleCollision(s, e, playerBox) {
  if (s.invuln > 0) return false;
  const box = obstacleBox(e);
  if (!hit(playerBox, box)) return false;
  if (isJumpingOver(playerBox.y, playerBox.h, box.y)) return false;

  s.lives -= 1;
  s.invuln = 2000;
  s.chaserOffset += 0.045;
  s.flash = 350;
  if (e.type === 'booth') {
    s.flashText = e.knockoff
      ? `Fake ${e.knockoff.name} booth!`
      : `${e.boothStyle?.title || 'Vendor'} — jump!`;
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
      drawShowFloor(ctx, w, h, aisle, s.distance, now);

      const progRatio = Math.min(1, s.registerProgress / CHECKOUT_GOAL);
      const boothX = 0.62 + (1 - progRatio) * 0.42;
      const nearBooth = progRatio > 0.72;
      drawGlobalAccessBooth(ctx, boothX, w, h, nearBooth, now, s.registerProgress);

      ctx.font = '700 10px "Bebas Neue", sans-serif';
      ctx.fillStyle = '#C9A84C';
      ctx.textAlign = 'right';
      ctx.fillText('GA BOOTH →', w - 8, py(0.075));
      ctx.textAlign = 'start';

      if (s.running) {
        s.walkPhase += dt * (s.grounded ? 0.32 : 0.08);
        s.spawnTimer += dt;
        const spawnGap = Math.max(1600, 2400 - s.aisleIdx * 100);
        if (s.spawnTimer >= spawnGap) {
          s.spawnTimer = 0;
          const lastEnt = s.entities[s.entities.length - 1];
          if (!lastEnt || lastEnt.x < 0.68) {
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
            s.flashText = `+ ${e.brand} (real GA brand)`;
            s.chaserOffset = Math.max(0, s.chaserOffset - 0.02);
            return false;
          }
          if ((e.type === 'vendor' || e.type === 'booth') && handleObstacleCollision(s, e, playerBox)) {
            endGame(s, 'caught');
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
        if (e.type === 'brand') drawBrandPickup(ctx, e.brand, e.x, e.y, e.bob, w, h, now, aisle);
        else if (e.type === 'booth') drawKnockoffBooth(ctx, e, w, h, aisle, now);
        else drawVendorRep(ctx, e, w, h, s.walkPhase, aisle);
      });

      const chaserFootX = s.chaserOffset * w;
      const chaserFootYpx = py(GROUND - 0.01);
      drawChasingRep(ctx, chaserFootX, chaserFootYpx, h * 0.105, s.walkPhase, s.chaserLine, now, w, h);

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

      <button
        type="button"
        onClick={jump}
        style={{
          width: '100%', padding: 0,
          border: `2px solid ${aisleColor}`,
          borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
          background: '#0a0a10', touchAction: 'manipulation',
          boxShadow: `0 4px 20px ${aisleColor}33`,
        }}
        aria-label="Champs trade show runner — dodge vendors, reach Global Access booth"
      >
        <canvas ref={canvasRef} width={360} height={280} style={{ display: 'block', width: '100%', height: 'auto' }} />
      </button>

      <p style={{ fontSize: 11, color: theme?.textFaint || '#AAA', margin: '8px 0 0', lineHeight: 1.45, textAlign: 'center' }}>
        Run right to Global Access · Jump pre-roll labs, shroom walls & knockoff booths · Dodge every rep pitching 7-OH
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
