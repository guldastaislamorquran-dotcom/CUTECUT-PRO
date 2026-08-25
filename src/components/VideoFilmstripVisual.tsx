import React, { useMemo, useState, useEffect } from 'react';
import { Clip } from '../types';
import { formatTimeCode, getSafeCrossOrigin, normalizeMediaUrl } from '../utils/editorUtils';

interface VideoFilmstripVisualProps {
  clip: Clip;
  width: number;
  isSelected: boolean;
  zoom: number;
}

export const VideoFilmstripVisual: React.FC<VideoFilmstripVisualProps> = ({
  clip,
  width,
  isSelected,
  zoom,
}) => {
  const targetFrameWidth = 54; // Preferred width of individual frame preview block
  const frameCount = Math.max(1, Math.min(80, Math.floor(width / targetFrameWidth)));
  const frameWidth = width / Math.max(1, frameCount);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});

  const normalizedUrl = useMemo(() => normalizeMediaUrl(clip.url), [clip.url]);
  const isImage = clip.url ? (clip.url.startsWith('data:image/') || /\.(jpeg|jpg|png|gif|webp|svg)($|\?)/i.test(clip.url)) : false;

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

  // Resilient background frame snapshot processor for video URLs
  useEffect(() => {
    if (!normalizedUrl || isImage) return;

    let isMounted = true;
    let seekTimer: any = null;
    let batchTimer: any = null;

    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 70;
    const ctx = canvas.getContext('2d');

    const crossOrigin = getSafeCrossOrigin(clip.url);
    if (crossOrigin) {
      video.crossOrigin = crossOrigin;
    }
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = normalizedUrl;

    let currentIndex = 0;

    const clearSeekTimeout = () => {
      if (seekTimer) {
        clearTimeout(seekTimer);
        seekTimer = null;
      }
    };

    const processNextFrame = () => {
      if (!isMounted || currentIndex >= frameCount) return;

      clearSeekTimeout();

      // Timeout safety: if seek takes longer than 450ms on huge MP4s, skip to next index
      seekTimer = setTimeout(() => {
        if (!isMounted) return;
        currentIndex++;
        batchTimer = setTimeout(processNextFrame, 20);
      }, 450);

      const targetTime = Math.min(clip.duration, (currentIndex + 0.15) * (clip.duration / frameCount));
      if (!isNaN(targetTime) && isFinite(targetTime)) {
        try {
          video.currentTime = Math.max(0.01, targetTime);
        } catch {
          currentIndex++;
          batchTimer = setTimeout(processNextFrame, 20);
        }
      } else {
        currentIndex++;
        batchTimer = setTimeout(processNextFrame, 20);
      }
    };

    const handleSeeked = () => {
      clearSeekTimeout();
      if (!isMounted || !ctx) return;
      
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.55);
        if (isMounted) {
          setThumbnails((prev) => ({ ...prev, [currentIndex]: dataUrl }));
        }
      } catch {
        // Fallback on canvas draw failure / memory constraint
      }

      currentIndex++;
      // Batch sequentially with 30ms throttle gap to prevent decoder thread lockup
      batchTimer = setTimeout(processNextFrame, 30);
    };

    const handleLoadedMetadata = () => {
      batchTimer = setTimeout(processNextFrame, 10);
    };

    const handleVideoError = () => {
      clearSeekTimeout();
      if (video.crossOrigin) {
        video.removeAttribute('crossorigin');
        video.src = normalizedUrl;
        try {
          video.load();
        } catch {
          // ignore
        }
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleVideoError);

    try {
      video.load();
    } catch {
      // ignore
    }

    return () => {
      isMounted = false;
      clearSeekTimeout();
      if (batchTimer) clearTimeout(batchTimer);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleVideoError);
      video.pause();
      video.removeAttribute('src');
      try {
        video.load();
      } catch {
        // ignore
      }
    };
  }, [clip.url, normalizedUrl, frameCount, clip.duration, isImage]);

  const crossOrigin = getSafeCrossOrigin(clip.url);

  return (
    <div className="absolute inset-0 flex items-center overflow-hidden pointer-events-none select-none rounded-md">
      {/* Top Film Sprocket Holes */}
      <div className="absolute top-0 left-0 right-0 h-1.5 flex justify-between px-1 bg-black/60 z-10">
        {Array.from({ length: Math.floor(width / 12) }).map((_, i) => (
          <div key={i} className="w-1.5 h-1 bg-white/20 rounded-xs" />
        ))}
      </div>

      {/* Filmstrip Frame Container */}
      <div className="w-full h-full flex items-center pt-1.5 pb-1.5">
        {frames.map((frame) => {
          const thumb = thumbnails[frame.index];

          return (
            <div
              key={frame.index}
              className={`h-full border-r border-black/50 flex flex-col justify-between p-1 relative overflow-hidden bg-slate-900/90 ${
                isSelected ? 'border-cyan-400/50' : 'border-slate-800'
              }`}
              style={{ width: `${frameWidth}px`, minWidth: `${frameWidth}px` }}
            >
              {/* Captured Frame Snapshot Image */}
              {thumb ? (
                <img
                  src={thumb}
                  alt={`frame-${frame.index}`}
                  className="absolute inset-0 w-full h-full object-cover opacity-80"
                />
              ) : isImage && normalizedUrl ? (
                /* Image Clip Poster */
                <img
                  src={normalizedUrl}
                  crossOrigin={crossOrigin}
                  alt={`img-frame-${frame.index}`}
                  className="absolute inset-0 w-full h-full object-cover opacity-70"
                />
              ) : normalizedUrl ? (
                /* Video element with temporal fragment fallback (#t=time) */
                <video
                  src={`${normalizedUrl}#t=${frame.mediaTime}`}
                  muted
                  preload="metadata"
                  className="absolute inset-0 w-full h-full object-cover opacity-65 pointer-events-none"
                />
              ) : (
                /* Placeholder background pattern */
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/40 to-slate-900/80" />
              )}

              {/* Timecode Badge */}
              <div className="z-10 flex justify-between items-center text-[7px] font-mono font-bold tracking-tighter text-cyan-200 bg-black/75 px-1 py-0.5 rounded-xs w-fit shadow">
                <span>{frame.timecode}</span>
              </div>

              {/* Center Sprocket Frame Outline */}
              <div className="z-10 flex items-center justify-center opacity-30">
                <div className="w-3 h-2 border border-cyan-200 rounded-xs" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Film Sprocket Holes */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 flex justify-between px-1 bg-black/60 z-10">
        {Array.from({ length: Math.floor(width / 12) }).map((_, i) => (
          <div key={i} className="w-1.5 h-1 bg-white/20 rounded-xs" />
        ))}
      </div>
    </div>
  );
};

export default VideoFilmstripVisual;
