import { bg, setupResize, getInitialWaterlineNorm, initCameraIfNeeded, updateCameraTarget } from "./background.js";
import { createBoat, drawBoat } from "./barco.js";


const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const waterlineNorm = getInitialWaterlineNorm();

setupResize(canvas, ctx);
const boat = createBoat(canvas);

function loop() {
  const tSec = performance.now() / 1000;

  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  initCameraIfNeeded(waterlineNorm);
  updateCameraTarget({ waterlineNorm, player: null });

  bg.draw(ctx, canvas);
  drawBoat(ctx, canvas, boat, tSec, waterlineNorm);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);