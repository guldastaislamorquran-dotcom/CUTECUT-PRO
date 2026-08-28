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
const pendingExtractions = new Set<string>();

// Helper to safely extract a frame snapshot from a video URL with global caching
function extractVideoFrame(
  url: string,
  targetTime: number,
  crossOrigin: string | undefined,
  onExtracted: (timeKey: string, dataUrl: string) => void
) {
  const cacheKey = `${url}_${Math.round(targetTime * 10) / 10}`;
  if (globalThumbnailCache.has(cacheKey)) {
    onExtracted(cacheKey, globalThumbnailCache.get(cacheKey)!);
    return;
  }

  const posterKey = `${url}_poster`;
  if (globalThumbnailCache.has(posterKey) && targetTime === 0) {
    onExtracted(posterKey, globalThumbnailCache.get(posterKey)!);
    return;
  }

  if (pendingExtractions.has(cacheKey)) {
    return;
  }
  pendingExtractions.add(cacheKey);

  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 90;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });

  if (crossOrigin) {
    video.crossOrigin = crossOrigin;
  }
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  let hasCleanedUp = false;
  let timeoutId: any = null;

  const cleanup = () => {
    if (hasCleanedUp) return;
    hasCleanedUp = true;
    pendingExtractions.delete(cacheKey);
    if (timeoutId) clearTimeout(timeoutId);
    video.removeEventListener('loadeddata', handleLoaded);
    video.removeEventListener('seeked', handleSeeked);
    video.removeEventListener('error', handleError);
    video.pause();
    video.removeAttribute('src');
    try {
      video.load();
    } catch {
      // ignore
    }
  };

  const captureCanvas = () => {
    if (!ctx) return;
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
      globalThumbnailCache.set(cacheKey, dataUrl);
      if (!globalThumbnailCache.has(posterKey)) {
        globalThumbnailCache.set(posterKey, dataUrl);
      }
      onExtracted(cacheKey, dataUrl);
    } catch {
      // ignore draw error
    }
    cleanup();
  };

  const handleSeeked = () => {
    captureCanvas();
  };

  const handleLoaded = () => {
    try {
      video.currentTime = Math.max(0.05, targetTime);
    } catch {
      captureCanvas();
    }
  };

  const handleError = () => {
    if (video.crossOrigin) {
      video.removeAttribute('crossorigin');
      video.src = url;
      try {
        video.load();
      } catch {
        cleanup();
      }
    } else {
      cleanup();
    }
  };

  video.addEventListener('loadeddata', handleLoaded);
  video.addEventListener('seeked', handleSeeked);
  video.addEventListener('error', handleError);

  timeoutId = setTimeout(() => {
    cleanup();
  }, 2500);

  video.src = url;
  try {
    video.load();
  } catch {
    cleanup();
  }
}

export const VideoFilmstripVisual: React.FC<VideoFilmstripVisualProps> = ({
  clip,
  width,
  isSelected,
  zoom,
}) => {
  const targetFrameWidth = Math.max(48, Math.min(80, Math.round(56 * (zoom > 25 ? 1 : 0.85))));
  const frameCount = Math.max(1, Math.min(64, Math.floor(width / targetFrameWidth)));
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
  const [isLoaded, setIsLoaded] = useState<boolean>(!!initialPoster || isImage);

  const crossOrigin = useMemo(() => getSafeCrossOrigin(clip.url), [clip.url]);

  const frames = useMemo(() => {
    const list = [];
    const secPerFrame = clip.duration / Math.max(1, frameCount);

    for (let i = 0; i < frameCount; i++) {
      const frameOffset = clip.start + i * secPerFrame;
      const mediaTime = i * secPerFrame;
      list.push({
        index: i,
        timecode: formatTimeCode(frameOffset, false),
        mediaTime,
      });
    }
    return list;
  }, [width, zoom, clip.start, clip.duration, frameCount]);

  // Preload image or extract video thumbnails with global caching
  useEffect(() => {
    if (!normalizedUrl) return;

    let isMounted = true;

    if (isImage) {
      // Preload image smoothly
      const img = new Image();
      if (crossOrigin) img.crossOrigin = crossOrigin;
      img.src = normalizedUrl;
      img.onload = () => {
        if (isMounted) {
          setIsLoaded(true);
          globalThumbnailCache.set(posterKey, normalizedUrl);
        }
      };
      return () => {
        isMounted = false;
      };
    }

    // Video extraction: First get poster (at 0.1s)
    extractVideoFrame(normalizedUrl, 0.1, crossOrigin, (key, dataUrl) => {
      if (isMounted) {
        setPosterThumb(dataUrl);
        setIsLoaded(true);
      }
    });

    // Then extract keyframes for multi-frame filmstrip
    frames.forEach((frame) => {
      const cacheKey = `${normalizedUrl}_${Math.round(frame.mediaTime * 10) / 10}`;
      if (globalThumbnailCache.has(cacheKey)) {
        if (isMounted) {
          setThumbnails((prev) => ({ ...prev, [frame.index]: globalThumbnailCache.get(cacheKey)! }));
        }
      } else {
        extractVideoFrame(normalizedUrl, frame.mediaTime, crossOrigin, (_key, dataUrl) => {
          if (isMounted) {
            setThumbnails((prev) => ({ ...prev, [frame.index]: dataUrl }));
          }
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [normalizedUrl, isImage, frames, crossOrigin, posterKey]);

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
                  className="absolute inset-0 w-full h-full object-cover opacity-75 transition-opacity duration-300"
                  loading="lazy"
                />
                {/* Subtle gradient vignette on each frame */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
                
                {/* Frame Index or subtle timecode indicator */}
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
            const thumb = thumbnails[frame.index] || posterThumb;

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
                    className="absolute inset-0 w-full h-full object-cover opacity-80 transition-opacity duration-200"
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
