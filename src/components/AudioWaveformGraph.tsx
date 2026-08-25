import React, { useRef, useEffect, useState } from 'react';
import { generateWaveformPeaks, normalizeMediaUrl, calculateAudioPeakDb, calculateFrequencySpectrumAtOffset } from '../utils/editorUtils';

interface AudioWaveformGraphProps {
  clipId: string;
  url?: string;
  width: number;
  height?: number;
  isSelected: boolean;
  volume?: number;
  showSilenceHighlights?: boolean;
  onPeakCalculated?: (peakDb: number) => void;
  currentTime?: number;
  clipStart?: number;
  clipDuration?: number;
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
  onPeakCalculated,
  currentTime,
  clipStart = 0,
  clipDuration = 0,
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
    const dpr = window.devicePixelRatio || 1;

    canvas.width = renderWidth * dpr;
    canvas.height = renderHeight * dpr;
    canvas.style.width = `${renderWidth}px`;
    canvas.style.height = `${renderHeight}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, renderWidth, renderHeight);

    // 1. Deep dark purple container backdrop
    const backdropGradient = ctx.createLinearGradient(0, 0, 0, renderHeight);
    backdropGradient.addColorStop(0, '#1c0d2e');
    backdropGradient.addColorStop(0.5, '#150924');
    backdropGradient.addColorStop(1, '#1c0d2e');
    ctx.fillStyle = backdropGradient;
    ctx.fillRect(0, 0, renderWidth, renderHeight);

    // 2. Compute Peak Amplitudes & RMS Silence Flags (downsampled per bar)
    const volFactor = Math.min(2.0, Math.max(0.1, volume));
    const barWidth = 2;
    const gap = 1;
    const totalBars = Math.max(8, Math.floor(renderWidth / (barWidth + gap)));

    let peaks: number[] = [];
    let isSilenceFlags: boolean[] = [];

    const noiseFloorDb = -35;
    const rmsThreshold = Math.pow(10, noiseFloorDb / 20); // ~0.01778 RMS threshold

    if (channelData && channelData.length > 0) {
      const samplesPerBar = Math.floor(channelData.length / totalBars);
      for (let i = 0; i < totalBars; i++) {
        const start = i * samplesPerBar;
        const end = Math.min(channelData.length, start + samplesPerBar);
        let maxVal = 0;
        let sumSq = 0;
        let count = 0;
        for (let j = start; j < end; j += 2) {
          const val = channelData[j];
          const absVal = Math.abs(val);
          if (absVal > maxVal) maxVal = absVal;
          sumSq += val * val;
          count++;
        }
        const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
        peaks.push(Math.min(1.0, maxVal * volFactor));
        // Silence condition: RMS energy below noise floor or peak negligible
        isSilenceFlags.push(rms < rmsThreshold || maxVal < 0.02);
      }
    } else {
      const rawPeaks = generateWaveformPeaks(`${clipId}-${url || 'audio'}`, totalBars);
      for (let i = 0; i < totalBars; i++) {
        const p = rawPeaks[i];
        peaks.push(Math.min(1.0, p * volFactor));
        isSilenceFlags.push(p < 0.15);
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

    // 3. Draw Background Highlight Bands & Text Guides for Silence Regions
    if (showSilenceHighlights) {
      let silenceStartBar: number | null = null;
      for (let i = 0; i <= totalBars; i++) {
        const isSil = i < totalBars ? isSilenceFlags[i] : false;
        if (isSil && silenceStartBar === null) {
          silenceStartBar = i;
        } else if (!isSil && silenceStartBar !== null) {
          const silenceEndBar = i;
          const xStart = silenceStartBar * (barWidth + gap);
          const xWidth = (silenceEndBar - silenceStartBar) * (barWidth + gap) - gap;

          if (xWidth >= 4) {
            // Draw soft Amber translucent glow background
            ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
            ctx.fillRect(xStart, 0, xWidth, renderHeight);

            // Top and bottom accent border lines marking the silence window
            ctx.fillStyle = 'rgba(251, 191, 36, 0.5)';
            ctx.fillRect(xStart, 0, xWidth, 1.5);
            ctx.fillRect(xStart, renderHeight - 1.5, xWidth, 1.5);

            // Render crisp "PAUSE" text node placement guide label if silence region is wide enough
            if (xWidth >= 24 && renderHeight >= 28) {
              ctx.save();
              ctx.font = '700 8px Inter, system-ui, sans-serif';
              ctx.fillStyle = 'rgba(251, 191, 36, 0.95)';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillText('PAUSE', xStart + xWidth / 2, 2);
              ctx.restore();
            }
          }
          silenceStartBar = null;
        }
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

    // 5. Speech vs Silence Waveform Bar Gradients
    // Speech: Lavender / Purple / Violet
    const speechGradient = ctx.createLinearGradient(0, 0, 0, renderHeight);
    if (isSelected) {
      speechGradient.addColorStop(0, '#f3e8ff');
      speechGradient.addColorStop(0.5, '#d8b4fe');
      speechGradient.addColorStop(1, '#c084fc');
    } else {
      speechGradient.addColorStop(0, '#e9d5ff');
      speechGradient.addColorStop(0.5, 'rgba(192, 132, 252, 0.9)');
      speechGradient.addColorStop(1, 'rgba(168, 85, 247, 0.7)');
    }

    // Silence: High-Contrast Amber / Gold / Orange Highlight
    const silenceGradient = ctx.createLinearGradient(0, 0, 0, renderHeight);
    if (isSelected) {
      silenceGradient.addColorStop(0, '#fffbeb');
      silenceGradient.addColorStop(0.5, '#fde68a');
      silenceGradient.addColorStop(1, '#f59e0b');
    } else {
      silenceGradient.addColorStop(0, '#fef3c7');
      silenceGradient.addColorStop(0.5, 'rgba(251, 191, 36, 0.9)');
      silenceGradient.addColorStop(1, 'rgba(217, 119, 6, 0.8)');
    }

    const maxAmplitude = (renderHeight / 2) * 0.88;

    // 6. Draw Main Waveform Bars
    for (let i = 0; i < totalBars; i++) {
      const x = i * (barWidth + gap);
      const isSil = isSilenceFlags[i];
      const amp = Math.max(0.04, peaks[i] || 0.04);
      const barHeight = amp * maxAmplitude;

      const topY = centerY - barHeight;
      const h = barHeight * 2;

      ctx.fillStyle = (showSilenceHighlights && isSil) ? silenceGradient : speechGradient;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, topY, barWidth, h, 1);
      } else {
        ctx.rect(x, topY, barWidth, h);
      }
      ctx.fill();
    }

    // 7. REAL-TIME FREQUENCY DATA VISUALIZATION BELOW AUDIO CLIP FOR VISUAL SCRUBBING FEEDBACK
    if (currentTime !== undefined && clipDuration > 0) {
      const clipOffset = currentTime - clipStart;
      const isPlayheadInClip = clipOffset >= -0.05 && clipOffset <= clipDuration + 0.05;

      if (isPlayheadInClip) {
        const clampedOffset = Math.max(0, Math.min(clipDuration, clipOffset));
        const playheadRatio = clampedOffset / clipDuration;
        const playheadX = Math.round(playheadRatio * renderWidth);

        // A. Calculate real-time 32-bin frequency spectrum & bands from AudioContext / PCM data
        const freqAnalysis = channelData && channelData.length > 0
          ? calculateFrequencySpectrumAtOffset(channelData, 44100, clampedOffset, 32)
          : {
              bins: new Float32Array([0.2, 0.4, 0.7, 0.85, 0.9, 0.75, 0.6, 0.5, 0.4, 0.35, 0.5, 0.65, 0.8, 0.7, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1, 0.1, 0.08, 0.05, 0.04, 0.03, 0.02, 0.02, 0.01, 0.01, 0.01, 0.01]),
              bass: 0.72,
              mid: 0.54,
              treble: 0.28
            };

        // B. Render Real-Time Frequency Waveform Visualizer Band Below Clip Body
        const freqHeight = Math.min(22, Math.floor(renderHeight * 0.42));
        const freqTopY = renderHeight - freqHeight;

        // Sub-panel backdrop for frequency spectrum display
        ctx.fillStyle = 'rgba(10, 6, 22, 0.85)';
        ctx.fillRect(0, freqTopY, renderWidth, freqHeight);

        ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.fillRect(0, freqTopY, renderWidth, 1); // Top divider line

        // Render Real-Time Frequency Equalizer Bars Below Clip
        const freqBarCount = freqAnalysis.bins.length;
        const freqBarWidth = Math.max(1, (renderWidth / freqBarCount) - 1);

        for (let b = 0; b < freqBarCount; b++) {
          const bx = b * (freqBarWidth + 1);
          const binMag = freqAnalysis.bins[b] || 0.05;
          const bh = Math.max(1, binMag * (freqHeight - 2));
          const by = renderHeight - bh;

          // Color spectrum gradient: Bass (Cyan) -> Mid (Violet) -> High (Pink)
          const ratio = b / freqBarCount;
          let barColor = 'rgba(6, 182, 212, 0.9)'; // Cyan
          if (ratio > 0.35 && ratio < 0.75) {
            barColor = 'rgba(139, 92, 246, 0.9)'; // Violet
          } else if (ratio >= 0.75) {
            barColor = 'rgba(236, 72, 153, 0.9)'; // Pink
          }

          ctx.fillStyle = barColor;
          ctx.fillRect(bx, by, freqBarWidth, bh);
        }

        // C. Draw Playhead Scrubbing Laser Cursor Line across the Clip
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#06b6d4';
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, renderHeight);
        ctx.stroke();

        // Top & Bottom glowing playhead indicator nodes
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.arc(playheadX, 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(playheadX, renderHeight - 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // D. Visual Scrubbing Feedback HUD Overlay Text Label
        if (renderWidth >= 70 && renderHeight >= 32) {
          ctx.save();
          ctx.font = '700 7.5px Monospace, system-ui, sans-serif';
          const scrubTimeStr = `${clampedOffset.toFixed(2)}s`;
          const bassPct = Math.round(freqAnalysis.bass * 100);
          const midPct = Math.round(freqAnalysis.mid * 100);
          const highPct = Math.round(freqAnalysis.treble * 100);

          const hudLabel = `SCRUB: ${scrubTimeStr} | B:${bassPct}% M:${midPct}% H:${highPct}%`;
          
          ctx.fillStyle = 'rgba(6, 182, 212, 0.95)';
          ctx.shadowBlur = 4;
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'top';
          ctx.fillText(hudLabel, renderWidth - 3, 2);
          ctx.restore();
        }
      }
    }

  }, [channelData, width, height, isSelected, volume, clipId, url, showSilenceHighlights, currentTime, clipStart, clipDuration, isPlaying]);

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


