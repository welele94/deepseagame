import {
  bg,
  setupResize,
  getInitialWaterlineNorm,
  initCameraIfNeeded,
  updateCameraTarget,
  screenToImage,
} from "./background.js";

import { ObjectSpawner } from "./objectSpawner.js";
import { drawBarsHUD } from "./hud.js";
import { createBoat, drawBoat, getBoatAnchor } from "./barco.js";
import { Rope, gustavoImg } from "./corda.js";
import { computeIsMobile } from "./background.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const spawnPoints = generateSpawnPoints({
  count: 10,
  minU: 0.05,
  maxU: 0.95,
  minV: 0.58,
  maxV: 0.96,
});



// ===============================
// LOOT IMAGE CACHE
// ===============================
const lootImgCache = new Map();

function getLootImg(src) {
  if (!src) return null;

  if (lootImgCache.has(src)) {
    return lootImgCache.get(src);
  }

  const img = new Image();
  img.src = src;

  lootImgCache.set(src, img);

  return img;
}

let gustVxSm = 0;
let gustVySm = 0;
let gustRot = 0;
let prevRect = null;

let playerForCamera = null;

setupResize(canvas, ctx);

function generateSpawnPoints({
  count = 40,
  minU = 0.05,
  maxU = 0.95,
  minV = 0.55,
  maxV = 0.95,
  minDist = 0.06,
  rng = Math.random,
} = {}) {
  const points = [];
  let tries = 0;
  const maxTries = count * 30;

  while (points.length < count && tries < maxTries) {
    tries++;

    const u = minU + (maxU - minU) * rng();
    const v = minV + (maxV - minV) * rng();

    let ok = true;
    for (const p of points) {
      const du = p.u - u;
      const dv = p.v - v;
      if (du * du + dv * dv < minDist * minDist) {
        ok = false;
        break;
      }
    }

    if (ok) points.push({ u, v });
  }

  return points;
}

function imageUVToScreen(u, v) {
  if (!bg.img || !bg.lastRect) return null;

  const imgW = bg.img.naturalWidth;
  const imgH = bg.img.naturalHeight;

  const ix = u * imgW;
  const iy = v * imgH;

  return {
    x: bg.lastRect.x + ix * bg.lastRect.w / imgW,
    y: bg.lastRect.y + iy * bg.lastRect.h / imgH,
    ix,
    iy,
  };
}

// impede scroll/pinch e estabiliza input mobile
canvas.style.touchAction = "none";

// ===============================
// INPUT (KEYS)
// ===============================
const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

// ===============================
// SPAWNER
// ===============================
// ⚠️ Para este teste, vamos considerar x/y em SCREEN coords.
// Então xMin/xMax são em px do ecrã (centrado no canvas).
const spawner = new ObjectSpawner({
  maxActive: 18,
  spawnEverySec: 0.9,
  spawnJitter: 0.35,
  aheadMin: 220,
  aheadMax: 900,
  avoidRadius: 120,
  spawnPoints,
});
// ===============================
// PLAYER STATS
// ===============================
export const stats = {
  maxOxygen: 100,
  oxygen: 100,

  maxLife: 100,
  life: 100,

  lastBreath: false,
  lastBreathTimer: 0,
};

export function updateOxygen(dt, depth, lootWeight) {
  const baseDrain = 4.5; // por segundo
  const depthDrain = depth * 0.0012; // depth em px -> tuning
  const weightDrain = lootWeight * 0.03;

  if (!stats.lastBreath) {
    stats.oxygen -= (baseDrain + depthDrain + weightDrain) * dt;

    if (stats.oxygen <= 0) {
      stats.oxygen = 0;
      stats.lastBreath = true;
      stats.lastBreathTimer = 2.0;
    }
  } else {
    stats.lastBreathTimer -= dt;
    if (stats.lastBreathTimer <= 0) {
      stats.life = 0;
    }
  }
}

export function recoverAtSurface() {
  if (stats.lastBreath) {
    stats.lastBreath = false;
    stats.lastBreathTimer = 0;
    stats.oxygen = 8;
  } else {
    stats.oxygen = stats.maxOxygen;
  }
}

export function damage(amount) {
  stats.life = Math.max(0, stats.life - amount);
}

export function heal(amount) {
  stats.life = Math.min(stats.maxLife, stats.life + amount);
}

export function isDead() {
  return stats.life <= 0;
}

// ===============================
// WORLD INIT
// ===============================
const waterlineNorm = getInitialWaterlineNorm();
const boat = createBoat(canvas);

const rope = new Rope({ segments: 25, ropeLength: 320, iterations: 10 });
let ropeInited = false;

// gameplay
let lootWeight = 0;

let last = performance.now();

// ===============================
// POINTER (MOBILE) — state-based
// ===============================
const pointer = {
  active: false,
  id: null,
  target: { x: 0, y: 0 },
};

function setPointerTarget(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  pointer.target.x = clientX - r.left;
  pointer.target.y = clientY - r.top;
}

canvas.addEventListener(
  "pointerdown",
  (e) => {
    if (!computeIsMobile(canvas)) return;
    if (e.pointerType !== "touch") return;

    e.preventDefault();
    pointer.active = true;
    pointer.id = e.pointerId;
    setPointerTarget(e.clientX, e.clientY);
  },
  { passive: false }
);

canvas.addEventListener(
  "pointermove",
  (e) => {
    if (!computeIsMobile(canvas)) return;
    if (!pointer.active) return;
    if (e.pointerId !== pointer.id) return;

    e.preventDefault();
    setPointerTarget(e.clientX, e.clientY);
  },
  { passive: false }
);

function endPointer(e) {
  if (!computeIsMobile(canvas)) return;
  if (e.pointerId !== pointer.id) return;

  e.preventDefault();
  pointer.active = false;
  pointer.id = null;
}

canvas.addEventListener("pointerup", endPointer, { passive: false });
canvas.addEventListener("pointercancel", endPointer, { passive: false });

// ===============================
// RENDER: GUSTAVO (último nó da rope)
// ===============================
function drawGustavo(ctx, rope, img, dt, ctrl) {
  if (!img?.naturalWidth) return;

  const { x, y } = rope.getDiverPos();
  const size = rope.segLen * 16;
  const offX = 0;
  const offY = 8;

  const inputX = ctrl.ax || 0;
  const inputY = ctrl.ay || 0;

  const inputMag2 = inputX * inputX + inputY * inputY;

  // só atualiza direção se houver input real
  if (inputMag2 > 1) {
    const targetRot = Math.atan2(inputY, inputX) + Math.PI / 2;

    let diff = targetRot - gustRot;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));

    const maxTurn = 4.0 * dt; // controla rapidez da viragem
    diff = Math.max(-maxTurn, Math.min(maxTurn, diff));

    gustRot += diff;
  }

  ctx.save();
  ctx.translate(x + offX, y + offY);
  ctx.rotate(gustRot);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
}
// ===============================
// LOOT DRAW (DEBUG)
// ===============================
const DEBUG_LOOT = false; // mete true se quiseres ver as bolinhas

function drawLoot(o) {
  const x = o.x ?? 0;
  const y = o.y ?? 0;
  const r = o.radius ?? 12;

  const img = getLootImg(o.assetKey);

  // DEBUG (opcional)
  if (DEBUG_LOOT) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 215, 0, 1)";
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(o.size ?? "?", x, y - r - 6);
    ctx.restore();
  }

  // SPRITE
  if (img && img.naturalWidth > 0) {
    // queremos que o sprite tenha +/- (2*radius) de largura/altura
    const targetSize = r * 2;

    const scale = targetSize / Math.max(img.naturalWidth, img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;

    const ax = o.anchor?.x ?? 0.5;
    const ay = o.anchor?.y ?? 0.5;

    ctx.drawImage(img, x - w * ax, y - h * ay, w, h);
  } else {
    // fallback: se ainda não carregou, mostra um pontinho discreto
    if (!DEBUG_LOOT) {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
      ctx.restore();
    }
  }
}

/*
#################  M A I N   L O O P  ################
*/
function loop(now) {
  const tSec = now / 1000;
  const dt = Math.min(0.033, (now - last) / 1000);

  if (!Number.isFinite(dt) || dt < 0.001) {
    requestAnimationFrame(loop);
    return;
  }
  last = now;

  initCameraIfNeeded(waterlineNorm);

  // usa o target do frame anterior (estável)
  updateCameraTarget({ waterlineNorm, player: playerForCamera });

  // limpa
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // mundo
  bg.draw(ctx, canvas);

  // ===============================
  // CAMERA COMPENSATION (anti energy injection)
  // ===============================
  if (ropeInited && bg.lastRect) {
    if (prevRect) {
      const dxCam = bg.lastRect.x - prevRect.x;
      const dyCam = bg.lastRect.y - prevRect.y;

      if (dxCam || dyCam) {
        rope.offsetAll(dxCam, dyCam);
      }
    }
    prevRect = { x: bg.lastRect.x, y: bg.lastRect.y };
  }

  drawBoat(ctx, canvas, boat, tSec, waterlineNorm);

  // ===============================
  // INIT ROPE quando já temos rect real do barco
  // ===============================
  if (!ropeInited && boat.screenW > 0) {
    const a = getBoatAnchor(boat);
    rope.initAtAnchor(a.x, a.y);
    ropeInited = true;

    const d0 = rope.getDiverPos();
    pointer.target.x = d0.x;
    pointer.target.y = d0.y;
    pointer.active = false;
  }

  // ===============================
  // CONTROLS
  // ===============================
  const ctrl = { ax: 0, ay: 0 };

  if (computeIsMobile(canvas)) {
    if (!pointer.active || !ropeInited) {
      ctrl.ax = 0;
      ctrl.ay = 0;
    } else {
      const d = rope.getDiverPos();
      const dx = pointer.target.x - d.x;
      const dy = pointer.target.y - d.y;
      const dist = Math.hypot(dx, dy) || 1;

      const DEAD = 10;
      if (dist < DEAD) {
        ctrl.ax = 0;
        ctrl.ay = 0;
      } else {
        const MAX_SPEED = 90;
        const SLOW_RADIUS = 180;

        const speed = MAX_SPEED * Math.min(1, dist / SLOW_RADIUS);
        const dirX = dx / dist;
        const dirY = dy / dist;

        const desiredVx = dirX * speed;
        const desiredVy = dirY * speed;

        const dtSafe = Math.max(dt, 1 / 60);
        let vCurX = d.vx / dtSafe;
        let vCurY = d.vy / dtSafe;

        const VCLAMP = 600;
        vCurX = Math.max(-VCLAMP, Math.min(VCLAMP, vCurX));
        vCurY = Math.max(-VCLAMP, Math.min(VCLAMP, vCurY));

        const GAIN = 4;
        ctrl.ax = (desiredVx - vCurX) * GAIN;
        ctrl.ay = (desiredVy - vCurY) * GAIN;

        const MAX_ACCEL = 450;
        ctrl.ax = Math.max(-MAX_ACCEL, Math.min(MAX_ACCEL, ctrl.ax));
        ctrl.ay = Math.max(-MAX_ACCEL, Math.min(MAX_ACCEL, ctrl.ay));
      }
    }
  } else {
    const SWIM_DESKTOP = 1200;
    if (keys["a"] || keys["arrowleft"]) ctrl.ax -= SWIM_DESKTOP;
    if (keys["d"] || keys["arrowright"]) ctrl.ax += SWIM_DESKTOP;
    if (keys["w"] || keys["arrowup"]) ctrl.ay -= SWIM_DESKTOP;
    if (keys["s"] || keys["arrowdown"]) ctrl.ay += SWIM_DESKTOP;
  }

  // ===============================
  // LIMITS: só sai da água na zona do barco
  // ===============================
  const limits = {
    waterlineY: boat.waterlineScreenY,
    boatXMin: boat.screenX + boat.screenW * 0.2,
    boatXMax: boat.screenX + boat.screenW * 0.8,
    margin: 2,
  };

  const extraDownForce = lootWeight * 10;

  // ===============================
  // UPDATE ROPE + DRAW
  // ===============================
  if (ropeInited) {
    rope.step(dt, () => getBoatAnchor(boat), ctrl, extraDownForce, limits);
    rope.draw(ctx);
    drawGustavo(ctx, rope, gustavoImg, dt, ctrl);
  }

  // ===============================
  // PLAYER OBJ (para o spawner)
  // ===============================
  let player = null;
  if (ropeInited) {
    const d = rope.getDiverPos(); // screen coords
    const pImg = screenToImage(d.x, d.y); // image coords

    const bgH = bg?.img?.naturalHeight || 1;
    const waterYImg = waterlineNorm * bgH;

    player = {
      // ✅ SCREEN (para este teste do spawner)
      x: d.x,
      y: d.y,

      // ✅ IMAGE (vai ser útil já já quando mudarmos p/ pontos fixos)
      ix: pImg.ix,
      iy: pImg.iy,

      // depth em px abaixo da waterline (na imagem)
      depth: Math.max(0, pImg.iy - waterYImg),
    };
  }

  // ===============================
  // SPAWNER UPDATE + DRAW (✅ só UMA vez)
  // ===============================
  if (player) {
    spawner.update(dt, player, {
      imageUVToScreen,
    });
  }
  for (const o of spawner.active) {
    const pos = imageUVToScreen(o.u, o.v);
    if (pos) {
      o.x = pos.x;
      o.y = pos.y;
    }
  }
  for (const o of spawner.active) {
    drawLoot(o);
  }

  // HUD
  drawBarsHUD(ctx, canvas, {
    oxygen01: stats.oxygen / stats.maxOxygen,
    life01: stats.life / stats.maxLife,
  });

  // atualizar target da camera com base no diver (last node)
  if (ropeInited && bg.lastRect) {
    const d = rope.getDiverPos();
    const pImg = screenToImage(d.x, d.y);
    playerForCamera = { ix: pImg.ix, iy: pImg.iy };
  } else {
    playerForCamera = null;
  }

  // DEBUG
  ctx.save();
  ctx.fillStyle = "#111";
  ctx.font = "14px Arial";
  ctx.fillText(
    `loot: ${spawner.active.length}  tension: ${rope.tensionSmoothed.toFixed(1)} ${
      rope.broken ? "BROKE" : ""
    }`,
    10,
    20
  );
  ctx.restore();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);