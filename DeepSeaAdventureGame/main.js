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
// TOUCH (MOBILE)
// ===============================
let touchActive = false;
let touchId = null;
let touchTarget = { x: 0, y: 0 };

function setTouchTarget(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  touchTarget.x = clientX - r.left;
  touchTarget.y = clientY - r.top;
}

canvas.addEventListener(
  "touchstart",
  (e) => {
    if (!computeIsMobile(canvas)) return;
    e.preventDefault();

    const t = e.changedTouches[0];
    touchActive = true;
    touchId = t.identifier;
    setTouchTarget(t.clientX, t.clientY);
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    if (!computeIsMobile(canvas)) return;
    if (!touchActive) return;
    e.preventDefault();

    const t =
      [...e.touches].find((tt) => tt.identifier === touchId) ||
      [...e.changedTouches].find((tt) => tt.identifier === touchId);
    if (!t) return;

    setTouchTarget(t.clientX, t.clientY);
  },
  { passive: false }
);

canvas.addEventListener(
  "touchend",
  (e) => {
    if (!computeIsMobile(canvas)) return;

    const ended = [...e.changedTouches].some((t) => t.identifier === touchId);
    if (!ended) return;

    e.preventDefault();
    touchActive = false;
    touchId = null;
  },
  { passive: false }
);

canvas.addEventListener(
  "touchcancel",
  (e) => {
    if (!computeIsMobile(canvas)) return;
    e.preventDefault();
    touchActive = false;
    touchId = null;
  },
  { passive: false }
);

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
  const rot = speed2 > 0.0001
    ? Math.atan2(vy, vx) + Math.PI / 2
    : 0;

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

    // init target do touch
    const d0 = rope.getDiverPos();
    touchTarget.x = d0.x;
    touchTarget.y = d0.y;
    touchActive = false;
  }

  // ===============================
  // CONTROLS
  // ===============================
  const ctrl = { ax: 0, ay: 0 };

  if (computeIsMobile(canvas)) {
    // mobile: “segue o dedo”
    if (!touchActive || !ropeInited) {
      ctrl.ax = 0;
      ctrl.ay = 0;
    } else if (dt < 0.01) {
      ctrl.ax = 0;
      ctrl.ay = 0;
    } else {
      const d = rope.getDiverPos();
      const dx = touchTarget.x - d.x;
      const dy = touchTarget.y - d.y;
      const dist = Math.hypot(dx, dy) || 1;

      const MAX_SPEED = 90; // px/s
      const SLOW_RADIUS = 180;
      const speed = MAX_SPEED * Math.min(1, dist / SLOW_RADIUS);

      const dirX = dx / dist;
      const dirY = dy / dist;

      const desiredVx = dirX * speed;
      const desiredVy = dirY * speed;

      const vCurX = d.vx / dt;
      const vCurY = d.vy / dt;

      const GAIN = 4;
      ctrl.ax = (desiredVx - vCurX) * GAIN;
      ctrl.ay = (desiredVy - vCurY) * GAIN;

      const MAX_ACCEL = 450;
      ctrl.ax = Math.max(-MAX_ACCEL, Math.min(MAX_ACCEL, ctrl.ax));
      ctrl.ay = Math.max(-MAX_ACCEL, Math.min(MAX_ACCEL, ctrl.ay));
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
    `tension: ${rope.tensionSmoothed.toFixed(1)} ${
      rope.broken ? "BROKE" : ""
    }`,
    10,
    20
  );
  ctx.restore();


  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);