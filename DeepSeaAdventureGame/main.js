import {
  bg,
  setupResize,
  getInitialWaterlineNorm,
  initCameraIfNeeded,
  updateCameraTarget,
  screenToImage,
} from "./background.js";

import { createBoat, drawBoat, getBoatAnchor } from "./barco.js";
import { Rope, gustavoImg } from "./corda.js";
import { computeIsMobile } from "./background.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let playerForCamera = null;
setupResize(canvas, ctx);

// impede scroll/pinch e estabiliza input mobile
canvas.style.touchAction = "none";

// ===============================
// INPUT (KEYS)
// ===============================
const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

// ===============================
// WORLD INIT
// ===============================
const waterlineNorm = getInitialWaterlineNorm();
const boat = createBoat(canvas);

const rope = new Rope({ segments: 25, ropeLength: 320, iterations: 10 });
let ropeInited = false;

// gameplay
let lootWeight = 0; // depois aumentas quando apanhar loot

let last = performance.now();

// ===============================
// POINTER (MOBILE) — state-based
// ===============================
const pointer = {
  active: false,
  id: null,
  target: { x: 0, y: 0 }, // em coords do canvas (CSS px)
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
function drawGustavo(ctx, rope, img) {
  if (!img?.naturalWidth) return;

  const { x, y, vx, vy } = rope.getDiverPos();
  const size = rope.segLen * 16;
  const offX = 0;
  const offY = 8;

  const speed2 = vx * vx + vy * vy;
  const rot = speed2 > 0.0001 ? Math.atan2(vy, vx) + Math.PI / 2 : 0;

  ctx.save();
  ctx.translate(x + offX, y + offY);
  ctx.rotate(rot);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
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
  drawBoat(ctx, canvas, boat, tSec, waterlineNorm);

  // atualizar target da camera com base no diver (last node)
  if (ropeInited && bg.lastRect) {
    const d = rope.getDiverPos();
    const pImg = screenToImage(d.x, d.y);
    playerForCamera = { ix: pImg.ix, iy: pImg.iy };
  } else {
    playerForCamera = null;
  }

  // init rope quando já temos rect real do barco
  if (!ropeInited && boat.screenW > 0) {
    const a = getBoatAnchor(boat);
    rope.initAtAnchor(a.x, a.y);
    ropeInited = true;

    // init target do pointer
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
    // mobile: “segue o dedo”
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
        const MAX_SPEED = 90;     // px/s
        const SLOW_RADIUS = 180;

        const speed = MAX_SPEED * Math.min(1, dist / SLOW_RADIUS);
        const dirX = dx / dist;
        const dirY = dy / dist;

        const desiredVx = dirX * speed; // px/s
        const desiredVy = dirY * speed; // px/s

        // ✅ d.vx é px/frame, logo -> px/s = (px/frame) / dt
        const dtSafe = Math.max(dt, 1 / 60); // nunca uses dt minúsculo
        let vCurX = d.vx / dtSafe;
        let vCurY = d.vy / dtSafe;

        // clamp para evitar picos absurdos por jitter/frames estranhos
        const VCLAMP = 600; // px/s
        vCurX = Math.max(-VCLAMP, Math.min(VCLAMP, vCurX));
        vCurY = Math.max(-VCLAMP, Math.min(VCLAMP, vCurY));

        const GAIN = 4; // 3..6
        ctrl.ax = (desiredVx - vCurX) * GAIN;
        ctrl.ay = (desiredVy - vCurY) * GAIN;

        const MAX_ACCEL = 450;
        ctrl.ax = Math.max(-MAX_ACCEL, Math.min(MAX_ACCEL, ctrl.ax));
        ctrl.ay = Math.max(-MAX_ACCEL, Math.min(MAX_ACCEL, ctrl.ay));
      }
    }
  } else {
    // desktop: teclado (WASD / setas)
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

  // peso extra (exemplo simples)
  const extraDownForce = lootWeight * 10;

  // ===============================
  // UPDATE ROPE + DRAW
  // ===============================
  if (ropeInited) {
    rope.step(dt, () => getBoatAnchor(boat), ctrl, extraDownForce, limits);

    // desenhar corda
    rope.draw(ctx);

    // desenhar Gustavo (último nó)
    drawGustavo(ctx, rope, gustavoImg);
  }

  // ===============================
  // DEBUG
  // ===============================
  ctx.save();
  ctx.fillStyle = "#111";
  ctx.font = "14px Arial";
  ctx.fillText(
    `tension: ${rope.tensionSmoothed.toFixed(1)} ${rope.broken ? "BROKE" : ""}`,
    10,
    20
  );
  ctx.restore();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);