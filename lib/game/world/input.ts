import type { Dir } from "../core/constants";

const DIR_KEYS: Record<string, Dir> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

const ACTION_KEYS = new Set(["Enter", "Space", "KeyZ"]);
const CANCEL_KEYS = new Set(["Escape", "KeyX", "Backspace"]);

/**
 * キーボード入力。
 * - heldDir: 押し続けている方向（フィールドの連続移動用）
 * - consumeDirs: 押された方向の履歴（メニューのカーソル移動用）
 * - consumeAction / consumeCancel: 決定・取り消しの1回分の入力
 */
export class Input {
  private held: Dir[] = [];
  private dirQueue: Dir[] = [];
  private actionPending = false;
  private cancelPending = false;

  readonly onKeyDown = (e: KeyboardEvent): void => {
    const dir = DIR_KEYS[e.code];
    if (dir) {
      e.preventDefault();
      if (!this.held.includes(dir)) this.held.push(dir);
      this.dirQueue.push(dir);
      return;
    }
    if (ACTION_KEYS.has(e.code)) {
      e.preventDefault();
      if (!e.repeat) this.actionPending = true;
      return;
    }
    if (CANCEL_KEYS.has(e.code)) {
      e.preventDefault();
      if (!e.repeat) this.cancelPending = true;
    }
  };

  readonly onKeyUp = (e: KeyboardEvent): void => {
    const dir = DIR_KEYS[e.code];
    if (dir) this.held = this.held.filter((d) => d !== dir);
  };

  heldDir(): Dir | null {
    return this.held.length > 0 ? this.held[this.held.length - 1] : null;
  }

  consumeDirs(): Dir[] {
    const out = this.dirQueue;
    this.dirQueue = [];
    return out;
  }

  consumeAction(): boolean {
    const v = this.actionPending;
    this.actionPending = false;
    return v;
  }

  consumeCancel(): boolean {
    const v = this.cancelPending;
    this.cancelPending = false;
    return v;
  }

  /** 画面上のボタン（クリック）からの決定操作。 */
  pressAction(): void {
    this.actionPending = true;
  }

  reset(): void {
    this.held = [];
    this.dirQueue = [];
    this.actionPending = false;
    this.cancelPending = false;
  }
}
