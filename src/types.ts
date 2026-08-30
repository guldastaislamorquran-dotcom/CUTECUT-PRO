export enum ClipType {
  VIDEO = 'video',
  AUDIO = 'audio',
  TEXT = 'text',
  EFFECT = 'effect',
  IMAGE = 'image'
}

export interface VideoFilters {
  brightness: number; // 0 to 200, default 100
  contrast: number;   // 0 to 200, default 100
  saturation: number; // 0 to 200, default 100
  grayscale: number;  // 0 to 100, default 0
  sepia: number;      // 0 to 100, default 0
  invert: number;     // 0 to 100, default 0
  hueRotate: number;  // 0 to 360, default 0
  chromaKey: {
    enabled: boolean;
    color: string; // hex string, e.g. "#00ff00"
    threshold: number; // 0 to 100
    smoothness: number; // 0 to 100
  };
}

export interface Keyframe {
  id: string;
  timestamp: number; // offset in seconds relative to clip start (0 to clip.duration)
  opacity?: number;  // 0.0 to 1.0
  posX?: number;     // -300 to 300 px
  posY?: number;     // -300 to 300 px
  scale?: number;    // 10 to 200 %
  rotation?: number; // 0 to 360 deg
  volume?: number;   // 0.0 to 2.0
}

export interface Clip {
  id: string;
  name: string;
  type: ClipType;
  trackId: string;
  start: number; // In seconds on the timeline
  duration: number; // Duration in seconds in the timeline
  sourceStart: number; // Playback start offset inside the source media (in seconds)
  sourceDuration: number; // Total length of the original resource (in seconds)
  playbackRate: number; // Speed multiplier, e.g., 0.5, 1.0, 2.0, 5.0
  volume: number; // Gain multiplier, e.g. 1.0 (100%)
  peakDb?: number; // Calculated peak audio dBFS level, e.g., -2.4
  opacity?: number; // Opacity 0.0 to 1.0
  keyframes?: Keyframe[]; // Keyframes for property animation at specific timestamps
  
  // Media source parameters
  url?: string; // Video/audio source URL
  color?: string; // For text layers (text color) or solid background video clips
  
  // Text specific properties
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  textX?: number; // percentage 0-100
  textY?: number; // percentage 0-100
  textStyle?: 'normal' | 'shadow' | 'outline' | 'neon' | 'gold-glow' | 'viral-reels';
  textTransform?: 'uppercase' | 'none';
  textWrap?: boolean;
  textMaxWidth?: number; // percentage 10-100 of canvas width
  textLineHeight?: number; // multiplier, e.g., 1.2, 1.4
  textAlignment?: 'left' | 'center' | 'right';
  textGlowIntensity?: number; // 0 to 60 px
  textGlowColor?: string;
  textStrokeWidth?: number; // 0 to 20 px
  textStrokeColor?: string;
  confidenceScore?: number; // Tasmeea alignment confidence match ratio (0-100%)
  textAnimation?: TextAnimationConfig;

  // Video adjustments and filters
  transform?: {
    scale?: number;    // 10 to 200 (%)
    posX?: number;     // -300 to 300 px
    posY?: number;     // -300 to 300 px
    rotation?: number; // 0 to 360 deg
  };
  filters?: VideoFilters;
  isImage?: boolean;
  videoEffects?: {
    vignette?: boolean;
    filmGrain?: boolean;
    glitch?: boolean;
    blur?: number; // 0 to 20
    relighting?: {
      enabled: boolean;
      style: 'amber-glow' | 'neon-cyan' | 'studio-sunset' | 'quran-gold';
      intensity: number; // 0 to 100
    };
    upscaler4k?: boolean;
    lightLeak?: boolean;
    bokeh?: boolean;
    transition?: TransitionType | ClipTransition;
    transitionIn?: TransitionType;
    transitionOut?: TransitionType;
    transitionDuration?: number;
  };
  text3D?: {
    metallicBorder?: boolean;
    dropShadowBlur?: number; // 0 to 50
    depth3D?: number; // 0 to 20
    neonGlowColor?: string;
  };
  speedRamp?: {
    preset: 'none' | 'hero' | 'bullet' | 'montage' | 'custom';
    curve: number[]; // e.g., [1, 2.5, 0.5, 1]
  };
  audioEffects?: {
    reverb?: boolean; // Qiraat Hall Echo
    echo?: boolean; // Fast feedback echo
    bassBoost?: boolean; // Low-end frequency boost
    vocalIsolation?: boolean; // AI Vocal Isolation
    voiceEnhancer?: boolean; // Voice Clarity Enhancer
    noiseGateThreshold?: number; // dB threshold, e.g. -40
  };
  transition?: ClipTransition;
}

export type TransitionType =
  | 'none'
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'dissolve'
  | 'cross-dissolve'
  | 'zoom'
  | 'wipe';

export interface ClipTransition {
  type?: TransitionType;
  duration?: number; // seconds, default 1.0
  inType?: TransitionType;
  inDuration?: number;
  outType?: TransitionType;
  outDuration?: number;
}

export interface Track {
  id: string;
  name: string;
  type: ClipType;
  clips: Clip[];
  muted?: boolean;
  locked?: boolean;
  hidden?: boolean;
}

export interface TimelineState {
  tracks: Track[];
  currentTime: number;
  duration: number; // total duration of the timeline in seconds
  zoom: number; // px per second
  selectedClipId: string | null;
  isPlaying: boolean;
  aspectRatio: '16:9' | '9:16' | '1:1';
}

export interface PresetMedia {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  url: string;
  duration: number;
  thumbnail: string;
  category: string;
}

export interface AICaptionRequest {
  transcript: string;
  language: string;
  style: string;
}

export interface AICaptionResponse {
  subtitles: {
    start: number;
    end: number;
    text: string;
  }[];
}

export interface WatermarkSettings {
  enabled: boolean;
  url: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity: number; // 0.1 to 1.0
  scale: number; // 10 to 50 (% of canvas width)
}

export type AyahSymbolStyle = 'ornate-medallion' | 'uthmani-circle' | 'ornate-brackets' | 'parentheses' | 'brackets' | 'none';
export type AyahDigitType = 'arabic' | 'latin';
export type AyahSymbolPosition = 'end' | 'start';

export interface QuranTranslationOption {
  id: string;
  apiId: number | null;
  language: string;
  languageCode: string;
  translator: string;
  direction: 'ltr' | 'rtl';
  defaultFont: string;
  flag: string;
  isPopular?: boolean;
}

export interface VisualStylePreset {
  id: string;
  userId?: string;
  name: string;
  category: 'quranic_calligraphy' | 'caption_style' | 'relighting_effects' | 'full_theme';
  createdAt: string;
  updatedAt: string;
  isFirestoreSynced?: boolean;
  styleConfig: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    textStyle?: 'normal' | 'shadow' | 'outline' | 'neon' | 'gold-glow' | 'viral-reels';
    textGlowColor?: string;
    textGlowIntensity?: number;
    textStrokeColor?: string;
    textStrokeWidth?: number;
    text3D?: {
      metallicBorder?: boolean;
      dropShadowBlur?: number;
      depth3D?: number;
      neonGlowColor?: string;
    };
    relightingStyle?: 'amber-glow' | 'neon-cyan' | 'studio-sunset' | 'quran-gold';
    relightingIntensity?: number;
    ayahSymbolStyle?: AyahSymbolStyle;
    watermark?: WatermarkSettings;
  };
}

export type TextAnimationIn =
  | 'none'
  | 'fade'
  | 'pop'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'typewriter'
  | 'bounce'
  | 'zoom-in'
  | 'glitch';

export type TextAnimationOut =
  | 'none'
  | 'fade'
  | 'zoom-out'
  | 'slide-down'
  | 'slide-up'
  | 'slide-left'
  | 'slide-right';

export type TextAnimationLoop =
  | 'none'
  | 'pulse'
  | 'float'
  | 'shimmer'
  | 'bounce-loop';

export interface TextAnimationConfig {
  inAnimation?: TextAnimationIn;
  inDuration?: number; // In animation duration in seconds (0.1 - 2.0s)
  outAnimation?: TextAnimationOut;
  outDuration?: number; // Out animation duration in seconds (0.1 - 2.0s)
  loopAnimation?: TextAnimationLoop;
}


