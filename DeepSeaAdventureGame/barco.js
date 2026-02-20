// barco.js (ES Module)

import { bg, computeIsMobile, loadImage, imageToScreen, getWaterlineIy } from "./background.js";

// ===============================
// CONFIG
// ===============================
export const BOAT_SRC =
  "https://cdn.jsdelivr.net/gh/welele94/deepseagame@main/boat.png.png"; // confirma o nome!

export const DEFAULT_FLOAT_NORM = 0.03; // % da altura do sprite

// ===============================
// STATE HELPERS
// ===============================
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function getInitialBoatFloatNorm() {
  let f = parseFloat(localStorage.getItem("boatFloatNorm"));
  if (!Number.isFinite(f)) f = DEFAULT_FLOAT_NORM;
  return clamp(f, -0.2, 0.2);
}

// ===============================
// FACTORY
// ===============================
export function createBoat(canvas) {
  const boatFloatNorm = getInitialBoatFloatNorm();

  return {
    id: "boat",
    img: loadImage(BOAT_SRC, "Boat"),

    // alinhamento do sprite à linha de água (percentagem da altura do sprite)
    waterlineAt: 0.77,

    // float configurável (positivo = sobe, negativo = desce)
    floatNorm: boatFloatNorm,

    // “tamanho” do barco em WORLD (vamos escolher com base em mobile)
    worldWDesktop: 260,
    worldWMobile: 160,

    // animação
    bob: { amp: 3, speed: 0.5 },
    tilt: { amp: 0.035, speed: 0.35 },

    // cache (opcional)
    _last: { boatW: 0, boatH: 0, isMobile: false },
  };
}

// ===============================
// DRAW
// ===============================
export function drawBoat(ctx, canvas, boat, tSec, waterlineNorm) {
  if (!boat?.img?.naturalWidth) return;
  if (!bg.lastRect || !bg.img.naturalWidth) return;

  // posição do barco no mundo (centro da imagem, na linha de água)
  const boatIx = bg.img.naturalWidth * 0.5;
  const boatIy = getWaterlineIy(waterlineNorm);

  // mundo -> ecrã
  const sp = imageToScreen(boatIx, boatIy);

  // escala do mundo (já inclui zoom/camera)
  const worldScale = bg.lastRect.scale;

  // tamanho do barco (world -> screen)
  const isMobile = computeIsMobile(canvas);
  const BOAT_WORLD_W = isMobile ? boat.worldWMobile : boat.worldWDesktop;

  const boatW = BOAT_WORLD_W * worldScale;
  const boatH = (boat.img.naturalHeight / boat.img.naturalWidth) * boatW;

  // float offset
  const floatNorm = Number.isFinite(boat.floatNorm) ? boat.floatNorm : DEFAULT_FLOAT_NORM;

  // ⚠️ no teu código estavas a multiplicar por um "mobileBoost"
  // isso é o que te estava a dar valores negativos e confusão.
  // Aqui mantemos simples e estável:
  // floatNorm positivo levanta o barco; negativo afunda.
  const floatOffsetPx = boatH * floatNorm;

  // alinhar waterlineAt do sprite com a linha de água do mundo
  const waterlineAt = Number.isFinite(boat.waterlineAt) ? boat.waterlineAt : 0.78;
  const yTop = sp.y - boatH * waterlineAt + floatOffsetPx;

  // animação
  const bob =
    Math.sin(tSec * Math.PI * 2 * (boat.bob?.speed ?? 0.5)) * (boat.bob?.amp ?? 3);

  const tilt =
    Math.sin(tSec * Math.PI * 2 * (boat.tilt?.speed ?? 0.35)) * (boat.tilt?.amp ?? 0.035);

  // desenhar (com rotação suave)
  ctx.save();
  ctx.translate(sp.x, yTop + boatH / 2);
  ctx.rotate(tilt);
  ctx.drawImage(boat.img, -boatW / 2, -boatH / 2 + bob, boatW, boatH);
  ctx.restore();

  // cache (se quiseres mostrar no debug)
  boat._last = { boatW, boatH, isMobile };
}