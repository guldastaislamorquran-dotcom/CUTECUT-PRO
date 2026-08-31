import React, { useRef, useEffect, useState } from 'react';
import { generateWaveformPeaks, normalizeMediaUrl, calculateAudioPeakDb, calculateFrequencySpectrumAtOffset } from '../utils/editorUtils';
import { getSystemSpecs } from '../utils/systemPerformance';

interface AudioWaveformGraphProps {
  clipId: string;
  url?: string;
  width: number;
  height?: number;
  isSelected: boolean;
  volume?: number;
  showSilenceHighlights?: boolean;
  showBeatMarkers?: boolean;
  overlayMode?: boolean;
  onPeakCalculated?: (peakDb: number) => void;
  currentTime?: number;
  clipStart?: number;
  clipDuration?: number;
  clipOffset?: number;
  mediaDuration?: number;
  isPlaying?: boolean;
}

// Global cache for decoded audio channel data buffers to avoid re-fetching / re-decoding audio on every zoom tick
const decodedAudioCache = new Map<string, Float32Array>();
const pendingDecodes = new Map<string, Promise<Float32Array | null>>();

export const AudioWaveformGraph: React.FC<AudioWaveformGraphProps> = ({
  clipId,
  url,
  width,
  height,
  isSelected,
  volume = 1.0,
  showSilenceHighlights = true,
  showBeatMarkers = true,
  overlayMode = false,
  onPeakCalculated,
  currentTime,
  clipStart = 0,
  clipDuration = 0,
  clipOffset = 0,
  mediaDuration,
  isPlaying = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [channelData, setChannelData] = useState<Float32Array | null>(null);
  const lastReportedPeakRef = useRef<number | null>(null);

  // Decode audio data using Web Audio API if URL is provided
  useEffect(() => {
    let isMounted = true;
    if (!url) {
      setChannelData(null);
      return;
    }

    const cacheKey = url;
    if (decodedAudioCache.has(cacheKey)) {
      setChannelData(decodedAudioCache.get(cacheKey)!);
      return;
    }

    if (pendingDecodes.has(cacheKey)) {
      pendingDecodes.get(cacheKey)!.then((data) => {
        if (isMounted && data) setChannelData(data);
      });
      return;
    }

    const decodePromise = (async (): Promise<Float32Array | null> => {
      try {
        // Check IndexedDB cache first
        try {
          const { getCachedAudioChannel, setCachedAudioChannel } = await import('../utils/offlineStorage');
          const idbData = await getCachedAudioChannel(url);
          if (idbData && idbData.length > 0) {
            decodedAudioCache.set(cacheKey, idbData);
            return idbData;
          }
        } catch {
          // ignore cache read error
        }

        const normalized = normalizeMediaUrl(url);
        const response = await fetch(normalized);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();

        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtxClass) return null;
        const audioCtx = new AudioCtxClass();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioCtx.close();

        // Extract channel 0 data
        const rawData = audioBuffer.getChannelData(0);
        
        // Cache decoded float array in memory and IndexedDB
        decodedAudioCache.set(cacheKey, rawData);
        try {
          const { setCachedAudioChannel } = await import('../utils/offlineStorage');
          await setCachedAudioChannel(url, rawData);
        } catch {
          // ignore cache write error
        }
        return rawData;
      } catch (err) {
        console.warn(`[AudioWaveformEngine] Web Audio decode bypass for ${url}:`, err);
        return null;
      } finally {
        pendingDecodes.delete(cacheKey);
      }
    })();

    pendingDecodes.set(cacheKey, decodePromise);
    decodePromise.then((data) => {
      if (isMounted && data) {
        setChannelData(data);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [url]);

  // Render Canvas Waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderWidth = Math.max(10, Math.floor(width));
    const renderHeight = height || canvas.parentElement?.clientHeight || 48;
    
    // Adapt DPR and sampling step based on system hardware performance tier
    const specs = getSystemSpecs();
    let dprCap = 1.0;
    if (specs.tier === 'ultra') dprCap = Math.min(window.devicePixelRatio || 1, 2.0);
    else if (specs.tier === 'high') dprCap = Math.min(window.devicePixelRatio || 1, 1.5);
    const dpr = dprCap;

    canvas.width = renderWidth * dpr;
    canvas.height = renderHeight * dpr;
    canvas.style.width = `${renderWidth}px`;
    canvas.style.height = `${renderHeight}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, renderWidth, renderHeight);

    // 1. Container backdrop (Solid dark purple for audio, translucent dark slate for video overlay)
    const backdropGradient = ctx.createLinearGradient(0, 0, 0, renderHeight);
    if (overlayMode) {
      backdropGradient.addColorStop(0, 'rgba(10, 15, 28, 0.55)');
      backdropGradient.addColorStop(0.5, 'rgba(15, 23, 42, 0.45)');
      backdropGradient.addColorStop(1, 'rgba(10, 15, 28, 0.55)');
    } else {
      backdropGradient.addColorStop(0, '#1c0d2e');
      backdropGradient.addColorStop(0.5, '#150924');
      backdropGradient.addColorStop(1, '#1c0d2e');
    }
    ctx.fillStyle = backdropGradient;
    ctx.fillRect(0, 0, renderWidth, renderHeight);

    // 2. Compute Peak Amplitudes (downsampled per bar across clip range)
    const volFactor = Math.min(2.0, Math.max(0.1, volume));
    const targetBarStep = specs.tier === 'power_saver' ? 5 : 3;
    const totalBars = Math.max(16, Math.floor(renderWidth / targetBarStep));
    const stepX = renderWidth / totalBars;
    const barWidth = Math.max(1, Math.min(4, stepX - 1));

    let peaks: number[] = [];

    if (channelData && channelData.length > 0) {
      const totalAudioDuration = mediaDuration || (channelData.length / 44100);
      const activeClipDuration = clipDuration > 0 ? clipDuration : totalAudioDuration;
      const secPerBar = activeClipDuration / totalBars;
      // Audio sample count per bar
      const samplesPerBar = Math.max(1, Math.floor((secPerBar / totalAudioDuration) * channelData.length));
      const stepStride = Math.max(1, Math.floor(samplesPerBar / 80));

      const rawMaxVals: number[] = [];
      let globalWindowMaxPeak = 0;

      for (let i = 0; i < totalBars; i++) {
        // Compute bar timestamp relative to audio start
        const barTimeSec = (clipOffset || 0) + i * secPerBar;
        // Modulo wrap around totalAudioDuration for seamless infinite looping across timeline
        const loopedTimeSec = totalAudioDuration > 0 ? (barTimeSec % totalAudioDuration) : 0;
        const safeRatio = Math.min(0.9999, Math.max(0, loopedTimeSec / totalAudioDuration));
        const startSample = Math.floor(safeRatio * channelData.length);
        const endSample = Math.min(channelData.length, startSample + samplesPerBar);

        let maxVal = 0;
        for (let j = startSample; j < endSample; j += stepStride) {
          const val = channelData[j];
          if (val !== undefined) {
            const absVal = Math.abs(val);
            if (absVal > maxVal) maxVal = absVal;
          }
        }

        rawMaxVals.push(maxVal);
        if (maxVal > globalWindowMaxPeak) {
          globalWindowMaxPeak = maxVal;
        }
      }

      // Dynamic Auto-Gain Normalization Factor
      // Normalize audio track so waveform fills canvas height cleanly
      const normScale = globalWindowMaxPeak > 0.005 ? Math.min(12.0, 0.88 / globalWindowMaxPeak) : 1.0;

      for (let i = 0; i < totalBars; i++) {
        const rawM = rawMaxVals[i];
        const scaledPeak = Math.min(1.0, rawM * normScale * volFactor);
        // Ensure a solid continuous visible floor (~0.18) so there are no empty breaks or gaps
        const displayPeak = Math.max(0.18, scaledPeak);
        peaks.push(displayPeak);
      }
    } else {
      const totalAudioDuration = mediaDuration || 60;
      const activeClipDuration = clipDuration > 0 ? clipDuration : totalAudioDuration;
      const secPerBar = activeClipDuration / totalBars;
      const rawPeaks = generateWaveformPeaks(`${clipId}-${url || 'audio'}`, Math.max(totalBars, 200));

      for (let i = 0; i < totalBars; i++) {
        const barTimeSec = (clipOffset || 0) + i * secPerBar;
        const loopedTimeSec = totalAudioDuration > 0 ? (barTimeSec % totalAudioDuration) : 0;
        const loopRatio = Math.min(0.9999, Math.max(0, loopedTimeSec / totalAudioDuration));
        const peakIdx = Math.floor(loopRatio * rawPeaks.length) % rawPeaks.length;
        const p = rawPeaks[peakIdx] || 0.4;
        peaks.push(Math.min(1.0, Math.max(0.18, p * volFactor)));
      }
    }

    // 2.5 Compute Peak dB for local display without triggering React state cascade loops
    const calculatedPeakDb = channelData && channelData.length > 0
      ? calculateAudioPeakDb(channelData, volume)
      : calculateAudioPeakDb(peaks, 1.0);

    if (onPeakCalculated && lastReportedPeakRef.current !== calculatedPeakDb) {
      lastReportedPeakRef.current = calculatedPeakDb;
      try {
        onPeakCalculated(calculatedPeakDb);
      } catch (err) {
        // ignore
      }
    }

    // 4. Center Baseline Reference Line
    const centerY = renderHeight / 2;
    ctx.strokeStyle = isSelected ? 'rgba(216, 180, 254, 0.5)' : 'rgba(168, 85, 247, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(renderWidth, centerY);
    ctx.stroke();

    // 5. Solid Uniform Waveform Bar Gradient Across Full Track
    const speechGradient = ctx.createLinearGradient(0, 0, 0, renderHeight);
    if (overlayMode) {
      // Vibrant Cyan/Teal for Video Audio Overlays
      if (isSelected) {
        speechGradient.addColorStop(0, '#e0f2fe');
        speechGradient.addColorStop(0.5, '#38bdf8');
        speechGradient.addColorStop(1, '#0284c7');
      } else {
        speechGradient.addColorStop(0, '#cff4fc');
        speechGradient.addColorStop(0.5, 'rgba(34, 211, 238, 0.95)');
        speechGradient.addColorStop(1, 'rgba(14, 116, 144, 0.85)');
      }
    } else {
      // Lavender / Purple / Violet for Audio Clips
      if (isSelected) {
        speechGradient.addColorStop(0, '#f3e8ff');
        speechGradient.addColorStop(0.5, '#d8b4fe');
        speechGradient.addColorStop(1, '#c084fc');
      } else {
        speechGradient.addColorStop(0, '#e9d5ff');
        speechGradient.addColorStop(0.5, 'rgba(192, 132, 252, 0.95)');
        speechGradient.addColorStop(1, 'rgba(168, 85, 247, 0.75)');
      }
    }

    const maxAmplitude = (renderHeight / 2) * 0.88;

    // 6. Draw Unbroken Waveform Bars Across Full Clip Width
    for (let i = 0; i < totalBars; i++) {
      const x = i * stepX;
      const amp = Math.max(0.18, peaks[i] || 0.18);
      const barHeight = amp * maxAmplitude;

      const topY = centerY - barHeight;
      const h = barHeight * 2;

      ctx.fillStyle = speechGradient;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, topY, barWidth, h, 1);
      } else {
        ctx.rect(x, topY, barWidth, h);
      }
      ctx.fill();

      // 6.5 Beat / Transient Spike Dot Indicator
      const prevPeak = i > 0 ? peaks[i - 1] : 0;
      const isBeatTransient = showBeatMarkers && amp > 0.42 && (amp > prevPeak * 1.2 + 0.08);
      if (isBeatTransient && renderHeight >= 20) {
        ctx.save();
        ctx.fillStyle = overlayMode ? '#fbbf24' : '#22d3ee';
        ctx.shadowBlur = 4;
        ctx.shadowColor = overlayMode ? 'rgba(251, 191, 36, 0.9)' : 'rgba(34, 211, 238, 0.9)';
        ctx.beginPath();
        ctx.arc(x + barWidth / 2, Math.max(2, topY - 2), 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 7. Render scrubbing laser cursor only if explicitly selected and manual scrub
    if (isSelected && currentTime !== undefined && clipDuration > 0) {
      const clipOffset = currentTime - clipStart;
      const isPlayheadInClip = clipOffset >= 0 && clipOffset <= clipDuration;

      if (isPlayheadInClip) {
        const clampedOffset = Math.max(0, Math.min(clipDuration, clipOffset));
        const playheadRatio = clampedOffset / clipDuration;
        const playheadX = Math.round(playheadRatio * renderWidth);

        // Draw Playhead Scrubbing Laser Cursor Line across the Clip
        ctx.save();
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#06b6d4';
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, renderHeight);
        ctx.stroke();
        ctx.restore();
      }
    }

  }, [channelData, width, height, isSelected, volume, clipId, url, showSilenceHighlights, showBeatMarkers, overlayMode]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none rounded-md">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
      />
    </div>
  );
};

export default AudioWaveformGraph;


