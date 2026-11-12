/**
 * 小さなピクセルバッファ。スプライト・タイルを生成するための基本描画器。
 * 色は "#rrggbb" 形式の文字列、透明は null で表す。
 */
export type Point = [number, number];

function parseHex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class Pixels {
  readonly w: number;
  readonly h: number;
  private d: (string | null)[];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.d = new Array<string | null>(w * h).fill(null);
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.d[y * this.w + x];
  }

  set(x: number, y: number, c: string | null): this {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.d[y * this.w + x] = c;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: string): this {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
    }
    return this;
  }

  /** 楕円内（ピクセル中心基準）を塗る。clip で塗る範囲を絞れる。 */
  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    c: string,
    clip?: (x: number, y: number) => boolean,
  ): this {
    const y0 = Math.floor(cy - ry - 1);
    const y1 = Math.ceil(cy + ry + 1);
    const x0 = Math.floor(cx - rx - 1);
    const x1 = Math.ceil(cx + rx + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && (!clip || clip(x, y))) this.set(x, y, c);
      }
    }
    return this;
  }

  /** 多角形内（ピクセル中心基準）を塗る。 */
  poly(points: Point[], c: string): this {
    const n = points.length;
    let minY = Infinity;
    let maxY = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const [x, y] of points) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        let inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const [xi, yi] = points[i];
          const [xj, yj] = points[j];
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
            inside = !inside;
          }
        }
        if (inside) this.set(x, y, c);
      }
    }
    return this;
  }

  /** Bresenham による直線。 */
  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const xe = Math.round(x1);
    const ye = Math.round(y1);
    const dx = Math.abs(xe - x);
    const dy = -Math.abs(ye - y);
    const sx = x < xe ? 1 : -1;
    const sy = y < ye ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x, y, c);
      if (x === xe && y === ye) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
    return this;
  }

  /** 不透明ピクセルに隣接する透明ピクセルを輪郭色で埋める（ドット絵の黒縁）。 */
  outline(color: string): this {
    const src = this.d.slice();
    const opaque = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < this.w && y < this.h && src[y * this.w + x] !== null;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x] !== null) continue;
        if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) {
          this.d[y * this.w + x] = color;
        }
      }
    }
    return this;
  }

  /** 左右反転した新しいバッファを返す。 */
  flipX(): Pixels {
    const out = new Pixels(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        out.set(this.w - 1 - x, y, this.get(x, y));
      }
    }
    return out;
  }

  /** src の不透明ピクセルを (ox, oy) にコピーする。 */
  blit(src: Pixels, ox: number, oy: number): this {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.get(x, y);
        if (c !== null) this.set(x + ox, y + oy, c);
      }
    }
    return this;
  }

  /** ImageData 経由で canvas に変換する（ブラウザ専用）。 */
  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    const img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.d.length; i++) {
      const c = this.d[i];
      if (c === null) continue;
      const [r, g, b] = parseHex(c);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }
}
