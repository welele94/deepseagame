// objectSpawner.js
// Spawner de loot para o Linha de Fundo (S/M/L visível; valor só revela no surface)

export class ObjectSpawner {
  constructor(opts = {}) {
    this.rng = opts.rng || Math.random;

    this.maxActive = opts.maxActive ?? 18;
    this.spawnEverySec = opts.spawnEverySec ?? 0.9; // frequência base
    this.spawnJitter = opts.spawnJitter ?? 0.35;

    // distância “à frente” do player onde vão aparecer
    this.aheadMin = opts.aheadMin ?? 220;
    this.aheadMax = opts.aheadMax ?? 900;

    // zona horizontal do spawn (mundo) — adapta à tua câmera
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
    // player: { x, y/depth } (y positivo = mais fundo)
    // world: hooks/utilidades opcionais (ex: camera bounds), pode ser null

    // cleanup (remover apanhados/destruídos)
    this.active = this.active.filter((o) => !o.dead);

    // garante que não enche demais
    if (this.active.length >= this.maxActive) return;

    this._t += dt;
    if (this._t < this._nextSpawn) return;

    // tentar spawn (pode falhar se colisões/avoid)
    const spawned = this._spawnOne(player);
    // mesmo se falhar, agenda próximo para evitar loop infinito
    this._t = 0;
    this._nextSpawn = this._pickNextSpawn();

    // se estiver muito vazio, tenta acelerar um bocadinho
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
    // escolhe onde spawna (mais fundo do que o player)
    const ahead = lerp(this.aheadMin, this.aheadMax, this.rng());
    const y = (player.y ?? player.depth ?? 0) + ahead;
    const x = lerp(this.xMin, this.xMax, this.rng());

    // não aparecer colado ao player
    const dx = x - (player.x ?? 0);
    const dy = y - (player.y ?? player.depth ?? 0);
    if (dx * dx + dy * dy < this.avoidRadius * this.avoidRadius) return false;

    // evita overlap com outros objetos
    for (const o of this.active) {
      const ox = o.x - x;
      const oy = o.y - y;
      const rr = (o.radius ?? 26) + 26;
      if (ox * ox + oy * oy < rr * rr) return false;
    }

    const depth = y; // assume y=depth
    const def = this._rollLoot(depth);

    const obj = {
      id: uid(),
      kind: def.kind,          // "chest", "pearl", "scrap", etc
      size: def.size,          // "S" | "M" | "L" (visível)
      spriteId: def.spriteId,  // opcional, p/ render
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

  _rollLoot(depth) {
    // “curva” de profundidade: quanto mais fundo, mais chance de coisas grandes/valiosas
    const d01 = clamp(depth / 3000, 0, 1); // 0..1 até 3000px (ajusta)

    // Tabela de raridade por profundidade
    // Nota: valores escondidos — só revelas quando voltar à superfície (GDD)
    const table = [
      // shallow: muito scrap e pequenos
      {
        w: lerp(70, 35, d01),
        make: () => mk("scrap", rollSize(d01, "S"), 1.0, 6, 18),
      },
      {
        w: lerp(22, 30, d01),
        make: () => mk("pearl", rollSize(d01, "S"), 0.8, 10, 28),
      },
      // medium depths: começa a aparecer chest
      {
        w: lerp(7, 22, d01),
        make: () => mk("chest", rollSize(d01, "M"), 1.6, 30, 120),
      },
      // deep: jackpot mas pesado
      {
        w: lerp(1, 11, d01),
        make: () => mk("relic", rollSize(d01, "L"), 2.6, 80, 260),
      },
      // “mau”: pesado e quase sem valor (punição de ganância)
      {
        w: lerp(0, 8, d01),
        make: () => mk("junkHeavy", "L", 3.2, 0, 35),
      },
    ];

    const picked = weightedPick(table, this.rng);
    return picked.make();

    function mk(kind, size, wMul, vMin, vMax) {
      const sizeMeta = sizeStats(size);
      const weight = sizeMeta.baseWeight * wMul * lerp(0.85, 1.2, Math.random());
      const hiddenValue = Math.floor(lerp(vMin, vMax, Math.random()));
      return {
        kind,
        size,
        spriteId: `${kind}_${size}`,
        radius: sizeMeta.radius,
        weight,
        hiddenValue,
      };
    }

    function sizeStats(size) {
      if (size === "S") return { radius: 18, baseWeight: 6 };
      if (size === "M") return { radius: 24, baseWeight: 14 };
      return { radius: 30, baseWeight: 26 }; // L
    }

    function rollSize(d01, bias) {
      // bias é o tamanho “preferido” daquele tipo; mas depth pode puxar para cima
      const r = Math.random();
      if (bias === "S") {
        // fundo aumenta chance de M
        if (r < lerp(0.12, 0.35, d01)) return "M";
        return "S";
      }
      if (bias === "M") {
        if (r < lerp(0.15, 0.40, d01)) return "L";
        if (r < 0.55) return "M";
        return "S";
      }
      // bias L
      if (r < lerp(0.10, 0.25, 1 - d01)) return "M"; // menos fundo => cai
      return "L";
    }
  }
}

// -------------------------
// Helpers
// -------------------------
function weightedPick(items, rng) {
  let sum = 0;
  for (const it of items) sum += it.w;
  let roll = rng() * sum;
  for (const it of items) {
    roll -= it.w;
    if (roll <= 0) return it;
  }
  return items[items.length - 1];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}