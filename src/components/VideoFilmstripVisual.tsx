import React, { useMemo, useState, useEffect } from 'react';
import { Clip } from '../types';
import { formatTimeCode, getSafeCrossOrigin, normalizeMediaUrl } from '../utils/editorUtils';

interface VideoFilmstripVisualProps {
  clip: Clip;
  width: number;
  isSelected: boolean;
  zoom: number;
}

// Global persistent cache for thumbnail snapshots across all clips and re-renders
const globalThumbnailCache = new Map<string, string>();

type Listener = (cacheKey: string, dataUrl: string) => void;
const frameListeners = new Map<string, Set<Listener>>();

function subscribeToFrame(cacheKey: string, listener: Listener): () => void {
  if (globalThumbnailCache.has(cacheKey)) {
    listener(cacheKey, globalThumbnailCache.get(cacheKey)!);
    return () => {};
  }
  if (!frameListeners.has(cacheKey)) {
    frameListeners.set(cacheKey, new Set());
  }
  frameListeners.get(cacheKey)!.add(listener);

  return () => {
    const set = frameListeners.get(cacheKey);
    if (set) {
      set.delete(listener);
      if (set.size === 0) frameListeners.delete(cacheKey);
    }
  };
}

function notifyFrameExtracted(cacheKey: string, dataUrl: string) {
  globalThumbnailCache.set(cacheKey, dataUrl);
  const set = frameListeners.get(cacheKey);
  if (set) {
    set.forEach((cb) => cb(cacheKey, dataUrl));
    frameListeners.delete(cacheKey);
  }
}

interface ExtractionRequest {
  targetTime: number;
  cacheKey: string;
}

// Managed video thumbnail extractor per video URL to avoid browser video decoder limits
class VideoUrlExtractor {
  private url: string;
  private crossOrigin?: string;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private queue: ExtractionRequest[] = [];
  private isProcessing = false;
  private isLoaded = false;
  private loadFailed = false;
  private idleTimer: any = null;

  constructor(url: string, crossOrigin?: string) {
    this.url = url;
    this.crossOrigin = crossOrigin;
  }

  public requestFrame(targetTime: number, cacheKey: string) {
    if (globalThumbnailCache.has(cacheKey)) return;
    if (this.queue.some((q) => q.cacheKey === cacheKey)) return;

    this.queue.push({ targetTime, cacheKey });
    this.scheduleProcessing();
  }

  private scheduleProcessing() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    if (this.isProcessing || this.loadFailed) return;

    if (!this.video) {
      this.initVideo();
    } else if (this.isLoaded) {
      this.processNext();
    }
  }

  private initVideo() {
    this.isProcessing = true;
    const video = document.createElement('video');
    this.video = video;
    this.canvas = document.createElement('canvas');
    // High-DPI 320x180 canvas resolution for crisp CapCut style thumbnails
    this.canvas.width = 320;
    this.canvas.height = 180;

    if (this.crossOrigin) {
      video.crossOrigin = this.crossOrigin;
    }
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    let timeoutId = setTimeout(() => {
      this.handleError('Load timeout');
    }, 8000);

    const onLoaded = () => {
      clearTimeout(timeoutId);
      this.isLoaded = true;
      this.processNext();
    };

    const onError = () => {
      clearTimeout(timeoutId);
      if (video.crossOrigin) {
        // Retry without crossOrigin if CORS failed
        video.removeAttribute('crossorigin');
        this.crossOrigin = undefined;
        video.src = this.url;
        try {
          video.load();
        } catch {
          this.handleError('Load error without CORS');
        }
      } else {
        this.handleError('Load error');
      }
    };

    video.addEventListener('loadeddata', onLoaded, { once: true });
    video.addEventListener('error', onError, { once: true });

    video.src = this.url;
    try {
      video.load();
    } catch {
      this.handleError('Load sync exception');
    }
  }

  private handleError(reason: string) {
    this.loadFailed = true;
    this.isProcessing = false;
    this.destroyVideo();
  }

  private destroyVideo() {
    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      try {
        this.video.load();
      } catch {}
      this.video = null;
    }
    this.canvas = null;
  }

  private processNext() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      this.idleTimer = setTimeout(() => {
        this.destroyVideo();
      }, 15000);
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift()!;

    if (globalThumbnailCache.has(task.cacheKey)) {
      this.processNext();
      return;
    }

    if (!this.video || !this.isLoaded) {
      this.isProcessing = false;
      return;
    }

    const video = this.video;
    const canvas = this.canvas!;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });

    let seekTimeout = setTimeout(() => {
      this.processNext();
    }, 3000);

    const onSeeked = () => {
      clearTimeout(seekTimeout);
      video.removeEventListener('seeked', onSeeked);

      if (ctx) {
        try {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          notifyFrameExtracted(task.cacheKey, dataUrl);

          const posterKey = `${this.url}_poster`;
          if (!globalThumbnailCache.has(posterKey)) {
            notifyFrameExtracted(posterKey, dataUrl);
          }
        } catch {
          // Ignore tainted canvas errors gracefully
        }
      }

      setTimeout(() => {
        this.processNext();
      }, 15);
    };

    video.addEventListener('seeked', onSeeked);

    try {
      const duration = video.duration || 600;
      const safeTime = Math.max(0.05, Math.min(duration - 0.1, task.targetTime));
      video.currentTime = safeTime;
    } catch {
      clearTimeout(seekTimeout);
      video.removeEventListener('seeked', onSeeked);
      this.processNext();
    }
  }
}

const extractors = new Map<string, VideoUrlExtractor>();

function requestVideoFrameExtraction(url: string, targetTime: number, crossOrigin?: string): string {
  const roundedTime = Math.round(targetTime * 10) / 10;
  const cacheKey = `${url}_${roundedTime}`;

  if (globalThumbnailCache.has(cacheKey)) {
    return cacheKey;
  }

  if (!extractors.has(url)) {
    extractors.set(url, new VideoUrlExtractor(url, crossOrigin));
  }

  const extractor = extractors.get(url)!;
  extractor.requestFrame(targetTime, cacheKey);

  return cacheKey;
}

export const VideoFilmstripVisual: React.FC<VideoFilmstripVisualProps> = ({
  clip,
  width,
  isSelected,
  zoom,
}) => {
  const targetFrameWidth = Math.max(48, Math.min(80, Math.round(56 * (zoom > 25 ? 1 : 0.85))));
  const frameCount = Math.max(1, Math.min(48, Math.floor(width / targetFrameWidth)));
  const frameWidth = width / Math.max(1, frameCount);

  const normalizedUrl = useMemo(() => normalizeMediaUrl(clip.url), [clip.url]);
  const isImage = useMemo(() => {
    if (!clip.url) return false;
    return (
      clip.type === 'image' ||
      clip.url.startsWith('data:image/') ||
      /\.(jpeg|jpg|png|gif|webp|svg|bmp|avif)($|\?)/i.test(clip.url)
    );
  }, [clip.url, clip.type]);

  const posterKey = normalizedUrl ? `${normalizedUrl}_poster` : '';
  const initialPoster = posterKey ? globalThumbnailCache.get(posterKey) : null;
  const [posterThumb, setPosterThumb] = useState<string | null>(initialPoster || null);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});

  const crossOrigin = useMemo(() => getSafeCrossOrigin(clip.url), [clip.url]);

  const frames = useMemo(() => {
    const list = [];
    const secPerFrame = clip.duration / Math.max(1, frameCount);
    const mediaDuration = clip.mediaDuration || 0;

    for (let i = 0; i < frameCount; i++) {
      const frameOffset = clip.start + i * secPerFrame;
      const rawTime = (clip.offset || 0) + i * secPerFrame;
      const mediaTime = mediaDuration > 0 ? (rawTime % mediaDuration) : rawTime;

      list.push({
        index: i,
        timecode: formatTimeCode(frameOffset, false),
        mediaTime,
      });
    }
    return list;
  }, [width, zoom, clip.start, clip.duration, clip.offset, clip.mediaDuration, frameCount]);

  // Subscribe to extracted frame thumbnails smoothly
  useEffect(() => {
    if (!normalizedUrl) return;

    if (isImage) {
      const img = new Image();
      if (crossOrigin) img.crossOrigin = crossOrigin;
      img.src = normalizedUrl;
      img.onload = () => {
        globalThumbnailCache.set(posterKey, normalizedUrl);
        setPosterThumb(normalizedUrl);
      };
      return;
    }

    // Subscribe to poster thumbnail
    const unSubPoster = subscribeToFrame(posterKey, (_key, dataUrl) => {
      setPosterThumb(dataUrl);
    });

    // Request poster extraction at 0.1s
    requestVideoFrameExtraction(normalizedUrl, 0.1, crossOrigin);

    // Request & subscribe to each keyframe thumbnail
    const unSubList: Array<() => void> = [];
    frames.forEach((frame) => {
      const cacheKey = requestVideoFrameExtraction(normalizedUrl, frame.mediaTime, crossOrigin);
      const unSub = subscribeToFrame(cacheKey, (_key, dataUrl) => {
        setThumbnails((prev) => ({ ...prev, [frame.index]: dataUrl }));
      });
      unSubList.push(unSub);
    });

    return () => {
      unSubPoster();
      unSubList.forEach((fn) => fn());
    };
  }, [normalizedUrl, isImage, frames, crossOrigin, posterKey]);

  // Find best available thumbnail for frame `index` (falls back to nearest extracted frame or poster)
  const getFrameThumbnail = (index: number): string | null => {
    if (thumbnails[index]) return thumbnails[index];
    // Search backwards for nearest extracted frame
    for (let i = index - 1; i >= 0; i--) {
      if (thumbnails[i]) return thumbnails[i];
    }
    // Search forwards for nearest extracted frame
    for (let i = index + 1; i < frameCount; i++) {
      if (thumbnails[i]) return thumbnails[i];
    }
    return posterThumb;
  };

  return (
    <div className="absolute inset-0 flex items-center overflow-hidden pointer-events-none select-none rounded-md bg-[#12121a]">
      {/* Top Film Sprocket Holes (Cinematic Perforation Ribbon) */}
      <div className="absolute top-0 left-0 right-0 h-1.5 flex justify-between px-1 bg-black/75 z-10">
        {Array.from({ length: Math.max(2, Math.floor(width / 12)) }).map((_, i) => (
          <div key={`sprocket-top-${i}`} className="w-1.5 h-1 bg-white/25 rounded-xs" />
        ))}
      </div>

      {/* Repeating Filmstrip Loop Container */}
      <div className="w-full h-full flex items-center pt-1.5 pb-1.5">
        {isImage && normalizedUrl ? (
          /* Smooth Looping Image Ribbon */
          <div className="w-full h-full flex items-center relative overflow-hidden">
            {frames.map((frame) => (
              <div
                key={`img-frame-${frame.index}`}
                className={`h-full border-r border-black/40 relative overflow-hidden bg-slate-900/90 flex-shrink-0 ${
                  isSelected ? 'border-cyan-400/40' : 'border-slate-800/80'
                }`}
                style={{ width: `${frameWidth}px`, minWidth: `${frameWidth}px` }}
              >
                <img
                  src={normalizedUrl}
                  crossOrigin={crossOrigin}
                  alt={`img-loop-${frame.index}`}
                  className="absolute inset-0 w-full h-full object-cover opacity-85 transition-opacity duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
                {frameWidth >= 40 && (
                  <div className="absolute bottom-0.5 left-1 z-10 text-[6.5px] font-mono text-cyan-200/80 bg-black/60 px-0.5 rounded-xs">
                    {frame.timecode}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Smooth Looping Video Filmstrip */
          frames.map((frame) => {
            const thumb = getFrameThumbnail(frame.index);

            return (
              <div
                key={`video-frame-${frame.index}`}
                className={`h-full border-r border-black/40 flex flex-col justify-between p-1 relative overflow-hidden bg-[#161622] flex-shrink-0 ${
                  isSelected ? 'border-cyan-400/50' : 'border-slate-800/70'
                }`}
                style={{ width: `${frameWidth}px`, minWidth: `${frameWidth}px` }}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={`frame-${frame.index}`}
                    className="absolute inset-0 w-full h-full object-cover opacity-85 transition-opacity duration-200"
                  />
                ) : (
                  /* Smooth shimmering placeholder skeleton while generating snapshot */
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 animate-pulse opacity-70" />
                )}

                {/* Subtle dark vignette overlay for high contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40 pointer-events-none" />

                {/* Timecode Badge on frame */}
                {frameWidth >= 42 && (
                  <div className="z-10 flex justify-between items-center text-[6.5px] font-mono font-bold text-cyan-200 bg-black/75 px-1 py-0.2 rounded-xs w-fit shadow-xs">
                    <span>{frame.timecode}</span>
                  </div>
                )}

                {/* Center subtle filmstrip frame icon */}
                <div className="z-10 flex items-center justify-center opacity-25">
                  <div className="w-2.5 h-1.5 border border-cyan-200 rounded-xs" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Film Sprocket Holes (Cinematic Perforation Ribbon) */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 flex justify-between px-1 bg-black/75 z-10">
        {Array.from({ length: Math.max(2, Math.floor(width / 12)) }).map((_, i) => (
          <div key={`sprocket-bot-${i}`} className="w-1.5 h-1 bg-white/25 rounded-xs" />
        ))}
      </div>
    </div>
  );
};

export default VideoFilmstripVisual;
