import type { RippleSource } from "../core/types";

interface Ripple {
  cx: number;
  cy: number;
  startTime: number;
  wavelength: number;
  amplitude: number;
  decay: number;
  _radius: number;
  _timeFade: number;
  _ringWidth: number;
  _baseSpeed: number;
}

export interface WaveRippleSettings {
  amplitude: number;
  wavelength: number;
  decay: number;
  force: number;
  waveCenterY: number;
  waveAmpMul: number;
}

const DEFAULTS: WaveRippleSettings = {
  amplitude: 1.25,
  wavelength: 800,
  decay: 0.0048,
  force: 2350,
  waveCenterY: -0.05,
  waveAmpMul: 1.4,
};

export class WaveRipple implements RippleSource {
  settings: WaveRippleSettings;
  private ripples: Ripple[] = [];

  constructor(settings?: Partial<WaveRippleSettings>) {
    this.settings = { ...DEFAULTS, ...settings };
  }

  resize(_w: number, _h: number) {
    // No buffers needed for ripple calculation
  }

  addRipple(x: number, y: number, time: number) {
    const s = this.settings;
    this.ripples.push({
      cx: x,
      cy: y,
      startTime: time,
      wavelength: s.wavelength,
      amplitude: s.amplitude,
      decay: s.decay,
      _radius: 0,
      _timeFade: 1,
      _ringWidth: s.wavelength * 0.15,
      _baseSpeed: s.wavelength * 0.002,
    });
  }

  update(time: number) {
    for (const r of this.ripples) {
      const age = time - r.startTime;
      r._timeFade = Math.exp(-age * r.decay);
      r._ringWidth = r.wavelength * 0.15;
      r._baseSpeed = r.wavelength * 0.002;

      const phase = (2 * Math.PI * age) / r.wavelength;
      const sw =
        (1 - Math.cos(phase + this.settings.waveCenterY * Math.PI)) *
        this.settings.waveAmpMul;
      const sineR = r._baseSpeed * age * 0.5 * sw;
      r._radius = r._baseSpeed * age * 0.3 + sineR * 0.7;
    }
  }

  prune(_time: number) {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      if (this.ripples[i]._timeFade < 0.01) {
        this.ripples.splice(i, 1);
      }
    }
  }

  computeForce(
    lx: number,
    ly: number,
    _time: number,
  ): [number, number, number] {
    let totalFx = 0;
    let totalFy = 0;
    let maxInfluence = 0;
    const force = this.settings.force;

    for (const r of this.ripples) {
      const rdx = lx - r.cx;
      const rdy = ly - r.cy;
      const distSq = rdx * rdx + rdy * rdy;
      if (distSq < 1) continue;

      const dist = Math.sqrt(distSq);
      const delta = dist - r._radius;
      const rw = r._ringWidth;
      const range = rw * 3;
      if (delta > range || delta < -range) continue;

      const snap = -delta / rw;
      const normDelta = delta / rw;
      const proximity = Math.exp(-normDelta * normDelta);
      const behindFront =
        delta < 0 ? Math.exp(delta / rw) : Math.exp((-delta * 2) / rw);

      const snapF = snap * proximity * force * 1.5;
      const pushF = behindFront * force * r._baseSpeed * 0.8;
      const total = (snapF + pushF) * r._timeFade * r.amplitude;

      const invDist = 1 / dist;
      totalFx += rdx * invDist * total;
      totalFy += rdy * invDist * total;
      maxInfluence = Math.max(maxInfluence, proximity * r._timeFade);
    }

    return [totalFx, totalFy, maxInfluence];
  }

  activeCount() {
    return this.ripples.length;
  }
}
