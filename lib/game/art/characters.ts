import { Pixels } from "./pixels";

/**
 * 16x24 のドット絵キャラクターを部品から組み立てる。
 * 正面(front)・背面(back)・横(side)の3視点を持ち、左向きは横向きの反転で表現する。
 * frame: 0=直立, 1=左足を持ち上げ, 2=右足を持ち上げ（歩行アニメ）
 */

export type View = "front" | "back" | "side";
export type Headgear = "none" | "helmet" | "witch" | "hood" | "bandana";
export type Weapon = "none" | "sword" | "staff" | "oldStaff" | "shield" | "dagger";

export interface Look {
  /** 髪: [基本色, 影, ハイライト] */
  hair: readonly [string, string, string];
  /** 肌: [基本色, 影] */
  skin: readonly [string, string];
  /** 服・鎧: [基本色, 影, ハイライト] */
  top: readonly [string, string, string];
  bottom: string;
  bottomShadow: string;
  boots: string;
  /** 飾りの差し色（ベルト・クレスト等） */
  trim: string;
  cape?: readonly [string, string];
  headgear?: Headgear;
  headColor?: readonly [string, string];
  beard?: string;
  robe?: boolean;
  weapon?: Weapon;
}

export const CHAR_W = 16;
export const CHAR_H = 24;

const EYE = "#120e18";
const MOUTH = "#8a3a2a";
const OUTLINE = "#120e18";
const STEEL = "#8c86a0";
const STEEL_LIGHT = "#e4ebf3";
const WOOD = "#6b4a2b";

export function drawCharacter(look: Look, view: View, frame: number): Pixels {
  const p = new Pixels(CHAR_W, CHAR_H);
  if (view === "side") {
    drawSide(p, look, frame);
  } else {
    drawFront(p, look, view === "back", frame);
  }
  return p.outline(OUTLINE);
}

/** 足: x位置・幅を指定。lift=1 で足を1px持ち上げる。 */
function leg(
  p: Pixels,
  look: Look,
  x: number,
  w: number,
  lift: number,
  pants: string,
): void {
  const top = 19 - lift;
  if (!look.robe) p.rect(x, top, w, 3, pants);
  p.rect(x, top + 3, w, 2, look.boots);
}

function shadeSkin(p: Pixels, look: Look, cond: (x: number, y: number) => boolean): void {
  for (let y = 3; y <= 12; y++) {
    for (let x = 3; x <= 12; x++) {
      if (p.get(x, y) === look.skin[0] && cond(x, y)) p.set(x, y, look.skin[1]);
    }
  }
}

function drawFront(p: Pixels, look: Look, back: boolean, frame: number): void {
  const lLift = frame === 1 ? 1 : 0;
  const rLift = frame === 2 ? 1 : 0;
  const [t0, t1, t2] = look.top;

  // マント（最背面）
  if (look.cape) {
    p.rect(3, back ? 11 : 12, 10, back ? 10 : 3, look.cape[1]);
    p.rect(3, back ? 11 : 12, 10, back ? 8 : 2, look.cape[0]);
  }

  // ローブのスカート
  if (look.robe) {
    p.rect(4, 18, 8, 4, look.bottom);
    p.rect(3, 20, 10, 2, look.bottom);
    p.rect(10, 19, 1, 3, look.bottomShadow);
  }

  // 両足（ズボン色と靴）
  leg(p, look, 5, 3, lLift, look.bottom);
  leg(p, look, 8, 3, rLift, look.bottom);
  if (!look.robe) p.rect(7, 19, 1, 3, look.bottomShadow);

  // 胴体
  p.rect(5, 13, 6, 6, t0);
  p.rect(10, 13, 1, 6, t1);
  p.rect(5, 13, 1, 5, t2);
  p.set(7, 13, look.trim).set(8, 13, look.trim);
  p.rect(5, 17, 6, 1, look.trim);

  // 腕と手
  p.rect(3, 13, 2, 4, t0);
  p.rect(4, 13, 1, 4, t1);
  p.rect(3, 17, 2, 2, look.skin[0]);
  p.rect(11, 13, 2, 4, t0);
  p.rect(12, 13, 1, 4, t1);
  p.rect(11, 17, 2, 2, look.skin[0]);

  // 頭
  if (back) {
    p.ellipse(8, 8, 5, 5, look.hair[0]);
    p.rect(5, 2, 3, 1, look.hair[2]);
    p.rect(5, 11, 6, 1, look.hair[1]);
    p.rect(3, 8, 1, 3, look.hair[1]);
    p.rect(12, 8, 1, 3, look.hair[1]);
  } else {
    p.ellipse(8, 8, 5, 5, look.skin[0]);
    shadeSkin(p, look, (x, y) => x >= 11 || y >= 11);
    // 前髪
    p.ellipse(8, 7, 5.3, 5.3, look.hair[0], (_x, y) => y <= 6);
    p.rect(4, 6, 8, 1, look.hair[1]);
    p.rect(5, 2, 3, 1, look.hair[2]);
    p.rect(3, 7, 1, 2, look.hair[0]);
    p.rect(12, 7, 1, 2, look.hair[0]);
    p.rect(4, 7, 3, 1, look.hair[0]);
    p.rect(9, 7, 3, 1, look.hair[0]);
    // 目と口
    p.rect(6, 8, 1, 2, EYE);
    p.rect(9, 8, 1, 2, EYE);
    p.rect(7, 11, 2, 1, MOUTH);
  }

  if (look.beard) p.ellipse(8, 12, 3.2, 2.3, look.beard, (_x, y) => y >= 11);
  headgear(p, look);
  weapon(p, look, false);
}

function drawSide(p: Pixels, look: Look, frame: number): void {
  const backLift = frame === 1 ? 1 : 0;
  const frontLift = frame === 2 ? 1 : 0;
  const [t0, t1, t2] = look.top;

  if (look.cape) {
    p.rect(1, 12, 5, 10, look.cape[1]);
    p.rect(2, 12, 4, 8, look.cape[0]);
  }
  if (look.robe) {
    p.rect(4, 18, 7, 4, look.bottom);
    p.rect(3, 20, 8, 2, look.bottom);
  }
  leg(p, look, 5, 3, backLift, look.bottomShadow);
  leg(p, look, 7, 3, frontLift, look.bottom);

  // 奥側の腕
  p.rect(5, 13, 2, 4, t1);
  p.rect(5, 17, 2, 2, look.skin[1]);

  // 胴体
  p.rect(5, 13, 5, 6, t0);
  p.rect(5, 13, 1, 5, t2);
  p.rect(5, 17, 5, 1, look.trim);

  // 手前側の腕
  p.rect(9, 13, 2, 4, t0);
  p.rect(10, 13, 1, 4, t1);
  p.rect(9, 17, 2, 2, look.skin[0]);

  // 頭（横顔）
  p.ellipse(8, 8, 5, 5, look.skin[0]);
  shadeSkin(p, look, (x) => x <= 4);
  if (look.headgear !== "hood") {
    p.ellipse(7.5, 7, 5.3, 5.3, look.hair[0], (x, y) => y <= 6 && x <= 10);
    p.rect(3, 7, 2, 4, look.hair[0]);
    p.rect(3, 9, 1, 2, look.hair[1]);
    p.rect(7, 7, 4, 1, look.hair[0]);
    p.rect(5, 2, 3, 1, look.hair[2]);
  }
  p.rect(10, 8, 1, 2, EYE);
  p.set(13, 9, look.skin[0]);
  p.set(11, 11, MOUTH);

  if (look.beard) p.ellipse(9.5, 12, 2.6, 2.2, look.beard, (_x, y) => y >= 11);
  headgear(p, look);
  weapon(p, look, true);
}

function headgear(p: Pixels, look: Look): void {
  const kind = look.headgear ?? "none";
  const [c0, c1] = look.headColor ?? ["#888888", "#444444"];
  switch (kind) {
    case "helmet":
      p.ellipse(8, 7, 5.6, 5.6, c0, (_x, y) => y <= 6);
      p.rect(3, 7, 10, 1, c1);
      p.rect(7, 0, 2, 2, look.trim);
      break;
    case "witch":
      p.rect(2, 5, 12, 1, c0);
      p.rect(4, 4, 8, 1, c0);
      p.rect(5, 3, 6, 1, c0);
      p.rect(6, 2, 4, 1, c0);
      p.rect(6, 1, 4, 1, c0);
      p.rect(7, 0, 2, 1, c0);
      p.rect(4, 4, 8, 1, look.trim);
      p.rect(3, 6, 10, 1, c1);
      break;
    case "hood":
      p.ellipse(8, 7, 6, 6, c0, (_x, y) => y <= 7);
      p.rect(2, 7, 2, 6, c0);
      p.rect(12, 7, 2, 6, c0);
      p.rect(4, 7, 8, 1, c1);
      break;
    case "bandana":
      p.rect(3, 6, 10, 2, c0);
      p.rect(3, 7, 10, 1, c1);
      p.set(13, 7, c0).set(14, 8, c0).set(13, 8, c0);
      break;
    default:
      break;
  }
}

/** 武器。side=true のとき横向きの持ち位置（x=11）を使う。 */
function weapon(p: Pixels, look: Look, side: boolean): void {
  const w = look.weapon ?? "none";
  const x = side ? 11 : 13;
  switch (w) {
    case "sword":
      p.rect(x, 7, 1, 10, STEEL_LIGHT);
      p.rect(x, 7, 1, 2, "#ffffff");
      p.rect(x - 1, 17, 3, 1, look.trim);
      p.rect(x, 18, 1, 2, WOOD);
      break;
    case "dagger":
      p.rect(x, 14, 1, 4, STEEL_LIGHT);
      p.rect(x - 1, 18, 3, 1, look.trim);
      break;
    case "staff":
      p.rect(x, 3, 1, 20, WOOD);
      p.ellipse(x + 0.5, 2.5, 1.7, 1.7, "#5fd3f0");
      p.set(x, 2, "#ffffff");
      break;
    case "oldStaff":
      p.rect(2, 4, 1, 19, WOOD);
      p.set(2, 3, "#8a6a44");
      break;
    case "shield":
      p.rect(0, 12, 3, 8, STEEL);
      p.rect(0, 12, 1, 8, look.trim);
      p.rect(1, 14, 1, 4, "#c8c2d8");
      break;
    default:
      break;
  }
}
