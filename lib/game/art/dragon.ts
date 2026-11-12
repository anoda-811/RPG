import { Pixels } from "./pixels";

const OUTLINE = "#120e18";
const SCALE = "#8e1f22";
const SCALE_LIGHT = "#c23a22";
const SCALE_DARK = "#5e1419";
const BELLY = "#e8843a";
const BELLY_STRIPE = "#c4531f";
const MEMBRANE = "#7a1f26";
const BONE = "#2a0a10";
const HORN = "#e8d9b0";
const EYE_GLOW = "#ffe25a";

/**
 * 炎龍の上から見下ろしたスプライト（64x48）。
 * flap: 0〜2 で翼の先端の高さを変える（羽ばたき）。
 * breathe: 口の炎を光らせる。
 */
export function drawDragon(awake: boolean, flap: number, breathe: boolean): Pixels {
  const p = new Pixels(64, 48);
  const lift = [-6, -1, 4][flap] ?? 0;

  drawWing(p, false, lift);
  drawWing(p, true, lift);

  // 尾（体の上側から伸びる）
  p.poly(
    [
      [29, 18],
      [35, 18],
      [37, 9],
      [35, 3],
      [32, 0],
      [29, 3],
      [27, 9],
    ],
    SCALE,
  );

  // 胴体と腹
  p.ellipse(32, 25, 9, 11, SCALE);
  p.ellipse(32, 28, 5, 8, BELLY);
  for (let y = 22; y < 36; y += 3) p.rect(28, y, 8, 1, BELLY_STRIPE);

  // 背中の鱗模様
  for (let y = 15; y <= 34; y++) {
    for (let x = 24; x <= 40; x++) {
      if (p.get(x, y) !== SCALE) continue;
      if ((x * 7 + y * 13) % 11 === 0) p.set(x, y, SCALE_DARK);
      else if ((x * 3 + y * 5) % 13 === 0) p.set(x, y, SCALE_LIGHT);
    }
  }

  // 首と頭（頭は手前＝画面下側）
  p.ellipse(32, 35, 5, 4, SCALE);
  p.ellipse(32, 40, 7, 5, SCALE_LIGHT);
  p.ellipse(32, 43, 4, 2, SCALE);

  // 角
  p.poly(
    [
      [25, 38],
      [18, 31],
      [22, 41],
    ],
    HORN,
  );
  p.poly(
    [
      [39, 38],
      [46, 31],
      [42, 41],
    ],
    HORN,
  );

  // 目
  if (awake) {
    p.rect(27, 38, 3, 2, EYE_GLOW);
    p.rect(34, 38, 3, 2, EYE_GLOW);
    p.set(28, 38, "#ffffff").set(35, 38, "#ffffff");
  } else {
    p.rect(27, 39, 3, 1, OUTLINE);
    p.rect(34, 39, 3, 1, OUTLINE);
  }

  // 鼻孔と口
  p.set(30, 44, OUTLINE).set(34, 44, OUTLINE);
  p.rect(29, 46, 6, 1, "#3a0c0c");
  if (awake && breathe) {
    p.rect(30, 46, 4, 2, "#ffb347");
    p.set(31, 47, "#ffe25a").set(32, 47, "#ffe25a");
  }

  return p.outline(OUTLINE);
}

function drawWing(p: Pixels, mirror: boolean, lift: number): void {
  const X = (x: number) => (mirror ? 63 - x : x);
  const outline: [number, number][] = [
    [24, 14],
    [12, 4 + lift],
    [2, 6 + lift],
    [6, 13 + lift],
    [1, 20 + lift],
    [9, 21 + lift],
    [14, 29 + lift],
    [24, 34],
  ];
  p.poly(
    outline.map(([x, y]) => [X(x), y] as [number, number]),
    MEMBRANE,
  );
  // 翼の骨
  const tips: [number, number][] = [
    [12, 4 + lift],
    [2, 6 + lift],
    [1, 20 + lift],
    [14, 29 + lift],
  ];
  for (const [tx, ty] of tips) p.line(X(24), 24, X(tx), ty, BONE);
}
