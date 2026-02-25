export function drawBarsHUD(ctx, canvas, state) {
  // state: { oxygen01, life01 }  // 0..1
  const W = canvas.clientWidth;
  const pad = 14;
  const barW = Math.min(260, W * 0.35);
  const barH = 14;
  const gap = 10;

  drawBar(ctx, pad, pad, barW, barH, state.oxygen01, "O2");
  drawBar(ctx, pad, pad + barH + gap, barW, barH, state.life01, "HP");
}

function drawBar(ctx, x, y, w, h, t, label) {
  t = Math.max(0, Math.min(1, t));

  // bg
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();

  // fill
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  roundRect(ctx, x + 2, y + 2, (w - 4) * t, h - 4, 6);
  ctx.fill();

  // label
  ctx.globalAlpha = 1;
  ctx.fillStyle = "white";
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText(`${label} ${(t * 100).toFixed(0)}%`, x + 8, y + h - 3);
  ctx.restore();
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