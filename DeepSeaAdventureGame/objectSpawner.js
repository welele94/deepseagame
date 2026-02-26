// objectSpawner.js
// Spawner de loot para o Linha de Fundo (S/M/L visível; valor só revela no surface)

import { createTreasureForDepth } from "./inventario.js";

export class ObjectSpawner {
  constructor(opts = {}) {
    this.rng = opts.rng || Math.random;

    this.maxActive = opts.maxActive ?? 18;
    this.spawnEverySec = opts.spawnEverySec ?? 0.9; // frequência base
    this.spawnJitter = opts.spawnJitter ?? 0.35;

    // distância “à frente” do player onde vão aparecer
    this.aheadMin = opts.aheadMin ?? 220;
    this.aheadMax = opts.aheadMax ?? 900;

    // zona horizontal do spawn (mundo)
    this.xMin = opts.xMin ?? -260;
    this.xMax = opts.xMax ?? 260;

    // evita spawn colado ao player
    this.avoidRadius = opts.avoidRadius ?? 120;

    // lista de objetos vivos
    this.active = [];

    this._t = 0;
    this._nextSpawn = this._pickNextSpawn();
  }

  reset() {
    this.active.length = 0;
    this._t = 0;
    this._nextSpawn = this._pickNextSpawn();
  }

  update(dt, player, world) {
    // cleanup (remover apanhados/destruídos)
    this.active = this.active.filter((o) => !o.dead);

    // garante que não enche demais
    if (this.active.length >= this.maxActive) return;

    this._t += dt;
    if (this._t < this._nextSpawn) return;

    // tentar spawn
    const spawned = this._spawnOne(player);

    // agenda próximo
    this._t = 0;
    this._nextSpawn = this._pickNextSpawn();

    // se estiver muito vazio, acelera um bocado
    if (!spawned && this.active.length < Math.floor(this.maxActive * 0.4)) {
      this._nextSpawn *= 0.6;
    }
  }

  // chamado quando o player apanha loot
  markCollected(obj) {
    obj.collected = true;
    obj.dead = true;
  }

  // util para revelares no surface
  revealAll() {
    for (const o of this.active) o.revealed = true;
  }

  // -------------------------
  // Internals
  // -------------------------

  _pickNextSpawn() {
    const base = this.spawnEverySec;
    const j = this.spawnJitter;
    return Math.max(0.15, base + (this.rng() * 2 - 1) * j);
  }

  _spawnOne(player) {
    const px = player.x ?? 0;
    const py = (player.y ?? player.depth ?? 0);

    // escolhe onde spawna (mais fundo do que o player)
    const ahead = lerp(this.aheadMin, this.aheadMax, this.rng());
    const y = py + ahead;
    const x = lerp(this.xMin, this.xMax, this.rng());

    // não aparecer colado ao player
    const dx = x - px;
    const dy = y - py;
    if (dx * dx + dy * dy < this.avoidRadius * this.avoidRadius) return false;

    // evita overlap com outros objetos
    for (const o of this.active) {
      const ox = o.x - x;
      const oy = o.y - y;
      const rr = (o.radius ?? 26) + 26;
      if (ox * ox + oy * oy < rr * rr) return false;
    }

    // ✅ inventário decide sprite/tamanho/peso/valor
    const depth = y; // assume y=depth
    const def = createTreasureForDepth(depth, this.rng);

    const obj = {
      id: uid(),

      kind: def.kind ?? "treasure",
      size: def.size,                 // S/M/L
      assetKey: def.assetKey,         // caminho do png
      templateKey: def.templateKey,   // id do template no inventario (opcional)

      x,
      y,
      radius: def.radius,
      weight: def.weight,
      hiddenValue: def.hiddenValue,

      revealed: false,
      collected: false,
      dead: false,
    };

    this.active.push(obj);
    return true;
  }
}

// -------------------------
// Helpers
// -------------------------

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}