import type {
  FieldEffect,
  Letter,
  LetterInput,
  RippleSource,
  RippleTextSettings,
  SettingsInput,
} from './types';

const DT = 1 / 60;

const DEFAULTS: RippleTextSettings = {
  gradientForce: 18000,
  springForce: 3.0,
  darkSpringBoost: 8.0,
  damping: 0.88,
  maxDisplacement: 120,
  fieldScale: 3,
  rippleInterval: 90,
  colorBuckets: 10,
  bgColor: 'rgb(255,254,250)',
  showFps: false,
  buildColors(n: number) {
    const colors: string[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const v = Math.round(50 - t * 40);
      colors.push(`rgba(${v},${v},${v},${(0.75 + t * 0.25).toFixed(2)})`);
    }
    return colors;
  },
};

export class RippleTextEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private field: FieldEffect;
  private ripple: RippleSource;
  settings: RippleTextSettings;

  private letters: Letter[] = [];
  private colors: string[] = [];
  private rafId = 0;
  private lastFrameTime = 0;
  private running = false;

  // FPS
  private fpsFrames = 0;
  private fpsLastTime = 0;
  private fpsDisplay = 0;

  // Pointer state
  private pointerDown = false;
  private pointerX = 0;
  private pointerY = 0;
  private prevPointerX = 0;
  private prevPointerY = 0;
  private pointerSpeed = 0;
  private lastRippleTime = 0;

  // Bound handlers
  private _onDown: (e: MouseEvent) => void;
  private _onMove: (e: MouseEvent) => void;
  private _onUp: () => void;
  private _onTouchStart: (e: TouchEvent) => void;
  private _onTouchMove: (e: TouchEvent) => void;
  private _onTouchEnd: () => void;

  constructor(
    canvas: HTMLCanvasElement,
    field: FieldEffect,
    ripple: RippleSource,
    settings?: SettingsInput,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.field = field;
    this.ripple = ripple;
    this.settings = { ...DEFAULTS, ...settings };
    this.colors = this.settings.buildColors(this.settings.colorBuckets);

    const fw = Math.ceil(canvas.width / this.settings.fieldScale);
    const fh = Math.ceil(canvas.height / this.settings.fieldScale);
    this.field.resize(fw, fh);
    this.ripple.resize(canvas.width, canvas.height);

    // Bind pointer handlers
    this._onDown = (e) => {
      this.pointerDown = true;
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
      this.prevPointerX = this.pointerX;
      this.prevPointerY = this.pointerY;
      this.pointerSpeed = 0;
      this.ripple.addRipple(this.pointerX, this.pointerY, this.lastFrameTime);
      this.lastRippleTime = this.lastFrameTime;
    };

    this._onMove = (e) => {
      if (!this.pointerDown) return;
      this.prevPointerX = this.pointerX;
      this.prevPointerY = this.pointerY;
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
      const dx = this.pointerX - this.prevPointerX;
      const dy = this.pointerY - this.prevPointerY;
      this.pointerSpeed = Math.sqrt(dx * dx + dy * dy);
    };

    this._onUp = () => {
      this.pointerDown = false;
      this.pointerSpeed = 0;
    };

    this._onTouchStart = (e) => {
      const t = e.touches[0];
      if (!t) return;
      this.pointerDown = true;
      this.pointerX = t.clientX;
      this.pointerY = t.clientY;
      this.prevPointerX = this.pointerX;
      this.prevPointerY = this.pointerY;
      this.pointerSpeed = 0;
      this.ripple.addRipple(this.pointerX, this.pointerY, this.lastFrameTime);
      this.lastRippleTime = this.lastFrameTime;
    };

    this._onTouchMove = (e) => {
      const t = e.touches[0];
      if (!t || !this.pointerDown) return;
      this.prevPointerX = this.pointerX;
      this.prevPointerY = this.pointerY;
      this.pointerX = t.clientX;
      this.pointerY = t.clientY;
      const dx = this.pointerX - this.prevPointerX;
      const dy = this.pointerY - this.prevPointerY;
      this.pointerSpeed = Math.sqrt(dx * dx + dy * dy);
    };

    this._onTouchEnd = () => {
      this.pointerDown = false;
      this.pointerSpeed = 0;
    };
  }

  // ——— Public API ———

  setLetters(letters: LetterInput[]) {
    this.letters = letters.map((l) => ({
      char: l.char,
      ox: l.x,
      oy: l.y,
      x: l.x,
      y: l.y,
      vx: 0,
      vy: 0,
      font: l.font,
    }));
  }

  updateSettings(patch: SettingsInput) {
    Object.assign(this.settings, patch);
    if (patch.buildColors || patch.colorBuckets) {
      this.colors = this.settings.buildColors(this.settings.colorBuckets);
    }
  }

  resize(w: number, h: number) {
    this.canvas.width = w;
    this.canvas.height = h;
    const fw = Math.ceil(w / this.settings.fieldScale);
    const fh = Math.ceil(h / this.settings.fieldScale);
    this.field.resize(fw, fh);
    this.ripple.resize(w, h);
  }

  start() {
    if (this.running) this.stop();
    this.running = true;

    this.canvas.addEventListener('mousedown', this._onDown);
    this.canvas.addEventListener('mousemove', this._onMove);
    window.addEventListener('mouseup', this._onUp);
    this.canvas.addEventListener('touchstart', this._onTouchStart, {
      passive: true,
    });
    this.canvas.addEventListener('touchmove', this._onTouchMove, {
      passive: true,
    });
    window.addEventListener('touchend', this._onTouchEnd);

    const loop = (time: number) => {
      if (!this.running) return;
      this.lastFrameTime = time;

      this.fpsFrames++;
      if (time - this.fpsLastTime >= 1000) {
        this.fpsDisplay = this.fpsFrames;
        this.fpsFrames = 0;
        this.fpsLastTime = time;
      }

      this.emitRipples(time);
      this.updatePhysics(time);
      this.render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.pointerDown = false;
    this.pointerSpeed = 0;

    this.canvas.removeEventListener('mousedown', this._onDown);
    this.canvas.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('mouseup', this._onUp);
    this.canvas.removeEventListener('touchstart', this._onTouchStart);
    this.canvas.removeEventListener('touchmove', this._onTouchMove);
    window.removeEventListener('touchend', this._onTouchEnd);
  }

  // ——— Private ———

  private emitRipples(time: number) {
    if (!this.pointerDown) return;

    const moveFactor = Math.min(this.pointerSpeed * 0.1, 1.0);
    const interval =
      800 * (1 - moveFactor) + this.settings.rippleInterval * moveFactor;

    if (time - this.lastRippleTime >= interval) {
      this.lastRippleTime = time;
      this.ripple.addRipple(this.pointerX, this.pointerY, time);
    }
    this.pointerSpeed *= 0.85;
  }

  private updatePhysics(time: number) {
    const s = this.settings;
    const fieldScale = s.fieldScale;

    this.field.update(time);
    this.ripple.update(time);
    this.ripple.prune(time);

    for (const letter of this.letters) {
      const fx = letter.x / fieldScale;
      const fy = letter.y / fieldScale;
      const { brightness, gradX, gradY } = this.field.sample(fx, fy);

      // Field gradient force
      const mag = brightness * brightness;
      letter.vx -= gradX * s.gradientForce * mag * DT;
      letter.vy -= gradY * s.gradientForce * mag * DT;

      // Ripple force
      const [rfx, rfy, influence] = this.ripple.computeForce(
        letter.x,
        letter.y,
        time,
      );
      letter.vx += rfx * DT;
      letter.vy += rfy * DT;

      // Spring restoration
      const dx = letter.ox - letter.x;
      const dy = letter.oy - letter.y;
      const darkness = 1.0 - brightness;
      const rippleDampen = 1.0 - influence * 0.85;
      const spring =
        (s.springForce + darkness * s.darkSpringBoost) * rippleDampen;

      letter.vx += dx * spring * DT;
      letter.vy += dy * spring * DT;

      // Damping + integration
      letter.vx *= s.damping;
      letter.vy *= s.damping;
      letter.x += letter.vx * DT;
      letter.y += letter.vy * DT;

      // Clamp displacement
      const ddx = letter.x - letter.ox;
      const ddy = letter.y - letter.oy;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist > s.maxDisplacement) {
        const sc = s.maxDisplacement / dist;
        letter.x = letter.ox + ddx * sc;
        letter.y = letter.oy + ddy * sc;
        letter.vx *= 0.5;
        letter.vy *= 0.5;
      }
    }
  }

  private render() {
    const { ctx, canvas, settings: s } = this;
    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = s.bgColor;
    ctx.fillRect(0, 0, W, H);

    const invMax = 1 / s.maxDisplacement;
    const bucketScale = s.colorBuckets - 1;

    ctx.textBaseline = 'alphabetic';
    let lastFont = '';

    for (const letter of this.letters) {
      const dx = letter.x - letter.ox;
      const dy = letter.y - letter.oy;
      const t = Math.min(Math.sqrt(dx * dx + dy * dy) * invMax, 1);
      const bucket = ((t * bucketScale + 0.5) | 0);

      if (letter.font !== lastFont) {
        ctx.font = letter.font;
        lastFont = letter.font;
      }
      ctx.fillStyle = this.colors[bucket];
      ctx.fillText(letter.char, letter.x, letter.y);
    }

    if (s.showFps) {
      ctx.font = '11px monospace';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(100,180,255,0.4)';
      const txt = `${this.fpsDisplay} fps | ${this.letters.length} chars | ${this.ripple.activeCount()} ripples`;
      const tw = ctx.measureText(txt).width;
      ctx.fillText(txt, W - tw - 10, H - 10);
    }
  }
}
