import type { FieldEffect, FieldSample } from "../core/types";

// ——— Simplex noise ———
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const gx = [1, -1, 1, -1, 1, -1, 0, 0];
const gy = [1, 1, -1, -1, 0, 0, 1, -1];
const perm = new Uint8Array(512);
const permMod8 = new Uint8Array(512);
const p = new Uint8Array(256);
for (let i = 0; i < 256; i++) p[i] = i;
for (let i = 255; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [p[i], p[j]] = [p[j], p[i]];
}
for (let i = 0; i < 512; i++) {
  perm[i] = p[i & 255];
  permMod8[i] = perm[i] & 7;
}

function simplex2(x: number, y: number): number {
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;
  const x0 = x - (i - t);
  const y0 = y - (j - t);
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = 1 - i1;
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;
  const ii = i & 255;
  const jj = j & 255;
  let n0 = 0,
    n1 = 0,
    n2 = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    t0 *= t0;
    const gi = permMod8[ii + perm[jj]];
    n0 = t0 * t0 * (gx[gi] * x0 + gy[gi] * y0);
  }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    t1 *= t1;
    const gi = permMod8[ii + i1 + perm[jj + j1]];
    n1 = t1 * t1 * (gx[gi] * x1 + gy[gi] * y1);
  }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    t2 *= t2;
    const gi = permMod8[ii + 1 + perm[jj + 1]];
    n2 = t2 * t2 * (gx[gi] * x2 + gy[gi] * y2);
  }
  return 70 * (n0 + n1 + n2);
}

// ——— Settings ———
export interface WaterFieldSettings {
  noiseScale: number;
  timeSpeed: number;
  sharpness: number;
}

const DEFAULTS: WaterFieldSettings = {
  noiseScale: 0.004,
  timeSpeed: 0.0003,
  sharpness: 0.6,
};

// ——— Implementation ———
export class WaterField implements FieldEffect {
  settings: WaterFieldSettings;
  private w = 0;
  private h = 0;
  private brightness = new Float32Array(0);
  private gradXBuf = new Float32Array(0);
  private gradYBuf = new Float32Array(0);
  private frameCount = 0;

  constructor(settings?: Partial<WaterFieldSettings>) {
    this.settings = { ...DEFAULTS, ...settings };
  }

  resize(width: number, height: number) {
    this.w = width;
    this.h = height;
    const len = width * height;
    this.brightness = new Float32Array(len);
    this.gradXBuf = new Float32Array(len);
    this.gradYBuf = new Float32Array(len);
  }

  update(time: number) {
    this.frameCount++;
    const { w, h, brightness } = this;

    // Only update noise every 2nd frame
    if ((this.frameCount & 1) === 0) {
      const scale = this.settings.noiseScale;
      const t = time * this.settings.timeSpeed;
      const sharp = this.settings.sharpness;
      const usePow = Math.abs(sharp - 1) > 0.01 && Math.abs(sharp - 0.5) > 0.01;
      const useSqrt = Math.abs(sharp - 0.5) < 0.01;
      const t07 = t * 0.7,
        t05 = t * 0.5;
      const t04 = t * 0.4,
        t03 = t * 0.3;
      const t02 = t * 0.2,
        t06 = t * 0.6;

      for (let y = 0; y < h; y++) {
        const ny = y * scale;
        const row = y * w;
        for (let x = 0; x < w; x++) {
          const nx = x * scale;
          let v = 0;
          v += simplex2(nx + t07, ny + t05) * 0.5;
          v += simplex2(nx * 2 - t04, ny * 2 + t03) * 0.25;
          v += simplex2(nx * 4 + t02, ny * 4 - t06) * 0.125;
          v = v < 0 ? -v : v;
          if (useSqrt) v = Math.sqrt(v);
          else if (usePow) v = Math.pow(v, sharp);
          brightness[row + x] = 1.0 - v;
        }
      }
    }

    this.computeGradients();
  }

  sample(x: number, y: number): FieldSample {
    const { w, h, brightness, gradXBuf, gradYBuf } = this;
    const w1 = w - 1.001;
    const h1 = h - 1.001;
    if (x < 0) x = 0;
    else if (x > w1) x = w1;
    if (y < 0) y = 0;
    else if (y > h1) y = h1;

    const ix = x | 0;
    const iy = y | 0;
    const fx = x - ix;
    const fy = y - iy;
    const i00 = iy * w + ix;
    const fx1 = 1 - fx;
    const fy1 = 1 - fy;

    const b =
      brightness[i00] * fx1 * fy1 +
      brightness[i00 + 1] * fx * fy1 +
      brightness[i00 + w] * fx1 * fy +
      brightness[i00 + w + 1] * fx * fy;

    const idx = (y | 0) * w + (x | 0);
    return { brightness: b, gradX: gradXBuf[idx], gradY: gradYBuf[idx] };
  }

  private computeGradients() {
    const { w, h, brightness, gradXBuf, gradYBuf } = this;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      const above = y > 1 ? (y - 2) * w : 0;
      const below = y < h - 2 ? (y + 2) * w : (h - 1) * w;
      for (let x = 0; x < w; x++) {
        const xm = x > 1 ? x - 2 : 0;
        const xp = x < w - 2 ? x + 2 : w - 1;
        gradXBuf[row + x] =
          (brightness[row + xp] - brightness[row + xm]) * 0.25;
        gradYBuf[row + x] =
          (brightness[below + x] - brightness[above + x]) * 0.25;
      }
    }
  }
}
