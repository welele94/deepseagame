import {
  bg,
  setupResize,
  getInitialWaterlineNorm,
  initCameraIfNeeded,
  updateCameraTarget
} from "./background.js";
import { createBoat, drawBoat, getBoatAnchor } from "./barco.js";
import { Rope } from "./corda.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

setupResize(canvas, ctx);

const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

const waterlineNorm = getInitialWaterlineNorm();
const boat = createBoat(canvas);

const rope = new Rope({ segments: 25, ropeLength: 320, iterations: 10 });
let ropeInited = false;

// gameplay
let lootWeight = 0; // depois aumentas quando apanhar loot

let last = performance.now();

function loop(now) {
  const tSec = now / 1000;
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  // camera
  initCameraIfNeeded(waterlineNorm);
  updateCameraTarget({ waterlineNorm, player: null });

  // limpa
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // desenhar mundo primeiro
  bg.draw(ctx, canvas);
  drawBoat(ctx, canvas, boat, tSec, waterlineNorm);

  // init rope quando já temos rect real do barco
  if (!ropeInited && boat.screenW > 0) {
    const a = getBoatAnchor(boat);
    rope.initAtAnchor(a.x, a.y);
    ropeInited = true;
  }

  // controls
  const swim = 2600;
  const ctrl = { ax: 0, ay: 0 };
  if (keys["a"] || keys["arrowleft"]) ctrl.ax -= swim;
  if (keys["d"] || keys["arrowright"]) ctrl.ax += swim;
  if (keys["w"] || keys["arrowup"]) ctrl.ay -= swim;
  if (keys["s"] || keys["arrowdown"]) ctrl.ay += swim;

  // limites: só sai da água na zona do barco
  const limits = {
    waterlineY: boat.waterlineScreenY,
    boatXMin: boat.screenX + boat.screenW * 0.20,
    boatXMax: boat.screenX + boat.screenW * 0.80,
    margin: 2
  };

  // peso extra (exemplo simples)
  const extraDownForce = lootWeight * 10;

  // update rope + draw rope
  if (ropeInited) {
    rope.step(dt, () => getBoatAnchor(boat), ctrl, extraDownForce, limits);
    rope.draw(ctx);

    // desenhar Gustavo (último nó)
    const d = rope.getDiverPos();
    ctx.save();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(d.x, d.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // debug
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