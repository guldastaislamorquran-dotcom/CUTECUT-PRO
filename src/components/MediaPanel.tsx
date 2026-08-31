import React, { useState, useRef, useEffect } from 'react';
import { Upload, Film, Music, Type, Sliders, Play, Plus, Trash2, BookOpen, Sparkles, Terminal, Globe, ExternalLink, Search, Download, Shield, Image as ImageIcon, Brain, ChevronLeft, ChevronRight, Wand2, Zap, Eye, Flame, Cpu, Scissors, Activity, CheckCircle2, Layers, Volume2, Mic, RefreshCw, Languages, Check, Radio, Square } from 'lucide-react';
import { Clip, ClipType, Track, WatermarkSettings, QuranTranslationOption } from '../types';
import { STOCK_VIDEOS, STOCK_AUDIOS, STOCK_IMAGES, TEXT_PRESETS, PRESET_LUTS } from '../data/presetAssets';
import { AyahSymbolStyle, AyahDigitType, AyahSymbolPosition, formatAyahSymbol } from '../utils/editorUtils';
import { QURAN_TRANSLATION_OPTIONS, getTranslationOptionById, SUPPORTED_TRANSLATION_FONTS, getSuggestedFontsForLanguage } from '../utils/quranTranslations';
import OrnateAyahMedallion from './OrnateAyahMedallion';
import EffectsPanel from './EffectsPanel';
import { QuranVisualsPanel } from './QuranVisualsPanel';

/**
 * Asset URL Resolver Helper using Tauri's convertFileSrc API.
 * Safely bypasses cross-origin CORS rules and webview sandboxing restrictions
 * for both local file paths and external streams in Tauri desktop production builds.
 */
export function resolveTauriAssetUrl(pathOrUrl: string | undefined): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('blob:') || pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('content:')) {
    return pathOrUrl;
  }

  if (typeof window !== 'undefined') {
    // Check window.__TAURI__ global convertFileSrc
    const tauriGlobal = (window as any).__TAURI__;
    if (tauriGlobal && tauriGlobal.tauri && typeof tauriGlobal.tauri.convertFileSrc === 'function') {
      try {
        if (!pathOrUrl.startsWith('http://') && !pathOrUrl.startsWith('https://')) {
          return tauriGlobal.tauri.convertFileSrc(pathOrUrl);
        }
      } catch (err) {
        console.warn('convertFileSrc global failed', err);
      }
    }
  }

  return pathOrUrl;
}

/**
 * Safe external URL opener for Tauri native shell or browser fallback.
 */
export async function openExternalUrl(url: string) {
  if (!url) return;
  try {
    if (typeof window !== 'undefined' && (window as any).__TAURI__?.shell?.open) {
      await (window as any).__TAURI__.shell.open(url);
      return;
    }
    const shellPkg = '@tauri-apps/api/shell';
    const tauriShell = await import(/* @vite-ignore */ shellPkg).catch(() => null);
    if (tauriShell && typeof tauriShell.open === 'function') {
      await tauriShell.open(url);
      return;
    }
  } catch (e) {
    console.warn('Failed opening external shell url', e);
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export const SURAHS = [
  { id: 1, name: '1. Al-Fatihah (The Opening)' },
  { id: 2, name: '2. Al-Baqarah (The Cow)' },
  { id: 3, name: '3. Ali \'Imran (Family of Imran)' },
  { id: 4, name: '4. An-Nisa (The Women)' },
  { id: 5, name: '5. Al-Ma\'idah (The Table Spread)' },
  { id: 6, name: '6. Al-An\'am (The Cattle)' },
  { id: 7, name: '7. Al-A\'raf (The Heights)' },
  { id: 8, name: '8. Al-Anfal (The Spoils of War)' },
  { id: 9, name: '9. At-Tawbah (The Repentance)' },
  { id: 10, name: '10. Yunus (Jonah)' },
  { id: 11, name: '11. Hud (Hud)' },
  { id: 12, name: '12. Yusuf (Joseph)' },
  { id: 13, name: '13. Ar-Ra\'d (The Thunder)' },
  { id: 14, name: '14. Ibrahim (Abraham)' },
  { id: 15, name: '15. Al-Hijr (The Rocky Tract)' },
  { id: 16, name: '16. An-Nahl (The Bee)' },
  { id: 17, name: '17. Al-Isra (The Night Journey)' },
  { id: 18, name: '18. Al-Kahf (The Cave)' },
  { id: 19, name: '19. Maryam (Mary)' },
  { id: 20, name: '20. Taha (Taha)' },
  { id: 21, name: '21. Al-Anbiya (The Prophets)' },
  { id: 22, name: '22. Al-Hajj (The Pilgrimage)' },
  { id: 23, name: '23. Al-Mu\'minun (The Believers)' },
  { id: 24, name: '24. An-Nur (The Light)' },
  { id: 25, name: '25. Al-Furqan (The Criterian)' },
  { id: 26, name: '26. Ash-Shu\'ara (The Poets)' },
  { id: 27, name: '27. An-Naml (The Ant)' },
  { id: 28, name: '28. Al-Qasas (The Stories)' },
  { id: 29, name: '29. Al-\'Ankabut (The Spider)' },
  { id: 30, name: '30. Ar-Rum (The Romans)' },
  { id: 31, name: '31. Luqman (Luqman)' },
  { id: 32, name: '32. As-Sajdah (The Prostration)' },
  { id: 33, name: '33. Al-Ahzab (The Combined Forces)' },
  { id: 34, name: '34. Saba (Sheba)' },
  { id: 35, name: '35. Fatir (Originator)' },
  { id: 36, name: '36. Ya-Sin (Ya-Sin)' },
  { id: 37, name: '37. As-Saffat (Those Who Set The Ranks)' },
  { id: 38, name: '38. Sad (Sad)' },
  { id: 39, name: '39. Az-Zumar (The Troops)' },
  { id: 40, name: '40. Ghafir (The Forgiver)' },
  { id: 41, name: '41. Fussilat (Explained In Detail)' },
  { id: 42, name: '42. Ash-Shura (The Consultation)' },
  { id: 43, name: '43. Az-Zukhruf (The Ornaments of Gold)' },
  { id: 44, name: '44. Ad-Dukhan (The Smoke)' },
  { id: 45, name: '45. Al-Jathiyah (The Crouching)' },
  { id: 46, name: '46. Al-Ahqaf (The Wind-Curved Sandhills)' },
  { id: 47, name: '47. Muhammad (Muhammad)' },
  { id: 48, name: '48. Al-Fath (The Victory)' },
  { id: 49, name: '49. Al-Hujurat (The Rooms)' },
  { id: 50, name: '50. Qaf (Qaf)' },
  { id: 51, name: '51. Adh-Dhariyat (The Winnowing Winds)' },
  { id: 52, name: '52. At-Tur (The Mount)' },
  { id: 53, name: '53. An-Najm (The Star)' },
  { id: 54, name: '54. Al-Qamar (The Moon)' },
  { id: 55, name: '55. Ar-Rahman (The Beneficent)' },
  { id: 56, name: '56. Al-Waqi\'ah (The Inevitable)' },
  { id: 57, name: '57. Al-Hadid (The Iron)' },
  { id: 58, name: '58. Al-Mujadila (The Pleading Woman)' },
  { id: 59, name: '59. Al-Hashr (The Exile)' },
  { id: 60, name: '60. Al-Mumtahanah (She That Is To Be Examined)' },
  { id: 61, name: '61. As-Saff (The Ranks)' },
  { id: 62, name: '62. Al-Jumu\'ah (The Congregation)' },
  { id: 63, name: '63. Al-Munafiqun (The Hypocrites)' },
  { id: 64, name: '64. At-Taghabun (The Mutual Disillusion)' },
  { id: 65, name: '65. At-Talaq (The Divorce)' },
  { id: 66, name: '66. At-Tahrim (The Prohibition)' },
  { id: 67, name: '67. Al-Mulk (The Sovereignty)' },
  { id: 68, name: '68. Al-Qalam (The Pen)' },
  { id: 69, name: '69. Al-Haqqah (The Inevitable Reality)' },
  { id: 70, name: '70. Al-Ma\'arij (The Ascending Stairways)' },
  { id: 71, name: '71. Nuh (Noah)' },
  { id: 72, name: '72. Al-Jinn (The Jinn)' },
  { id: 73, name: '73. Al-Muzzammil (The Enshrouded One)' },
  { id: 74, name: '74. Al-Muddaththir (The Cloaked One)' },
  { id: 75, name: '75. Al-Qiyamah (The Resurrection)' },
  { id: 76, name: '76. Al-Insan (The Man)' },
  { id: 77, name: '77. Al-Mursalat (Those Sent Forth)' },
  { id: 78, name: '78. An-Naba (The Tidings)' },
  { id: 79, name: '79. An-Nazi\'at (Those Who Drag Forth)' },
  { id: 80, name: '80. \'Abasa (He Frowned)' },
  { id: 81, name: '81. At-Takwir (The Overthrowing)' },
  { id: 82, name: '82. Al-Infitar (The Cleaving)' },
  { id: 83, name: '83. Al-Mutaffifin (The Defrauding)' },
  { id: 84, name: '84. Al-Inshiqaq (The Sundering)' },
  { id: 85, name: '85. Al-Buruj (The Mansions of the Stars)' },
  { id: 86, name: '86. At-Tariq (The Nightcomer)' },
  { id: 87, name: '87. Al-A\'la (The Most High)' },
  { id: 88, name: '88. Al-Ghashiyah (The Overwhelming)' },
  { id: 89, name: '89. Al-Fajr (The Dawn)' },
  { id: 90, name: '90. Al-Balad (The City)' },
  { id: 91, name: '91. Ash-Shams (The Sun)' },
  { id: 92, name: '92. Al-Layl (The Night)' },
  { id: 93, name: '93. Ad-Duhaa (The Morning Hours)' },
  { id: 94, name: '94. Ash-Sharh (The Relief)' },
  { id: 95, name: '95. At-Tin (The Fig)' },
  { id: 96, name: '96. Al-\'Alaq (The Clot)' },
  { id: 97, name: '97. Al-Qadr (The Power)' },
  { id: 98, name: '98. Al-Bayyinah (The Clear Proof)' },
  { id: 99, name: '99. Az-Zalzalah (The Earthquake)' },
  { id: 100, name: '100. Al-\'Adiyat (The Courser)' },
  { id: 101, name: '101. Al-Qari\'ah (The Calamity)' },
  { id: 102, name: '102. At-Takathur (The Rivalry in World Increase)' },
  { id: 103, name: '103. Al-\'Asr (The Declining Day)' },
  { id: 104, name: '104. Al-Humazah (The Traducer)' },
  { id: 105, name: '105. Al-Fil (The Elephant)' },
  { id: 106, name: '106. Quraysh (Quraysh)' },
  { id: 107, name: '107. Al-Ma\'un (The Small Kindnesses)' },
  { id: 108, name: '108. Al-Kawthar (The Abundance)' },
  { id: 109, name: '109. Al-Kafirun (The Disbelievers)' },
  { id: 110, name: '110. An-Nasr (The Divine Support)' },
  { id: 111, name: '111. Al-Masad (The Palm Fiber)' },
  { id: 112, name: '112. Al-Ikhlas (Sincerity)' },
  { id: 113, name: '113. Al-Falaq (The Daybreak)' },
  { id: 114, name: '114. An-Nas (Mankind)' }
];

interface MediaPanelProps {
  onAddClip: (clipData: Partial<Clip>) => void;
  selectedAspectRatio: string;
  tracks: Track[];
  onAlignQuran: (params: {
    surah: number | string;
    startAyah: number;
    mode: 'individual' | 'batch';
    style: string;
    selectionType?: 'single' | 'range' | 'list' | 'all';
    surahEnd?: number;
    surahList?: string;
    introMode?: 'both' | 'taawwuz-only' | 'bismillah-only' | 'none';
  }) => Promise<void> | void;
  aligningStatus: {
    status: 'idle' | 'running' | 'success' | 'error';
    progress: number;
    log: string[];
  } | null;
  quranArabicFont: string;
  setQuranArabicFont: (f: string) => void;
  quranArabicSize: number;
  setQuranArabicSize: (s: number) => void;
  quranArabicColor: string;
  setQuranArabicColor: (c: string) => void;
  quranArabicStyle: 'normal' | 'shadow' | 'outline' | 'neon' | 'gold-glow' | 'viral-reels';
  setQuranArabicStyle: (s: 'normal' | 'shadow' | 'outline' | 'neon' | 'gold-glow' | 'viral-reels') => void;
  quranArabicY: number;
  setQuranArabicY: (y: number) => void;
  quranArabicWrap: boolean;
  setQuranArabicWrap: (w: boolean) => void;
  quranArabicMaxWidth: number;
  setQuranArabicMaxWidth: (w: number) => void;
  quranArabicLineHeight: number;
  setQuranArabicLineHeight: (lh: number) => void;
  quranArabicAlign: 'left' | 'center' | 'right';
  setQuranArabicAlign: (a: 'left' | 'center' | 'right') => void;
  quranAyahSymbolStyle?: AyahSymbolStyle;
  setQuranAyahSymbolStyle?: (s: AyahSymbolStyle) => void;
  quranAyahDigitType?: AyahDigitType;
  setQuranAyahDigitType?: (d: AyahDigitType) => void;
  quranAyahSymbolPosition?: AyahSymbolPosition;
  setQuranAyahSymbolPosition?: (p: AyahSymbolPosition) => void;
  quranShowAyahSymbol?: boolean;
  setQuranShowAyahSymbol?: (s: boolean) => void;
  quranEnglishFont: string;
  setQuranEnglishFont: (f: string) => void;
  quranEnglishSize: number;
  setQuranEnglishSize: (s: number) => void;
  quranEnglishColor: string;
  setQuranEnglishColor: (c: string) => void;
  quranEnglishStyle: 'normal' | 'shadow' | 'outline' | 'neon' | 'gold-glow' | 'viral-reels';
  setQuranEnglishStyle: (s: 'normal' | 'shadow' | 'outline' | 'neon' | 'gold-glow' | 'viral-reels') => void;
  quranEnglishY: number;
  setQuranEnglishY: (y: number) => void;
  quranEnglishUppercase: boolean;
  setQuranEnglishUppercase: (u: boolean) => void;
  quranEnglishWrap: boolean;
  setQuranEnglishWrap: (w: boolean) => void;
  quranEnglishMaxWidth: number;
  setQuranEnglishMaxWidth: (w: number) => void;
  quranEnglishLineHeight: number;
  setQuranEnglishLineHeight: (lh: number) => void;
  quranEnglishAlign: 'left' | 'center' | 'right';
  setQuranEnglishAlign: (a: 'left' | 'center' | 'right') => void;
  quranTranslation?: string;
  setQuranTranslation?: (t: string) => void;
  quranIntroMode?: 'both' | 'taawwuz-only' | 'bismillah-only' | 'none';
  setQuranIntroMode?: (m: 'both' | 'taawwuz-only' | 'bismillah-only' | 'none') => void;
  quranBreathSegmentationMode?: 'full-ayah' | 'split-breaths';
  setQuranBreathSegmentationMode?: (m: 'full-ayah' | 'split-breaths') => void;
  onReplaceBismillahWithTabarakallazi?: () => void;
  onApplyTranslationToTimeline?: (translationId?: string) => Promise<void> | void;
  onApplyQuranStyles: (customParams?: any) => void;
  onApplyGlobalFontSize?: (size: number) => void;
  onApplyGlobalTextCase?: (casing: 'uppercase' | 'lowercase' | 'capitalize') => void;
  onOpenAISegmentation?: () => void;
  watermark?: WatermarkSettings;
  setWatermark?: React.Dispatch<React.SetStateAction<WatermarkSettings>>;
  width?: number;
  selectedClip?: Clip | null;
  onUpdateClip?: (clipId: string, updates: Partial<Clip>) => void;

  // Auto-Segmentation & Acoustic Analysis Suite
  onAutoSegmentAudio?: (
    clipId?: string,
    sensitivity?: 'quran-ayah' | 'studio' | 'mosque' | 'tartil' | 'hadr' | 'custom',
    customOptions?: {
      minSilenceMs?: number;
      minSpeechMs?: number;
      startAyahNumber?: number;
      gapHandling?: 'preserve-gaps' | 'bridge-seamless';
      paddingMs?: number;
    }
  ) => void;
  onAutoSyncVideoToAyahs?: () => void;
  onAutoRemoveSilence?: (clipId?: string) => void;
  onAutoSegmentRhythm?: (clipId?: string, interval?: number) => void;
  onReplaceVideoTrackClips?: (clips: Partial<Clip>[]) => void;
  currentTime?: number;
}

export default function MediaPanel({
  onAddClip,
  selectedAspectRatio,
  tracks,
  onAlignQuran,
  aligningStatus,
  quranArabicFont,
  setQuranArabicFont,
  quranArabicSize,
  setQuranArabicSize,
  quranArabicColor,
  setQuranArabicColor,
  quranArabicStyle,
  setQuranArabicStyle,
  quranArabicY,
  setQuranArabicY,
  quranArabicWrap,
  setQuranArabicWrap,
  quranArabicMaxWidth,
  setQuranArabicMaxWidth,
  quranArabicLineHeight,
  setQuranArabicLineHeight,
  quranArabicAlign,
  setQuranArabicAlign,
  quranAyahSymbolStyle = 'uthmani-circle',
  setQuranAyahSymbolStyle,
  quranAyahDigitType = 'arabic',
  setQuranAyahDigitType,
  quranAyahSymbolPosition = 'end',
  setQuranAyahSymbolPosition,
  quranShowAyahSymbol = true,
  setQuranShowAyahSymbol,
  quranEnglishFont,
  setQuranEnglishFont,
  quranEnglishSize,
  setQuranEnglishSize,
  quranEnglishColor,
  setQuranEnglishColor,
  quranEnglishStyle,
  setQuranEnglishStyle,
  quranEnglishY,
  setQuranEnglishY,
  quranEnglishUppercase,
  setQuranEnglishUppercase,
  quranEnglishWrap,
  setQuranEnglishWrap,
  quranEnglishMaxWidth,
  setQuranEnglishMaxWidth,
  quranEnglishLineHeight,
  setQuranEnglishLineHeight,
  quranEnglishAlign,
  setQuranEnglishAlign,
  quranTranslation = 'ur-jalandhry',
  setQuranTranslation,
  quranIntroMode = 'none',
  setQuranIntroMode,
  quranBreathSegmentationMode = 'split-breaths',
  setQuranBreathSegmentationMode,
  onReplaceBismillahWithTabarakallazi,
  onApplyTranslationToTimeline,
  onApplyQuranStyles,
  onApplyGlobalFontSize,
  onApplyGlobalTextCase,
  onOpenAISegmentation,
  watermark,
  setWatermark,
  width,
  selectedClip,
  onUpdateClip,
  onAutoSegmentAudio,
  onAutoSyncVideoToAyahs,
  onAutoRemoveSilence,
  onAutoSegmentRhythm,
  onReplaceVideoTrackClips,
  currentTime = 0,
}: MediaPanelProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'video' | 'audio' | 'image' | 'text' | 'quran-visuals' | 'quran' | 'effects' | 'background' | 'watermark'>('upload');
  const [customAssets, setCustomAssets] = useState<any[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Acoustic Sensitivity State
  const [audioSensitivity, setAudioSensitivity] = useState<'quran-ayah' | 'studio' | 'mosque' | 'tartil' | 'hadr' | 'custom'>('quran-ayah');
  const [customMinSilenceMs, setCustomMinSilenceMs] = useState(480);
  const [customStartAyah, setCustomStartAyah] = useState(1);
  const [gapHandlingMode, setGapHandlingMode] = useState<'preserve-gaps' | 'bridge-seamless'>('preserve-gaps');
  const [silencePaddingMs, setSilencePaddingMs] = useState(120);
  const [isSegmentingAudio, setIsSegmentingAudio] = useState(false);
  const [isSyncingVideo, setIsSyncingVideo] = useState(false);

  // Live Microphone Voiceover Recorder State
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [micRecordingTime, setMicRecordingTime] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micTimerRef = useRef<any>(null);
  const micChunksRef = useRef<Blob[]>([]);

  const startMicRecording = async () => {
    setMicError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone recording is not supported in this browser environment.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      micChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          micChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(micChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const recordDuration = Math.max(1, micRecordingTime);

        const fileId = `voiceover-${Date.now()}`;
        const newAsset = {
          id: fileId,
          name: `Voiceover Recording (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})`,
          type: 'audio',
          url: audioUrl,
          duration: recordDuration,
          thumbnail: '🎙️',
          size: `${(audioBlob.size / (1024 * 1024)).toFixed(2)} MB`
        };

        setCustomAssets(prev => [newAsset, ...prev]);

        // Auto Add to Timeline Audio track
        onAddClip({
          name: newAsset.name,
          type: ClipType.AUDIO,
          url: audioUrl,
          duration: recordDuration,
          sourceStart: 0,
          sourceDuration: recordDuration,
          playbackRate: 1.0,
          volume: 1.0
        });

        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach(t => t.stop());
          micStreamRef.current = null;
        }
      };

      recorder.start(100);
      setIsRecordingMic(true);
      setMicRecordingTime(0);

      if (micTimerRef.current) clearInterval(micTimerRef.current);
      micTimerRef.current = setInterval(() => {
        setMicRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Mic recording error:', err);
      setMicError(err.message || 'Microphone access denied or unreadable.');
      setIsRecordingMic(false);
    }
  };

  const stopMicRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (micTimerRef.current) {
      clearInterval(micTimerRef.current);
      micTimerRef.current = null;
    }
    setIsRecordingMic(false);
  };

  useEffect(() => {
    return () => {
      if (micTimerRef.current) clearInterval(micTimerRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Translation Suite Internal UI State
  const [isApplyingTranslation, setIsApplyingTranslation] = useState<boolean>(false);
  const [translationToast, setTranslationToast] = useState<string | null>(null);
  const [translationSearchQuery, setTranslationSearchQuery] = useState<string>('');

  const currentTranslation = getTranslationOptionById(quranTranslation);

  const handleSelectTranslation = async (transId: string, autoApplyToTimeline: boolean = false) => {
    if (setQuranTranslation) {
      setQuranTranslation(transId);
    }
    const opt = getTranslationOptionById(transId);
    
    // Auto adapt Translation font to optimal script font for the selected language
    if (opt.defaultFont) {
      setQuranEnglishFont(opt.defaultFont);
      onApplyQuranStyles({ englishFont: opt.defaultFont });
    }

    if (autoApplyToTimeline && onApplyTranslationToTimeline) {
      setIsApplyingTranslation(true);
      try {
        await onApplyTranslationToTimeline(transId);
        setTranslationToast(`✓ Applied ${opt.language} (${opt.translator}) to Timeline!`);
        setTimeout(() => setTranslationToast(null), 3500);
      } finally {
        setIsApplyingTranslation(false);
      }
    }
  };

  const handleTriggerApplyTranslation = async () => {
    if (!onApplyTranslationToTimeline) return;
    setIsApplyingTranslation(true);
    try {
      await onApplyTranslationToTimeline(quranTranslation);
      setTranslationToast(`✓ Applied ${currentTranslation.language} (${currentTranslation.translator}) to Timeline!`);
      setTimeout(() => setTranslationToast(null), 3500);
    } finally {
      setIsApplyingTranslation(false);
    }
  };

  // Global Typography & Text Transformation Suite state
  const [globalFontSize, setGlobalFontSize] = useState<number>(24);
  const [activeTextCase, setActiveTextCase] = useState<'uppercase' | 'lowercase' | 'capitalize' | null>(null);

  const handleGlobalFontSizeChange = (size: number) => {
    const validSize = Math.max(10, Math.min(80, size));
    setGlobalFontSize(validSize);
    if (onApplyGlobalFontSize) {
      onApplyGlobalFontSize(validSize);
    } else {
      onApplyQuranStyles({
        arabicSize: Math.max(16, Math.round(validSize * 1.35)),
        englishSize: validSize
      });
    }
  };

  const handleGlobalTextCaseChange = (casing: 'uppercase' | 'lowercase' | 'capitalize') => {
    setActiveTextCase(casing);
    if (onApplyGlobalTextCase) {
      onApplyGlobalTextCase(casing);
    } else {
      onApplyQuranStyles({
        englishUppercase: casing === 'uppercase'
      });
    }
  };

  // Tab horizontal scroll & bottom slider state
  const tabsRef = useRef<HTMLDivElement>(null);
  const [tabScrollPercent, setTabScrollPercent] = useState<number>(0);

  const handleTabScroll = () => {
    if (!tabsRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      setTabScrollPercent((scrollLeft / maxScroll) * 100);
    } else {
      setTabScrollPercent(0);
    }
  };

  const handleBottomSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setTabScrollPercent(val);
    if (tabsRef.current) {
      const { scrollWidth, clientWidth } = tabsRef.current;
      const maxScroll = scrollWidth - clientWidth;
      tabsRef.current.scrollLeft = (val / 100) * maxScroll;
    }
  };

  useEffect(() => {
    if (!tabsRef.current) return;
    const activeBtn = tabsRef.current.querySelector(`#tab-${activeTab}`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  // Quran Form states
  const [quranSurahPreset, setQuranSurahPreset] = useState<string>('67');
  const [quranSurahCustom, setQuranSurahCustom] = useState<number>(67);
  const [quranSelectionType, setQuranSelectionType] = useState<'single' | 'range' | 'list' | 'all'>('all');
  const [quranSurahEnd, setQuranSurahEnd] = useState<number>(3);
  const [quranSurahList, setQuranSurahList] = useState<string>('112, 113, 114');
  const [quranStartAyah, setQuranStartAyah] = useState<number>(1);
  const [quranMode, setQuranMode] = useState<'individual' | 'batch'>('batch');
  const [quranStyle, setQuranStyle] = useState<string>('Imperial Gold');
  const [styleAppliedNotice, setStyleAppliedNotice] = useState<string | null>(null);
  const [bgSearchQuery, setBgSearchQuery] = useState<string>('');
  const [bgMediaType, setBgMediaType] = useState<'video' | 'image'>('video');

  const handleOpenExternalUrl = async (url: string) => {
    await openExternalUrl(url);
  };

  const handleStylePresetChange = (presetName: string) => {
    setQuranStyle(presetName);
    if (presetName === 'Neon Glow') {
      setQuranArabicFont('Amiri');
      setQuranArabicSize(32);
      setQuranArabicColor('#00ffff');
      setQuranArabicStyle('neon');
      setQuranArabicY(35);

      setQuranEnglishFont('Space Grotesk');
      setQuranEnglishSize(22);
      setQuranEnglishColor('#ff00ff');
      setQuranEnglishStyle('neon');
      setQuranEnglishY(72);
      setQuranEnglishUppercase(true);

      onApplyQuranStyles({
        arabicFont: 'Amiri',
        arabicSize: 32,
        arabicColor: '#00ffff',
        arabicStyle: 'neon',
        arabicY: 35,
        englishFont: 'Space Grotesk',
        englishSize: 22,
        englishColor: '#ff00ff',
        englishStyle: 'neon',
        englishY: 72,
        englishUppercase: true
      });
    } else if (presetName === 'Imperial Gold') {
      setQuranArabicFont('Amiri');
      setQuranArabicSize(36);
      setQuranArabicColor('#ffd700');
      setQuranArabicStyle('outline');
      setQuranArabicY(35);

      setQuranEnglishFont('Inter');
      setQuranEnglishSize(20);
      setQuranEnglishColor('#ffffff');
      setQuranEnglishStyle('shadow');
      setQuranEnglishY(72);
      setQuranEnglishUppercase(false);

      onApplyQuranStyles({
        arabicFont: 'Amiri',
        arabicSize: 36,
        arabicColor: '#ffd700',
        arabicStyle: 'outline',
        arabicY: 35,
        englishFont: 'Inter',
        englishSize: 20,
        englishColor: '#ffffff',
        englishStyle: 'shadow',
        englishY: 72,
        englishUppercase: false
      });
    } else if (presetName === 'Subtle White') {
      setQuranArabicFont('Scheherazade New');
      setQuranArabicSize(32);
      setQuranArabicColor('#ffffff');
      setQuranArabicStyle('outline');
      setQuranArabicY(35);

      setQuranEnglishFont('Inter');
      setQuranEnglishSize(18);
      setQuranEnglishColor('#f3f4f6');
      setQuranEnglishStyle('shadow');
      setQuranEnglishY(72);
      setQuranEnglishUppercase(false);

      onApplyQuranStyles({
        arabicFont: 'Scheherazade New',
        arabicSize: 32,
        arabicColor: '#ffffff',
        arabicStyle: 'outline',
        arabicY: 35,
        englishFont: 'Inter',
        englishSize: 18,
        englishColor: '#f3f4f6',
        englishStyle: 'shadow',
        englishY: 72,
        englishUppercase: false
      });
    } else if (presetName === 'Chroma Green') {
      setQuranArabicFont('Amiri');
      setQuranArabicSize(34);
      setQuranArabicColor('#00ff00');
      setQuranArabicStyle('outline');
      setQuranArabicY(35);

      setQuranEnglishFont('Inter');
      setQuranEnglishSize(22);
      setQuranEnglishColor('#00ff00');
      setQuranEnglishStyle('outline');
      setQuranEnglishY(72);
      setQuranEnglishUppercase(false);

      onApplyQuranStyles({
        arabicFont: 'Amiri',
        arabicSize: 34,
        arabicColor: '#00ff00',
        arabicStyle: 'outline',
        arabicY: 35,
        englishFont: 'Inter',
        englishSize: 22,
        englishColor: '#00ff00',
        englishStyle: 'outline',
        englishY: 72,
        englishUppercase: false
      });
    }
  };

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the logger terminal
  useEffect(() => {
    if (activeTab === 'quran' && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aligningStatus?.log, activeTab]);

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  // Process uploaded files and probe their duration locally
  const handleFiles = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      const isImage = file.type.startsWith('image/');

      if (!isVideo && !isAudio && !isImage) {
        alert('Please upload a valid Video, Audio, or Image file.');
        return;
      }

      const fileId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

      if (isImage) {
        // Images don't need duration probing, default to 10 seconds
        const newAsset = {
          id: fileId,
          name: file.name,
          type: 'video', // treated as video clip on timeline
          isImage: true,
          url: url,
          duration: 10.0,
          thumbnail: '🖼️',
          size: (file.size / (1024 * 1024)).toFixed(1) + ' MB'
        };
        setCustomAssets(prev => [newAsset, ...prev]);
        setActiveTab('upload');
      } else {
        // Probe duration by loading it briefly
        const element = document.createElement(isVideo ? 'video' : 'audio');
        element.src = url;

        let resolved = false;

        const handleSuccess = () => {
          if (resolved) return;
          resolved = true;
          const duration = element.duration || 10;
          const newAsset = {
            id: fileId,
            name: file.name,
            type: isVideo ? 'video' : 'audio',
            url: url,
            duration: parseFloat(duration.toFixed(2)),
            thumbnail: isVideo ? '📹' : '🎵',
            size: (file.size / (1024 * 1024)).toFixed(1) + ' MB'
          };

          setCustomAssets(prev => [newAsset, ...prev]);
          setActiveTab('upload');
          cleanup();
        };

        const handleError = () => {
          if (resolved) return;
          resolved = true;
          // Fallback to 10s on error
          const newAsset = {
            id: fileId,
            name: file.name,
            type: isVideo ? 'video' : 'audio',
            url: url,
            duration: 10.0,
            thumbnail: isVideo ? '📹' : '🎵',
            size: (file.size / (1024 * 1024)).toFixed(1) + ' MB'
          };
          setCustomAssets(prev => [newAsset, ...prev]);
          setActiveTab('upload');
          cleanup();
        };

        const cleanup = () => {
          element.removeEventListener('loadedmetadata', handleSuccess);
          element.removeEventListener('error', handleError);
        };

        element.addEventListener('loadedmetadata', handleSuccess);
        element.addEventListener('error', handleError);

        // Safety timeout of 2.5 seconds in case loadedmetadata never fires
        setTimeout(() => {
          if (!resolved) {
            handleError();
          }
        }, 2500);
      }
    });
  };

  const addPresetVideo = (video: typeof STOCK_VIDEOS[0]) => {
    onAddClip({
      name: video.name,
      type: ClipType.VIDEO,
      url: video.url,
      duration: video.duration,
      sourceStart: 0,
      sourceDuration: video.duration,
      playbackRate: 1.0,
      volume: 1.0,
      filters: {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        grayscale: 0,
        sepia: 0,
        invert: 0,
        hueRotate: 0,
        chromaKey: {
          enabled: false,
          color: '#00ff00',
          threshold: 30,
          smoothness: 10
        }
      }
    });
  };

  const addPresetAudio = (audio: typeof STOCK_AUDIOS[0]) => {
    onAddClip({
      name: audio.name,
      type: ClipType.AUDIO,
      url: audio.url,
      duration: audio.duration,
      sourceStart: 0,
      sourceDuration: audio.duration,
      playbackRate: 1.0,
      volume: 1.0
    });
  };

  const addPresetImage = (image: typeof STOCK_IMAGES[0]) => {
    onAddClip({
      name: image.name,
      type: ClipType.IMAGE,
      url: image.url,
      duration: image.duration || 8,
      sourceStart: 0,
      sourceDuration: image.duration || 8,
      playbackRate: 1.0,
      volume: 1.0,
      isImage: true,
      filters: {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        grayscale: 0,
        sepia: 0,
        invert: 0,
        hueRotate: 0,
        chromaKey: {
          enabled: false,
          color: '#00ff00',
          threshold: 30,
          smoothness: 10
        }
      }
    });
  };

  const addPresetText = (preset: typeof TEXT_PRESETS[0]) => {
    onAddClip({
      name: preset.name,
      type: ClipType.TEXT,
      text: preset.text,
      fontSize: preset.size,
      color: preset.color,
      fontFamily: (preset as any).fontFamily || 'sans-serif',
      textStyle: preset.style as any,
      textX: 50,
      textY: 50,
      duration: 5, // Default 5 seconds
      sourceStart: 0,
      sourceDuration: 5,
      playbackRate: 1.0,
      volume: 1.0
    });
  };

  const deleteCustomAsset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomAssets(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div
      id="media-panel"
      className="bg-[#121216] border border-[#202028] rounded-xl flex flex-col h-full select-none overflow-hidden shadow-lg m-1 mr-0"
      style={{ width: width !== undefined ? `${width}px` : undefined }}
    >
      {/* Tab Navigation with Bottom Slider & Scroll Controls */}
      <div className="relative border-b border-[#2a2a30] bg-[#121216] flex flex-col">
        <div className="relative flex items-center">
          {/* Left Scroll Button */}
          <button
            onClick={() => {
              if (tabsRef.current) tabsRef.current.scrollBy({ left: -120, behavior: 'smooth' });
            }}
            className="absolute left-0 top-0 bottom-0 z-10 px-1 bg-gradient-to-r from-[#121216] via-[#121216]/90 to-transparent text-gray-400 hover:text-cyan-400 flex items-center justify-center transition"
            title="Scroll Tabs Left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Scrollable Tabs Container */}
          <div
            ref={tabsRef}
            onScroll={handleTabScroll}
            className="flex overflow-x-auto text-gray-400 text-[10px] select-none scroll-smooth px-5 py-1.5 gap-1 whitespace-nowrap custom-scrollbar"
            style={{ scrollbarWidth: 'thin' }}
          >
            <button
              id="tab-upload"
              onClick={() => setActiveTab('upload')}
              className={`shrink-0 px-3.5 py-2 rounded-lg flex flex-col items-center gap-1 transition ${activeTab === 'upload' ? 'text-cyan-400 bg-[#22222a] font-bold border border-cyan-500/30' : 'hover:text-white hover:bg-[#1a1a20]'}`}
            >
              <Upload className="w-4 h-4 text-cyan-400" />
              <span className="font-extrabold text-cyan-300">Upload</span>
            </button>

            <button
              id="tab-video"
              onClick={() => setActiveTab('video')}
              className={`shrink-0 px-3 py-2 rounded-lg flex flex-col items-center gap-1 transition ${activeTab === 'video' ? 'text-cyan-400 bg-[#22222a] font-bold border border-cyan-500/30' : 'hover:text-white hover:bg-[#1a1a20]'}`}
            >
              <Film className="w-4 h-4" />
              <span>Video</span>
            </button>

            <button
              id="tab-audio"
              onClick={() => setActiveTab('audio')}
              className={`shrink-0 px-3 py-2 rounded-lg flex flex-col items-center gap-1 transition ${activeTab === 'audio' ? 'text-cyan-400 bg-[#22222a] font-bold border border-cyan-500/30' : 'hover:text-white hover:bg-[#1a1a20]'}`}
            >
              <Music className="w-4 h-4" />
              <span>Audio</span>
            </button>

            <button
              id="tab-image"
              onClick={() => setActiveTab('image')}
              className={`shrink-0 px-3 py-2 rounded-lg flex flex-col items-center gap-1 transition ${activeTab === 'image' ? 'text-cyan-400 bg-[#22222a] font-bold border border-cyan-500/30' : 'hover:text-white hover:bg-[#1a1a20]'}`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Image</span>
            </button>

            <button
              id="tab-text"
              onClick={() => setActiveTab('text')}
              className={`shrink-0 px-3 py-2 rounded-lg flex flex-col items-center gap-1 transition ${activeTab === 'text' ? 'text-cyan-400 bg-[#22222a] font-bold border border-cyan-500/30' : 'hover:text-white hover:bg-[#1a1a20]'}`}
            >
              <Type className="w-4 h-4" />
              <span>Text</span>
            </button>

            <button
              id="tab-quran-visuals"
              onClick={() => setActiveTab('quran-visuals')}
              className={`shrink-0 px-3.5 py-2 rounded-lg flex flex-col items-center gap-1 transition ${activeTab === 'quran-visuals' ? 'text-emerald-400 bg-emerald-950/50 font-bold border border-emerald-500/50 shadow-md shadow-emerald-500/20' : 'text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-950/20'}`}
              title="AI Ayah Media & Background Scenery Generator"
            >
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="font-extrabold text-emerald-300">Ayah Visuals</span>
            </button>

            <button
              id="tab-quran"
              onClick={() => setActiveTab('quran')}
              className={`shrink-0 px-3.5 py-2 rounded-lg flex flex-col items-center gap-1 transition ${activeTab === 'quran' ? 'text-amber-400 bg-amber-950/40 font-bold border border-amber-500/50 shadow-md shadow-amber-500/10' : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-950/20'}`}
            >
              <BookOpen className="w-4 h-4 text-amber-400" />
              <span className="font-extrabold">Quran AI v4</span>
            </button>

            <button
              id="tab-effects"
              onClick={() => setActiveTab('effects')}
              className={`shrink-0 px-3 py-2 rounded-lg flex flex-col items-center gap-1 transition ${activeTab === 'effects' ? 'text-pink-400 bg-[#22222a] font-bold border border-pink-500/30' : 'hover:text-white hover:bg-[#1a1a20]'}`}
            >
              <Wand2 className="w-4 h-4 text-pink-400" />
              <span>Effect</span>
            </button>

            <button
              id="tab-background"
              onClick={() => setActiveTab('background')}
              className={`shrink-0 px-3 py-2 rounded-lg flex flex-col items-center gap-1 transition ${activeTab === 'background' ? 'text-emerald-400 bg-[#22222a] font-bold border border-emerald-500/30' : 'hover:text-white hover:bg-[#1a1a20]'}`}
            >
              <Globe className="w-4 h-4" />
              <span>Free BG</span>
            </button>

            <button
              id="tab-watermark"
              onClick={() => setActiveTab('watermark')}
              className={`shrink-0 px-3 py-2 rounded-lg flex flex-col items-center gap-1 transition ${activeTab === 'watermark' ? 'text-amber-400 bg-[#22222a] font-bold border border-amber-500/30' : 'hover:text-white hover:bg-[#1a1a20]'}`}
            >
              <Shield className="w-4 h-4" />
              <span>Watermark</span>
            </button>
          </div>

          {/* Right Scroll Button */}
          <button
            onClick={() => {
              if (tabsRef.current) tabsRef.current.scrollBy({ left: 120, behavior: 'smooth' });
            }}
            className="absolute right-0 top-0 bottom-0 z-10 px-1 bg-gradient-to-l from-[#121216] via-[#121216]/90 to-transparent text-gray-400 hover:text-cyan-400 flex items-center justify-center transition"
            title="Scroll Tabs Right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom Tab Navigation Slider */}
        <div className="px-3 pb-1.5 pt-0.5 flex items-center gap-2 bg-[#0e0e12] border-t border-[#1e1e26]">
          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider shrink-0">SLIDE TABS</span>
          <input
            id="tab-bottom-slider"
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={tabScrollPercent}
            onChange={handleBottomSliderChange}
            className="w-full h-1 bg-[#22222c] rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all"
            title="Slide to scroll navigation tabs"
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === 'video' && (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-400 tracking-wider">STOCK VIDEO LIBRARY</h3>
            <div className="grid grid-cols-1 gap-3">
              {STOCK_VIDEOS.map((video) => (
                <div
                  key={video.id}
                  id={`stock-video-${video.id}`}
                  className="group bg-[#202026] hover:bg-[#282830] rounded-lg p-2.5 flex items-center gap-3 transition cursor-pointer border border-transparent hover:border-gray-700"
                >
                  <div className="w-14 h-14 bg-slate-800 rounded flex items-center justify-center text-2xl relative overflow-hidden">
                    {video.thumbnail}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Play className="w-4 h-4 text-white fill-current" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{video.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded uppercase font-mono">{video.category}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{video.duration}s</span>
                    </div>
                  </div>
                  <button
                    id={`add-btn-${video.id}`}
                    onClick={() => addPresetVideo(video)}
                    className="p-1.5 rounded-md bg-[#2d2d38] hover:bg-cyan-500 hover:text-black transition"
                    title="Add to Timeline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="space-y-4">
            {/* Quran Ayah & Recitation Auto-Segmenter Tool */}
            <div className="bg-[#121218] border border-amber-500/40 rounded-xl p-3.5 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-wide">QURAN AYAH AUTO-SEGMENTER</h4>
                    <p className="text-[10px] text-amber-400/80">Acoustic Tajweed Waqf & Pause Detection</p>
                  </div>
                </div>
                <span className="text-[9px] font-mono font-bold bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  v4.0 Pro
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-300 font-semibold">Recitation Style & Sensitivity:</span>
                  <span className="text-amber-400 font-mono text-[10px]">
                    {audioSensitivity === 'quran-ayah' ? '🕌 Standard Ayah Waqf' :
                     audioSensitivity === 'tartil' ? '📖 Tartil (Slow & Madd)' :
                     audioSensitivity === 'hadr' ? '⚡ Hadr (Fast)' :
                     audioSensitivity === 'mosque' ? '🏛️ Mosque / Reverb' :
                     audioSensitivity === 'studio' ? '🎙️ Studio Speech' : '🎚️ Custom'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'quran-ayah', label: '🕌 Standard Ayah', desc: '480ms Waqf Gap' },
                    { id: 'tartil', label: '📖 Slow Tartil', desc: '600ms Deep Pause' },
                    { id: 'hadr', label: '⚡ Fast Hadr', desc: '340ms Short Pause' },
                    { id: 'mosque', label: '🏛️ Mosque Reverb', desc: 'Echo Rejection' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setAudioSensitivity(preset.id as any)}
                      className={`p-2 rounded-lg text-left transition border cursor-pointer ${
                        audioSensitivity === preset.id
                          ? 'bg-amber-500/20 border-amber-400 text-white font-bold'
                          : 'bg-[#1a1a24] border-gray-800 text-gray-300 hover:border-gray-700'
                      }`}
                    >
                      <p className="text-[11px] leading-tight">{preset.label}</p>
                      <p className={`text-[9px] mt-0.5 ${audioSensitivity === preset.id ? 'text-amber-300' : 'text-gray-500'}`}>
                        {preset.desc}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Optional Custom Silence Threshold Slider */}
                <div className="bg-[#0e0e14] p-2.5 rounded-lg border border-gray-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-400">Min Silence Gap:</span>
                    <span className="text-amber-400 font-mono font-bold">{customMinSilenceMs} ms</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="1200"
                    step="20"
                    value={customMinSilenceMs}
                    onChange={(e) => setCustomMinSilenceMs(parseInt(e.target.value, 10))}
                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                  <div className="flex justify-between text-[8px] text-gray-600 font-mono">
                    <span>Fast (200ms)</span>
                    <span>Standard (480ms)</span>
                    <span>Long (1200ms)</span>
                  </div>
                </div>

                {/* Silence Gap Handling Mode (وقف وسکوت) */}
                <div className="bg-[#0e0e14] p-2.5 rounded-lg border border-gray-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-300 font-semibold flex items-center gap-1">
                      <span>Silence Gap Behavior:</span>
                    </span>
                    <span className="text-[10px] font-mono text-amber-400">
                      {gapHandlingMode === 'preserve-gaps' ? '⏸️ Keep Silence Gaps' : '🔗 Continuous Audio'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGapHandlingMode('preserve-gaps')}
                      className={`p-2 rounded-lg text-left transition border cursor-pointer ${
                        gapHandlingMode === 'preserve-gaps'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                          : 'bg-[#161620] border-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <p className="text-[10px] font-bold flex items-center gap-1">
                        <span>⏸️ Leave Gaps</span>
                      </p>
                      <p className="text-[8px] text-gray-400 mt-0.5">
                        Preserves silence spaces between clips for easy editing & visuals snap
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGapHandlingMode('bridge-seamless')}
                      className={`p-2 rounded-lg text-left transition border cursor-pointer ${
                        gapHandlingMode === 'bridge-seamless'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                          : 'bg-[#161620] border-gray-800 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <p className="text-[10px] font-bold flex items-center gap-1">
                        <span>🔗 Seamless</span>
                      </p>
                      <p className="text-[8px] text-gray-400 mt-0.5">
                        Bridges audio tail to next verse start without timeline gaps
                      </p>
                    </button>
                  </div>

                  {/* Silence Padding Slider */}
                  <div className="pt-1 border-t border-gray-800/80 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-400">Silence Margin (Padding):</span>
                      <span className="text-amber-400 font-mono font-bold">±{silencePaddingMs} ms</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="400"
                      step="20"
                      value={silencePaddingMs}
                      onChange={(e) => setSilencePaddingMs(parseInt(e.target.value, 10))}
                      className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                    <div className="flex justify-between text-[8px] text-gray-600 font-mono">
                      <span>Tight (0ms)</span>
                      <span>Default (120ms)</span>
                      <span>Spacious (400ms)</span>
                    </div>
                  </div>
                </div>

                {/* Starting Ayah Number input */}
                <div className="flex items-center justify-between bg-[#0e0e14] p-2 rounded-lg border border-gray-800 text-[11px]">
                  <span className="text-gray-300">First Ayah Number:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500 font-mono">Start at:</span>
                    <input
                      type="number"
                      min="1"
                      max="286"
                      value={customStartAyah}
                      onChange={(e) => setCustomStartAyah(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-14 bg-black border border-amber-500/40 rounded px-2 py-0.5 text-xs text-amber-300 font-mono text-center focus:outline-none"
                    />
                  </div>
                </div>

                {/* Auto-Segment Action Button */}
                <button
                  type="button"
                  id="btn-trigger-auto-segment-audio"
                  onClick={async () => {
                    if (onAutoSegmentAudio) {
                      setIsSegmentingAudio(true);
                      try {
                        await onAutoSegmentAudio(selectedClip?.id, audioSensitivity, {
                          minSilenceMs: customMinSilenceMs,
                          startAyahNumber: customStartAyah,
                          gapHandling: gapHandlingMode,
                          paddingMs: silencePaddingMs,
                        });
                      } finally {
                        setIsSegmentingAudio(false);
                      }
                    }
                  }}
                  disabled={isSegmentingAudio}
                  className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-lg text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSegmentingAudio ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Scanning Recitation & Segmenting Ayahs...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>⚡ Auto-Segment Audio into Ayahs on Timeline</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <h3 className="text-xs font-semibold text-gray-400 tracking-wider pt-2">STOCK AUDIO TRACKS</h3>
            <div className="grid grid-cols-1 gap-3">
              {STOCK_AUDIOS.map((audio) => (
                <div
                  key={audio.id}
                  id={`stock-audio-${audio.id}`}
                  className="group bg-[#202026] hover:bg-[#282830] rounded-lg p-2.5 flex items-center gap-3 transition cursor-pointer border border-transparent hover:border-gray-700"
                >
                  <div className="w-11 h-11 bg-teal-950/40 text-teal-400 border border-teal-800/40 rounded flex items-center justify-center text-xl">
                    {audio.thumbnail}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{audio.name}</p>
                    <p className="text-[10px] text-gray-400 mt-1 font-mono">Music • {Math.floor(audio.duration / 60)}m {Math.floor(audio.duration % 60)}s</p>
                  </div>
                  <button
                    id={`add-audio-btn-${audio.id}`}
                    onClick={() => addPresetAudio(audio)}
                    className="p-1.5 rounded-md bg-[#2d2d38] hover:bg-cyan-500 hover:text-black transition"
                    title="Add to Timeline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'image' && (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-400 tracking-wider">STOCK IMAGE LIBRARY</h3>
            <div className="grid grid-cols-1 gap-3">
              {STOCK_IMAGES.map((img) => (
                <div
                  key={img.id}
                  id={`stock-img-${img.id}`}
                  className="group bg-[#202026] hover:bg-[#282830] rounded-lg p-2.5 flex items-center gap-3 transition cursor-pointer border border-transparent hover:border-gray-700"
                >
                  <div className="w-14 h-14 bg-slate-800 rounded flex items-center justify-center text-2xl relative overflow-hidden shrink-0">
                    {img.thumbnail}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{img.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded uppercase font-mono">{img.category}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{img.duration}s</span>
                    </div>
                  </div>
                  <button
                    id={`add-img-btn-${img.id}`}
                    onClick={() => addPresetImage(img)}
                    className="p-1.5 rounded-md bg-[#2d2d38] hover:bg-cyan-500 hover:text-black transition shrink-0"
                    title="Add to Timeline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'text' && (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-400 tracking-wider">TEXT TEMPLATES</h3>
            <div className="grid grid-cols-1 gap-3">
              {TEXT_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  id={`text-preset-${preset.id}`}
                  className="bg-[#202026] hover:bg-[#282830] rounded-lg p-3 flex items-center justify-between border border-transparent hover:border-gray-700 transition cursor-pointer"
                >
                  <div className="flex-1 pr-4">
                    <p className="text-xs font-medium text-gray-300">{preset.name}</p>
                    <p className="text-sm font-bold mt-1 tracking-wide truncate" style={{ color: preset.color }}>
                      {preset.text}
                    </p>
                  </div>
                  <button
                    id={`add-text-btn-${preset.id}`}
                    onClick={() => addPresetText(preset)}
                    className="p-1.5 rounded-md bg-[#2d2d38] hover:bg-cyan-500 hover:text-black transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div
              id="drop-zone"
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[140px] ${dragActive ? 'border-cyan-400 bg-cyan-950/20' : 'border-gray-700 hover:border-gray-500 bg-[#202026]/40'}`}
            >
              <Upload className={`w-8 h-8 mb-2.5 transition ${dragActive ? 'text-cyan-400 animate-bounce' : 'text-gray-500'}`} />
              <p className="text-xs font-medium text-gray-300">Drag & drop files here</p>
              <p className="text-[10px] text-gray-500 mt-1">Supports MP4, MP3, MOV, PNG, JPG (Max 50MB)</p>
              <button
                id="browse-btn"
                className="mt-3 text-[11px] bg-cyan-500 hover:bg-cyan-400 text-black font-semibold py-1 px-3 rounded-full transition"
              >
                Browse Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="video/*,audio/*,image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>

            {/* Custom Assets List */}
            {customAssets.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <h4 className="text-[11px] font-semibold text-gray-500 tracking-wider">YOUR IMPORTS</h4>
                <div className="space-y-2">
                  {customAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="group bg-[#202026] hover:bg-[#282830] rounded-lg p-2 flex items-center gap-3 border border-gray-800 hover:border-gray-700 transition"
                    >
                      <div className="w-10 h-10 bg-slate-800 rounded flex items-center justify-center text-lg">
                        {asset.thumbnail}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate" title={asset.name}>{asset.name}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5">
                          <span>{asset.size}</span>
                          <span>•</span>
                          <span>{asset.duration}s</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            onAddClip({
                              name: asset.name,
                              type: asset.type === 'video' ? ClipType.VIDEO : ClipType.AUDIO,
                              url: asset.url,
                              duration: asset.duration,
                              sourceStart: 0,
                              sourceDuration: asset.duration,
                              playbackRate: 1.0,
                              volume: 1.0,
                              isImage: asset.isImage,
                              filters: asset.type === 'video' ? {
                                brightness: 100,
                                contrast: 100,
                                saturation: 100,
                                grayscale: 0,
                                sepia: 0,
                                invert: 0,
                                hueRotate: 0,
                                chromaKey: {
                                  enabled: false,
                                  color: '#00ff00',
                                  threshold: 30,
                                  smoothness: 10
                                }
                              } : undefined
                            });
                          }}
                          className="p-1 rounded bg-[#2a2a34] hover:bg-cyan-500 hover:text-black transition text-gray-300"
                          title="Add to Timeline"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => deleteCustomAsset(asset.id, e)}
                          className="p-1 rounded bg-[#2a2a34] hover:bg-red-500/20 hover:text-red-400 transition text-gray-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'quran-visuals' && (
          <QuranVisualsPanel
            tracks={tracks}
            onAddClip={onAddClip}
            onReplaceVideoTrackClips={onReplaceVideoTrackClips}
            quranTranslation={quranTranslation}
            currentTime={currentTime}
          />
        )}

        {activeTab === 'quran' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-amber-500/10 to-yellow-600/10 border border-amber-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-amber-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>QURAN ALIGNMENT SUITE V4</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  1-Click AI
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Automated AI Quran alignment engine. Analyzes audio frequencies, fetches Uthmani scripture & translation from Quran.com, and generates multi-track synchronized captions.
              </p>
            </div>

            {aligningStatus?.status === 'running' ? (
              <div className="bg-[#15151a] border border-amber-500/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2.5 text-amber-400 font-bold text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-amber-400" />
                  <span>⚡ AI is analyzing voice frequencies and fetching Surah verses... Please wait.</span>
                </div>
                <div className="w-full bg-[#202026] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 h-full transition-all duration-300 animate-pulse"
                    style={{ width: `${Math.max(10, aligningStatus.progress || 20)}%` }}
                  />
                </div>
                <div className="bg-black/80 rounded-lg p-2.5 text-[10px] font-mono text-amber-300/90 h-24 overflow-y-auto space-y-1 border border-amber-500/20 custom-scrollbar">
                  {aligningStatus.log.map((logMsg, idx) => (
                    <div key={idx} className="leading-snug">
                      {logMsg}
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>
              </div>
            ) : (
              <div className="bg-[#15151a] border border-gray-800 rounded-xl p-4 space-y-4">
                {/* BLOCK 1: SELECT SURAH / CHAPTER */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wide flex items-center justify-between">
                    <span>SELECT SURAH / CHAPTER</span>
                    <span className="text-[10px] text-amber-400 font-mono">114 Chapters</span>
                  </label>
                  <select
                    id="select-surah-chapter"
                    value={quranSurahPreset === 'custom' ? quranSurahCustom : quranSurahPreset}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQuranSurahPreset(val);
                      const num = parseInt(val, 10);
                      if (!isNaN(num)) {
                        setQuranSurahCustom(num);
                      }
                    }}
                    className="w-full bg-[#0a0a0d] border border-gray-800 focus:border-amber-500 rounded-lg p-2.5 text-xs text-white font-medium focus:outline-none transition cursor-pointer"
                  >
                    {SURAHS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* BLOCK 2: ALIGNMENT SCOPE */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wide flex items-center justify-between">
                    <span>ALIGNMENT SCOPE</span>
                    <span className="text-[10px] text-amber-400 font-medium">
                      {quranSelectionType === 'all'
                        ? '✨ Single Whole Surah'
                        : quranSelectionType === 'list'
                        ? `🕌 Multi-Surahs (${quranSurahList})`
                        : quranSelectionType === 'range'
                        ? `📖 Range (Surah ${quranSurahPreset} to ${quranSurahEnd})`
                        : `Ayah #${quranStartAyah}`}
                    </span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#0a0a0d] border border-gray-800 rounded-lg">
                    <button
                      type="button"
                      id="scope-all"
                      onClick={() => setQuranSelectionType('all')}
                      className={`py-2 px-2 text-xs font-bold rounded-md transition flex items-center justify-center gap-1 cursor-pointer border ${
                        quranSelectionType === 'all'
                          ? 'bg-black text-white border-white shadow-md font-extrabold'
                          : 'bg-[#15151e] border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800/50'
                      }`}
                    >
                      <span>Whole Surah</span>
                    </button>
                    <button
                      type="button"
                      id="scope-list"
                      onClick={() => setQuranSelectionType('list')}
                      className={`py-2 px-2 text-xs font-bold rounded-md transition flex items-center justify-center gap-1 cursor-pointer border ${
                        quranSelectionType === 'list'
                          ? 'bg-black text-white border-white shadow-md font-extrabold'
                          : 'bg-[#15151e] border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800/50'
                      }`}
                      title="Multi-Surahs in one audio with automatic opening rules"
                    >
                      <Sparkles className={`w-3 h-3 inline ${quranSelectionType === 'list' ? 'text-white' : 'text-gray-400'}`} />
                      <span>Multi-Surah</span>
                    </button>
                    <button
                      type="button"
                      id="scope-single"
                      onClick={() => setQuranSelectionType('single')}
                      className={`py-2 px-2 text-xs font-bold rounded-md transition flex items-center justify-center gap-1 cursor-pointer border ${
                        quranSelectionType === 'single'
                          ? 'bg-black text-white border-white shadow-md font-extrabold'
                          : 'bg-[#15151e] border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800/50'
                      }`}
                    >
                      <span>Single Ayah</span>
                    </button>
                  </div>

                  {quranSelectionType === 'list' && (
                    <div className="space-y-1.5 pt-1.5 p-2.5 bg-amber-500/5 border border-amber-500/30 rounded-lg">
                      <div className="flex items-center justify-between text-xs">
                        <label className="text-[11px] font-bold text-amber-300">Surah Numbers (comma-separated):</label>
                        <span className="text-[9px] text-amber-400/80 font-mono">e.g. 112, 113, 114</span>
                      </div>
                      <input
                        type="text"
                        id="input-multi-surah-list"
                        value={quranSurahList}
                        onChange={(e) => setQuranSurahList(e.target.value)}
                        placeholder="112, 113, 114 (Ikhlas, Falaq, Nas)"
                        className="w-full bg-[#0a0a0d] border border-amber-500/40 focus:border-amber-400 rounded-md px-2.5 py-1.5 text-xs text-amber-200 font-mono focus:outline-none"
                      />
                      <div className="flex flex-wrap gap-1 pt-1">
                        <span className="text-[10px] text-gray-400">Quick sets:</span>
                        {[
                          { label: '4 Quls (109-114)', val: '109, 112, 113, 114' },
                          { label: '3 Quls (112-114)', val: '112, 113, 114' },
                          { label: 'Falaq & Nas', val: '113, 114' },
                          { label: 'Juz 30 (Last 5)', val: '110, 111, 112, 113, 114' },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setQuranSurahList(preset.val)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/20 text-amber-300 font-mono transition cursor-pointer"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {quranSelectionType === 'single' && (
                    <div className="flex items-center gap-2 pt-1">
                      <label className="text-xs text-gray-400 whitespace-nowrap">Ayah Number:</label>
                      <input
                        type="number"
                        id="input-single-ayah"
                        min="1"
                        max="286"
                        value={quranStartAyah}
                        onChange={(e) => setQuranStartAyah(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 bg-[#0a0a0d] border border-gray-800 focus:border-amber-500 rounded-md px-2 py-1 text-xs text-white font-mono text-center focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* BLOCK 2.5: 🌐 MULTI-TRANSLATION LANGUAGE & TRANSLATOR SUITE */}
                <div className="bg-[#101016] border border-cyan-500/30 rounded-xl p-3.5 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-800/80">
                    <label className="text-xs font-extrabold text-cyan-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Languages className="w-3.5 h-3.5 text-cyan-400" />
                      <span>TRANSLATION LANGUAGE & TRANSLATOR</span>
                    </label>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-bold border border-cyan-500/20 flex items-center gap-1">
                      <span>{currentTranslation.flag}</span>
                      <span>{currentTranslation.language.split(' ')[0]}</span>
                    </span>
                  </div>

                  {/* Toast notification when translation applied */}
                  {translationToast && (
                    <div className="p-2 bg-teal-500/20 border border-teal-500/40 rounded-lg text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span>{translationToast}</span>
                    </div>
                  )}

                  {/* 1. Quick Language Selection Grid */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">SELECT LANGUAGE:</span>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                      {[
                        { code: 'ur', id: 'ur-jalandhry', label: 'Urdu', flag: '🇵🇰' },
                        { code: 'hi', id: 'hi-suhel', label: 'Hindi', flag: '🇮🇳' },
                        { code: 'en', id: 'en-sahih', label: 'English', flag: '🇬🇧' },
                        { code: 'id', id: 'id-kemenag', label: 'Indonesian', flag: '🇮🇩' },
                        { code: 'tr', id: 'tr-diyanet', label: 'Turkish', flag: '🇹🇷' },
                        { code: 'fr', id: 'fr-hamidullah', label: 'French', flag: '🇫🇷' },
                        { code: 'bn', id: 'bn-muhiuddin', label: 'Bengali', flag: '🇧🇩' },
                        { code: 'fa', id: 'fa-kaldari', label: 'Persian', flag: '🇮🇷' },
                        { code: 'es', id: 'es-garcia', label: 'Spanish', flag: '🇪🇸' },
                        { code: 'de', id: 'de-bubenheim', label: 'German', flag: '🇩🇪' },
                        { code: 'ru', id: 'ru-kuliev', label: 'Russian', flag: '🇷🇺' },
                        { code: 'none', id: 'none', label: 'Arabic Only', flag: '🕌' },
                      ].map((lang) => {
                        const isSelected = currentTranslation.languageCode === lang.code;
                        return (
                          <button
                            key={lang.id}
                            type="button"
                            id={`btn-lang-${lang.code}`}
                            onClick={() => handleSelectTranslation(lang.id)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition border cursor-pointer ${
                              isSelected
                                ? 'bg-black text-white border-white font-extrabold shadow-md'
                                : 'bg-[#15151e] border-gray-800 text-gray-300 hover:text-white hover:bg-gray-800/80 hover:border-gray-700'
                            }`}
                          >
                            <span>{lang.flag}</span>
                            <span className="text-[11px] truncate">{lang.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Specific Translator Dropdown Selector */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ALL TRANSLATORS & AUTHORS:</span>
                      <span className="text-[10px] text-cyan-400 font-mono font-bold">{currentTranslation.direction === 'rtl' ? 'RTL Script' : 'LTR Script'}</span>
                    </div>
                    <select
                      id="select-quran-translation-option"
                      value={quranTranslation}
                      onChange={(e) => handleSelectTranslation(e.target.value)}
                      className="w-full bg-[#0a0a0d] border border-cyan-500/40 focus:border-cyan-400 rounded-lg p-2.5 text-xs text-cyan-300 font-semibold focus:outline-none transition cursor-pointer"
                    >
                      <optgroup label="🇵🇰 Urdu Translations (اردو تراجم)">
                        <option value="ur-jalandhry">🇵🇰 Fateh Muhammad Jalandhry (فتح محمد جالندھری)</option>
                        <option value="ur-tahir">🇵🇰 Dr. Tahir-ul-Qadri - Irfan-ul-Quran (طاہر القادری)</option>
                        <option value="ur-raza">🇵🇰 Ahmed Raza Khan - Kanzul Iman (احمد رضا خان)</option>
                        <option value="ur-maududi">🇵🇰 Abul A'la Maududi - Tafhim al-Qur'an (مودودی)</option>
                      </optgroup>
                      <optgroup label="🇮🇳 Hindi Translations (हिन्दी अनुवाद)">
                        <option value="hi-suhel">🇮🇳 Suhel Farooq Khan & Saifur Rahman (सुहेल फ़ारूक़ ख़ान)</option>
                        <option value="hi-farooq">🇮🇳 Muhammad Farooq Khan (मुहम्मद फ़ारूक़ ख़ान)</option>
                      </optgroup>
                      <optgroup label="🇬🇧 English Translations">
                        <option value="en-sahih">🇬🇧 Sahih International</option>
                        <option value="en-khattab">🇬🇧 Dr. Mustafa Khattab (The Clear Quran)</option>
                        <option value="en-hilali">🇬🇧 Muhsin Khan & Taqi-ud-Din al-Hilali</option>
                        <option value="en-yusufali">🇬🇧 Abdullah Yusuf Ali</option>
                      </optgroup>
                      <optgroup label="🇮🇩 Indonesian (Bahasa)">
                        <option value="id-kemenag">🇮🇩 Kementerian Agama RI (Kemenag)</option>
                      </optgroup>
                      <optgroup label="🇹🇷 Turkish (Türkçe)">
                        <option value="tr-diyanet">🇹🇷 Diyanet İşleri Başkanlığı</option>
                        <option value="tr-yazir">🇹🇷 Elmalılı Hamdi Yazır</option>
                      </optgroup>
                      <optgroup label="🇫🇷 French (Français)">
                        <option value="fr-hamidullah">🇫🇷 Muhammad Hamidullah</option>
                      </optgroup>
                      <optgroup label="🇧🇩 Bengali (বাংলা)">
                        <option value="bn-muhiuddin">🇧🇩 Muhiuddin Khan (মুহিউদ্দীন খান)</option>
                        <option value="bn-taisirul">🇧🇩 Taisirul Quran (তাইসিরুল কুরআন)</option>
                      </optgroup>
                      <optgroup label="🇪🇸 Spanish (Español)">
                        <option value="es-garcia">🇪🇸 Muhammad Isa García</option>
                      </optgroup>
                      <optgroup label="🇩🇪 German (Deutsch)">
                        <option value="de-bubenheim">🇩🇪 Frank Bubenheim & Nadeem Elyas</option>
                      </optgroup>
                      <optgroup label="🇷🇺 Russian (Русский)">
                        <option value="ru-kuliev">🇷🇺 Эльмир Кулиев (Elmir Kuliev)</option>
                      </optgroup>
                      <optgroup label="🇮🇷 Persian (فارسی)">
                        <option value="fa-kaldari">🇮🇷 حسین تاجی کل‌داری (Hussein Taji Kal Dari)</option>
                        <option value="fa-ghomshei">🇮🇷 مهدی الهی قمشه‌ای (Mahdi Elahi Ghomshei)</option>
                      </optgroup>
                      <optgroup label="🇲🇾 Malay & 🇮🇳 Tamil">
                        <option value="ms-basmeih">🇲🇾 Abdullah Muhammad Basmeih</option>
                        <option value="ta-jantrust">🇮🇳 Jan Trust Foundation (ஜான் டிரஸ்ட்)</option>
                      </optgroup>
                      <optgroup label="🕌 Arabic Scripture Only">
                        <option value="none">🕌 None (Arabic Scripture Only)</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* 3. ⚡ Apply Translation to Timeline Button */}
                  <button
                    type="button"
                    id="btn-apply-translation-to-timeline"
                    onClick={handleTriggerApplyTranslation}
                    disabled={isApplyingTranslation}
                    className="w-full py-2.5 px-3 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 font-bold rounded-lg text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isApplyingTranslation ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                        <span>Applying {currentTranslation.language} Translation to Timeline...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        <span>⚡ Apply {currentTranslation.flag} {currentTranslation.language.split(' ')[0]} Translation to Timeline</span>
                      </>
                    )}
                  </button>
                </div>

                {/* BLOCK 2.8: OPENING / INTRO RECITION SELECTOR (BISMILLAH & TAAWWUZ) */}
                <div className="bg-[#101016] border border-amber-500/30 rounded-xl p-3 space-y-2 shadow-md">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>OPENING VERSES</span>
                    </label>
                    <span className="text-[10px] text-amber-300 font-mono font-bold">
                      {quranIntroMode === 'both' ? '⭐ A’udhu + Bismillah' : quranIntroMode === 'bismillah-only' ? 'Bismillah Only' : quranIntroMode === 'taawwuz-only' ? 'A’udhu Only' : 'Direct Ayah 1'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'both', label: '⭐ A’udhu + Bismillah', desc: 'Include Both' },
                      { id: 'bismillah-only', label: 'Bismillah Only', desc: 'Bismillah Only' },
                      { id: 'taawwuz-only', label: 'A’udhu Only', desc: 'A’udhu Only' },
                      { id: 'none', label: 'Direct Ayah 1', desc: 'Direct Ayah' },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        id={`btn-intro-mode-${mode.id}`}
                        onClick={() => {
                          if (setQuranIntroMode) {
                            setQuranIntroMode(mode.id as any);
                          }
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex flex-col items-center justify-center border cursor-pointer ${
                          quranIntroMode === mode.id
                            ? 'bg-black text-white border-white shadow-md'
                            : 'bg-[#15151e] border-gray-800 text-gray-300 hover:text-white hover:bg-gray-800/80'
                        }`}
                      >
                        <span className="text-[11px] leading-tight">{mode.label}</span>
                        <span className={`text-[9px] ${quranIntroMode === mode.id ? 'text-white/80 font-semibold' : 'text-gray-400'}`}>{mode.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* BLOCK 2.9: BREATH & WAQF SEGMENTATION MODE */}
                <div className="bg-[#101016] border border-amber-500/30 rounded-xl p-3 space-y-2 shadow-md">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>BREATH & WAQF MODE</span>
                    </label>
                    <span className="text-[10px] text-amber-300 font-mono font-bold">
                      {quranBreathSegmentationMode === 'full-ayah' ? '📖 Full Ayah Display' : '✂️ Split Breath Phrases'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      {
                        id: 'full-ayah',
                        label: '📖 Full Ayah Display',
                        desc: 'Full Ayah intact (continuous screen display)',
                      },
                      {
                        id: 'split-breaths',
                        label: '✂️ Split Breath Phrases',
                        desc: 'Separate phrase per breath ([1/2], [2/2]) for long Ayahs',
                      },
                    ].map((bMode) => (
                      <button
                        key={bMode.id}
                        type="button"
                        id={`btn-breath-mode-${bMode.id}`}
                        onClick={() => {
                          if (setQuranBreathSegmentationMode) {
                            setQuranBreathSegmentationMode(bMode.id as any);
                          }
                        }}
                        className={`py-2 px-2 rounded-lg text-xs font-bold transition flex flex-col items-center justify-center border cursor-pointer text-center ${
                          quranBreathSegmentationMode === bMode.id
                            ? 'bg-black text-white border-white shadow-md'
                            : 'bg-[#15151e] border-gray-800 text-gray-300 hover:text-white hover:bg-gray-800/80'
                        }`}
                      >
                        <span className="text-[11px] font-extrabold leading-tight">{bMode.label}</span>
                        <span className={`text-[9px] mt-0.5 ${quranBreathSegmentationMode === bMode.id ? 'text-white/80 font-semibold' : 'text-gray-400'}`}>
                          {bMode.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-amber-300/80 italic pt-0.5 leading-snug">
                    💡 Note: An Ayah recited in a single breath will never be split into parts.
                  </p>
                </div>

                {/* BLOCK 3: ✨ 1-CLICK AUTO-GENERATE CAPTIONS BUTTON */}
                <button
                  type="button"
                  id="btn-1click-auto-generate"
                  onClick={() => {
                    const selectedSurahNum = quranSurahPreset === 'custom' ? quranSurahCustom : parseInt(quranSurahPreset, 10) || 1;
                    onAlignQuran({
                      surah: quranSelectionType === 'list' ? quranSurahList : selectedSurahNum,
                      startAyah: quranSelectionType === 'single' ? quranStartAyah : 1,
                      mode: quranSelectionType === 'single' ? 'individual' : 'batch',
                      style: 'Imperial Gold',
                      selectionType: quranSelectionType,
                      surahList: quranSurahList,
                      surahEnd: quranSurahEnd,
                      introMode: quranIntroMode,
                    });
                  }}
                  className="w-full py-3.5 px-4 bg-black text-white hover:bg-gray-900 font-extrabold rounded-xl text-xs sm:text-sm transition-all shadow-lg active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer border border-amber-400/80"
                >
                  <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>
                    ✨ 1-Click Auto-Generate Captions (
                    {quranSelectionType === 'list'
                      ? `Multi-Surah: ${quranSurahList}`
                      : quranSelectionType === 'all'
                      ? 'Whole Surah'
                      : `Ayah ${quranStartAyah}`}
                    {' '}• Arabic + {currentTranslation.language.split(' ')[0]})
                  </span>
                </button>



                {/* BLOCK 4: ARABIC SCRIPTURE TYPOGRAPHY & AYAH SYMBOL CONTROLS */}
                <div className="bg-[#121218] border border-amber-500/30 rounded-xl p-3.5 space-y-3.5 mt-2 shadow-lg">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-800/80">
                    <label className="text-xs font-extrabold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>ARABIC SCRIPTURE (UTHMANI)</span>
                    </label>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
                      Live Customization
                    </span>
                  </div>

                  {/* 1. QURANIC FONT FAMILY */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">QURANIC / ARABIC FONT</span>
                      <span className="font-mono text-amber-400 font-bold text-[10px] truncate max-w-[120px]">{quranArabicFont}</span>
                    </div>
                    <select
                      id="select-quran-arabic-font"
                      value={quranArabicFont}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuranArabicFont(val);
                        onApplyQuranStyles({ arabicFont: val });
                      }}
                      className="w-full bg-[#0a0a0d] border border-amber-500/40 focus:border-amber-400 rounded-lg p-2.5 text-xs text-amber-300 font-semibold focus:outline-none transition cursor-pointer"
                    >
                      <option value="Uthmani">📖 Uthmani (KFGQPC Madinah Mushaf Script)</option>
                      <option value="Amiri Quran">🕌 Amiri Quran (Classical Uthmani Scripture)</option>
                      <option value="KFGQPC Uthmanic Script HAFS">📜 KFGQPC Hafs Script (Official Mushaf)</option>
                      <option value="Noto Naskh Arabic">📜 Noto Naskh Arabic (Crisp Readable Naskh)</option>
                      <option value="Amiri">🕌 Amiri (Classical Calligraphic)</option>
                      <option value="Scheherazade New">🕌 Scheherazade New (Traditional Arabic)</option>
                      <option value="Lateef">🕌 Lateef (Perso-Arabic Quranic)</option>
                      <option value="Reem Kufi">🕌 Reem Kufi (Geometric Kufic Modern)</option>
                      <option value="Noto Nastaliq Urdu">🇵🇰 Noto Nastaliq Urdu (Nastaliq Calligraphy)</option>
                    </select>
                  </div>

                  {/* 2. AYAH NUMBER SYMBOL CONTROLLER SUITE */}
                  <div className="bg-[#0e0e14] border border-amber-500/25 rounded-lg p-2.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">AYAH NUMBER SYMBOL</span>
                      </div>
                      {/* Show/Hide Toggle */}
                      <button
                        type="button"
                        id="toggle-show-ayah-symbol"
                        onClick={() => {
                          const next = !quranShowAyahSymbol;
                          if (setQuranShowAyahSymbol) setQuranShowAyahSymbol(next);
                          onApplyQuranStyles({ showAyahSymbol: next });
                        }}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition cursor-pointer border ${
                          quranShowAyahSymbol
                            ? 'bg-black text-white border-white'
                            : 'bg-gray-800 text-gray-400 border-gray-700'
                        }`}
                      >
                        {quranShowAyahSymbol ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    {quranShowAyahSymbol && (
                      <div className="space-y-2 pt-1 border-t border-gray-800/80">
                        {/* Ayah Symbol Style Selection */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">SYMBOL STYLE</span>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              {
                                id: 'ornate-medallion',
                                label: '👑 Ornate Crown Medallion',
                                sample: '۝١',
                                isOrnate: true,
                              },
                              { id: 'uthmani-circle', label: '۝ Uthmani Circle', sample: '۝١' },
                              { id: 'ornate-brackets', label: '﴿ ﴾ Ornate Brackets', sample: '﴿١﴾' },
                              { id: 'parentheses', label: '( ) Curved', sample: '(١)' },
                              { id: 'brackets', label: '[ ] Square', sample: '[١]' },
                            ].map((styleOpt) => (
                              <button
                                key={styleOpt.id}
                                type="button"
                                id={`btn-ayah-style-${styleOpt.id}`}
                                onClick={() => {
                                  if (setQuranAyahSymbolStyle) setQuranAyahSymbolStyle(styleOpt.id as AyahSymbolStyle);
                                  onApplyQuranStyles({ ayahSymbolStyle: styleOpt.id });
                                }}
                                className={`py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-between transition border cursor-pointer ${
                                  quranAyahSymbolStyle === styleOpt.id
                                    ? 'bg-black text-white border-white font-bold shadow'
                                    : 'bg-[#15151e] border-gray-800 text-gray-300 hover:text-white hover:bg-gray-800'
                                } ${styleOpt.id === 'ornate-medallion' ? 'col-span-2 bg-gradient-to-r from-amber-950/40 via-[#1a1528] to-amber-950/40 border-amber-500/40' : ''}`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {styleOpt.id === 'ornate-medallion' && (
                                    <OrnateAyahMedallion
                                      ayahNumber={1}
                                      digitType={quranAyahDigitType}
                                      size={18}
                                      color={quranAyahSymbolStyle === 'ornate-medallion' ? '#fbbf24' : '#d97706'}
                                    />
                                  )}
                                  <span className="text-[11px] truncate">{styleOpt.label}</span>
                                </div>
                                {styleOpt.id === 'ornate-medallion' ? (
                                  <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold border border-amber-500/30">
                                    TAJ CARTOUCHE
                                  </span>
                                ) : (
                                  <span className="font-arabic text-amber-400 font-bold text-xs shrink-0 ml-1">{styleOpt.sample}</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Digits & Position Controls */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {/* Numerals Format */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">DIGIT TYPE</span>
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                id="btn-ayah-digits-arabic"
                                onClick={() => {
                                  if (setQuranAyahDigitType) setQuranAyahDigitType('arabic');
                                  onApplyQuranStyles({ ayahDigitType: 'arabic' });
                                }}
                                className={`py-1 text-[11px] font-bold rounded transition border cursor-pointer ${
                                  quranAyahDigitType === 'arabic'
                                    ? 'bg-black text-white border-white'
                                    : 'bg-[#15151e] text-gray-400 border-gray-800 hover:text-white'
                                }`}
                              >
                                Arabic (١, ٢, ٣)
                              </button>
                              <button
                                type="button"
                                id="btn-ayah-digits-latin"
                                onClick={() => {
                                  if (setQuranAyahDigitType) setQuranAyahDigitType('latin');
                                  onApplyQuranStyles({ ayahDigitType: 'latin' });
                                }}
                                className={`py-1 text-[11px] font-bold rounded transition border cursor-pointer ${
                                  quranAyahDigitType === 'latin'
                                    ? 'bg-black text-white border-white'
                                    : 'bg-[#15151e] text-gray-400 border-gray-800 hover:text-white'
                                }`}
                              >
                                Latin (1, 2, 3)
                              </button>
                            </div>
                          </div>

                          {/* Symbol Position */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">POSITION</span>
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                id="btn-ayah-pos-end"
                                onClick={() => {
                                  if (setQuranAyahSymbolPosition) setQuranAyahSymbolPosition('end');
                                  onApplyQuranStyles({ ayahSymbolPosition: 'end' });
                                }}
                                className={`py-1 text-[11px] font-bold rounded transition border cursor-pointer ${
                                  quranAyahSymbolPosition === 'end'
                                    ? 'bg-black text-white border-white'
                                    : 'bg-[#15151e] text-gray-400 border-gray-800 hover:text-white'
                                }`}
                              >
                                End
                              </button>
                              <button
                                type="button"
                                id="btn-ayah-pos-start"
                                onClick={() => {
                                  if (setQuranAyahSymbolPosition) setQuranAyahSymbolPosition('start');
                                  onApplyQuranStyles({ ayahSymbolPosition: 'start' });
                                }}
                                className={`py-1 text-[11px] font-bold rounded transition border cursor-pointer ${
                                  quranAyahSymbolPosition === 'start'
                                    ? 'bg-black text-white border-white'
                                    : 'bg-[#15151e] text-gray-400 border-gray-800 hover:text-white'
                                }`}
                              >
                                Start
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Live Ayah Preview */}
                        <div className="bg-[#08080c] border border-amber-500/20 rounded p-2 text-center">
                          <span className="text-[9px] font-mono text-gray-500 block mb-0.5 uppercase tracking-wider">Live Preview with {quranArabicFont}</span>
                          <div
                            className="text-sm font-bold text-amber-300 flex items-center justify-center gap-2 flex-wrap"
                            style={{ fontFamily: quranArabicFont || 'Uthmani' }}
                            dir="rtl"
                          >
                            {quranAyahSymbolPosition === 'start' && (
                              quranAyahSymbolStyle === 'ornate-medallion' ? (
                                <OrnateAyahMedallion ayahNumber={1} digitType={quranAyahDigitType} size={24} color="#f59e0b" />
                              ) : (
                                <span>{formatAyahSymbol(1, quranAyahSymbolStyle, quranAyahDigitType)}</span>
                              )
                            )}
                            <span>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</span>
                            {quranAyahSymbolPosition === 'end' && (
                              quranAyahSymbolStyle === 'ornate-medallion' ? (
                                <OrnateAyahMedallion ayahNumber={1} digitType={quranAyahDigitType} size={24} color="#f59e0b" />
                              ) : (
                                <span>{formatAyahSymbol(1, quranAyahSymbolStyle, quranAyahDigitType)}</span>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick Apply Button */}
                    <button
                      type="button"
                      id="btn-apply-ayah-symbol-to-timeline"
                      onClick={() => {
                        onApplyQuranStyles({
                          arabicFont: quranArabicFont,
                          ayahSymbolStyle: quranAyahSymbolStyle,
                          ayahDigitType: quranAyahDigitType,
                          ayahSymbolPosition: quranAyahSymbolPosition,
                          showAyahSymbol: quranShowAyahSymbol,
                        });
                      }}
                      className="w-full py-2 px-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 hover:border-amber-400 text-amber-300 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>⚡ Apply Ayah Symbol & Uthmani Font to All Clips</span>
                    </button>
                  </div>

                  {/* 3. FONT SIZE */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">FONT SIZE</span>
                      <span className="font-mono text-amber-400 font-bold text-xs">{quranArabicSize}PX</span>
                    </div>
                    <input
                      type="range"
                      id="slider-quran-arabic-size"
                      min="16"
                      max="72"
                      step="1"
                      value={quranArabicSize}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 36;
                        setQuranArabicSize(val);
                        onApplyQuranStyles({ arabicSize: val });
                      }}
                      className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                  </div>

                  {/* 4. FONT COLOR */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">FONT COLOR</span>
                      <span className="font-mono text-amber-400 font-bold text-xs uppercase">{quranArabicColor}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-0.5">
                      {/* Active Color Preview & Picker */}
                      <label
                        className="w-7 h-7 rounded border border-gray-700 cursor-pointer relative shrink-0 shadow-sm flex items-center justify-center transition hover:scale-105"
                        style={{ backgroundColor: quranArabicColor }}
                        title="Pick custom color"
                      >
                        <input
                          type="color"
                          value={quranArabicColor}
                          onChange={(e) => {
                            setQuranArabicColor(e.target.value);
                            onApplyQuranStyles({ arabicColor: e.target.value });
                          }}
                          className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
                        />
                      </label>
                      {/* Preset Color Swatches */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {['#FFD700', '#FFFF00', '#00FFFF', '#00FF66', '#FFFFFF', '#FDE047', '#FF8C00'].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              setQuranArabicColor(c);
                              onApplyQuranStyles({ arabicColor: c });
                            }}
                            className={`w-5 h-5 rounded-full transition-transform hover:scale-125 cursor-pointer border ${
                              quranArabicColor.toLowerCase() === c.toLowerCase()
                                ? 'ring-2 ring-amber-400 border-white scale-110'
                                : 'border-transparent opacity-90 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 3. TEXT EFFECT / GLOW */}
                  <div className="space-y-1.5">
                    <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">TEXT EFFECT / GLOW</span>
                    <div className="space-y-1.5">
                      {/* Row 1 */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['normal', 'shadow', 'outline'] as const).map((styleKey) => (
                          <button
                            key={styleKey}
                            type="button"
                            id={`btn-arabic-effect-${styleKey}`}
                            onClick={() => {
                              setQuranArabicStyle(styleKey);
                              onApplyQuranStyles({ arabicStyle: styleKey });
                            }}
                            className={`py-2 px-2 text-xs font-semibold rounded-lg transition capitalize border cursor-pointer ${
                              quranArabicStyle === styleKey
                                ? 'bg-black text-white border-white shadow-md font-bold'
                                : 'bg-[#181822] text-gray-300 hover:text-white hover:bg-gray-800 border-gray-800'
                            }`}
                          >
                            {styleKey}
                          </button>
                        ))}
                      </div>
                      {/* Row 2 */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          id="btn-arabic-effect-neon"
                          onClick={() => {
                            setQuranArabicStyle('neon');
                            onApplyQuranStyles({ arabicStyle: 'neon' });
                          }}
                          className={`py-2 px-1 text-xs font-semibold rounded-lg transition border cursor-pointer ${
                            quranArabicStyle === 'neon'
                              ? 'bg-black text-white border-white shadow-md font-bold'
                              : 'bg-[#181822] text-gray-300 hover:text-white hover:bg-gray-800 border-gray-800'
                          }`}
                        >
                          Neon
                        </button>
                        <button
                          type="button"
                          id="btn-arabic-effect-gold-glow"
                          onClick={() => {
                            setQuranArabicStyle('gold-glow');
                            onApplyQuranStyles({ arabicStyle: 'gold-glow' });
                          }}
                          className={`py-2 px-1 text-xs font-semibold rounded-lg transition border cursor-pointer ${
                            quranArabicStyle === 'gold-glow'
                              ? 'bg-black text-white border-white shadow-md font-bold'
                              : 'bg-[#181822] text-gray-300 hover:text-white hover:bg-gray-800 border-gray-800'
                          }`}
                        >
                          ✨ Gold Glow
                        </button>
                        <button
                          type="button"
                          id="btn-arabic-effect-viral-reels"
                          onClick={() => {
                            setQuranArabicStyle('viral-reels');
                            onApplyQuranStyles({ arabicStyle: 'viral-reels' });
                          }}
                          className={`py-2 px-1 text-xs font-semibold rounded-lg transition border cursor-pointer ${
                            quranArabicStyle === 'viral-reels'
                              ? 'bg-black text-white border-white shadow-md font-bold'
                              : 'bg-[#181822] text-gray-300 hover:text-white hover:bg-gray-800 border-gray-800'
                          }`}
                        >
                          🔥 Viral Reels
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 4. VERTICAL ALIGNMENT (Y-AXIS) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">VERTICAL ALIGNMENT (Y-AXIS)</span>
                      <span className="font-mono text-amber-400 font-bold text-xs">{quranArabicY}%</span>
                    </div>
                    <input
                      type="range"
                      id="slider-quran-arabic-y"
                      min="5"
                      max="90"
                      step="1"
                      value={quranArabicY}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 35;
                        setQuranArabicY(val);
                        onApplyQuranStyles({ arabicY: val });
                      }}
                      className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                  </div>

                  {/* 5. Auto Word Wrap Switch */}
                  <div className="flex items-center justify-between bg-[#0b0b0f] p-3 rounded-lg border border-gray-800">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-white">Auto Word Wrap</p>
                      <p className="text-[10px] text-gray-400">Wrap long Arabic text to multiple lines</p>
                    </div>
                    <button
                      type="button"
                      id="toggle-quran-arabic-wrap"
                      onClick={() => {
                        const next = !quranArabicWrap;
                        setQuranArabicWrap(next);
                        onApplyQuranStyles({ arabicWrap: next });
                      }}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer border ${
                        quranArabicWrap ? 'bg-amber-500 border-amber-400 justify-end' : 'bg-gray-800 border-gray-700 justify-start'
                      }`}
                    >
                      <span className="bg-black w-4 h-4 rounded-full shadow-md" />
                    </button>
                  </div>

                  {/* 6. MAX LINE WIDTH (CANVAS %) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">MAX LINE WIDTH (CANVAS %)</span>
                      <span className="font-mono text-amber-400 font-bold text-xs">{quranArabicMaxWidth}%</span>
                    </div>
                    <input
                      type="range"
                      id="slider-quran-arabic-max-width"
                      min="40"
                      max="100"
                      step="1"
                      value={quranArabicMaxWidth}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 80;
                        setQuranArabicMaxWidth(val);
                        onApplyQuranStyles({ arabicMaxWidth: val });
                      }}
                      className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                  </div>

                  {/* 7. LINE SPACING (HEIGHT) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">LINE SPACING (HEIGHT)</span>
                      <span className="font-mono text-amber-400 font-bold text-xs">{quranArabicLineHeight}X</span>
                    </div>
                    <input
                      type="range"
                      id="slider-quran-arabic-line-height"
                      min="1.0"
                      max="2.5"
                      step="0.1"
                      value={quranArabicLineHeight}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 1.3;
                        setQuranArabicLineHeight(val);
                        onApplyQuranStyles({ arabicLineHeight: val });
                      }}
                      className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                  </div>

                  {/* 8. TEXT ALIGNMENT */}
                  <div className="space-y-1.5">
                    <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">TEXT ALIGNMENT</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['left', 'center', 'right'] as const).map((alignKey) => (
                        <button
                          key={alignKey}
                          type="button"
                          id={`btn-arabic-align-${alignKey}`}
                          onClick={() => {
                            setQuranArabicAlign(alignKey);
                            onApplyQuranStyles({ arabicAlign: alignKey });
                          }}
                          className={`py-2 px-2 text-xs font-semibold rounded-lg transition capitalize border cursor-pointer ${
                            quranArabicAlign === alignKey
                              ? 'bg-black text-white border-white shadow-md font-bold'
                              : 'bg-[#181822] text-gray-300 hover:text-white hover:bg-gray-800 border-gray-800'
                          }`}
                        >
                          {alignKey}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* BLOCK 5: 🌐 TRANSLATION SCRIPT & TYPOGRAPHY (LIVE CUSTOMIZATION) CONTROLS */}
                <div className="bg-[#121218] border border-cyan-500/30 rounded-xl p-3.5 space-y-3.5 mt-2 shadow-lg">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-800/80">
                    <label className="text-xs font-extrabold text-cyan-400 uppercase tracking-wide flex items-center gap-1.5">
                      <span>{currentTranslation.flag}</span>
                      <span>{currentTranslation.language.toUpperCase()} TRANSLATION</span>
                    </label>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-bold border border-cyan-500/20">
                      Live Typography
                    </span>
                  </div>

                  {/* 1. TRANSLATION FONT FAMILY */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">TRANSLATION FONT FAMILY</span>
                      <span className="text-[10px] text-cyan-400 font-mono font-bold">{quranEnglishFont}</span>
                    </div>
                    <select
                      id="select-quran-english-font"
                      value={quranEnglishFont}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuranEnglishFont(val);
                        onApplyQuranStyles({ englishFont: val });
                      }}
                      className="w-full bg-[#0a0a0d] border border-gray-800 focus:border-cyan-500 rounded-lg p-2.5 text-xs text-white font-medium focus:outline-none transition cursor-pointer"
                    >
                      <optgroup label={`⭐ Recommended for ${currentTranslation.language.split(' ')[0]} (${currentTranslation.flag})`}>
                        {getSuggestedFontsForLanguage(currentTranslation.languageCode).map((f) => (
                          <option key={`rec-${f.family}`} value={f.family}>
                            {f.label}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="🇵🇰 Urdu & Nastaliq Calligraphy">
                        <option value="Noto Nastaliq Urdu">🇵🇰 Noto Nastaliq Urdu (Traditional Calligraphy)</option>
                        <option value="Gulzar">🇵🇰 Gulzar (Modern Nastaliq Display)</option>
                        <option value="Lateef">🇵🇰 Lateef (Perso-Arabic Naskh-Nastaliq)</option>
                      </optgroup>
                      <optgroup label="🇮🇳 Hindi & Devanagari (हिन्दी)">
                        <option value="Noto Sans Devanagari">🇮🇳 Noto Sans Devanagari (Crisp Modern)</option>
                        <option value="Noto Serif Devanagari">🇮🇳 Noto Serif Devanagari (Literary Classical)</option>
                        <option value="Poppins">🇮🇳 Poppins (Devanagari & Latin Geometric)</option>
                        <option value="Rozha One">🇮🇳 Rozha One (Bold Editorial)</option>
                        <option value="Mukta">🇮🇳 Mukta (Contemporary Devanagari)</option>
                        <option value="Kalam">🇮🇳 Kalam (Handwritten Brush)</option>
                        <option value="Tiro Devanagari Hindi">🇮🇳 Tiro Devanagari Hindi (Formal Academic)</option>
                      </optgroup>
                      <optgroup label="🇧🇩 Bengali & Bangla (বাংলা)">
                        <option value="Noto Sans Bengali">🇧🇩 Noto Sans Bengali (Clear Modern)</option>
                        <option value="Noto Serif Bengali">🇧🇩 Noto Serif Bengali (Traditional Literary)</option>
                        <option value="Hind Siliguri">🇧🇩 Hind Siliguri (Clean Editorial Sans)</option>
                        <option value="Galada">🇧🇩 Galada (Bengali Cursive Display)</option>
                        <option value="Atma">🇧🇩 Atma (Charming Display)</option>
                        <option value="Tiro Bangla">🇧🇩 Tiro Bangla (Scholarly Bengali)</option>
                      </optgroup>
                      <optgroup label="🇮🇳 Tamil (தமிழ்)">
                        <option value="Noto Sans Tamil">🇮🇳 Noto Sans Tamil (Clean Sans)</option>
                        <option value="Noto Serif Tamil">🇮🇳 Noto Serif Tamil (Classic Serif)</option>
                        <option value="Mukta Malar">🇮🇳 Mukta Malar (Modern Tamil)</option>
                      </optgroup>
                      <optgroup label="🇮🇷 Persian & Farsi (فارسی)">
                        <option value="Vazirmatn">🇮🇷 Vazirmatn (Modern Persian UI)</option>
                        <option value="Lalezar">🇮🇷 Lalezar (Bold Persian Vintage Poster)</option>
                      </optgroup>
                      <optgroup label="🇷🇺 Russian & Cyrillic (Русский)">
                        <option value="Cormorant Garamond">🇷🇺 Cormorant Garamond (Royal Classical Cyrillic)</option>
                        <option value="Merriweather">🇷🇺 Merriweather (High-Legibility Cyrillic Serif)</option>
                        <option value="Roboto Slab">🇷🇺 Roboto Slab (Modern Slab Serif)</option>
                      </optgroup>
                      <optgroup label="🔤 English, Turkish, Indonesian & European">
                        <option value="Inter">🇬🇧 Inter (Ultra-Clean Global Sans)</option>
                        <option value="Outfit">🇹🇷 Outfit (Sleek Geometric Modern)</option>
                        <option value="Cinzel">👑 Cinzel (Royal Cinematic Classical)</option>
                        <option value="Cinzel Decorative">👑 Cinzel Decorative (Grand Capitals)</option>
                        <option value="Lora">📖 Lora (Contemporary Literary Serif)</option>
                        <option value="Montserrat">⚡ Montserrat (Bold High-Impact Sans)</option>
                        <option value="Playfair Display">✨ Playfair Display (Luxury Editorial Serif)</option>
                        <option value="Space Grotesk">🚀 Space Grotesk (Tech Modernist)</option>
                        <option value="JetBrains Mono">💻 JetBrains Mono (Technical Monospace)</option>
                      </optgroup>
                      <optgroup label="🕌 Arabic & Perso-Arabic Calligraphy">
                        <option value="Amiri">🕌 Amiri (Classical Calligraphic)</option>
                        <option value="Noto Naskh Arabic">📜 Noto Naskh Arabic (Crisp Readable Naskh)</option>
                        <option value="Scheherazade New">🕌 Scheherazade New (Traditional Arabic)</option>
                        <option value="Reem Kufi">🕌 Reem Kufi (Geometric Kufic Modern)</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* 2. FONT SIZE */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">FONT SIZE</span>
                      <span className="font-mono text-cyan-400 font-bold text-xs">{quranEnglishSize}PX</span>
                    </div>
                    <input
                      type="range"
                      id="slider-quran-english-size"
                      min="10"
                      max="60"
                      step="1"
                      value={quranEnglishSize}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 20;
                        setQuranEnglishSize(val);
                        onApplyQuranStyles({ englishSize: val });
                      }}
                      className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  {/* 3. FONT COLOR */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">FONT COLOR</span>
                      <span className="font-mono text-cyan-400 font-bold text-xs uppercase">{quranEnglishColor}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-0.5">
                      {/* Active Color Preview & Picker */}
                      <label
                        className="w-7 h-7 rounded border border-gray-700 cursor-pointer relative shrink-0 shadow-sm flex items-center justify-center transition hover:scale-105"
                        style={{ backgroundColor: quranEnglishColor }}
                        title="Pick custom color"
                      >
                        <input
                          type="color"
                          value={quranEnglishColor}
                          onChange={(e) => {
                            setQuranEnglishColor(e.target.value);
                            onApplyQuranStyles({ englishColor: e.target.value });
                          }}
                          className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
                        />
                      </label>
                      {/* Preset Color Swatches */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {['#FFFFFF', '#E2E8F0', '#FEF3C7', '#FEF08A', '#EC4899', '#06B6D4', '#94A3B8'].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              setQuranEnglishColor(c);
                              onApplyQuranStyles({ englishColor: c });
                            }}
                            className={`w-5 h-5 rounded-full transition-transform hover:scale-125 cursor-pointer border ${
                              quranEnglishColor.toLowerCase() === c.toLowerCase()
                                ? 'ring-2 ring-cyan-400 border-white scale-110'
                                : 'border-transparent opacity-90 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 4. TEXT EFFECT / GLOW */}
                  <div className="space-y-1.5">
                    <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">TEXT EFFECT / GLOW</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['normal', 'shadow', 'outline', 'neon'] as const).map((styleKey) => (
                        <button
                          key={styleKey}
                          type="button"
                          id={`btn-english-effect-${styleKey}`}
                          onClick={() => {
                            setQuranEnglishStyle(styleKey);
                            onApplyQuranStyles({ englishStyle: styleKey });
                          }}
                          className={`py-2 px-1 text-xs font-semibold rounded-lg transition capitalize border cursor-pointer ${
                            quranEnglishStyle === styleKey
                              ? 'bg-black text-white border-white shadow-md font-bold'
                              : 'bg-[#181822] text-gray-300 hover:text-white hover:bg-gray-800 border-gray-800'
                          }`}
                        >
                          {styleKey}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 5. VERTICAL ALIGNMENT (Y-AXIS) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">VERTICAL ALIGNMENT (Y-AXIS)</span>
                      <span className="font-mono text-cyan-400 font-bold text-xs">{quranEnglishY}%</span>
                    </div>
                    <input
                      type="range"
                      id="slider-quran-english-y"
                      min="10"
                      max="95"
                      step="1"
                      value={quranEnglishY}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 72;
                        setQuranEnglishY(val);
                        onApplyQuranStyles({ englishY: val });
                      }}
                      className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  {/* 6. Capitalize Translation Switch */}
                  <div className="flex items-center justify-between bg-[#0b0b0f] p-3 rounded-lg border border-gray-800">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-white">Capitalize Translation</p>
                      <p className="text-[10px] text-gray-400">Converts English clips to UPPERCASE</p>
                    </div>
                    <button
                      type="button"
                      id="toggle-quran-english-uppercase"
                      onClick={() => {
                        const next = !quranEnglishUppercase;
                        setQuranEnglishUppercase(next);
                        onApplyQuranStyles({ englishUppercase: next });
                      }}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer border ${
                        quranEnglishUppercase ? 'bg-cyan-500 border-cyan-400 justify-end' : 'bg-gray-800 border-gray-700 justify-start'
                      }`}
                    >
                      <span className="bg-black w-4 h-4 rounded-full shadow-md" />
                    </button>
                  </div>

                  {/* 7. Auto Word Wrap Switch */}
                  <div className="flex items-center justify-between bg-[#0b0b0f] p-3 rounded-lg border border-gray-800">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-white">Auto Word Wrap</p>
                      <p className="text-[10px] text-gray-400">Wrap long English text to multiple lines</p>
                    </div>
                    <button
                      type="button"
                      id="toggle-quran-english-wrap"
                      onClick={() => {
                        const next = !quranEnglishWrap;
                        setQuranEnglishWrap(next);
                        onApplyQuranStyles({ englishWrap: next });
                      }}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer border ${
                        quranEnglishWrap ? 'bg-cyan-500 border-cyan-400 justify-end' : 'bg-gray-800 border-gray-700 justify-start'
                      }`}
                    >
                      <span className="bg-black w-4 h-4 rounded-full shadow-md" />
                    </button>
                  </div>

                  {/* 8. MAX LINE WIDTH (CANVAS %) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">MAX LINE WIDTH (CANVAS %)</span>
                      <span className="font-mono text-cyan-400 font-bold text-xs">{quranEnglishMaxWidth}%</span>
                    </div>
                    <input
                      type="range"
                      id="slider-quran-english-max-width"
                      min="40"
                      max="100"
                      step="1"
                      value={quranEnglishMaxWidth}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 85;
                        setQuranEnglishMaxWidth(val);
                        onApplyQuranStyles({ englishMaxWidth: val });
                      }}
                      className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  {/* 9. LINE SPACING (HEIGHT) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">LINE SPACING (HEIGHT)</span>
                      <span className="font-mono text-cyan-400 font-bold text-xs">{quranEnglishLineHeight}X</span>
                    </div>
                    <input
                      type="range"
                      id="slider-quran-english-line-height"
                      min="1.0"
                      max="2.5"
                      step="0.1"
                      value={quranEnglishLineHeight}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 1.3;
                        setQuranEnglishLineHeight(val);
                        onApplyQuranStyles({ englishLineHeight: val });
                      }}
                      className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  {/* 10. TEXT ALIGNMENT */}
                  <div className="space-y-1.5">
                    <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">TEXT ALIGNMENT</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['left', 'center', 'right'] as const).map((alignKey) => (
                        <button
                          key={alignKey}
                          type="button"
                          id={`btn-english-align-${alignKey}`}
                          onClick={() => {
                            setQuranEnglishAlign(alignKey);
                            onApplyQuranStyles({ englishAlign: alignKey });
                          }}
                          className={`py-2 px-2 text-xs font-semibold rounded-lg transition capitalize border cursor-pointer ${
                            quranEnglishAlign === alignKey
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-md font-bold'
                              : 'bg-[#181822] text-gray-300 hover:text-white hover:bg-gray-800 border-gray-800'
                          }`}
                        >
                          {alignKey}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* BLOCK 6: MASTER APPLY ACTION BUTTON */}
                <button
                  type="button"
                  id="btn-apply-style-all-quran-clips"
                  onClick={() => onApplyQuranStyles()}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-600/90 via-yellow-600/90 to-amber-700/90 hover:from-amber-500 hover:to-yellow-500 text-white font-extrabold rounded-xl text-xs sm:text-sm transition-all shadow-lg shadow-amber-900/30 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer border border-amber-500/40 mt-1"
                >
                  <Sliders className="w-4 h-4 text-amber-300" />
                  <span>⚡ Apply Style to All Existing Quran Clips</span>
                </button>

                {/* Status Notifications */}
                {aligningStatus?.status === 'success' && (
                  <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-3 text-center space-y-1">
                    <p className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Quran Captions Successfully Generated!</span>
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Arabic & English tracks synced to timeline. Click Play on preview to view captions.
                    </p>
                  </div>
                )}

                {aligningStatus?.status === 'error' && (
                  <div className="bg-rose-950/40 border border-rose-500/30 rounded-lg p-3 text-center space-y-1">
                    <p className="text-xs font-bold text-rose-400">
                      Alignment Error
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {aligningStatus.log[aligningStatus.log.length - 1] || 'Unable to process audio.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'background' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-emerald-500/10 to-teal-600/10 border border-emerald-500/20 rounded-xl p-3.5 space-y-2">
              <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Globe className="w-4 h-4" />
                <span>FREE BG PORTAL (DYNAMIC SEARCH)</span>
              </h3>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Download premium, copyright-free high-definition background loops and photos for your video edits. Click items to add them directly to your active timeline video track using safe Tauri asset resolution.
              </p>
            </div>

            {/* Toggle Tabs: Image Background vs Video Background */}
            <div className="flex items-center gap-2 bg-[#16161c] p-1 rounded-xl border border-gray-800">
              <button
                type="button"
                id="tab-bg-video"
                onClick={() => setBgMediaType('video')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  bgMediaType === 'video'
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-[#22222a]'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Video Background</span>
              </button>
              <button
                type="button"
                id="tab-bg-image"
                onClick={() => setBgMediaType('image')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  bgMediaType === 'image'
                    ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-[#22222a]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Image Background</span>
              </button>
            </div>

            {/* Direct Search Bar */}
            <div className="space-y-2 bg-[#202026]/50 p-3 rounded-xl border border-gray-800">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                Search {bgMediaType === 'video' ? 'Video Loops' : 'Background Images'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={
                    bgMediaType === 'video'
                      ? 'e.g. stars background, rain loop, makkah...'
                      : 'e.g. mosque dome, starry night, sunset, mountains...'
                  }
                  value={bgSearchQuery}
                  onChange={(e) => setBgSearchQuery(e.target.value)}
                  className="w-full bg-[#15151a] border border-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
              </div>

              {/* Direct Web Portal Links */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {bgMediaType === 'video' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenExternalUrl(`https://www.pexels.com/search/video/${encodeURIComponent(bgSearchQuery || 'background loop')}/`)}
                      className="py-1.5 px-2 bg-[#2d2d38] hover:bg-[#3d3d4c] rounded-md transition text-[10px] text-white flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Pexels Videos</span>
                      <ExternalLink className="w-3 h-3 text-gray-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenExternalUrl(`https://pixabay.com/videos/search/${encodeURIComponent(bgSearchQuery || 'background loop')}/`)}
                      className="py-1.5 px-2 bg-[#2d2d38] hover:bg-[#3d3d4c] rounded-md transition text-[10px] text-white flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Pixabay Videos</span>
                      <ExternalLink className="w-3 h-3 text-gray-400" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenExternalUrl(`https://unsplash.com/s/photos/${encodeURIComponent(bgSearchQuery || 'background')}`)}
                      className="py-1.5 px-2 bg-[#2d2d38] hover:bg-[#3d3d4c] rounded-md transition text-[10px] text-white flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Unsplash Photos</span>
                      <ExternalLink className="w-3 h-3 text-gray-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenExternalUrl(`https://www.pexels.com/search/${encodeURIComponent(bgSearchQuery || 'background')}/`)}
                      className="py-1.5 px-2 bg-[#2d2d38] hover:bg-[#3d3d4c] rounded-md transition text-[10px] text-white flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Pexels Photos</span>
                      <ExternalLink className="w-3 h-3 text-gray-400" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Quick Keyword Suggestions */}
            <div className="space-y-1.5">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide px-1">
                Suggested {bgMediaType === 'video' ? 'Video' : 'Image'} Topics
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {(bgMediaType === 'video'
                  ? [
                      { label: '🌌 Stars', query: 'stars background loop' },
                      { label: '🌧️ Rain', query: 'rain on window loop' },
                      { label: '☁️ Slow Clouds', query: 'clouds timelapse slow' },
                      { label: '✨ Particles', query: 'particles black background' },
                      { label: '🌊 Waves', query: 'ocean waves slow' },
                      { label: '🌲 Dark Forest', query: 'misty forest dark' },
                      { label: '🕋 Makkah', query: 'makkah madinah' },
                    ]
                  : [
                      { label: '🕌 Mosque Dome', query: 'mosque dome architecture' },
                      { label: '✨ Night Sky', query: 'starry night galaxy' },
                      { label: '📜 Calligraphy', query: 'quran calligraphy gold' },
                      { label: '🌅 Sunset Peak', query: 'misty mountain sunset' },
                      { label: '🏜️ Desert Dunes', query: 'desert sand dunes' },
                      { label: '🌿 Islamic Art', query: 'islamic geometry pattern' },
                    ]
                ).map((tag) => (
                  <button
                    key={tag.label}
                    onClick={() => {
                      setBgSearchQuery(tag.query);
                      const searchUrl = bgMediaType === 'video'
                        ? `https://www.pexels.com/search/video/${encodeURIComponent(tag.query)}/`
                        : `https://unsplash.com/s/photos/${encodeURIComponent(tag.query)}`;
                      handleOpenExternalUrl(searchUrl);
                    }}
                    className="text-[10px] bg-[#1a1a22] hover:bg-[#282834] text-gray-300 px-2 py-1 rounded border border-gray-800 hover:border-gray-700 transition cursor-pointer"
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Curated Background Gallery Grid */}
            <div className="space-y-2.5 pt-1">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide px-1">
                Direct-Add {bgMediaType === 'video' ? 'Video Loops' : 'Background Photos'}
              </h4>
              <div className="space-y-2">
                {(bgMediaType === 'video'
                  ? [
                      {
                        id: 'bg-stars',
                        name: 'Stars & Galaxy Loop',
                        url: 'https://assets.mixkit.co/videos/preview/mixkit-background-of-stars-and-galaxy-in-the-space-34444-large.mp4',
                        duration: 13,
                        thumbnail: '🌌',
                        category: 'Space',
                        isImage: false,
                      },
                      {
                        id: 'bg-rain',
                        name: 'Rain On Glass Window',
                        url: 'https://assets.mixkit.co/videos/preview/mixkit-rain-drops-falling-on-a-window-pane-41617-large.mp4',
                        duration: 10,
                        thumbnail: '🌧️',
                        category: 'Nature',
                        isImage: false,
                      },
                      {
                        id: 'bg-clouds',
                        name: 'Slow Motion Sunset Clouds',
                        url: 'https://assets.mixkit.co/videos/preview/mixkit-clouds-moving-slowly-in-the-sky-41619-large.mp4',
                        duration: 15,
                        thumbnail: '☁️',
                        category: 'Clouds',
                        isImage: false,
                      },
                      {
                        id: 'bg-particles',
                        name: 'Golden Divine Particles',
                        url: 'https://assets.mixkit.co/videos/preview/mixkit-dust-particles-flying-slowly-in-the-air-42516-large.mp4',
                        duration: 12,
                        thumbnail: '✨',
                        category: 'VFX',
                        isImage: false,
                      },
                      {
                        id: 'bg-waves',
                        name: 'Ocean Waves Slow Mo',
                        url: 'https://assets.mixkit.co/videos/preview/mixkit-waves-breaking-and-splashing-in-slow-motion-41624-large.mp4',
                        duration: 12,
                        thumbnail: '🌊',
                        category: 'Nature',
                        isImage: false,
                      },
                      {
                        id: 'bg-forest',
                        name: 'Misty Coniferous Forest',
                        url: 'https://assets.mixkit.co/videos/preview/mixkit-dense-mist-in-a-coniferous-forest-41616-large.mp4',
                        duration: 11,
                        thumbnail: '🌲',
                        category: 'Scenic',
                        isImage: false,
                      },
                    ]
                  : [
                      {
                        id: 'bg-img-mosque',
                        name: 'Islamic Mosque Silhouette',
                        url: 'https://images.unsplash.com/photo-1542816417-0983c9c9ad53?w=1200&auto=format&fit=crop&q=80',
                        duration: 10,
                        thumbnail: '🕌',
                        category: 'Architecture',
                        isImage: true,
                      },
                      {
                        id: 'bg-img-galaxy',
                        name: 'Deep Space Starry Cosmos',
                        url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1200&auto=format&fit=crop&q=80',
                        duration: 10,
                        thumbnail: '🌌',
                        category: 'Cosmos',
                        isImage: true,
                      },
                      {
                        id: 'bg-img-sunset',
                        name: 'Misty Mountain Sunset Glow',
                        url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&auto=format&fit=crop&q=80',
                        duration: 10,
                        thumbnail: '🌅',
                        category: 'Nature',
                        isImage: true,
                      },
                      {
                        id: 'bg-img-quran',
                        name: 'Golden Quranic Manuscript',
                        url: 'https://images.unsplash.com/photo-1584282676008-ef0fef197e70?w=1200&auto=format&fit=crop&q=80',
                        duration: 10,
                        thumbnail: '📜',
                        category: 'Islamic Art',
                        isImage: true,
                      },
                      {
                        id: 'bg-img-desert',
                        name: 'Golden Sand Dunes Evening',
                        url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=1200&auto=format&fit=crop&q=80',
                        duration: 10,
                        thumbnail: '🏜️',
                        category: 'Landscape',
                        isImage: true,
                      },
                      {
                        id: 'bg-img-pattern',
                        name: 'Dark Emerald Geometric Motif',
                        url: 'https://images.unsplash.com/photo-1564121211835-e88c852648ab?w=1200&auto=format&fit=crop&q=80',
                        duration: 10,
                        thumbnail: '🌿',
                        category: 'Pattern',
                        isImage: true,
                      },
                    ]
                ).map((bg) => (
                  <div
                    key={bg.id}
                    className="group bg-[#202026] hover:bg-[#282830] rounded-lg p-2 flex items-center gap-2.5 border border-transparent hover:border-emerald-800/50 transition cursor-pointer"
                  >
                    <div className="w-10 h-10 bg-slate-800 rounded flex items-center justify-center text-lg relative overflow-hidden shrink-0">
                      {bg.isImage ? (
                        <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                      ) : (
                        bg.thumbnail
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{bg.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] text-emerald-400 bg-emerald-950/40 px-1 py-0.2 rounded uppercase font-mono">{bg.category}</span>
                        <span className="text-[9px] text-gray-400 font-mono">{bg.isImage ? 'IMAGE' : `${bg.duration}s`}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Direct Download Badge */}
                      <a
                        href={bg.url}
                        download={`${bg.id}.${bg.isImage ? 'jpg' : 'mp4'}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded bg-[#2a2a34] hover:bg-emerald-500 hover:text-black transition text-gray-400"
                        title="Download Asset File"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      {/* Add directly to CuteCut timeline using safe Tauri asset URL */}
                      <button
                        onClick={() => {
                          const safeUrl = resolveTauriAssetUrl(bg.url);
                          onAddClip({
                            name: bg.name,
                            type: ClipType.VIDEO,
                            isImage: bg.isImage,
                            url: safeUrl,
                            duration: bg.duration,
                            sourceStart: 0,
                            sourceDuration: bg.duration,
                            playbackRate: 1.0,
                            volume: 1.0,
                            filters: {
                              brightness: 100,
                              contrast: 100,
                              saturation: 100,
                              grayscale: 0,
                              sepia: 0,
                              invert: 0,
                              hueRotate: 0,
                              chromaKey: {
                                enabled: false,
                                color: '#00ff00',
                                threshold: 30,
                                smoothness: 10,
                              },
                            },
                          });
                        }}
                        className="p-1.5 rounded bg-[#2a2a34] hover:bg-emerald-500 hover:text-black transition text-white cursor-pointer"
                        title="Add to Editor Timeline"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'watermark' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-amber-500/10 to-yellow-600/10 border border-amber-500/20 rounded-xl p-3.5 space-y-2">
              <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>🛡️ ADD CHANNEL WATERMARK / LOGO</span>
              </h3>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Overlay your YouTube channel emblem, Islamic branding badge, or custom watermark graphic seamlessly onto the video canvas viewport.
              </p>
            </div>

            {/* Toggle Watermark Switch */}
            <div className="bg-[#202026] p-3 rounded-xl border border-gray-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">Enable Channel Logo</p>
                <p className="text-[10px] text-gray-400">Display persistent brand overlay on canvas</p>
              </div>
              <input
                id="watermark-toggle"
                type="checkbox"
                checked={watermark?.enabled ?? false}
                onChange={(e) => {
                  if (setWatermark) {
                    setWatermark(prev => ({ ...prev, enabled: e.target.checked }));
                  }
                }}
                className="w-5 h-5 rounded text-amber-500 bg-gray-800 border-gray-700 cursor-pointer accent-amber-500"
              />
            </div>

            {/* Logo Selection & Custom Upload */}
            <div className="space-y-3 bg-[#202026] p-3 rounded-xl border border-gray-800">
              <h4 className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">
                1. Upload Custom Logo or Select Preset
              </h4>

              {/* Custom Upload Button */}
              <label
                htmlFor="watermark-file-upload"
                className="flex items-center justify-center gap-2 w-full py-2.5 px-3 bg-[#16161c] hover:bg-[#282832] border border-dashed border-gray-700 rounded-lg cursor-pointer text-xs font-semibold text-amber-400 transition"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Custom Logo (.PNG / .SVG)</span>
                <input
                  id="watermark-file-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0] && setWatermark) {
                      const file = e.target.files[0];
                      const url = URL.createObjectURL(file);
                      setWatermark(prev => ({ ...prev, url, enabled: true }));
                    }
                  }}
                />
              </label>

              {/* Preset Islamic Logos Grid */}
              <div className="space-y-1.5 pt-2 border-t border-gray-800">
                <span className="text-[10px] text-gray-400 font-bold uppercase">Preset Branding Stamps</span>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[
                    { id: 'wm-bismillah', name: '🕌 Bismillah Badge', url: 'https://images.unsplash.com/photo-1542816417-0983c9c9ad53?w=300&auto=format&fit=crop&q=80' },
                    { id: 'wm-crescent', name: '🌙 Gold Crescent', url: 'https://images.unsplash.com/photo-1564121211835-e88c852648ab?w=300&auto=format&fit=crop&q=80' },
                    { id: 'wm-quran', name: '📜 Quranic Medallion', url: 'https://images.unsplash.com/photo-1584282676008-ef0fef197e70?w=300&auto=format&fit=crop&q=80' },
                    { id: 'wm-neon', name: '✨ Neon Glow Emblem', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=300&auto=format&fit=crop&q=80' },
                    { id: 'wm-hd', name: '🎥 HD Recitation Seal', url: 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=300&auto=format&fit=crop&q=80' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        if (setWatermark) {
                          setWatermark(prev => ({ ...prev, url: preset.url, enabled: true }));
                        }
                      }}
                      className={`p-2 rounded-lg border text-left flex items-center gap-2.5 transition ${watermark?.url === preset.url ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-[#16161c] border-gray-800 text-gray-300 hover:border-gray-600'}`}
                    >
                      <img src={preset.url} alt={preset.name} className="w-7 h-7 rounded object-cover border border-amber-500/30" />
                      <span className="text-[10px] font-bold truncate">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Corner Alignment Selection */}
            <div className="space-y-3 bg-[#202026] p-3 rounded-xl border border-gray-800">
              <h4 className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">
                2. Screen Corner Alignment
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { pos: 'top-left', label: '↖️ Top Left' },
                  { pos: 'top-right', label: '↗️ Top Right' },
                  { pos: 'bottom-left', label: '↙️ Bottom Left' },
                  { pos: 'bottom-right', label: '↘️ Bottom Right' },
                ].map(({ pos, label }) => (
                  <button
                    key={pos}
                    onClick={() => {
                      if (setWatermark) {
                        setWatermark(prev => ({ ...prev, position: pos as any }));
                      }
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition ${watermark?.position === pos ? 'bg-amber-500 text-black border-amber-400' : 'bg-[#16161c] text-gray-300 border-gray-800 hover:text-white'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Transparency & Scale Controls */}
            <div className="space-y-3 bg-[#202026] p-3 rounded-xl border border-gray-800">
              <h4 className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">
                3. Transparency & Size
              </h4>

              {/* Opacity Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-gray-400">
                  <span>Logo Opacity (Transparency)</span>
                  <span className="font-mono text-amber-400 font-bold">{Math.round((watermark?.opacity ?? 0.8) * 100)}%</span>
                </div>
                <input
                  id="watermark-opacity-slider"
                  type="range"
                  min="10"
                  max="100"
                  value={Math.round((watermark?.opacity ?? 0.8) * 100)}
                  onChange={(e) => {
                    if (setWatermark) {
                      const val = parseInt(e.target.value) / 100;
                      setWatermark(prev => ({ ...prev, opacity: val }));
                    }
                  }}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              {/* Scale Slider */}
              <div className="space-y-1 pt-2 border-t border-gray-800">
                <div className="flex justify-between text-[11px] text-gray-400">
                  <span>Logo Size / Scale</span>
                  <span className="font-mono text-amber-400 font-bold">{watermark?.scale ?? 22}%</span>
                </div>
                <input
                  id="watermark-scale-slider"
                  type="range"
                  min="10"
                  max="50"
                  value={watermark?.scale ?? 22}
                  onChange={(e) => {
                    if (setWatermark) {
                      setWatermark(prev => ({ ...prev, scale: parseInt(e.target.value) }));
                    }
                  }}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* CAPCUT PRO ALL-IN-ONE VIDEO EFFECTS PANEL */}
        {activeTab === 'effects' && (
          <EffectsPanel
            selectedClip={selectedClip || null}
            onUpdateClip={onUpdateClip || (() => {})}
            onAddEffectClip={(name, config) => {
              onAddClip({
                name: `FX: ${name}`,
                type: ClipType.VIDEO,
                ...config
              });
            }}
            tracks={tracks}
            width={width}
          />
        )}
      </div>
    </div>
  );
}
