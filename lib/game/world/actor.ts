import { STEP_FRAMES, type Dir } from "../core/constants";

/** タイル単位で移動するキャラクター（主人公・仲間）。 */
export class Actor {
  x: number;
  y: number;
  dir: Dir;
  moving = false;
  private fromX: number;
  private fromY: number;
  private t = 0;

  constructor(x: number, y: number, dir: Dir) {
    this.x = x;
    this.y = y;
    this.fromX = x;
    this.fromY = y;
    this.dir = dir;
  }

  /** (x, y) へ1マス移動を開始する。 */
  start(x: number, y: number, dir: Dir): void {
    this.fromX = this.x;
    this.fromY = this.y;
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.t = 0;
    this.moving = true;
  }

  /** 1フレーム進める。移動が完了したフレームだけ true を返す。 */
  update(): boolean {
    if (!this.moving) return false;
    this.t++;
    if (this.t >= STEP_FRAMES) {
      this.moving = false;
      return true;
    }
    return false;
  }

  /** 描画用の位置（タイル座標・小数）。 */
  renderX(): number {
    return this.moving ? this.fromX + (this.x - this.fromX) * (this.t / STEP_FRAMES) : this.x;
  }

  renderY(): number {
    return this.moving ? this.fromY + (this.y - this.fromY) * (this.t / STEP_FRAMES) : this.y;
  }

  /** 歩行アニメのフレーム: 0=直立, 1=左足, 2=右足 */
  walkFrame(): number {
    if (!this.moving) return 0;
    return this.t < STEP_FRAMES / 2 ? 1 : 2;
  }
}
