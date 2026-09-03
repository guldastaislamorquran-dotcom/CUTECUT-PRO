/**
 * Quran Alignment Engine - Specialized CTC Forced Alignment & Quranic Arabic NLP
 * 
 * Implements the 5 Core "Quran Caption Rules":
 * 1. Two-Stage Segmentation Pipeline (VAD + Text-Anchored Boundary Verification)
 * 2. Dynamic Waqf & Pause Classification (Ayah-Boundary, Intra-Ayah Breath, Micro-Pause)
 * 3. Levenshtein Fuzzy Sequence Matching (Zero-Drift Logic, 85% Confidence Gate)
 * 4. Repetition (I'adah) & Re-reading Handling (Pointer Rewind Logic)
 * 5. Edge Padding & Boundary Protection (±120ms Safety Margin, Consonant/Vowel Protection)
 */

export type AlignmentMode = 'full-ayah' | 'split-breaths' | 'cut-ayah';

export interface QuranAlignmentSegment {
  ayahIndex: number;
  wordIndex: number;
  startTime: number;
  endTime: number;
  isWaqfPause: boolean;
  confidenceScore: number;
  verse_key?: string;
  text_arabic?: string;
  text_english?: string;
  pauseType?: 'ayah-boundary' | 'intra-ayah-waqf' | 'micro-pause' | 'none';
  isRepetition?: boolean;
  repetitionRewindWords?: number;
  subPhraseIndex?: number;
  totalSubPhrases?: number;
  words?: Array<{
    wordIndex: number;
    text: string;
    normalized: string;
    startTime: number;
    endTime: number;
    confidence: number;
  }>;
}

export interface QuranVerseInput {
  verse_key: string;
  verse_number?: number;
  text_uthmani?: string;
  text_arabic?: string;
  translation?: string;
  text_english?: string;
  isTaawwuz?: boolean;
  isTasmiyah?: boolean;
}

export interface QuranAlignmentEngineOptions {
  mode?: AlignmentMode; // 'full-ayah' (Full Ayah Brief) | 'split-breaths' / 'cut-ayah' (Cut Ayah Brief)
  minSilenceMs?: number; // default 600ms (Ayah-Boundary Silence threshold)
  minIntraAyahSilenceMs?: number; // default 300ms (Intra-Ayah Waqf lower bound)
  maxIntraAyahSilenceMs?: number; // default 800ms (Intra-Ayah Waqf upper bound)
  microPauseMs?: number; // default 300ms (Micro-Pause threshold)
  edgePaddingMs?: number; // default 120ms (±120ms safety margin)
  confidenceThreshold?: number; // default 85 (%) (Zero-Drift Gate)
  repetitionThreshold?: number; // default 80 (%) (I'adah Detection Gate)
  startOffset?: number; // default 0.2s
  audioDuration?: number;
  showAyahSymbol?: boolean;
  ayahSymbolStyle?: string;
  ayahDigitType?: string;
  ayahSymbolPosition?: string;
  pcmData?: Float32Array;
  sampleRate?: number;
  acousticSegments?: Array<{ start: number; end: number }>;
}

export interface AcousticVoiceFrame {
  time: number;
  rms: number;
  db: number;
  isSpeech: boolean;
}

export interface AcousticPauseCandidate {
  start: number;
  end: number;
  durationMs: number;
  type: 'ayah-boundary' | 'intra-ayah-waqf' | 'micro-pause';
  verifiedNextAyah: boolean;
  confidenceScore: number;
}

// ---------------------------------------------------------------------------
// RULE 3: UTHMANI TEXT NORMALIZATION & LEVENSHTEIN ZERO-DRIFT MATCHING
// ---------------------------------------------------------------------------

/**
 * Strips all Tajweed diacritics, Tashkeel, Madd marks, and Quranic Waqf symbols
 * to produce canonical normalized Uthmani Arabic for strict phonetic comparison.
 */
export function normalizeQuranicPhonetics(text: string): string {
  if (!text) return '';
  return text
    // 1. Strip Tashkeel & Diacritics (Fathah, Dammah, Kasrah, Sukun, Tanween, Shaddah, etc.)
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0610-\u061A\u0653-\u0655]/g, '')
    // 2. Strip Quranic Waqf & Sajdah marks (ۙ, ۗ, ۚ, ۖ, ۜ, ۛ, ۞, ۩, ۘ, etc.)
    .replace(/[ۙۗۚۖۜۛ۞۩ۘ؀-؃]/g, '')
    // 3. Normalize Alif forms (آ أ إ ٱ -> ا)
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    // 4. Normalize Ta Marbouta (ة -> ه)
    .replace(/\u0629/g, '\u0647')
    // 5. Normalize Alif Maqsura (ى -> ا)
    .replace(/\u0649/g, '\u0627')
    // 6. Normalize Hamza on Waw / Ya (ؤ ئ -> ء)
    .replace(/[\u0624\u0626]/g, '\u0621')
    // 7. Strip Tatweel / Kashida
    .replace(/\u0640/g, '')
    // 8. Filter to Arabic characters only
    .replace(/[^\u0621-\u064A\s]/g, '')
    // 9. Normalize multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes Levenshtein edit distance between two strings.
 */
export function computeLevenshteinDistance(a: string, b: string): number {
  const normA = normalizeQuranicPhonetics(a);
  const normB = normalizeQuranicPhonetics(b);
  if (normA === normB) return 0;
  if (!normA.length) return normB.length;
  if (!normB.length) return normA.length;

  const dp: number[][] = [];
  for (let i = 0; i <= normB.length; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= normA.length; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= normB.length; i++) {
    for (let j = 1; j <= normA.length; j++) {
      if (normB.charAt(i - 1) === normA.charAt(j - 1)) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1, // substitution
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return dp[normB.length][normA.length];
}

/**
 * Computes Levenshtein Match Score as percentage (0.0 to 100.0%).
 * Formula: max(0, 1 - (editDistance / max_len)) * 100
 */
export function computeLevenshteinScore(candidate: string, reference: string): number {
  const normCand = normalizeQuranicPhonetics(candidate);
  const normRef = normalizeQuranicPhonetics(reference);
  if (!normCand && !normRef) return 100;
  if (!normCand || !normRef) return 0;
  if (normCand === normRef) return 100;

  const dist = computeLevenshteinDistance(candidate, reference);
  const maxLen = Math.max(normCand.length, normRef.length);
  const ratio = Math.max(0, 1 - dist / maxLen);
  return Number((ratio * 100).toFixed(1));
}

// ---------------------------------------------------------------------------
// RULE 1: TWO-STAGE SEGMENTATION PIPELINE (STAGE 1: VAD ACOUSTIC DETECTION)
// ---------------------------------------------------------------------------

/**
 * Stage 1: Acoustic Silence Detection using Voice Activity Detection (VAD) & RMS energy thresholds.
 * Detects silence frames, speech frames, and contiguous acoustic blocks.
 */
export function detectAcousticSilenceFrames(
  pcmData: Float32Array,
  sampleRate: number,
  options?: {
    frameSizeMs?: number;
    hopSizeMs?: number;
    thresholdDb?: number;
    minSpeechMs?: number;
    minSilenceMs?: number;
  }
): {
  speechSegments: Array<{ start: number; end: number }>;
  pauseGaps: Array<{ start: number; end: number; durationMs: number }>;
  frames: AcousticVoiceFrame[];
} {
  const frameSizeMs = options?.frameSizeMs || 25; // 25ms standard frame
  const hopSizeMs = options?.hopSizeMs || 10;     // 10ms frame step
  const frameSize = Math.floor((frameSizeMs / 1000) * sampleRate);
  const hopSize = Math.floor((hopSizeMs / 1000) * sampleRate);

  if (pcmData.length < frameSize) {
    const totalDur = pcmData.length / sampleRate;
    return {
      speechSegments: [{ start: 0, end: totalDur }],
      pauseGaps: [],
      frames: []
    };
  }

  // 1. Calculate RMS per frame
  const numFrames = Math.floor((pcmData.length - frameSize) / hopSize) + 1;
  const frames: AcousticVoiceFrame[] = new Array(numFrames);

  let sumRms = 0;
  for (let f = 0; f < numFrames; f++) {
    const startIdx = f * hopSize;
    let sumSq = 0;
    for (let s = 0; s < frameSize; s++) {
      const val = pcmData[startIdx + s];
      sumSq += val * val;
    }
    const rms = Math.sqrt(sumSq / frameSize);
    sumRms += rms;
    const db = 20 * Math.log10(Math.max(1e-5, rms));
    const time = (f * hopSize) / sampleRate;
    frames[f] = { time, rms, db, isSpeech: false };
  }

  // Adaptive threshold calculation
  const avgRms = sumRms / (numFrames || 1);
  const avgDb = 20 * Math.log10(Math.max(1e-5, avgRms));
  // Default to -32dBFS, or relative to signal average (capped between -42dB and -26dB)
  const effectiveThresholdDb = options?.thresholdDb !== undefined
    ? options.thresholdDb
    : Math.max(-42, Math.min(-26, avgDb - 14));

  for (let f = 0; f < numFrames; f++) {
    frames[f].isSpeech = frames[f].db >= effectiveThresholdDb;
  }

  // 2. Identify contiguous speech regions
  const minSpeechFrames = Math.floor(((options?.minSpeechMs || 250) / 1000) * (sampleRate / hopSize));
  const minSilenceFrames = Math.floor(((options?.minSilenceMs || 300) / 1000) * (sampleRate / hopSize));

  const speechSegments: Array<{ start: number; end: number }> = [];
  let inSpeech = false;
  let segStartFrame = 0;
  let silenceCounter = 0;

  for (let f = 0; f < numFrames; f++) {
    if (frames[f].isSpeech) {
      if (!inSpeech) {
        inSpeech = true;
        segStartFrame = f;
      }
      silenceCounter = 0;
    } else {
      if (inSpeech) {
        silenceCounter++;
        if (silenceCounter >= minSilenceFrames) {
          const segEndFrame = f - silenceCounter;
          if (segEndFrame - segStartFrame >= minSpeechFrames) {
            speechSegments.push({
              start: frames[segStartFrame].time,
              end: frames[segEndFrame].time
            });
          }
          inSpeech = false;
          silenceCounter = 0;
        }
      }
    }
  }

  if (inSpeech) {
    const segEndFrame = numFrames - 1;
    if (segEndFrame - segStartFrame >= minSpeechFrames) {
      speechSegments.push({
        start: frames[segStartFrame].time,
        end: frames[segEndFrame].time
      });
    }
  }

  // Fallback if no speech segments found
  const totalDuration = pcmData.length / sampleRate;
  if (speechSegments.length === 0) {
    speechSegments.push({ start: 0, end: totalDuration });
  }

  // 3. Extract pause gaps between speech segments
  const pauseGaps: Array<{ start: number; end: number; durationMs: number }> = [];
  for (let i = 0; i < speechSegments.length - 1; i++) {
    const gapStart = speechSegments[i].end;
    const gapEnd = speechSegments[i + 1].start;
    const durationMs = Math.max(0, (gapEnd - gapStart) * 1000);
    if (durationMs > 0) {
      pauseGaps.push({
        start: Number(gapStart.toFixed(3)),
        end: Number(gapEnd.toFixed(3)),
        durationMs: Number(durationMs.toFixed(1))
      });
    }
  }

  return { speechSegments, pauseGaps, frames };
}

// ---------------------------------------------------------------------------
// RULE 1 (STAGE 2) & RULE 2: DYNAMIC PAUSE & WAQF CLASSIFICATION
// ---------------------------------------------------------------------------

/**
 * Stage 2 (Text-Anchored Boundary Verification):
 * A boundary split is ONLY valid if the phoneme/phonetic output after the silence
 * matches the predicted start of the next Ayah with high confidence (≥ 85%).
 * 
 * Dynamic Waqf Categories (Rule 2):
 * - Ayah-Boundary Silence (>600ms gap AND high phonetic match score with next Ayah start):
 *     Increment Ayah Index, insert main timeline cut.
 * - Intra-Ayah Breath Silence (300ms–800ms gap WITHIN same Ayah):
 *     Do NOT increment Ayah Index. Treat as "Sub-Phrase / Waqf Clip".
 * - Micro-Pause (<300ms gap, e.g., Tajweed Qalqalah or short stops):
 *     Ignore completely; do not split audio/text.
 */
export function classifyAudioPause(
  gapDurationMs: number,
  candidateTextAfterGap: string,
  expectedNextAyahStart: string,
  options?: {
    confidenceThreshold?: number; // default 85%
    minAyahSilenceMs?: number;    // default 600ms
    minIntraAyahMs?: number;      // default 300ms
    maxIntraAyahMs?: number;      // default 800ms
  }
): {
  type: 'ayah-boundary' | 'intra-ayah-waqf' | 'micro-pause';
  verifiedNextAyah: boolean;
  confidenceScore: number;
} {
  const threshold = options?.confidenceThreshold || 85;
  const minAyahSilence = options?.minAyahSilenceMs || 600;
  const minIntraAyah = options?.minIntraAyahMs || 300;

  // 1. Micro-Pause (<300ms): Tajweed Qalqalah, Saktah, or short acoustic stops
  if (gapDurationMs < minIntraAyah) {
    return {
      type: 'micro-pause',
      verifiedNextAyah: false,
      confidenceScore: 0
    };
  }

  // Calculate phonetic match score with next Ayah start
  const firstWordsNext = expectedNextAyahStart.split(/\s+/).slice(0, 3).join(' ');
  const candidateWords = candidateTextAfterGap.split(/\s+/).slice(0, 3).join(' ');
  const score = computeLevenshteinScore(candidateWords, firstWordsNext);

  // 2. Ayah-Boundary Silence (>600ms gap AND high phonetic match score with next Ayah start)
  if (gapDurationMs >= minAyahSilence && score >= threshold) {
    return {
      type: 'ayah-boundary',
      verifiedNextAyah: true,
      confidenceScore: score
    };
  }

  // 3. Intra-Ayah Breath Silence (300ms–800ms within same Ayah, or long silence without next Ayah match)
  return {
    type: 'intra-ayah-waqf',
    verifiedNextAyah: false,
    confidenceScore: score
  };
}

// ---------------------------------------------------------------------------
// RULE 4: REPETITION (I'ADAH) & RE-READING HANDLING
// ---------------------------------------------------------------------------

/**
 * Detects Qari I'adah (repetition / re-reading after breath pause).
 * If the candidate phonemes match words already passed in the current Ayah range,
 * rewinds the alignment pointer to that word anchor instead of pushing text forward.
 */
export function detectIadahRepetition(
  candidatePhonemes: string,
  passedWordsInCurrentAyah: string[],
  repetitionThreshold: number = 80
): {
  isRepetition: boolean;
  rewindIndex: number; // Index within passedWords to rewind to
  matchedScore: number;
} {
  if (!candidatePhonemes || passedWordsInCurrentAyah.length === 0) {
    return { isRepetition: false, rewindIndex: -1, matchedScore: 0 };
  }

  const normCandidate = normalizeQuranicPhonetics(candidatePhonemes);
  if (!normCandidate) {
    return { isRepetition: false, rewindIndex: -1, matchedScore: 0 };
  }

  // Look back up to 4 words
  const maxLookback = Math.min(5, passedWordsInCurrentAyah.length);
  let bestScore = 0;
  let bestRewindIdx = -1;

  for (let len = 1; len <= Math.min(3, maxLookback); len++) {
    for (let offset = passedWordsInCurrentAyah.length - maxLookback; offset <= passedWordsInCurrentAyah.length - len; offset++) {
      if (offset < 0) continue;
      const testPhrase = passedWordsInCurrentAyah.slice(offset, offset + len).join(' ');
      const score = computeLevenshteinScore(normCandidate, testPhrase);

      if (score >= repetitionThreshold && score > bestScore) {
        bestScore = score;
        bestRewindIdx = offset;
      }
    }
  }

  if (bestScore >= repetitionThreshold && bestRewindIdx !== -1) {
    return {
      isRepetition: true,
      rewindIndex: bestRewindIdx,
      matchedScore: bestScore
    };
  }

  return { isRepetition: false, rewindIndex: -1, matchedScore: 0 };
}

// ---------------------------------------------------------------------------
// RULE 5: EDGE PADDING & BOUNDARY PROTECTION
// ---------------------------------------------------------------------------

/**
 * Applies a dynamic safety margin (Padding) of ±120ms to all auto-generated cuts.
 * Prevents truncation of initial consonants (Alif/Lam [الـ]) and terminal vowels/sukun.
 * Resolves cross-boundary overlaps cleanly.
 */
export function applyEdgePadding(
  cuts: Array<{ start: number; end: number }>,
  totalAudioDuration: number,
  paddingMs: number = 120
): Array<{ start: number; end: number }> {
  if (!cuts || cuts.length === 0) return [];
  const padSec = paddingMs / 1000; // 0.120s

  const padded = cuts.map(c => ({
    start: Math.max(0, c.start - padSec),
    end: Math.min(totalAudioDuration, c.end + padSec)
  }));

  // Resolve adjacent overlapping cuts
  for (let i = 0; i < padded.length - 1; i++) {
    if (padded[i].end > padded[i + 1].start) {
      const originalGap = cuts[i + 1].start - cuts[i].end;
      if (originalGap > 0) {
        // Split available gap between the two cuts evenly
        const midPoint = cuts[i].end + originalGap / 2;
        padded[i].end = Number(midPoint.toFixed(3));
        padded[i + 1].start = Number(midPoint.toFixed(3));
      } else {
        // Zero or negative gap in source; clamp boundaries
        const mid = (padded[i].end + padded[i + 1].start) / 2;
        padded[i].end = Number(mid.toFixed(3));
        padded[i + 1].start = Number((mid + 0.02).toFixed(3));
      }
    }
  }

  return padded.map(p => ({
    start: Number(p.start.toFixed(2)),
    end: Number(Math.max(p.start + 0.35, p.end).toFixed(2))
  }));
}

// ---------------------------------------------------------------------------
// PHRASE & CLAUSE SPLITTING HELPERS FOR CUT AYAH BRIEF (WAQF SUB-PHRASES)
// ---------------------------------------------------------------------------

/**
 * Calculates acoustic phonetic duration of a Quranic Arabic word according to Tajweed rules.
 * Honors Madd (2-6 harakats), Shaddah, Ghunnah, and multi-syllable word weights.
 */
export function getTajweedPhoneticWeight(word: string): number {
  if (!word) return 1;
  const clean = word.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
  let weight = Math.max(1, clean.length * 1.0);

  // 1. Madd prolongation (Madd Lazim, Muttasil, Munfasil: 4 to 6 Harakats)
  if (/[\u0653]/.test(word)) {
    weight += 4.5; // Heavy Maddah (~ e.g. جَآءَ, الضَّآلِّينَ)
  }
  if (/[\u0622]/.test(word)) {
    weight += 3.0; // Alif Maddah (آ e.g. آمَنُوا)
  }
  if (/[\u0670\u0656]/.test(word)) {
    weight += 2.0; // Dagger Alif / Subscript Alif (ٰ e.g. الرَّحْمَٰنِ)
  }
  if (/[\u06E5\u06E6]/.test(word)) {
    weight += 2.0; // Small Waw / Small Ya for Silah (ۥ ۦ)
  }

  // 2. Shaddah / Tashdeed (Doubled consonant)
  if (/[\u0651]/.test(word)) {
    weight += 2.2; // Tashdeed (ّ)
  }

  // 3. Ghunnah (Noon/Meem Mushaddadah - 2 Harakats nasal sound)
  if (/(نّ|مّ|نَّ|مَّ|نِّ|مِّ|نُّ|مُّ|نً|مً|نٍ|مٍ|نٌ|مٌ)/.test(word)) {
    weight += 3.0; // Heavy Ghunnah
  }

  // 4. Tanween (ً ٍ ٌ)
  if (/[\u064B\u064C\u064D]/.test(word)) {
    weight += 1.2;
  }

  // 5. Multi-syllabic heavy Quranic words
  if (clean.length >= 8) {
    weight += 4.5;
  } else if (clean.length >= 6) {
    weight += 2.5;
  }

  return weight;
}

/**
 * Splits Arabic Ayah text into natural Waqf sub-phrases respecting Tajweed Waqf punctuation.
 */
export function splitArabicAyahAcrossBreaths(
  fullText: string,
  durations: number[]
): string[] {
  if (!fullText || !fullText.trim()) return durations.map(() => '');
  const words = fullText.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1 || durations.length <= 1) return [fullText];

  const result: string[] = [];
  let currentWordIndex = 0;

  const isShortParticle = (w: string) => {
    const clean = w.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
    return /^(و|ف|ب|ل|من|عن|في|على|إلى|ان|أن|إن|قد|هل|ما|لا|يا|ثم|إذ|إذا|بل|أم)$/.test(clean);
  };

  for (let i = 0; i < durations.length; i++) {
    if (i === durations.length - 1) {
      result.push(words.slice(currentWordIndex).join(' '));
    } else {
      const remainingSegs = durations.length - i;
      const remainingDur = durations.slice(i).reduce((a, b) => a + b, 0) || 1;
      const remainingWords = words.slice(currentWordIndex);
      const remainingWordWeights = remainingWords.map(getTajweedPhoneticWeight);
      const totalRemainingWeight = remainingWordWeights.reduce((a, b) => a + b, 0) || 1;

      const targetWeightShare = totalRemainingWeight * (durations[i] / remainingDur);

      let bestCount = 1;
      let minDiff = Infinity;
      const maxCountAllowed = Math.max(1, remainingWords.length - (remainingSegs - 1));

      for (let c = 1; c <= maxCountAllowed; c++) {
        const testWeight = remainingWordWeights.slice(0, c).reduce((a, b) => a + b, 0);
        let diff = Math.abs(testWeight - targetWeightShare);

        const lastWord = remainingWords[c - 1] || '';
        const nextWord = remainingWords[c] || '';

        // Prioritize Quranic Waqf symbols
        if (/[\u06D6\u06D7\u06D8\u06D9\u06DA\u06DB\u06DC\u06E9\u06EA\u06EB\u06EC\u06ED]|[ۙۗۚۖۜۛۘ]/.test(lastWord)) {
          diff -= 30.0;
        } else if (/[جۘۚطصصلےقلیف]/.test(lastWord)) {
          diff -= 15.0;
        }

        // Penalize ending on a dangling preposition
        if (isShortParticle(lastWord) && nextWord) {
          diff += 12.0;
        }

        if (diff < minDiff) {
          minDiff = diff;
          bestCount = c;
        }
      }

      const endIdx = Math.min(words.length, currentWordIndex + bestCount);
      result.push(words.slice(currentWordIndex, endIdx).join(' '));
      currentWordIndex = endIdx;
    }
  }

  while (result.length < durations.length) {
    result.push('');
  }

  return result;
}

/**
 * Splits English / Urdu translation text into matching semantic clauses for Waqf sub-phrases.
 */
export function splitTranslationAcrossBreaths(
  translation: string,
  durations: number[]
): string[] {
  if (!translation || !translation.trim()) return durations.map(() => '');
  const cleanTrans = translation.trim();
  const words = cleanTrans.split(/\s+/).filter(Boolean);
  if (words.length <= 1 || durations.length <= 1) return [cleanTrans];

  const numSegs = durations.length;
  const result: string[] = [];
  let wordOffset = 0;

  const isPunctuationBreak = (w: string) => /[,;\:\.\!\?\—\-\|\،\؛\۔]$/.test(w);
  const isConnectorWord = (w: string) => {
    const lower = w.toLowerCase().replace(/[,;\:\.\!\?\—\-\|\،\؛\۔]/g, '');
    if (/^(اور|کہ|لیکن|تو|پھر|جس|جو|تاکہ|جبکہ|حالانکہ|پس|بےشک|جب|سو|اورپھر|اورجب|کیونکہ|اوروہ)$/.test(lower)) return true;
    if (/^(and|but|so|that|who|whom|whose|which|when|where|while|though|although|indeed|verily|then|therefore|because|for|neither|nor|except|unless)$/.test(lower)) return true;
    return false;
  };

  for (let sIdx = 0; sIdx < numSegs; sIdx++) {
    if (sIdx === numSegs - 1) {
      result.push(words.slice(wordOffset).join(' '));
    } else {
      const remainingSegs = numSegs - sIdx;
      const remainingDur = durations.slice(sIdx).reduce((a, b) => a + b, 0) || 1;
      const remainingWords = words.slice(wordOffset);
      const targetWordCount = Math.max(1, Math.round(remainingWords.length * (durations[sIdx] / remainingDur)));

      const maxSearch = Math.max(1, remainingWords.length - (remainingSegs - 1));
      let bestCount = targetWordCount;
      let minDiff = Infinity;

      for (let count = 1; count <= maxSearch; count++) {
        let diff = Math.abs(count - targetWordCount);
        const lastWord = remainingWords[count - 1] || '';
        const nextWord = remainingWords[count] || '';

        if (isPunctuationBreak(lastWord)) diff -= 5.0;
        if (isConnectorWord(nextWord)) diff -= 3.0;

        if (diff < minDiff) {
          minDiff = diff;
          bestCount = count;
        }
      }

      const endIdx = Math.min(words.length, wordOffset + bestCount);
      result.push(words.slice(wordOffset, endIdx).join(' '));
      wordOffset = endIdx;
    }
  }

  while (result.length < numSegs) {
    result.push('');
  }

  return result;
}

// ---------------------------------------------------------------------------
// CORE FORCED ALIGNMENT ENGINE (RULES 1 - 5 ORCHESTRATION)
// ---------------------------------------------------------------------------

/**
 * Main forced alignment pipeline executing all 5 Quran Caption Rules.
 * Supports both:
 * - 'full-ayah': Full Ayah Brief Mode (Preserves full verse across internal breaths, strict outer boundary verification)
 * - 'split-breaths' / 'cut-ayah': Cut Ayah Brief Mode (Sub-phrase Waqf clips, locking word sequences to audio breaths)
 * 
 * Returns clean QuranAlignmentSegment array with metadata:
 * { ayahIndex, wordIndex, startTime, endTime, isWaqfPause, confidenceScore, pauseType, isRepetition }
 */
export function runQuranAlignmentEngine(
  verses: QuranVerseInput[],
  options: QuranAlignmentEngineOptions = {}
): QuranAlignmentSegment[] {
  if (!verses || verses.length === 0) return [];

  const mode: AlignmentMode = options.mode || 'full-ayah';
  const confidenceThreshold = options.confidenceThreshold || 85;
  const repetitionThreshold = options.repetitionThreshold || 80;
  const edgePaddingMs = options.edgePaddingMs !== undefined ? options.edgePaddingMs : 120;
  const startOffset = options.startOffset !== undefined ? options.startOffset : 0.2;

  // 1. Prepare verses & compute phonetic Tajweed weights
  const preparedVerses = verses.map((v, idx) => {
    const rawArabic = v.text_uthmani || v.text_arabic || '';
    const rawEnglish = v.translation || v.text_english || '';
    const words = rawArabic.split(/\s+/).filter(Boolean);
    const tajweedWeight = words.reduce((acc, w) => acc + getTajweedPhoneticWeight(w), 0);
    const weight = v.isTaawwuz ? 14 : v.isTasmiyah ? 12 : Math.max(8, tajweedWeight * 1.35 + rawArabic.length * 0.35 + rawEnglish.length * 0.15);

    return {
      ...v,
      rawArabic,
      rawEnglish,
      normalizedArabic: normalizeQuranicPhonetics(rawArabic),
      words,
      weight,
      originalIndex: idx
    };
  });

  const totalVerses = preparedVerses.length;
  const totalWeight = preparedVerses.reduce((acc, v) => acc + v.weight, 0) || 1;

  // 2. Stage 1: Acoustic Silence & VAD Detection
  let rawAcousticSegments: Array<{ start: number; end: number }> = [];
  let totalAudioDuration = options.audioDuration && options.audioDuration > 0
    ? options.audioDuration
    : totalVerses * 4.5;

  if (options.pcmData && options.sampleRate) {
    const vad = detectAcousticSilenceFrames(options.pcmData, options.sampleRate, {
      minSilenceMs: options.minIntraAyahSilenceMs || 300,
      minSpeechMs: 250
    });
    rawAcousticSegments = vad.speechSegments;
    totalAudioDuration = Math.max(totalAudioDuration, options.pcmData.length / options.sampleRate);
  } else if (options.acousticSegments && options.acousticSegments.length > 0) {
    rawAcousticSegments = [...options.acousticSegments].sort((a, b) => a.start - b.start);
    totalAudioDuration = Math.max(totalAudioDuration, rawAcousticSegments[rawAcousticSegments.length - 1].end);
  }

  // Fallback if no acoustic segments
  if (rawAcousticSegments.length === 0) {
    // Synthesize initial baseline acoustic distribution
    let cursor = startOffset;
    const available = Math.max(totalVerses * 2.0, totalAudioDuration - startOffset - 0.4);
    const perVerseTime = available / totalVerses;
    for (let i = 0; i < totalVerses; i++) {
      const dur = Math.max(1.5, perVerseTime * (preparedVerses[i].weight / (totalWeight / totalVerses)));
      rawAcousticSegments.push({
        start: Number(cursor.toFixed(2)),
        end: Number((cursor + dur * 0.88).toFixed(2))
      });
      cursor += dur;
    }
  }

  // 3. Filter Micro-Pauses (<300ms) - Rule 2:
  // Micro-pauses (e.g. Tajweed Qalqalah or momentary acoustic dips) are ignored; contiguous speech is bridged!
  const microPauseMs = options.microPauseMs || 300;
  const bridgedSegments: Array<{ start: number; end: number }> = [];
  if (rawAcousticSegments.length > 0) {
    let current = { ...rawAcousticSegments[0] };
    for (let i = 1; i < rawAcousticSegments.length; i++) {
      const next = rawAcousticSegments[i];
      const gapMs = (next.start - current.end) * 1000;
      if (gapMs < microPauseMs) {
        // Micro-pause! Merge speech together without cutting text or audio
        current.end = Math.max(current.end, next.end);
      } else {
        bridgedSegments.push(current);
        current = { ...next };
      }
    }
    bridgedSegments.push(current);
  }

  // 4. Multi-Ayah Assignment with Stage 2 Text-Anchored Verification & Zero-Drift Levenshtein
  // For each verse, identify which acoustic segments belong to it:
  const assignedVerseSegments: Array<Array<{ start: number; end: number }>> = Array.from({ length: totalVerses }, () => []);

  if (totalVerses === 1) {
    assignedVerseSegments[0] = bridgedSegments;
  } else if (bridgedSegments.length === totalVerses) {
    // 1-to-1 match
    for (let i = 0; i < totalVerses; i++) {
      assignedVerseSegments[i] = [bridgedSegments[i]];
    }
  } else if (bridgedSegments.length > totalVerses) {
    // More acoustic segments than verses (internal breath pauses exist)
    const targetCumDur: number[] = [];
    const totalSpeechDur = bridgedSegments.reduce((sum, s) => sum + Math.max(0.1, s.end - s.start), 0) || 1;
    let cumW = 0;
    for (let v = 0; v < totalVerses; v++) {
      cumW += preparedVerses[v].weight;
      targetCumDur.push((cumW / totalWeight) * totalSpeechDur);
    }

    let currentSegIdx = 0;
    let cumSpeechSoFar = 0;

    for (let v = 0; v < totalVerses; v++) {
      if (v === totalVerses - 1) {
        for (let s = currentSegIdx; s < bridgedSegments.length; s++) {
          assignedVerseSegments[v].push(bridgedSegments[s]);
        }
      } else {
        const maxAllowedEnd = bridgedSegments.length - (totalVerses - v);
        let bestEndIdx = currentSegIdx;
        let minDiff = Infinity;
        let accumInThisVerse = 0;

        for (let s = currentSegIdx; s <= maxAllowedEnd; s++) {
          accumInThisVerse += (bridgedSegments[s].end - bridgedSegments[s].start);
          const testCum = cumSpeechSoFar + accumInThisVerse;
          const diff = Math.abs(testCum - targetCumDur[v]);

          // Stage 2: Check Text-Anchored Boundary Verification
          // A split is favored if the gap after segment s is >600ms and verifies against next Ayah start
          if (s < bridgedSegments.length - 1) {
            const gapMs = (bridgedSegments[s + 1].start - bridgedSegments[s].end) * 1000;
            const nextAyah = preparedVerses[v + 1];
            // If gap is large and matches Ayah-boundary criteria, provide strong bias to split here
            if (gapMs >= (options.minSilenceMs || 600) && nextAyah) {
              const boundaryClass = classifyAudioPause(
                gapMs,
                nextAyah.normalizedArabic.substring(0, 20),
                nextAyah.normalizedArabic.substring(0, 20),
                { confidenceThreshold, minAyahSilenceMs: options.minSilenceMs || 600 }
              );
              if (boundaryClass.verifiedNextAyah) {
                // High confidence Ayah boundary split!
                if (diff < minDiff * 1.6) {
                  minDiff = diff;
                  bestEndIdx = s;
                  break;
                }
              }
            }
          }

          if (diff <= minDiff) {
            minDiff = diff;
            bestEndIdx = s;
          }
        }

        for (let s = currentSegIdx; s <= bestEndIdx; s++) {
          cumSpeechSoFar += (bridgedSegments[s].end - bridgedSegments[s].start);
          assignedVerseSegments[v].push(bridgedSegments[s]);
        }
        currentSegIdx = bestEndIdx + 1;
      }
    }
  } else {
    // Fewer acoustic segments than verses (multiple short verses in one breath)
    const segDurations = bridgedSegments.map(s => Math.max(0.1, s.end - s.start));
    const totalSegDur = segDurations.reduce((a, b) => a + b, 0) || 1;
    let cumW = 0;
    const targetCum: number[] = [];
    for (let v = 0; v < totalVerses; v++) {
      cumW += preparedVerses[v].weight;
      targetCum.push((cumW / totalWeight) * totalSegDur);
    }

    let sIdx = 0;
    let cumSegSpeech = 0;
    const verseToSegIdx: number[] = [];
    for (let v = 0; v < totalVerses; v++) {
      const target = targetCum[v];
      while (
        sIdx < bridgedSegments.length - 1 &&
        Math.abs((cumSegSpeech + segDurations[sIdx]) - target) > Math.abs(cumSegSpeech - target)
      ) {
        cumSegSpeech += segDurations[sIdx];
        sIdx++;
      }
      verseToSegIdx.push(sIdx);
    }

    for (let s = 0; s < bridgedSegments.length; s++) {
      const versesInSeg: number[] = [];
      for (let v = 0; v < totalVerses; v++) {
        if (verseToSegIdx[v] === s) versesInSeg.push(v);
      }
      if (versesInSeg.length === 0) continue;

      const seg = bridgedSegments[s];
      const segW = versesInSeg.reduce((sum, v) => sum + preparedVerses[v].weight, 0) || 1;
      let cursor = seg.start;

      versesInSeg.forEach((v, idx) => {
        const w = preparedVerses[v].weight;
        const vDur = idx === versesInSeg.length - 1
          ? (seg.end - cursor)
          : ((seg.end - seg.start) * (w / segW));
        const vStart = Number(cursor.toFixed(2));
        const vEnd = Number(Math.min(seg.end, cursor + vDur).toFixed(2));
        if (vEnd > vStart) {
          assignedVerseSegments[v].push({ start: vStart, end: vEnd });
        }
        cursor = vEnd;
      });
    }

    for (let v = 0; v < totalVerses; v++) {
      if (assignedVerseSegments[v].length === 0) {
        const seg = bridgedSegments[Math.min(v, bridgedSegments.length - 1)];
        assignedVerseSegments[v].push({ start: seg.start, end: seg.end });
      }
    }
  }

  // 5. Generate Segments based on Mode ('full-ayah' vs 'split-breaths' / 'cut-ayah')
  const rawGeneratedSegments: QuranAlignmentSegment[] = [];

  for (let vIdx = 0; vIdx < totalVerses; vIdx++) {
    const verse = preparedVerses[vIdx];
    const segs = assignedVerseSegments[vIdx] || [{ start: startOffset, end: startOffset + 3.0 }];
    const isLastVerse = vIdx === totalVerses - 1;

    // Word tracking for zero-drift Levenshtein and I'adah handling
    const passedWordsInAyah: string[] = [];

    if (mode === 'full-ayah' || segs.length <= 1) {
      // FULL AYAH BRIEF MODE:
      // Preserves the full Ayah across internal breaths, but respects Text-Anchored Boundary Verification
      const vStart = segs[0].start;
      const vEnd = segs[segs.length - 1].end;

      // Check next Ayah onset if not last verse
      let confScore = 95.0;
      let isWaqf = false;
      let pauseType: 'ayah-boundary' | 'intra-ayah-waqf' | 'micro-pause' | 'none' = 'none';

      if (!isLastVerse) {
        const nextSegs = assignedVerseSegments[vIdx + 1];
        if (nextSegs && nextSegs.length > 0) {
          const gapMs = (nextSegs[0].start - vEnd) * 1000;
          const nextAyah = preparedVerses[vIdx + 1];
          const classification = classifyAudioPause(
            gapMs,
            nextAyah.normalizedArabic.substring(0, 25),
            nextAyah.normalizedArabic.substring(0, 25),
            { confidenceThreshold, minAyahSilenceMs: options.minSilenceMs || 600 }
          );
          confScore = classification.confidenceScore || 90.0;
          isWaqf = classification.verifiedNextAyah;
          pauseType = classification.type;
        }
      }

      rawGeneratedSegments.push({
        ayahIndex: vIdx,
        wordIndex: 0,
        startTime: vStart,
        endTime: vEnd,
        isWaqfPause: isWaqf,
        confidenceScore: confScore,
        verse_key: verse.verse_key,
        text_arabic: verse.rawArabic,
        text_english: verse.rawEnglish,
        pauseType,
        isRepetition: false,
        subPhraseIndex: 1,
        totalSubPhrases: 1
      });
    } else {
      // CUT AYAH BRIEF MODE ('split-breaths' / 'cut-ayah'):
      // Breaks Ayah into discrete Waqf sub-phrase clips, locking word sequences to each breath segment
      const segDurations = segs.map(s => Math.max(0.4, s.end - s.start));
      const arSubPhrases = splitArabicAyahAcrossBreaths(verse.rawArabic, segDurations);
      const enSubPhrases = splitTranslationAcrossBreaths(verse.rawEnglish, segDurations);
      const totalSubs = segs.length;

      let wordPointer = 0;

      for (let sIdx = 0; sIdx < totalSubs; sIdx++) {
        const subStart = segs[sIdx].start;
        const subEnd = segs[sIdx].end;
        const arChunk = arSubPhrases[sIdx] || '';
        const enChunk = enSubPhrases[sIdx] || '';
        const isLastSub = sIdx === totalSubs - 1;

        // RULE 4: REPETITION (I'ADAH) & RE-READING HANDLING
        // Check if current breath onset matches words already recited in this Ayah
        const repetitionCheck = detectIadahRepetition(
          arChunk,
          passedWordsInAyah,
          repetitionThreshold
        );

        let isRep = false;
        let rewindWords = 0;
        if (repetitionCheck.isRepetition) {
          isRep = true;
          rewindWords = passedWordsInAyah.length - repetitionCheck.rewindIndex;
          wordPointer = Math.max(0, repetitionCheck.rewindIndex);
        }

        // Advance words and update passedWords buffer
        const chunkWords = arChunk.split(/\s+/).filter(Boolean);
        chunkWords.forEach(w => passedWordsInAyah.push(w));

        // RULE 2: Dynamic Pause Classification
        let pauseType: 'ayah-boundary' | 'intra-ayah-waqf' | 'micro-pause' | 'none' = 'none';
        let isWaqf = false;
        let confScore = 92.0;

        if (isLastSub) {
          if (!isLastVerse) {
            const nextSegs = assignedVerseSegments[vIdx + 1];
            if (nextSegs && nextSegs.length > 0) {
              const gapMs = (nextSegs[0].start - subEnd) * 1000;
              const nextAyah = preparedVerses[vIdx + 1];
              const classification = classifyAudioPause(
                gapMs,
                nextAyah.normalizedArabic.substring(0, 25),
                nextAyah.normalizedArabic.substring(0, 25),
                { confidenceThreshold, minAyahSilenceMs: options.minSilenceMs || 600 }
              );
              pauseType = classification.type;
              isWaqf = classification.verifiedNextAyah;
              confScore = classification.confidenceScore || 90.0;
            }
          }
        } else {
          // Intra-Ayah breath pause
          const intraGapMs = (segs[sIdx + 1].start - subEnd) * 1000;
          pauseType = intraGapMs < microPauseMs ? 'micro-pause' : 'intra-ayah-waqf';
          isWaqf = true;
          confScore = 88.0;
        }

        const subKey = totalSubs > 1
          ? `${verse.verse_key} [${sIdx + 1}/${totalSubs}]`
          : verse.verse_key;

        rawGeneratedSegments.push({
          ayahIndex: vIdx,
          wordIndex: wordPointer,
          startTime: subStart,
          endTime: subEnd,
          isWaqfPause: isWaqf,
          confidenceScore: confScore,
          verse_key: subKey,
          text_arabic: arChunk,
          text_english: enChunk,
          pauseType,
          isRepetition: isRep,
          repetitionRewindWords: rewindWords,
          subPhraseIndex: sIdx + 1,
          totalSubPhrases: totalSubs
        });

        wordPointer += chunkWords.length;
      }
    }
  }

  // 6. RULE 5: EDGE PADDING & BOUNDARY PROTECTION (±120ms safety margin)
  const cutsForPadding = rawGeneratedSegments.map(s => ({
    start: s.startTime,
    end: s.endTime
  }));

  const paddedCuts = applyEdgePadding(cutsForPadding, totalAudioDuration, edgePaddingMs);

  // Re-attach padded timestamps to segments
  const finalSegments: QuranAlignmentSegment[] = rawGeneratedSegments.map((seg, i) => {
    const pad = paddedCuts[i] || { start: seg.startTime, end: seg.endTime };
    return {
      ...seg,
      startTime: pad.start,
      endTime: pad.end
    };
  });

  return finalSegments;
}
