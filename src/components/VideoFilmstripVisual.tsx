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
  const roundedTime = Math.round(targetTime * 10) / 10;
  const cacheKey = `${url}_${roundedTime}`;
  
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
  canvas.width = 320;
  canvas.height = 180;
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
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
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
  }, 3000);

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
  // CapCut Pro frame slice width (approx 68px to 80px per frame slice)
  const targetFrameWidth = Math.max(56, Math.min(90, Math.round(68 * (zoom > 25 ? 1 : 0.85))));
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
  const [, setIsLoaded] = useState<boolean>(!!initialPoster || isImage);

  const crossOrigin = useMemo(() => getSafeCrossOrigin(clip.url), [clip.url]);

  const frames = useMemo(() => {
    const list = [];
    const secPerFrame = clip.duration / Math.max(1, frameCount);
    const sourceOffset = clip.sourceStart || 0;

    for (let i = 0; i < frameCount; i++) {
      const clipTimeOffset = clip.start + i * secPerFrame;
      const mediaTime = sourceOffset + i * secPerFrame;
      list.push({
        index: i,
        timecode: formatTimeCode(clipTimeOffset, false),
        mediaTime,
      });
    }
    return list;
  }, [width, zoom, clip.start, clip.duration, clip.sourceStart, frameCount]);

  // Preload image or extract video thumbnails with global caching
  useEffect(() => {
    if (!normalizedUrl) return;

    let isMounted = true;

    if (isImage) {
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

    // Video extraction: First get poster (at start)
    const initialTime = (clip.sourceStart || 0) + 0.1;
    extractVideoFrame(normalizedUrl, initialTime, crossOrigin, (_key, dataUrl) => {
      if (isMounted) {
        setPosterThumb(dataUrl);
        setIsLoaded(true);
      }
    });

    // Then extract keyframes for multi-frame filmstrip
    frames.forEach((frame) => {
      const roundedTime = Math.round(frame.mediaTime * 10) / 10;
      const cacheKey = `${normalizedUrl}_${roundedTime}`;
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
  }, [normalizedUrl, isImage, frames, crossOrigin, posterKey, clip.sourceStart]);

  return (
    <div className="absolute inset-0 flex items-stretch overflow-hidden pointer-events-none select-none rounded-md bg-[#10171d]">
      {/* Edge-to-Edge Filmstrip Container matching CapCut */}
      <div className="w-full h-full flex items-stretch">
        {isImage && normalizedUrl ? (
          /* Smooth Looping Image Ribbon */
          <div className="w-full h-full flex items-stretch relative overflow-hidden">
            {frames.map((frame) => (
              <div
                key={`img-frame-${frame.index}`}
                className={`h-full border-r border-black/50 relative overflow-hidden bg-slate-900 flex-shrink-0 ${
                  isSelected ? 'border-cyan-400/40' : 'border-slate-800/80'
                }`}
                style={{ width: `${frameWidth}px`, minWidth: `${frameWidth}px` }}
              >
                <img
                  src={normalizedUrl}
                  crossOrigin={crossOrigin}
                  alt={`img-loop-${frame.index}`}
                  className="absolute inset-0 w-full h-full object-cover opacity-95 transition-opacity duration-300"
                  loading="lazy"
                />
                
                {/* Subtle bottom timecode indicator */}
                {frameWidth >= 44 && (
                  <div className="absolute bottom-1 left-1 z-10 text-[7px] font-mono text-cyan-200 bg-black/75 px-1 py-0.5 rounded shadow-sm">
                    {frame.timecode}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* CapCut Style Full-Bleed Video Keyframe Strip */
          frames.map((frame) => {
            const thumb = thumbnails[frame.index] || posterThumb;

            return (
              <div
                key={`video-frame-${frame.index}`}
                className={`h-full border-r border-black/60 flex flex-col justify-between relative overflow-hidden bg-[#0c181d] flex-shrink-0 ${
                  isSelected ? 'border-cyan-400/50' : 'border-black/50'
                }`}
                style={{ width: `${frameWidth}px`, minWidth: `${frameWidth}px` }}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={`frame-${frame.index}`}
                    className="absolute inset-0 w-full h-full object-cover opacity-95 transition-opacity duration-200"
                  />
                ) : (
                  /* Shimmering placeholder skeleton while generating snapshot */
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 animate-pulse opacity-90 flex items-center justify-center">
                    <span className="text-[7px] font-mono text-cyan-500/60">loading...</span>
                  </div>
                )}

                {/* Subtle vignette for contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />

                {/* Frame timecode indicator in lower corner */}
                {frameWidth >= 46 && (
                  <div className="z-10 absolute bottom-1 left-1 flex items-center text-[7px] font-mono font-bold text-cyan-200 bg-black/80 px-1 py-0.2 rounded shadow-sm">
                    <span>{frame.timecode}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default VideoFilmstripVisual;
