export interface CapCutAudioItem {
  id: string;
  name: string;
  category: string;
  duration: number; // in seconds
  durationFormatted: string;
  url: string;
}

export interface CapCutStickerItem {
  id: string;
  name: string;
  category: 'trending' | 'emoji' | 'emphasis' | 'arrows' | 'celebration';
  emoji: string;
}

export interface CapCutEffectItem {
  id: string;
  name: string;
  category: 'trending' | 'opening' | 'lens' | 'retro' | 'party' | 'glitch';
  icon: string;
  color: string;
  description: string;
}

export interface CapCutTransitionItem {
  id: string;
  name: string;
  category: 'trending' | 'basic' | 'overlay' | 'light' | 'camera' | '3d';
  icon: string;
}

export interface CapCutFilterItem {
  id: string;
  name: string;
  category: 'featured' | 'life' | 'scenery' | 'movie' | 'retro' | 'night';
  previewColor: string;
  settings: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    sepia?: number;
  };
}

// Audio tracks directly from the CapCut video (at 0:08 and 1:25 - 1:36)
export const CAPCUT_AUDIO_TRACKS: CapCutAudioItem[] = [
  {
    id: 'cc-audio-summer-vlog',
    name: 'Summer Vlog',
    category: 'Trending',
    duration: 65,
    durationFormatted: '01:05',
    url: 'https://assets.mixkit.co/music/preview/mixkit-summer-fun-13.mp3',
  },
  {
    id: 'cc-audio-playful-beauty',
    name: 'Playful Beauty Lifestyle House',
    category: 'Trending',
    duration: 124,
    durationFormatted: '02:04',
    url: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3',
  },
  {
    id: 'cc-audio-tokyo-train',
    name: 'Tokyo Train Station BGM',
    category: 'Travel',
    duration: 92,
    durationFormatted: '01:32',
    url: 'https://assets.mixkit.co/music/preview/mixkit-raising-me-higher-34.mp3',
  },
  {
    id: 'cc-audio-coconut-groove',
    name: 'Coconut Groove',
    category: 'Summer',
    duration: 110,
    durationFormatted: '01:50',
    url: 'https://assets.mixkit.co/music/preview/mixkit-groovy-hip-hop-107.mp3',
  },
  {
    id: 'cc-audio-energetic-beach',
    name: 'Energetic Beach Workout House',
    category: 'Beat',
    duration: 88,
    durationFormatted: '01:28',
    url: 'https://assets.mixkit.co/music/preview/mixkit-energetic-hip-hop-834.mp3',
  },
  {
    id: 'cc-audio-lounge-bar',
    name: 'Lounge Bar Groove',
    category: 'Lo-fi',
    duration: 140,
    durationFormatted: '02:20',
    url: 'https://assets.mixkit.co/music/preview/mixkit-chill-bro-494.mp3',
  },
  {
    id: 'cc-audio-morning-coffee',
    name: 'Morning Coffee Acoustic',
    category: 'Vlog',
    duration: 75,
    durationFormatted: '01:15',
    url: 'https://assets.mixkit.co/music/preview/mixkit-acoustic-guitars-ambient-uplift-29.mp3',
  },
  {
    id: 'cc-audio-pop-dance',
    name: 'Neon Pop Dance Glow',
    category: 'Pop',
    duration: 105,
    durationFormatted: '01:45',
    url: 'https://assets.mixkit.co/music/preview/mixkit-dance-with-me-3.mp3',
  },
];

// Stickers from CapCut video (at 0:15 - 0:18)
export const CAPCUT_STICKERS: CapCutStickerItem[] = [
  { id: 'st-fire', name: 'Trending Fire', category: 'trending', emoji: '🔥' },
  { id: 'st-sparkles', name: 'Magic Sparkles', category: 'trending', emoji: '✨' },
  { id: 'st-star', name: 'Golden Star', category: 'trending', emoji: '⭐' },
  { id: 'st-100', name: 'Hundred Percent', category: 'trending', emoji: '💯' },
  { id: 'st-rocket', name: 'Viral Rocket', category: 'trending', emoji: '🚀' },
  { id: 'st-heart', name: 'Red Heart', category: 'emoji', emoji: '❤️' },
  { id: 'st-laugh', name: 'Joy Laugh', category: 'emoji', emoji: '😂' },
  { id: 'st-cool', name: 'Sunglasses Cool', category: 'emoji', emoji: '😎' },
  { id: 'st-fire-eyes', name: 'Heart Eyes', category: 'emoji', emoji: '😍' },
  { id: 'st-bell', name: 'Subscribe Bell', category: 'emphasis', emoji: '🔔' },
  { id: 'st-target', name: 'Target Bullseye', category: 'emphasis', emoji: '🎯' },
  { id: 'st-warn', name: 'Attention Alert', category: 'emphasis', emoji: '⚠️' },
  { id: 'st-arrow-r', name: 'Arrow Right', category: 'arrows', emoji: '➡️' },
  { id: 'st-arrow-l', name: 'Arrow Left', category: 'arrows', emoji: '⬅️' },
  { id: 'st-arrow-u', name: 'Arrow Up', category: 'arrows', emoji: '⬆️' },
  { id: 'st-arrow-d', name: 'Arrow Down', category: 'arrows', emoji: '⬇️' },
  { id: 'st-party', name: 'Party Popper', category: 'celebration', emoji: '🎉' },
  { id: 'st-crown', name: 'Gold Crown', category: 'celebration', emoji: '👑' },
  { id: 'st-trophy', name: 'Winner Trophy', category: 'celebration', emoji: '🏆' },
];

// Effects from CapCut video (at 0:20 - 0:24)
export const CAPCUT_EFFECTS: CapCutEffectItem[] = [
  { id: 'eff-opening-art', name: 'Opening Art', category: 'opening', icon: '🎭', color: '#06b6d4', description: 'Cinematic art curtains opening' },
  { id: 'eff-vertical-open', name: 'Vertical Open', category: 'opening', icon: '↕️', color: '#3b82f6', description: 'Split vertical shutter opening' },
  { id: 'eff-prickle-warp', name: 'Prickle + Warp', category: 'trending', icon: '🌀', color: '#a855f7', description: 'Dynamic lens warp distortion' },
  { id: 'eff-flower-drop', name: 'Flower Drop', category: 'trending', icon: '🌸', color: '#ec4899', description: 'Floating petals visual ambiance' },
  { id: 'eff-halos', name: 'Halos', category: 'lens', icon: '💫', color: '#facc15', description: 'Anamorphic golden halo light' },
  { id: 'eff-heaven-light', name: 'Heaven Light', category: 'lens', icon: '✨', color: '#e0f2fe', description: 'Ethereal ray streaks' },
  { id: 'eff-war-arcade', name: 'War Arcade', category: 'retro', icon: '👾', color: '#f97316', description: 'Pixel 8-bit retro arcade vibe' },
  { id: 'eff-ember-veil', name: 'Ember Veil', category: 'party', icon: '🔥', color: '#ef4444', description: 'Floating cinematic embers and sparks' },
  { id: 'eff-crystal-wave', name: 'Crystal Wave', category: 'party', icon: '💎', color: '#06b6d4', description: 'Prismatic crystal refraction' },
  { id: 'eff-vision-grip', name: 'Vision Grip', category: 'trending', icon: '👁️', color: '#10b981', description: 'High-contrast edge surveillance' },
  { id: 'eff-vhs-glitch', name: 'VHS Glitch', category: 'glitch', icon: '📼', color: '#8b5cf6', description: 'Analog magnetic tape distortion' },
  { id: 'eff-film-grain', name: 'Film Grain 35mm', category: 'retro', icon: '🎞️', color: '#71717a', description: 'Organic silver halide grain' },
];

// Transitions from CapCut video (at 0:25 - 0:29)
export const CAPCUT_TRANSITIONS: CapCutTransitionItem[] = [
  { id: 'trans-overlap-fade', name: 'Overlap Fade', category: 'trending', icon: '🔀' },
  { id: 'trans-compartment', name: 'Compartment 2', category: 'trending', icon: '🪟' },
  { id: 'trans-paper-unfold', name: 'Paper Unfold', category: 'trending', icon: '📜' },
  { id: 'trans-fur-spread', name: 'Fur Spread', category: 'trending', icon: '🦚' },
  { id: 'trans-slide-left', name: 'Left Slide', category: 'basic', icon: '⬅️' },
  { id: 'trans-slide-right', name: 'Right Slide', category: 'basic', icon: '➡️' },
  { id: 'trans-push-up', name: 'Push Up', category: 'basic', icon: '⬆️' },
  { id: 'trans-clock-wipe', name: 'Clock Wipe', category: 'basic', icon: '🕒' },
  { id: 'trans-cross-dissolve', name: 'Cross Dissolve', category: 'overlay', icon: '🌫️' },
  { id: 'trans-light-leak', name: 'Light Leak Flash', category: 'light', icon: '⚡' },
  { id: 'trans-zoom-in', name: 'Zoom In 3D', category: 'camera', icon: '🔎' },
  { id: 'trans-flip-3d', name: 'Flip 3D', category: '3d', icon: '🔄' },
];

// Filters from CapCut video (at 0:36 - 0:42)
export const CAPCUT_FILTERS: CapCutFilterItem[] = [
  { id: 'filt-clean-vivid', name: 'Clean Vivid', category: 'featured', previewColor: '#38bdf8', settings: { brightness: 105, contrast: 110, saturation: 120 } },
  { id: 'filt-caramel-warm', name: 'Caramel Warm', category: 'featured', previewColor: '#f59e0b', settings: { brightness: 100, contrast: 105, saturation: 110, sepia: 25 } },
  { id: 'filt-cinematic-teal', name: 'Cinematic Teal', category: 'movie', previewColor: '#0d9488', settings: { brightness: 98, contrast: 118, saturation: 115 } },
  { id: 'filt-retro-90s', name: 'Retro 90s', category: 'retro', previewColor: '#d97706', settings: { brightness: 102, contrast: 112, saturation: 90, sepia: 40 } },
  { id: 'filt-nordic-chill', name: 'Nordic Chill', category: 'scenery', previewColor: '#60a5fa', settings: { brightness: 104, contrast: 100, saturation: 85 } },
  { id: 'filt-tokyo-night', name: 'Tokyo Night', category: 'night', previewColor: '#818cf8', settings: { brightness: 95, contrast: 125, saturation: 130 } },
  { id: 'filt-fresh-life', name: 'Fresh Life', category: 'life', previewColor: '#34d399', settings: { brightness: 106, contrast: 105, saturation: 115 } },
];
