// ===============================
// GUSTAVO (asset) - exportado
// ===============================
export const GUSTAVO_SRC =
  "https://raw.githubusercontent.com/welele94/deepseagame/main/DeepSeaAdventureGame/UI/ChatGPT%20Image%2024_02_2026%2C%2013_43_56.png";

function loadImage(src, label = "IMG") {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () =>
    console.log(`${label} loaded:`, img.naturalWidth, img.naturalHeight);
  img.onerror = (e) => console.error(`${label} failed to load:`, src, e);
  img.src = src;
  return img;
}

// Export: o main.js vai usar isto
export const gustavoImg = loadImage(GUSTAVO_SRC, "Gustavo");

// ===============================
// ROPE (Verlet + Constraints) - Gustavo é o último nó
// ===============================
export class Rope {
  constructor({ segments = 45, ropeLength = 500, iterations = 25 } = {}) {
    this.segments = segments;
    this.ropeLength = ropeLength;
    this.segLen = ropeLength / segments;
    this.iterations = iterations;

    this.points = [];
    this.damping = 0.040; // arrasto
    this.gravity = 40000;

    this.tension = 0;
    this.tensionSmoothed = 0;
    this.breakThreshold = 220;
    this.broken = false;

    // o último nó vai ser o Gustavo (pinned DURANTE solver)
    this.endPinned = true;
  }

  initAtAnchor(ax, ay) {
    this.points.length = 0;

    for (let i = 0; i <= this.segments; i++) {
      const x = ax;
      const y = ay + i * this.segLen;
      this.points.push({ x, y, px: x, py: y, pinned: i === 0 });
    }

    // Gustavo começa junto ao barco
    const d = this.points[this.points.length - 1];
    d.x = ax - 108;
    d.y = ay - 48;
    d.px = d.x;
    d.py = d.y;
  }

  // input aplicado ao Gustavo (último ponto) como “velocidade”
  applyGustavoControl(ctrl, dt) {
    const d = this.points[this.points.length - 1];
    if (!d) return;

    let vx = (d.x - d.px) * this.damping;
    let vy = (d.y - d.py) * this.damping;

    // input como aceleração -> velocidade (dt)
    vx += (ctrl.ax || 0) * dt;
    vy += (ctrl.ay || 0) * dt;

    // clamp opcional (evita foguete)
    const maxV = 1; // px/frame approx
    vx = Math.max(-maxV, Math.min(maxV, vx));
    vy = Math.max(-maxV, Math.min(maxV, vy));

    d.px = d.x;
    d.py = d.y;
    d.x += vx;
    d.y += vy;
  }

  // regra: só pode sair acima da waterline na zona do barco
  applyWaterlineRule(limits) {
    if (!limits) return;

    const { waterlineY, boatXMin, boatXMax, margin = 0 } = limits;
    if (!Number.isFinite(waterlineY)) return;

    const d = this.points[this.points.length - 1];
    if (!d) return;

    const inBoatZone =
      Number.isFinite(boatXMin) &&
      Number.isFinite(boatXMax) &&
      d.x >= boatXMin &&
      d.x <= boatXMax;

    if (!inBoatZone && d.y < waterlineY + margin) {
      d.y = waterlineY + margin;
      d.py = d.y; // mata bounce vertical
    }
  }

  step(
    dt,
    getAnchor,
    ctrl = { ax: 0, ay: 0 },
    extraDownForce = 0,
    limits = null
  ) {
    if (this.broken) return;
    if (!this.points.length) return;

    const { x: ax, y: ay } = getAnchor();
    const lastIndex = this.points.length - 1;

    // 1) Integrate: todos menos o nó 0 (boat) e (opcionalmente) o Gustavo
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const isEnd = i === lastIndex;

      if (p.pinned) continue;
      if (this.endPinned && isEnd) continue; // Gustavo não leva gravidade

      const vx = (p.x - p.px) * this.damping;
      const vy = (p.y - p.py) * this.damping;

      p.px = p.x;
      p.py = p.y;

      const ayForce = this.gravity + (extraDownForce || 0);

      p.x += vx;
      p.y += vy + ayForce * dt * dt;
    }

    // 2) Mover Gustavo com input
    this.applyGustavoControl(ctrl, dt);

    // 3) Regra da waterline (antes do solver)
    this.applyWaterlineRule(limits);

    // 4) Solver: constraints de comprimento fixo entre nós
    let tensionAccum = 0;

    // pin Gustavo durante o solver
    const d = this.points[lastIndex];
    const dx0 = d.x,
      dy0 = d.y;

    for (let it = 0; it < this.iterations; it++) {
      // pin boat
      const p0 = this.points[0];
      p0.x = ax;
      p0.y = ay;

      // pin gustavo
      if (this.endPinned) {
        d.x = dx0;
        d.y = dy0;
      }

      for (let i = 0; i < this.points.length - 1; i++) {
        const a = this.points[i];
        const b = this.points[i + 1];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.0001;

        const error = dist - this.segLen;
        tensionAccum += Math.abs(error);

        const diff = error / dist;
        const corrX = dx * diff;
        const corrY = dy * diff;

        const aPinned = a.pinned;
        const bPinned = i + 1 === lastIndex ? this.endPinned : false;

        if (!aPinned && !bPinned) {
          a.x += corrX * 0.5;
          a.y += corrY * 0.5;
          b.x -= corrX * 0.5;
          b.y -= corrY * 0.5;
        } else if (!aPinned && bPinned) {
          a.x += corrX;
          a.y += corrY;
        } else if (aPinned && !bPinned) {
          b.x -= corrX;
          b.y -= corrY;
        }
      }

      this.applyWaterlineRule(limits);
    }

    this.tension = tensionAccum / (this.iterations * this.segments);
    this.tensionSmoothed = this.tensionSmoothed * 0.9 + this.tension * 0.1;

    if (this.tensionSmoothed > this.breakThreshold) {
      this.broken = true;
    }
  }

  draw(ctx) {
    if (!this.points.length) return;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#111";
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++)
      ctx.lineTo(this.points[i].x, this.points[i].y);
    ctx.stroke();
    ctx.restore();
  }

  getDiverPos() {
    const p = this.points[this.points.length - 1];
    return { x: p.x, y: p.y, vx: p.x - p.px, vy: p.y - p.py };
  }
}