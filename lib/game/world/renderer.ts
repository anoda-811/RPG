import type { Look } from "../art/characters";
import { chestImage, characterImage, dragonImage, glowImage, tileImage } from "../art/atlas";
import { TILE, VIEW_H, VIEW_W, type Dir } from "../core/constants";

export interface SceneEntity {
  kind: "npc" | "chest" | "boss";
  id: string;
  x: number;
  y: number;
  look?: Look;
  dir: Dir;
  open?: boolean;
  awake?: boolean;
}

export interface SceneActor {
  id: string;
  look: Look;
  rx: number;
  ry: number;
  dir: Dir;
  walk: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

export interface Scene {
  rows: string[];
  frame: number;
  camX: number;
  camY: number;
  shakeX: number;
  shakeY: number;
  entities: SceneEntity[];
  actors: SceneActor[];
  particles: Particle[];
  flash: { color: string; alpha: number } | null;
  /** 画面遷移の円形マスク（中心と半径, px）。null なら遷移なし */
  iris: { x: number; y: number; r: number } | null;
}

/** 溶岩タイルのうち、周囲が岩の辺を示すビットマスク（1=上,2=下,4=左,8=右）。 */
function lavaEdges(rows: string[], x: number, y: number): number {
  const notLava = (xx: number, yy: number) => rows[yy]?.[xx] !== "~";
  let m = 0;
  if (notLava(x, y - 1)) m |= 1;
  if (notLava(x, y + 1)) m |= 2;
  if (notLava(x - 1, y)) m |= 4;
  if (notLava(x + 1, y)) m |= 8;
  return m;
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x + 4, y + 21, 8, 2);
}

/** 1フレーム分のシーンを canvas に描く。 */
export function renderScene(ctx: CanvasRenderingContext2D, s: Scene): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const ox = Math.round(-s.camX + s.shakeX);
  const oy = Math.round(-s.camY + s.shakeY);
  const rows = s.rows;
  const cols = rows[0].length;
  const anim = Math.floor(s.frame / 10) % 4;

  const txStart = Math.max(0, Math.floor(-ox / TILE));
  const txEnd = Math.min(cols - 1, Math.floor((VIEW_W - ox - 1) / TILE));
  const tyStart = Math.max(0, Math.floor(-oy / TILE));
  const tyEnd = Math.min(rows.length - 1, Math.floor((VIEW_H - oy - 1) / TILE));

  // 1) 地形
  for (let ty = tyStart; ty <= tyEnd; ty++) {
    for (let tx = txStart; tx <= txEnd; tx++) {
      const ch = rows[ty][tx];
      const edges = ch === "~" ? lavaEdges(rows, tx, ty) : 0;
      ctx.drawImage(tileImage(ch, tx, ty, anim, edges), tx * TILE + ox, ty * TILE + oy);
    }
  }

  // 2) キャラクター・オブジェクトを足元のy座標順に描く（奥→手前）
  const items: { y: number; draw: () => void }[] = [];

  for (const e of s.entities) {
    if (e.kind === "chest") {
      const img = chestImage(!!e.open);
      const x = e.x * TILE + ox;
      const y = e.y * TILE + oy;
      items.push({ y: e.y * TILE + TILE, draw: () => ctx.drawImage(img, x, y) });
    } else if (e.kind === "npc" && e.look) {
      const img = characterImage(e.id, e.look, e.dir, 0);
      const x = e.x * TILE + ox;
      const y = e.y * TILE - 8 + oy;
      items.push({
        y: e.y * TILE + TILE,
        draw: () => {
          drawShadow(ctx, x, y);
          ctx.drawImage(img, x, y);
        },
      });
    } else if (e.kind === "boss") {
      const flap = e.awake ? [0, 1, 2, 1][Math.floor(s.frame / 8) % 4] : 1;
      const breathe = Math.floor(s.frame / 12) % 2 === 0;
      const img = dragonImage(!!e.awake, flap, breathe);
      const bob = e.awake ? Math.floor(s.frame / 30) % 2 : 0;
      const x = e.x * TILE + ox;
      const y = e.y * TILE + oy + bob;
      items.push({ y: e.y * TILE + 48, draw: () => ctx.drawImage(img, x, y) });
    }
  }

  for (const a of s.actors) {
    const img = characterImage(a.id, a.look, a.dir, a.walk);
    const x = Math.round(a.rx * TILE + ox);
    const y = Math.round(a.ry * TILE - 8 + oy) - (a.walk ? 1 : 0);
    items.push({
      y: a.ry * TILE + TILE,
      draw: () => {
        drawShadow(ctx, x, y);
        ctx.drawImage(img, x, y);
      },
    });
  }

  items.sort((a, b) => a.y - b.y);
  for (const item of items) item.draw();

  // 3) パーティクル（火の粉・ブレス）
  ctx.globalCompositeOperation = "lighter";
  for (const p of s.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  // 4) 暗めのアンビエント + 溶岩と松明の光（加算合成）
  ctx.fillStyle = "rgba(12,6,18,0.32)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const lavaGlow = glowImage("lava");
  const torchGlow = glowImage("torch");
  ctx.globalCompositeOperation = "lighter";
  for (let ty = tyStart; ty <= tyEnd; ty++) {
    for (let tx = txStart; tx <= txEnd; tx++) {
      const ch = rows[ty][tx];
      const cx = tx * TILE + TILE / 2 + ox;
      const cy = ty * TILE + TILE / 2 + oy;
      if (ch === "~") {
        ctx.globalAlpha = 0.5;
        ctx.drawImage(lavaGlow, cx - 20, cy - 20, 40, 40);
      } else if (ch === "T") {
        ctx.globalAlpha = 0.8;
        ctx.drawImage(torchGlow, cx - 20, cy - 24, 40, 40);
      }
    }
  }
  for (const e of s.entities) {
    if (e.kind === "boss" && e.awake) {
      const bossGlow = glowImage("boss");
      const flicker = 0.45 + 0.1 * Math.sin(s.frame / 6);
      ctx.globalAlpha = flicker;
      ctx.drawImage(bossGlow, e.x * TILE + 32 - 48 + ox, e.y * TILE + 24 - 48 + oy, 96, 96);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  // 5) 周辺減光（ビネット）
  const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 90, VIEW_W / 2, VIEW_H / 2, 220);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // 6) 演出用のフラッシュ
  if (s.flash && s.flash.alpha > 0) {
    ctx.globalAlpha = Math.min(1, s.flash.alpha);
    ctx.fillStyle = s.flash.color;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  }

  // 7) 画面遷移（アイリス）
  if (s.iris) {
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, VIEW_H);
    if (s.iris.r > 0) ctx.arc(s.iris.x, s.iris.y, s.iris.r, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
  }
}
