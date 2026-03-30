/** A single character with physics state */
export interface Letter {
  char: string;
  ox: number; // Original x
  oy: number; // Original y
  x: number; // Current x (physics-driven)
  y: number; // Current y (physics-driven)
  vx: number; // Velocity x
  vy: number; // Velocity y
  font: string; // CSS font string
}

/** Input letter before physics initialization */
export interface LetterInput {
  char: string;
  x: number;
  y: number;
  font: string;
}

/** Sampled field value at a point */
export interface FieldSample {
  brightness: number; // 0..1 brightness at this point
  gradX: number; // Horizontal gradient
  gradY: number; // Vertical gradient
}

/**
 * A FieldEffect produces a continuous animated field that drives letter physics.
 * Replace this to swap the underlying algorithm (water caustics, perlin noise, etc.)
 */
export interface FieldEffect {
  /** Initialize or resize the field to cover the given dimensions */
  resize(width: number, height: number): void;
  /** Advance the field simulation by one frame */
  update(time: number): void;
  /** Sample field brightness and gradient at a point */
  sample(x: number, y: number): FieldSample;
}

/**
 * A RippleSource creates expanding interactive disturbances in the field.
 * Replace this to change how click/touch interactions propagate.
 */
export interface RippleSource {
  /** Initialize or resize to match field dimensions */
  resize(width: number, height: number): void;
  /** Create a new ripple at the given screen coordinates */
  addRipple(x: number, y: number, time: number): void;
  /** Advance ripple simulation */
  update(time: number): void;
  /** Remove dead ripples */
  prune(time: number): void;
  /**
   * Compute the force a ripple exerts on a letter.
   * Returns [forceX, forceY, influence] where influence is 0..1
   * indicating how much the letter is currently affected.
   */
  computeForce(
    letterX: number,
    letterY: number,
    time: number,
  ): [fx: number, fy: number, influence: number];
  /** Number of active ripples (for debug display) */
  activeCount(): number;
}

/** All tunable physics and rendering settings */
export interface RippleTextSettings {
  // Physics
  gradientForce: number; // Strength of field-gradient push on letters
  springForce: number; // Spring pull back to original position
  darkSpringBoost: number; // Extra spring in dark field regions
  damping: number; // Velocity damping per frame (0..1)
  maxDisplacement: number; // Max px a letter can move from origin

  // Field
  fieldScale: number; // Downscale factor for field simulation (e.g. 3 = 1/3 res)

  // Ripple interaction
  rippleInterval: number; // ms between ripples while holding

  // Rendering
  colorBuckets: number; // Number of displacement-based color steps
  bgColor: string; // Canvas background fill color
  showFps: boolean; // Show FPS counter

  /** Build an array of CSS color strings for each displacement bucket */
  buildColors(bucketCount: number): string[];
}

/** Deep partial — all fields optional */
export type SettingsInput = {
  [K in keyof RippleTextSettings]?: RippleTextSettings[K];
};
