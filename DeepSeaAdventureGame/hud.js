export function drawBarsHUD(ctx, canvas, state) {
  // state: { oxygen01, life01 }  // 0..1
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;

  const margin = 20;
  const gap = 20;

  const pad = 14;
  const barW = (W - margin * 2 - gap) / 2;
  const barH = 18;

  const x1 = margin;
  const x2 = margin + barW + gap;
  const y = 20;

  drawSingleBar(ctx, x1, y, barW, barH, state.oxygen01,  "#3ec5ff", "Oxygen");
  drawSingleBar(ctx, x2, y, barW, barH, state.life01,"#ff4d4d", "Health");
}

function drawSingleBar(ctx, x, y, w, h, value01, color, label) {
  value01 = Math.max(0, Math.min(1, value01));

  const r = Math.min(10, h / 2);
  const pad = 2;                 // margem interna para o stroke não “comer” o fill
  const strokeW = 2;

  // alinhar stroke em pixels inteiros (reduz “brilho”/blur)
  const ax = Math.round(x) + 0.5;
  const ay = Math.round(y) + 0.5;

  // --- BG (rounded) ---
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, ax, ay, w, h, r);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fill();

  // --- FILL (clipped dentro do rounded) ---
  ctx.clip();
  const innerW = Math.max(0, (w - pad * 2) * value01);
  ctx.fillStyle = color;
  ctx.fillRect(ax + pad, ay + pad, innerW, h - pad * 2);
  ctx.restore();

  // --- STROKE (mesmo path, no fim) ---
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, ax, ay, w, h, r);
  ctx.strokeStyle = "rgba(0,0,0,0.65)";
  ctx.lineWidth = strokeW;
  ctx.stroke();
  ctx.restore();

  // --- TEXTO ---
  ctx.fillStyle = "black";
  ctx.font = "12px sans-serif";
  ctx.fillText(`${label} ${Math.round(value01 * 100)}%`, x, y - 6);
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}