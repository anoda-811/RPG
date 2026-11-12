import type { Dir } from "../core/constants";
import { hash2 } from "../core/rng";
import { drawCharacter, type Look, type View } from "./characters";
import { drawDragon } from "./dragon";
import { makeChest, makeTile } from "./tiles";
import type { Pixels } from "./pixels";

/**
 * 生成済みスプライトのキャッシュ。
 * 同じ見た目は一度だけ描画し、以降は canvas を drawImage するだけにする。
 */
const cache = new Map<string, HTMLCanvasElement>();

function cachedPixels(key: string, make: () => Pixels): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    c = make().toCanvas();
    cache.set(key, c);
  }
  return c;
}

function cachedCanvas(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    c = make();
    cache.set(key, c);
  }
  return c;
}

/** 座標ごとのバリエーションを持つ地形タイル。 */
export function tileImage(
  ch: string,
  x: number,
  y: number,
  frame: number,
  edges: number,
): HTMLCanvasElement {
  const variant = Math.floor(hash2(x, y, 3) * 4);
  const animated = ch === "~" || ch === "," || ch === "A" || ch === "T" || ch === "D";
  const f = animated ? frame : 0;
  const e = ch === "~" ? edges : 0;
  return cachedPixels(`t|${ch}|${variant}|${f}|${e}`, () => makeTile(ch, variant, f, e));
}

/** キャラクター画像。left は right の反転で作る。 */
export function characterImage(
  id: string,
  look: Look,
  dir: Dir,
  frame: number,
): HTMLCanvasElement {
  const view: View = dir === "up" ? "back" : dir === "down" ? "front" : "side";
  const flip = dir === "left";
  return cachedPixels(`c|${id}|${dir}|${frame}`, () => {
    const p = drawCharacter(look, view, frame);
    return flip ? p.flipX() : p;
  });
}

export function dragonImage(awake: boolean, flap: number, breathe: boolean): HTMLCanvasElement {
  return cachedPixels(`d|${awake}|${flap}|${breathe}`, () => drawDragon(awake, flap, breathe));
}

export function chestImage(open: boolean): HTMLCanvasElement {
  return cachedPixels(`chest|${open}`, () => makeChest(open));
}

/** 光の輪（加算合成で使う）。 */
export function glowImage(kind: "lava" | "torch" | "boss"): HTMLCanvasElement {
  const size = kind === "boss" ? 96 : 40;
  const rgb =
    kind === "lava" ? "255,120,40" : kind === "torch" ? "255,170,80" : "255,110,40";
  return cachedCanvas(`glow|${kind}`, () => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    const r = size / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, `rgba(${rgb},0.9)`);
    g.addColorStop(0.5, `rgba(${rgb},0.25)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return canvas;
  });
}
