// Core
export { RippleTextEngine } from './core/engine';
export type {
  FieldEffect,
  FieldSample,
  Letter,
  LetterInput,
  RippleSource,
  RippleTextSettings,
  SettingsInput,
} from './core/types';

// Built-in effects
export { WaterField } from './effects/waterField';
export type { WaterFieldSettings } from './effects/waterField';
export { WaveRipple } from './effects/waveRipple';
export type { WaveRippleSettings } from './effects/waveRipple';

// Utilities
export { extractTextFromDOM, layoutText } from './utils/extractText';
