// inventario.js

export const TREASURE_DB = [
  // ---- SMALL ----
  {
    key: "tesouro_pequeno_astrolabio",
    src: "DeepSeaAdventureGame/UI/tesouros/tesouro_pequeno_astrolabio.png",
    size: "S",
    radius: 18,
    baseWeight: 6,
    valueRange: [30, 80],
    // chance base (podes mexer com depth depois)
    w: 30,
  },
  {
    key: "tesouro_pequeno_fechado",
    src: "DeepSeaAdventureGame/UI/tesouros/tesouro_pequeno_fechado.png",
    size: "S",
    radius: 18,
    baseWeight: 5,
    valueRange: [15, 50],
    w: 45,
  },
  {
    key: "tesouro_pequeno_pedras",
    src: "DeepSeaAdventureGame/UI/tesouros/tesouro_pequeno_pedras.png",
    size: "S",
    radius: 18,
    baseWeight: 7,
    valueRange: [40, 90],
    w: 25,
  },

  // ---- MEDIUM ----
  {
    key: "medium_poor",
    src: "DeepSeaAdventureGame/UI/tesouros/medium_poor.png",
    size: "M",
    radius: 24,
    baseWeight: 14,
    valueRange: [20, 60],
    w: 35,
  },
  {
    key: "medium_tesouro",
    src: "DeepSeaAdventureGame/UI/tesouros/medium_tesouro.png",
    size: "M",
    radius: 24,
    baseWeight: 15,
    valueRange: [40, 100],
    w: 35,
  },
  {
    key: "medium_treasure",
    src: "DeepSeaAdventureGame/UI/tesouros/medium_treasure.png",
    size: "M",
    radius: 24,
    baseWeight: 16,
    valueRange: [50, 120],
    w: 20,
  },
  {
    key: "tesouro_medio_perolas",
    src: "DeepSeaAdventureGame/UI/tesouros/tesouro_medio_perolas.png",
    size: "M",
    radius: 24,
    baseWeight: 15,
    valueRange: [60, 140],
    w: 10,
  },

  // ---- LARGE ----
  {
    key: "tesouro_ouro_fechado",
    src: "DeepSeaAdventureGame/UI/tesouros/tesouro_ouro_fechado.png",
    size: "L",
    radius: 30,
    baseWeight: 26,
    valueRange: [120, 300],
    w: 80, // raridade base, mas vai ser reduzida shallow
  },
  {
    key: "tesouro_ouro_aberto",
    src: "DeepSeaAdventureGame/UI/tesouros/tesouro_ouro_aberto.png",
    size: "L",
    radius: 30,
    baseWeight: 24,
    valueRange: [100, 250],
    w: 20,
  },
];

// Factory: cria um tesouro completo para uma profundidade
export function createTreasureForDepth(depth, rng = Math.random) {
  const d01 = clamp(depth / 3000, 0, 1);

  // pesos dinâmicos por profundidade (simples e eficaz)
  const weighted = TREASURE_DB.map((t) => {
    let w = t.w;

    // shallow => mais S/M, quase nada L
    if (t.size === "L") w *= lerp(0.05, 1.0, d01);
    if (t.size === "S") w *= lerp(1.2, 0.6, d01);
    if (t.size === "M") w *= lerp(1.0, 1.0, d01);

    return { t, w };
  });

  const picked = weightedPick(weighted, rng);
  const meta = picked.t;

  // instancia final (✅ já vem com tamanhos/raio/peso e sprite)
  const hiddenValue = randInt(meta.valueRange[0], meta.valueRange[1], rng);
  const weight = meta.baseWeight * lerp(0.85, 1.2, rng());

  return {
    kind: "treasure",
    templateKey: meta.key,
    assetKey: meta.src,
    size: meta.size,
    radius: meta.radius,
    weight,
    hiddenValue,
  };
}

// helpers
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
function lerp(a,b,t){ return a+(b-a)*t; }
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
function randInt(min,max,rng){ return Math.floor(min + rng()*(max-min+1)); }

