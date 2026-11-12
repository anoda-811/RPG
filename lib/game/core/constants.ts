/** 内部描画解像度（16:9）。CSS側で整数倍に拡大して表示する。 */
export const VIEW_W = 320;
export const VIEW_H = 180;

/** 1タイルのピクセル数 */
export const TILE = 16;

/** 1マス移動にかかるフレーム数（60fps 換算で約133ms） */
export const STEP_FRAMES = 8;

/** タイプライター演出: 何フレームごとに1文字表示するか */
export const TEXT_FRAMES_PER_CHAR = 2;

/** 画面遷移（アイリス）の片道フレーム数 */
export const TRANSITION_FRAMES = 28;

/** 固定タイムステップ（60Hz） */
export const FRAME_MS = 1000 / 60;

export type Dir = "up" | "down" | "left" | "right";

export const DELTA: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export function opposite(d: Dir): Dir {
  switch (d) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}
