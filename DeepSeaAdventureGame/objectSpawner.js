// objectSpawner.js
// Spawner de loot para o Linha de Fundo (S/M/L visível; valor só revela no surface)

import { createTreasureForDepth } from "./inventario.js";

export class ObjectSpawner {
  constructor(opts = {}) {
    this.rng = opts.rng || Math.random;

    this.maxActive = opts.maxActive ?? 18;
    this.spawnEverySec = opts.spawnEverySec ?? 0.9;
    this.spawnJitter = opts.spawnJitter ?? 0.35;

    this.aheadMin = opts.aheadMin ?? 220;
    this.aheadMax = opts.aheadMax ?? 900;
    this.avoidRadius = opts.avoidRadius ?? 120;

    this.spawnPoints = opts.spawnPoints ?? [];

    this.active = [];
    this.usedPointIds = new Set();

    this._t = 0;
    this._nextSpawn = this._pickNextSpawn();
  }

  reset() {
    this.active.length = 0;
    this.usedPointIds.clear();
    this._t = 0;
    this._nextSpawn = this._pickNextSpawn();
  }

  update(dt, player, world) {
    this.active = this.active.filter((o) => !o.dead);

    if (this.active.length >= this.maxActive) return;

    this._t += dt;
    if (this._t < this._nextSpawn) return;

    const spawned = this._spawnOne(player, world);

    this._t = 0;
    this._nextSpawn = this._pickNextSpawn();

    if (!spawned && this.active.length < Math.floor(this.maxActive * 0.4)) {
      this._nextSpawn *= 0.6;
    }
  }

  markCollected(obj) {
    obj.collected = true;
    obj.dead = true;
  }

  revealAll() {
    for (const o of this.active) o.revealed = true;
  }

  _pickNextSpawn() {
    const base = this.spawnEverySec;
    const j = this.spawnJitter;
    return Math.max(0.15, base + (this.rng() * 2 - 1) * j);
  }

  _spawnOne(player, world) {
    if (!player || !world?.imageUVToScreen || !this.spawnPoints.length) return false;

    const py = player.y ?? 0;
    const px = player.x ?? 0;

    const candidates = [];

    for (let i = 0; i < this.spawnPoints.length; i++) {
      if (this.usedPointIds.has(i)) continue;

      const p = this.spawnPoints[i];
      const pos = world.imageUVToScreen(p.u, p.v);
      if (!pos) continue;

      const dx = pos.x - px;
      const dy = pos.y - py;

      // só pontos "à frente" / mais fundo no ecrã
      if (dy < this.aheadMin || dy > this.aheadMax) continue;

      // evita spawn colado ao player
      if (dx * dx + dy * dy < this.avoidRadius * this.avoidRadius) continue;

      // evita overlap com outros objetos ativos
      let overlaps = false;
      for (const o of this.active) {
        const ox = o.x - pos.x;
        const oy = o.y - pos.y;
        const rr = (o.radius ?? 26) + 26;
        if (ox * ox + oy * oy < rr * rr) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      candidates.push({
        pointIndex: i,
        u: p.u,
        v: p.v,
        x: pos.x,
        y: pos.y,
        depth: pos.iy,
      });
    }

    if (!candidates.length) return false;

    const picked = candidates[(this.rng() * candidates.length) | 0];
    const def = createTreasureForDepth(picked.depth, this.rng);

    const obj = {
      id: uid(),
      kind: def.kind ?? "treasure",
      size: def.size,
      assetKey: (def.assetKey || "").replace(/^\/+/, ""),
      templateKey: def.templateKey,

      u: picked.u,
      v: picked.v,

      x: picked.x,
      y: picked.y,

      radius: def.radius,
      weight: def.weight,
      hiddenValue: def.hiddenValue,

      revealed: false,
      collected: false,
      dead: false,
    };

    this.active.push(obj);
    this.usedPointIds.add(picked.pointIndex);
    return true;
  }
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}