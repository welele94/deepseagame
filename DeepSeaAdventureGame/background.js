// background.js (ES Module)

// ===============================
// CONFIG
// ===============================
export const BG_SRC =
  "https://raw.githubusercontent.com/welele94/deepseagame/main/ChatGPT%20Image%2018_02_2026%2C%2017_07_05.png";

// Defaults
export const DEFAULT_WATERLINE_NORM = 0.3075; // 0..1 relativo à ALTURA ORIGINAL da imagem

// ===============================
// STATE
// ===============================
export function computeIsMobile(canvas) {
  const w = window.innerWidth;
  const cw = canvas?.clientWidth || w;
  return Math.min(w, cw) < 820;
}

export const camera = {
  x: 0,
  y: 0,
  zoom: 1.0,
  smoothing: 0.12,
  initialized: false,
};

// waterlineNorm vem do storage (ou default)
export function getInitialWaterlineNorm() {
  let wln = parseFloat(localStorage.getItem("waterlineNorm"));
  if (!Number.isFinite(wln) || wln <= 0) wln = DEFAULT_WATERLINE_NORM;
  return wln;
}

// ===============================
// ASSET LOADER
// ===============================
export function loadImage(src, label = "IMG") {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () =>
    console.log(`${label} loaded:`, img.naturalWidth, img.naturalHeight);
  img.onerror = (e) => console.error(`${label} failed to load:`, src, e);
  img.src = src;
  return img;
}

// ===============================
// BACKGROUND CLASS (camera-driven)
// ===============================
export class Background {
  constructor(src) {
    this.img = loadImage(src, "BG");
    this.lastRect = null; // {x,y,w,h,scale}
  }

  draw(ctx, canvas) {
    if (!this.img.naturalWidth) return;

    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    const imgW = this.img.naturalWidth;
    const imgH = this.img.naturalHeight;

    // cover * zoom
    const baseScale = Math.max(W / imgW, H / imgH);
    const scale = baseScale * camera.zoom;

    const drawW = imgW * scale;
    const drawH = imgH * scale;

    // centro da camera no centro do ecrã
    let x = W / 2 - camera.x * scale;
    let y = H / 2 - camera.y * scale;

    // clamp (não deixa aparecer “vazio” fora da imagem)
    const minX = W - drawW;
    const minY = H - drawH;

    x = Math.max(minX, Math.min(0, x));
    y = Math.max(minY, Math.min(0, y));

    this.lastRect = { x, y, w: drawW, h: drawH, scale };

    ctx.drawImage(this.img, x, y, drawW, drawH);
  }
}

// instancia default
export const bg = new Background(BG_SRC);

// ===============================
// RESIZE (DPR correto + atualiza zoom mobile)
// ===============================
export function setupResize(canvas, ctx) {
  function resize() {
    const dpr = window.devicePixelRatio || 1;

    const isMobile = computeIsMobile(canvas);
    camera.zoom = isMobile ? 2.0 : 1.0;

    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;

    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);

    // desenhar em “CSS pixels”
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 200));

  resize(); // primeira vez

  return resize; // se quiseres chamar manualmente
}

// ===============================
// HELPERS: WORLD <-> SCREEN
// ===============================
export function imageToScreen(ix, iy) {
  if (!bg.lastRect) return { x: 0, y: 0 };
  const { x, y, scale } = bg.lastRect;
  return { x: x + ix * scale, y: y + iy * scale };
}

export function getWaterlineIy(waterlineNorm) {
  if (!bg.img.naturalHeight) return 0;
  return bg.img.naturalHeight * waterlineNorm;
}

export function getWaterlineY(waterlineNorm) {
  if (!bg.lastRect) return 0;
  const iy = getWaterlineIy(waterlineNorm);
  return bg.lastRect.y + iy * bg.lastRect.scale;
}

// ===============================
// CAMERA FOLLOW (segue player; fallback segue a linha de água)
// ===============================
export function initCameraIfNeeded(waterlineNorm) {
  if (camera.initialized) return;
  if (!bg.img.naturalWidth) return;

  const imgW = bg.img.naturalWidth;
  const imgH = bg.img.naturalHeight;

  camera.x = imgW * 0.5;
  camera.y = imgH * waterlineNorm;
  camera.initialized = true;
}

export function updateCameraTarget({ waterlineNorm, player }) {
  if (!bg.img.naturalWidth) return;

  const imgW = bg.img.naturalWidth;
  const imgH = bg.img.naturalHeight;

  const fallbackIx = imgW * 0.5;
  const fallbackIy = imgH * waterlineNorm;

  const targetIx = (player && player.ix != null) ? player.ix : fallbackIx;
  const targetIy = (player && player.iy != null) ? player.iy : fallbackIy;

  camera.x += (targetIx - camera.x) * camera.smoothing;
  camera.y += (targetIy - camera.y) * camera.smoothing;
}