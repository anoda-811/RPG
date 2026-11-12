import { hash2, mulberry32 } from "../core/rng";
import { Pixels } from "./pixels";

const OUTLINE = "#120e18";
const LAVA_RAMP = ["#3a0a04", "#8a2208", "#e0481a", "#ff9b2e", "#ffe25a"];

/** ノイズで基本色にばらつきを与える。 */
function fillNoise(
  p: Pixels,
  seed: number,
  base: string,
  light: string,
  dark: string,
  lightP: number,
  darkP: number,
): void {
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const n = hash2(x, y, seed);
      if (n < lightP) p.set(x, y, light);
      else if (n > 1 - darkP) p.set(x, y, dark);
      else p.set(x, y, base);
    }
  }
}

/** 乱歩で細いひび割れを描く。 */
function crack(p: Pixels, seed: number, color: string, steps: number): void {
  const rnd = mulberry32(seed);
  let x = Math.floor(rnd() * 16);
  let y = Math.floor(rnd() * 16);
  for (let i = 0; i < steps; i++) {
    p.set(x, y, color);
    const d = Math.floor(rnd() * 4);
    if (d === 0) x++;
    else if (d === 1) x--;
    else if (d === 2) y++;
    else y--;
    x = Math.min(15, Math.max(0, x));
    y = Math.min(15, Math.max(0, y));
  }
}

/** タイル種別と見た目のバリエーションからピクセルを生成する。 */
export function makeTile(ch: string, variant: number, frame: number, edges: number): Pixels {
  switch (ch) {
    case ".":
      return floorTile(variant);
    case "a":
      return ashTile(variant);
    case ",":
      return emberTile(variant, frame);
    case "#":
      return wallTile(variant);
    case "~":
      return lavaTile(variant, frame, edges);
    case "=":
      return bridgeTile(variant);
    case "A":
      return altarTile(variant, frame);
    case "R":
      return carpetTile();
    case "D":
      return doorTile(frame);
    case "T":
      return torchTile(variant, frame);
    case "x":
      return treeTile(variant);
    case "o":
      return boulderTile(variant);
    case "g":
      return grassTile(variant);
    case "p":
      return pathTile(variant);
    case "t":
      return leafyTreeTile(variant);
    case "r":
      return roofTile(variant);
    case "H":
      return houseWallTile(variant);
    case "d":
      return houseDoorTile(variant);
    default: {
      const missing = new Pixels(16, 16);
      return missing.rect(0, 0, 16, 16, "#ff00ff");
    }
  }
}

function floorTile(v: number): Pixels {
  const p = new Pixels(16, 16);
  fillNoise(p, 10 + v, "#2b2430", "#3a3242", "#1d1821", 0.07, 0.07);
  for (let i = 0; i < 16; i++) {
    p.set(i, 0, "#241d2a");
    p.set(0, i, "#241d2a");
  }
  if (v % 2 === 0) crack(p, 200 + v, "#15101a", 6);
  return p;
}

function ashTile(v: number): Pixels {
  const p = new Pixels(16, 16);
  fillNoise(p, 30 + v, "#564c52", "#665b62", "#463e46", 0.09, 0.09);
  // 小石
  const rnd = mulberry32(400 + v);
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rnd() * 15);
    const y = Math.floor(rnd() * 15);
    p.set(x, y, "#7b6f76").set(x + 1, y, "#4a4046");
  }
  return p;
}

function emberTile(v: number, frame: number): Pixels {
  const p = ashTile(v);
  const glow = frame % 2 === 0 ? "#ffb347" : "#ff7a2a";
  const rnd = mulberry32(500 + v);
  let x = Math.floor(rnd() * 16);
  let y = Math.floor(rnd() * 16);
  for (let i = 0; i < 10; i++) {
    p.set(x, y, glow);
    p.set(x + 1, y, "#7a2a12");
    const d = Math.floor(rnd() * 3);
    if (d === 0) x = Math.min(14, x + 1);
    else if (d === 1) y = Math.min(15, y + 1);
    else x = Math.max(0, x - 1);
  }
  return p;
}

function wallTile(v: number): Pixels {
  const p = new Pixels(16, 16);
  fillNoise(p, 60 + v, "#2a2129", "#33283a", "#1f181f", 0.06, 0.1);
  const bands: [number, number][] = [
    [0, 5],
    [5, 11],
    [11, 16],
  ];
  bands.forEach(([y0, y1], b) => {
    if (y0 > 0) p.rect(0, y0, 16, 1, "#17111a");
    p.rect(0, y0 + 1 < y1 ? y0 + 1 : y0, 16, 1, "#3d3143");
    const offset = (v * 3 + b * 5) % 8;
    for (let y = y0; y < y1; y++) {
      p.set(offset, y, "#17111a");
      p.set(offset + 8, y, "#17111a");
    }
  });
  p.rect(0, 15, 16, 1, "#140f16");
  return p;
}

function lavaTile(v: number, frame: number, edges: number): Pixels {
  const p = new Pixels(16, 16);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const wave =
        0.5 +
        0.28 * Math.sin(x * 0.6 + y * 0.5 + frame * 1.2 + v * 1.7) +
        0.2 * Math.sin(y * 0.9 - frame * 0.9 + x * 0.3 + v) +
        0.12 * (hash2(x, y, 40 + v) - 0.5);
      const idx = Math.min(4, Math.max(0, Math.floor(wave * 5)));
      p.set(x, y, LAVA_RAMP[idx]);
      if (hash2(x, y, 70 + v + frame) > 0.985) p.set(x, y, "#fff3b0");
    }
  }
  // 周囲が岩の縁は黒く焼けた岩にする
  const rock = "#2b1a18";
  const rockDark = "#3a1c14";
  if (edges & 1) {
    for (let x = 0; x < 16; x++) p.set(x, 0, hash2(x, 0, 90) > 0.4 ? rockDark : rock);
  }
  if (edges & 2) {
    for (let x = 0; x < 16; x++) p.set(x, 15, hash2(x, 15, 91) > 0.4 ? rockDark : rock);
  }
  if (edges & 4) {
    for (let y = 0; y < 16; y++) p.set(0, y, hash2(0, y, 92) > 0.4 ? rockDark : rock);
  }
  if (edges & 8) {
    for (let y = 0; y < 16; y++) p.set(15, y, hash2(15, y, 93) > 0.4 ? rockDark : rock);
  }
  return p;
}

function bridgeTile(v: number): Pixels {
  const p = new Pixels(16, 16);
  fillNoise(p, 80 + v, "#6e4b2c", "#7f5a36", "#5a3c22", 0.1, 0.1);
  for (const y of [3, 7, 11]) p.rect(0, y, 16, 1, "#3f2a18");
  for (let y = 0; y < 16; y++) {
    const seam = y < 3 ? 6 : y < 7 ? 11 : y < 11 ? 3 : 9;
    p.set(seam, y, "#3f2a18");
  }
  p.rect(0, 0, 16, 1, "#3a2412");
  p.rect(0, 15, 16, 1, "#3a2412");
  return p;
}

function altarTile(v: number, frame: number): Pixels {
  const p = new Pixels(16, 16);
  fillNoise(p, 50 + v, "#2a1f33", "#352a42", "#1d1526", 0.08, 0.08);
  const ring = frame % 2 === 0 ? "#9352d8" : "#c08cff";
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8);
      if (d >= 5.2 && d <= 6.2) p.set(x, y, ring);
    }
  }
  for (const [x, y] of [
    [8, 2],
    [14, 8],
    [8, 14],
    [2, 8],
  ] as [number, number][]) {
    p.set(x, y, "#ffe25a");
  }
  p.set(7, 7, "#ff5b1f").set(8, 7, "#ff5b1f").set(7, 8, "#ff5b1f").set(8, 8, "#ff5b1f");
  return p;
}

function carpetTile(): Pixels {
  const p = new Pixels(16, 16);
  p.rect(0, 0, 16, 16, "#7a1d2a");
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (x <= 1 || x >= 14) p.set(x, y, "#c8962a");
      else if (x === 2 || x === 13) p.set(x, y, "#4a0f16");
      else if ((x + y) % 8 < 2) p.set(x, y, "#8e2636");
    }
  }
  return p;
}

function doorTile(frame: number): Pixels {
  const p = new Pixels(16, 16);
  fillNoise(p, 120, "#0b070e", "#15101a", "#050309", 0.05, 0.05);
  // 石のアーチ
  p.rect(0, 0, 16, 2, "#5b4a42");
  p.rect(0, 0, 2, 16, "#5b4a42");
  p.rect(14, 0, 2, 16, "#5b4a42");
  p.rect(2, 2, 12, 1, "#3a2e2a");
  p.rect(2, 14, 12, 2, "#2a211e");
  // 奥からの熱気
  const ember = frame % 2 === 0 ? "#8a3a1a" : "#b5501f";
  p.rect(4, 13, 8, 1, ember);
  return p;
}

function torchTile(v: number, frame: number): Pixels {
  const p = wallTile(v);
  p.rect(7, 9, 2, 5, "#3a3440");
  p.rect(6, 13, 4, 1, "#2a252e");
  const jitter = [0, 1, -1][frame % 3];
  const outer = "#ff5b1f";
  p.rect(6 + jitter, 6, 4, 1, outer);
  p.rect(5 + jitter, 5, 6, 1, outer);
  p.rect(6 + jitter, 4, 4, 1, outer);
  p.rect(7 + jitter, 3, 2, 1, outer);
  p.rect(6 + jitter, 5, 4, 1, "#ffb347");
  p.rect(7 + jitter, 4, 2, 2, "#ffb347");
  p.set(7 + jitter, 5, "#ffe25a").set(8 + jitter, 5, "#ffe25a");
  return p;
}

function treeTile(v: number): Pixels {
  const g = ashTile(v);
  const t = new Pixels(16, 16);
  t.rect(7, 8, 2, 8, "#3a2a22");
  t.rect(7, 8, 1, 8, "#4e3a2e");
  const branch = "#2a1e18";
  t.line(8, 9, 4, 4, branch);
  t.line(8, 10, 12, 5, branch);
  t.line(8, 12, 4, 11, branch);
  t.line(4, 4, 2, 2, branch);
  t.line(12, 5, 14, 2, branch);
  t.line(4, 11, 2, 9, branch);
  t.outline(OUTLINE);
  return g.blit(t, 0, 0);
}

function boulderTile(v: number): Pixels {
  const g = ashTile(v);
  const r = new Pixels(16, 16);
  r.ellipse(8, 10, 6, 4.5, "#5a5058");
  r.ellipse(7, 9, 4, 2.5, "#7b6f76", (_x, y) => y <= 9);
  r.ellipse(8, 11, 6, 3, "#3b3339", (_x, y) => y >= 11);
  r.outline(OUTLINE);
  return g.blit(r, 0, 0);
}

/* ───── 村のタイル ───── */

function grassTile(v: number): Pixels {
  const p = new Pixels(16, 16);
  fillNoise(p, 700 + v, "#3f7a3a", "#4f9148", "#2f5f2c", 0.08, 0.08);
  const rnd = mulberry32(800 + v);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rnd() * 14) + 1;
    const y = Math.floor(rnd() * 14) + 1;
    p.set(x, y, "#6fb35a").set(x, y - 1, "#6fb35a");
  }
  return p;
}

function pathTile(v: number): Pixels {
  const p = new Pixels(16, 16);
  fillNoise(p, 900 + v, "#9c8c76", "#ab9b84", "#766653", 0.08, 0.1);
  // 石畳の目地（4px ごとに横線、段ごとに縦線を半分ずらす）
  for (let band = 0; band < 4; band++) {
    const y0 = band * 4;
    p.rect(0, y0, 16, 1, "#5f5244");
    const off = band % 2 === 0 ? 0 : 8;
    for (let y = y0 + 1; y < y0 + 4; y++) {
      p.set(off, y, "#5f5244");
      p.set((off + 8) % 16, y, "#5f5244");
    }
  }
  return p;
}

function leafyTreeTile(v: number): Pixels {
  const g = grassTile(v);
  const t = new Pixels(16, 16);
  t.rect(7, 11, 2, 5, "#5a3a22");
  t.ellipse(8, 7, 6, 5.5, "#2e6b32");
  t.ellipse(6, 5, 3, 2, "#4f9148", (_x, y) => y <= 5);
  t.ellipse(10, 9, 3, 2, "#23532a", (_x, y) => y >= 8);
  t.outline(OUTLINE);
  return g.blit(t, 0, 0);
}

function roofTile(v: number): Pixels {
  const p = new Pixels(16, 16);
  const base = v % 2 === 0 ? "#a8442e" : "#b24e35";
  p.rect(0, 0, 16, 16, base);
  for (let y = 0; y < 16; y += 4) {
    p.rect(0, y, 16, 1, "#6b2418");
    const off = (y >> 2) % 2 === 0 ? 0 : 4;
    for (let x = off; x < 16; x += 8) p.rect(x, y + 1, 1, 3, "#6b2418");
    p.rect(0, y + 1, 16, 1, "#c25a3c");
  }
  return p;
}

function houseWallTile(v: number): Pixels {
  const p = new Pixels(16, 16);
  fillNoise(p, 1000 + v, "#d8c8a8", "#e6d8ba", "#bfae8c", 0.05, 0.05);
  for (let x = 0; x < 16; x += 4) p.rect(x, 0, 1, 15, "#b8a888");
  p.rect(0, 0, 16, 2, "#6b4a2b");
  p.rect(0, 15, 16, 1, "#8a7a60");
  return p;
}

function houseDoorTile(v: number): Pixels {
  const p = houseWallTile(v);
  p.rect(3, 3, 10, 13, "#4a3018");
  p.rect(4, 4, 8, 12, "#8a5a2b");
  p.rect(4, 4, 8, 1, "#b07a3e");
  p.set(10, 10, "#ffd84a").set(10, 11, "#ffd84a");
  p.rect(6, 1, 4, 1, "#ffd84a");
  return p;
}

/** 宝箱（16x16）。 */
export function makeChest(open: boolean): Pixels {
  const p = new Pixels(16, 16);
  const wood = "#8a5a2b";
  const dark = "#5a3a1b";
  const light = "#b07a3e";
  const metal = "#c8c8d0";
  const gold = "#ffd84a";
  if (open) {
    p.rect(2, 1, 12, 3, light);
    p.rect(2, 4, 12, 1, dark);
    p.rect(2, 5, 12, 3, "#1b1210");
    p.set(4, 6, gold).set(10, 6, gold);
    p.rect(2, 8, 12, 6, wood);
  } else {
    p.rect(3, 3, 10, 1, light);
    p.rect(2, 4, 12, 4, light);
    p.rect(2, 7, 12, 1, dark);
    p.rect(2, 8, 12, 6, wood);
    p.rect(7, 9, 2, 4, gold);
  }
  p.rect(2, 11, 12, 1, metal);
  p.rect(2, 13, 12, 2, dark);
  return p.outline(OUTLINE);
}
