import { RippleTextEngine, WaterField, WaveRipple, layoutText } from "../src";

const LOREM = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor. Ut ullamcorper, ligula ut dictum pharetra, nisi nunc fringilla magna, in commodo elit erat nec turpis. Ut pharetra augue nec augue. Nam elit magna, hendrerit sit amet, tincidunt ac, viverra sed, nulla. Donec porta diam eu massa. Quisque diam lorem, interdum vitae, dapibus ac, scelerisque vitae, pede.`;

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const ctx = canvas.getContext("2d")!;

const field = new WaterField();
const ripple = new WaveRipple();

const engine = new RippleTextEngine(canvas, field, ripple, {
  bgColor: "#020814",
  showFps: true,
  buildColors(n) {
    const colors: string[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const r = Math.round(225 + t * 30);
      const g = Math.round(228 + t * 27);
      const b = Math.round(232 + t * 23);
      colors.push(`rgba(${r},${g},${b},${(0.85 + t * 0.15).toFixed(2)})`);
    }
    return colors;
  },
});

const letters = layoutText(ctx, LOREM, { fontSize: 18, margin: 40 });
engine.setLetters(letters);
engine.start();

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  engine.resize(canvas.width, canvas.height);
  const newLetters = layoutText(ctx, LOREM, { fontSize: 18, margin: 40 });
  engine.setLetters(newLetters);
});

// ——— Slider bindings ———
function bind(sliderId: string, valId: string, setter: (v: number) => void) {
  const slider = document.getElementById(sliderId) as HTMLInputElement;
  const valEl = document.getElementById(valId)!;
  slider.addEventListener("input", () => {
    const v = parseFloat(slider.value);
    valEl.textContent = String(v);
    setter(v);
  });
}

// Physics
bind("s-force", "v-force", (v) => engine.updateSettings({ gradientForce: v }));
bind("s-spring", "v-spring", (v) => engine.updateSettings({ springForce: v }));
bind("s-darkspring", "v-darkspring", (v) =>
  engine.updateSettings({ darkSpringBoost: v }),
);
bind("s-damping", "v-damping", (v) => engine.updateSettings({ damping: v }));
bind("s-maxdisp", "v-maxdisp", (v) =>
  engine.updateSettings({ maxDisplacement: v }),
);

// Water field
bind("s-nscale", "v-nscale", (v) => {
  field.settings.noiseScale = v;
});
bind("s-tspeed", "v-tspeed", (v) => {
  field.settings.timeSpeed = v;
});
bind("s-sharp", "v-sharp", (v) => {
  field.settings.sharpness = v;
});

// Ripples
bind("s-ramp", "v-ramp", (v) => {
  ripple.settings.amplitude = v;
});
bind("s-rwlen", "v-rwlen", (v) => {
  ripple.settings.wavelength = v;
});
bind("s-rdecay", "v-rdecay", (v) => {
  ripple.settings.decay = v;
});
bind("s-rforce", "v-rforce", (v) => {
  ripple.settings.force = v;
});
