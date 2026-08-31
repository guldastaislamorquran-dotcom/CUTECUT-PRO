import React, { useRef, useEffect, useState } from 'react';
import {
  Play, Pause, ChevronLeft, ChevronRight, Maximize2, Minimize2, Layers,
  Grid, ShieldCheck, Volume2, VolumeX, Monitor, Smartphone, Square,
  Film, Menu, Scan, Search, ChevronDown, Activity, SlidersHorizontal
} from 'lucide-react';
import { Track, Clip, ClipType, WatermarkSettings } from '../types';
import { formatTimeCode, applyPixelFilters, normalizeMediaUrl, getSafeCrossOrigin, getInterpolatedClipProperties, computeClipTransitionState, getExportResolutionDimensions } from '../utils/editorUtils';

interface PreviewPlayerProps {
  tracks: Track[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  aspectRatio: '16:9' | '9:16' | '1:1';
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSetAspectRatio: (ratio: '16:9' | '9:16' | '1:1') => void;
  videoNodes: Record<string, HTMLVideoElement | HTMLImageElement>;
  selectedClip?: Clip | null;
  selectedClipIds?: string[];
  onSelectClip?: (clip: Clip | null) => void;
  onSelectClips?: (ids: string[]) => void;
  onUpdateClip?: (clipId: string, updates: Partial<Clip>) => void;
  onBatchUpdateClips?: (updates: { id: string; updates: Partial<Clip> }[]) => void;
  watermark?: WatermarkSettings;
  isExporting?: boolean;
  exportResolution?: '480p' | '720p' | '1080p' | string;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

interface TextBound {
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  clip: Clip;
}

export default function PreviewPlayer({
  tracks,
  currentTime,
  duration,
  isPlaying,
  aspectRatio,
  onPlayPause,
  onSeek,
  onSetAspectRatio,
  videoNodes,
  selectedClip,
  selectedClipIds,
  onSelectClip,
  onSelectClips,
  onUpdateClip,
  onBatchUpdateClips,
  watermark,
  isExporting,
  exportResolution = '1080p',
  onCanvasReady,
}: PreviewPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (onCanvasReady) {
      onCanvasReady(canvasRef.current);
    }
  }, [onCanvasReady]);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerFrameRef = useRef<HTMLDivElement>(null);
  const fallbackMediaRef = useRef<Record<string, HTMLVideoElement | HTMLImageElement>>({});
  const watermarkImgRef = useRef<HTMLImageElement | null>(null);

  const [dimensions, setDimensions] = useState({ width: 1280, height: 720 });
  const [showGrid, setShowGrid] = useState(false);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState<'fit' | 50 | 75 | 100>('fit');
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRatioMenu, setShowRatioMenu] = useState(false);
  const [showPlayerMenu, setShowPlayerMenu] = useState(false);

  // Interactive Text & Group Drag & Scale State
  const textBoundsRef = useRef<Record<string, TextBound>>({});
  const groupBoundsRef = useRef<{
    left: number;
    top: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
    clips: Clip[];
  } | null>(null);

  const activeSnapRef = useRef<{ x: number | null; y: number | null; label?: string }>({ x: null, y: null });
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [isResizingText, setIsResizingText] = useState(false);
  const [isDraggingGroup, setIsDraggingGroup] = useState(false);
  const [isResizingGroup, setIsResizingGroup] = useState(false);
  const initialGroupClipsPos = useRef<{ clip: Clip; initialX: number; initialY: number; initialFontSize: number; initialScale: number }[]>([]);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialTextPos, setInitialTextPos] = useState<{ x: number; y: number; fontSize: number }>({ x: 50, y: 50, fontSize: 32 });
  const [activeCursor, setActiveCursor] = useState<'default' | 'pointer' | 'move' | 'nwse-resize'>('default');

  // Compute Canvas Size based on aspect ratio (Native Crisp Full HD / 1080p resolution)
  useEffect(() => {
    const targetPreset = isExporting ? (exportResolution || '1080p') : '1080p';
    const dims = getExportResolutionDimensions(targetPreset, aspectRatio);
    setDimensions(dims);
  }, [aspectRatio, isExporting, exportResolution]);

  // Find active video clip for adjustment controls
  const activeClips: Clip[] = [];
  tracks.forEach((track) => {
    if (track.hidden) return;
    track.clips.forEach((clip) => {
      if (currentTime >= clip.start && currentTime <= clip.start + clip.duration) {
        activeClips.push(clip);
      }
    });
  });

  const activeVideoClip = selectedClip?.type === ClipType.VIDEO 
    ? selectedClip 
    : activeClips.find(c => c.type === ClipType.VIDEO) || null;

  // Frame Scrubbing
  const stepFrame = (direction: 'prev' | 'next') => {
    const fps = 30;
    const frameTime = 1 / fps;
    const nextTime = direction === 'next' ? currentTime + frameTime : currentTime - frameTime;
    onSeek(Math.max(0, Math.min(duration, nextTime)));
  };

  // Fullscreen player toggle
  const toggleFullscreen = () => {
    if (!playerFrameRef.current) return;
    if (!document.fullscreenElement) {
      playerFrameRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Single-click macro transformation matrix to auto fit full screen
  const handleAutoFitFullScreen = () => {
    if (onSetAspectRatio) {
      onSetAspectRatio('16:9');
    }
    if (!activeVideoClip || !onUpdateClip) return;
    onUpdateClip(activeVideoClip.id, {
      transform: {
        scale: 100,
        posX: 0,
        posY: 0,
        rotation: 0,
      },
    });
  };

  // Pre-trigger video element initialization on track changes
  useEffect(() => {
    tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        if (clip.type === ClipType.VIDEO && clip.url) {
          const media = videoNodes[clip.id] || fallbackMediaRef.current[clip.id];
          if (media && media instanceof HTMLVideoElement) {
            const video = media as HTMLVideoElement;
            video.muted = isMuted || !!track.muted;
            if (video.readyState < 1 && video.networkState === HTMLMediaElement.NETWORK_EMPTY) {
              try {
                video.load();
              } catch {
                // ignore
              }
            }
          }
        }
      });
    });
  }, [tracks, videoNodes, currentTime, isMuted]);

  // Render loop to draw active layers onto Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }) || canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      // 1. Clear Canvas
      ctx.fillStyle = '#08080b';
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Draw subtle grid lines if enabled
      if (showGrid && !isExporting) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;

        // Rule of Thirds
        const w3 = dimensions.width / 3;
        const h3 = dimensions.height / 3;

        ctx.beginPath();
        ctx.moveTo(w3, 0); ctx.lineTo(w3, dimensions.height);
        ctx.moveTo(w3 * 2, 0); ctx.lineTo(w3 * 2, dimensions.height);
        ctx.moveTo(0, h3); ctx.lineTo(dimensions.width, h3);
        ctx.moveTo(0, h3 * 2); ctx.lineTo(dimensions.width, h3 * 2);
        ctx.stroke();

        // Center crosshair
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
        const cx = dimensions.width / 2;
        const cy = dimensions.height / 2;
        ctx.beginPath();
        ctx.moveTo(cx - 15, cy); ctx.lineTo(cx + 15, cy);
        ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15);
        ctx.stroke();
      }

      // Safe Area lines if enabled
      if (showSafeArea) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        const marginX = dimensions.width * 0.1;
        const marginY = dimensions.height * 0.1;
        ctx.strokeRect(marginX, marginY, dimensions.width - marginX * 2, dimensions.height - marginY * 2);
        ctx.setLineDash([]);
      }

      // 2. Identify active clips at current timeline point
      const activeFrameClips: Clip[] = [];
      tracks.forEach((track) => {
        if (track.hidden) return; // Skip hidden tracks
        track.clips.forEach((clip) => {
          if (currentTime >= clip.start && currentTime <= clip.start + clip.duration) {
            activeFrameClips.push(clip);
          }
        });
      });

      // ------------------ VIDEO LAYERS ------------------
      activeFrameClips.forEach((clip) => {
        if (clip.type === ClipType.VIDEO) {
          let media = videoNodes[clip.id] || fallbackMediaRef.current[clip.id];

          // Fallback: create safe HTML5 video/image element dynamically if missing
          if (!media && clip.url) {
            const normUrl = normalizeMediaUrl(clip.url);
            const safeCrossOrigin = getSafeCrossOrigin(clip.url);

            if (clip.isImage || clip.url.startsWith('data:image/') || /\.(jpeg|jpg|png|gif|webp|svg|avif)/i.test(clip.url)) {
              const img = document.createElement('img');
              img.crossOrigin = safeCrossOrigin || 'anonymous';
              img.src = normUrl;

              img.addEventListener('error', () => {
                if (img.crossOrigin) {
                  img.removeAttribute('crossorigin');
                  img.src = normUrl;
                }
              });

              if (typeof img.decode === 'function') {
                img.decode().catch(() => {});
              }

              fallbackMediaRef.current[clip.id] = img;
              media = img;
            } else {
              const video = document.createElement('video');
              video.crossOrigin = safeCrossOrigin || 'anonymous';
              video.src = normUrl;
              video.muted = isMuted;
              video.playsInline = true;
              video.preload = 'auto';
              video.setAttribute('webkit-playsinline', 'true');

              const handleVideoErr = () => {
                if (video.crossOrigin) {
                  video.removeAttribute('crossorigin');
                  video.src = normUrl;
                  try {
                    video.load();
                  } catch {
                    // ignore
                  }
                }
              };
              video.addEventListener('error', handleVideoErr);

              try {
                video.load();
              } catch {
                // ignore
              }
              fallbackMediaRef.current[clip.id] = video;
              media = video;
            }
          }

          if (media) {
            const isImg = clip.isImage || (media instanceof HTMLImageElement);
            const videoEl = media as HTMLVideoElement;

            const isReady = isImg
              ? ((media as HTMLImageElement).complete && (media as HTMLImageElement).naturalWidth > 0)
              : (videoEl.readyState >= 1 || videoEl.videoWidth > 0 || videoEl.duration > 0 || videoEl.currentTime > 0 || videoEl.seeking);

            if (isReady) {
              if (!isImg && !isPlaying) {
                const video = media as HTMLVideoElement;
                const elapsed = currentTime - clip.start;
                const srcTime = clip.sourceStart + elapsed * clip.playbackRate;
                const durationLimit = (video.duration && !isNaN(video.duration) && isFinite(video.duration)) ? video.duration : (clip.duration || 999999);
                const clampedSrcTime = Math.max(0, Math.min(durationLimit, srcTime));
                if (Math.abs(video.currentTime - clampedSrcTime) > 0.08 && !video.seeking) {
                  try {
                    video.currentTime = clampedSrcTime;
                  } catch {
                    // ignore seek error
                  }
                }
              }

              // Transform, Keyframe & Transition parameters
              const interpolated = getInterpolatedClipProperties(clip, currentTime);
              const transState = computeClipTransitionState(clip, currentTime, dimensions.width, dimensions.height);

              const scale = (interpolated.scale / 100) * transState.scaleMultiplier;
              const posX = interpolated.posX + transState.offsetX;
              const posY = interpolated.posY + transState.offsetY;
              const rotationDeg = interpolated.rotation;
              const rad = (rotationDeg * Math.PI) / 180;

              // Render video/image onto canvas with safe matrix transforms
              ctx.save();
              ctx.globalAlpha = Math.max(0, Math.min(1, interpolated.opacity * transState.alphaMultiplier));
              
              if (transState.wipeProgress !== null) {
                ctx.beginPath();
                ctx.rect(-dimensions.width / 2, -dimensions.height / 2, dimensions.width * transState.wipeProgress, dimensions.height);
                ctx.clip();
              }

              // Apply GPU-level filters
              let filterStr = 'none';
              if (clip.videoEffects?.blur) {
                filterStr = `blur(${clip.videoEffects.blur}px)`;
              }
              ctx.filter = filterStr;

              // Matrix transform: Translate -> Rotate -> Scale
              ctx.translate(dimensions.width / 2 + posX, dimensions.height / 2 + posY);
              if (rotationDeg !== 0) {
                ctx.rotate(rad);
              }
              if (scale !== 1) {
                ctx.scale(scale, scale);
              }

              try {
                ctx.drawImage(media, -dimensions.width / 2, -dimensions.height / 2, dimensions.width, dimensions.height);
              } catch {
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(-dimensions.width / 2, -dimensions.height / 2, dimensions.width, dimensions.height);
              }
              
              ctx.filter = 'none';

              // Apply additional video effects inside transformed context
              if (clip.videoEffects?.vignette) {
                const grad = ctx.createRadialGradient(
                  0, 0, dimensions.width * 0.3,
                  0, 0, dimensions.width * 0.7
                );
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(1, 'rgba(0,0,0,0.85)');
                ctx.fillStyle = grad;
                ctx.fillRect(-dimensions.width / 2, -dimensions.height / 2, dimensions.width, dimensions.height);
              }

              if (clip.videoEffects?.filmGrain) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
                for (let i = 0; i < 40; i++) {
                  const gx = (Math.random() - 0.5) * dimensions.width;
                  const gy = (Math.random() - 0.5) * dimensions.height;
                  const gSize = Math.random() * 2 + 1;
                  ctx.fillRect(gx, gy, gSize, gSize);
                }
              }

              if (clip.videoEffects?.glitch && isPlaying && Math.random() < 0.18) {
                const sliceCount = Math.floor(Math.random() * 3) + 2;
                for (let s = 0; s < sliceCount; s++) {
                  const sy = (Math.random() - 0.5) * dimensions.height;
                  const sh = Math.random() * 30 + 10;
                  const sx = (Math.random() - 0.5) * 12;
                  try {
                    ctx.drawImage(canvas, 0, sy, dimensions.width, sh, sx, sy, dimensions.width, sh);
                  } catch {
                    // ignore glitch slice error
                  }
                }
              }

              // AI Video Relighting Presets (Simulated studio ambient lighting matrix)
              if (clip.videoEffects?.relighting?.enabled) {
                const style = clip.videoEffects.relighting.style || 'amber-glow';
                const intensity = (clip.videoEffects.relighting.intensity ?? 75) / 100;
                
                if (style === 'amber-glow' || style === 'quran-gold') {
                  const ambientGrad = ctx.createRadialGradient(
                    0, -dimensions.height * 0.2, dimensions.width * 0.1,
                    0, 0, dimensions.width * 0.8
                  );
                  ambientGrad.addColorStop(0, `rgba(245, 158, 11, ${0.45 * intensity})`);
                  ambientGrad.addColorStop(0.6, `rgba(217, 119, 6, ${0.2 * intensity})`);
                  ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                  ctx.fillStyle = ambientGrad;
                  ctx.fillRect(-dimensions.width / 2, -dimensions.height / 2, dimensions.width, dimensions.height);
                } else if (style === 'neon-cyan') {
                  const ambientGrad = ctx.createLinearGradient(
                    -dimensions.width / 2, -dimensions.height / 2,
                    dimensions.width / 2, dimensions.height / 2
                  );
                  ambientGrad.addColorStop(0, `rgba(6, 182, 212, ${0.35 * intensity})`);
                  ambientGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
                  ambientGrad.addColorStop(1, `rgba(236, 72, 153, ${0.35 * intensity})`);
                  ctx.fillStyle = ambientGrad;
                  ctx.fillRect(-dimensions.width / 2, -dimensions.height / 2, dimensions.width, dimensions.height);
                } else if (style === 'studio-sunset') {
                  const ambientGrad = ctx.createLinearGradient(
                    0, -dimensions.height / 2,
                    0, dimensions.height / 2
                  );
                  ambientGrad.addColorStop(0, `rgba(244, 63, 94, ${0.3 * intensity})`);
                  ambientGrad.addColorStop(0.6, `rgba(245, 158, 11, ${0.25 * intensity})`);
                  ambientGrad.addColorStop(1, `rgba(99, 102, 241, ${0.2 * intensity})`);
                  ctx.fillStyle = ambientGrad;
                  ctx.fillRect(-dimensions.width / 2, -dimensions.height / 2, dimensions.width, dimensions.height);
                }
              }

              // Light Leaks Overlay
              if (clip.videoEffects?.lightLeak) {
                const leakGrad = ctx.createRadialGradient(
                  dimensions.width * 0.3, -dimensions.height * 0.3, 10,
                  dimensions.width * 0.2, -dimensions.height * 0.2, dimensions.width * 0.6
                );
                leakGrad.addColorStop(0, 'rgba(255, 200, 100, 0.5)');
                leakGrad.addColorStop(0.5, 'rgba(255, 100, 150, 0.25)');
                leakGrad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = leakGrad;
                ctx.fillRect(-dimensions.width / 2, -dimensions.height / 2, dimensions.width, dimensions.height);
              }

              // Bokeh Particle Dust
              if (clip.videoEffects?.bokeh) {
                ctx.fillStyle = 'rgba(253, 230, 138, 0.15)';
                for (let b = 0; b < 12; b++) {
                  const bx = Math.sin(b * 1.5 + currentTime) * (dimensions.width * 0.4);
                  const by = Math.cos(b * 2.1 + currentTime) * (dimensions.height * 0.4);
                  const br = Math.random() * 12 + 8;
                  ctx.beginPath();
                  ctx.arc(bx, by, br, 0, Math.PI * 2);
                  ctx.fill();
                }
              }

              ctx.restore();

              // Draw CapCut Pro Selected Clip Bounding Outline
              if (selectedClip?.id === clip.id && !isExporting) {
                ctx.save();
                ctx.translate(dimensions.width / 2 + posX, dimensions.height / 2 + posY);
                if (rotationDeg !== 0) ctx.rotate(rad);
                
                const boxW = dimensions.width * scale;
                const boxH = dimensions.height * scale;
                const halfW = boxW / 2;
                const halfH = boxH / 2;

                ctx.strokeStyle = '#06b6d4'; // CapCut Cyan
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                ctx.strokeRect(-halfW, -halfH, boxW, boxH);
                ctx.setLineDash([]);

                // Corner Handles
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#06b6d4';
                ctx.lineWidth = 2;
                const handleRadius = 6;

                const corners = [
                  [-halfW, -halfH],
                  [halfW, -halfH],
                  [halfW, halfH],
                  [-halfW, halfH],
                ];

                corners.forEach(([cx, cy]) => {
                  ctx.beginPath();
                  ctx.arc(cx, cy, handleRadius, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.stroke();
                });

                // Rotation handle line & top dot
                ctx.beginPath();
                ctx.moveTo(0, -halfH);
                ctx.lineTo(0, -halfH - 24);
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(0, -halfH - 24, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.restore();
              }

              // Apply pixel-level LUT filters on untransformed canvas
              if (clip.filters) {
                applyPixelFilters(ctx, dimensions.width, dimensions.height, clip.filters);
              }
            } else {
              // High-quality non-blocking cinematic video slate fallback
              ctx.save();
              
              const grad = ctx.createLinearGradient(0, 0, dimensions.width, dimensions.height);
              grad.addColorStop(0, '#0f172a');
              grad.addColorStop(0.5, '#1e293b');
              grad.addColorStop(1, '#090d16');
              ctx.fillStyle = grad;
              ctx.fillRect(0, 0, dimensions.width, dimensions.height);

              ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
              ctx.lineWidth = 1;
              const gridStep = 40;
              for (let x = 0; x < dimensions.width; x += gridStep) {
                ctx.beginPath();
                ctx.moveTo(x, 0); ctx.lineTo(x, dimensions.height);
                ctx.stroke();
              }
              for (let y = 0; y < dimensions.height; y += gridStep) {
                ctx.beginPath();
                ctx.moveTo(0, y); ctx.lineTo(dimensions.width, y);
                ctx.stroke();
              }

              const boxW = Math.min(480, dimensions.width * 0.8);
              const boxH = 110;
              const boxX = (dimensions.width - boxW) / 2;
              const boxY = (dimensions.height - boxH) / 2;

              ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
              ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.roundRect(boxX, boxY, boxW, boxH, 12);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = '#38bdf8';
              ctx.font = 'bold 20px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(`🎬  ${clip.name}`, dimensions.width / 2, boxY + 40);

              ctx.fillStyle = '#94a3b8';
              ctx.font = '14px monospace';
              const timeFormatted = formatTimeCode(currentTime - clip.start, false);
              ctx.fillText(`STREAM ACTIVE  |  ${timeFormatted} / ${formatTimeCode(clip.duration, false)}`, dimensions.width / 2, boxY + 75);

              ctx.restore();
            }
          }
        }
      });

      // ------------------ TEXT LAYERS ------------------
      activeFrameClips.forEach((clip) => {
        if (clip.type === ClipType.TEXT && clip.text) {
          ctx.save();
          
          const transState = computeClipTransitionState(clip, currentTime, dimensions.width, dimensions.height);
          ctx.globalAlpha = Math.max(0, Math.min(1, transState.alphaMultiplier));

          const xPos = (((clip.textX ?? 50) / 100) * dimensions.width) + transState.offsetX;
          const yPos = (((clip.textY ?? 50) / 100) * dimensions.height) + transState.offsetY;
          const fontSize = clip.fontSize ?? 32;
          const color = clip.color ?? '#FFFFFF';
          const alignment = clip.textAlignment ?? 'center';
          const wrapEnabled = clip.textWrap !== false;
          const maxPct = clip.textMaxWidth ?? 85;
          const maxPxWidth = (maxPct / 100) * dimensions.width;
          const lineHeightMult = clip.textLineHeight ?? 1.3;

          let fontStack = '"Inter", sans-serif';
          if (clip.fontFamily === 'KFGQPC Uthmanic Script HAFS Regular' || clip.fontFamily === 'KFGQPC Uthmanic Script HAFS' || clip.fontFamily === 'Uthmani' || clip.fontFamily === 'KFGQPC Uthman Taha Naskh') {
            fontStack = '"KFGQPC Uthmanic Script HAFS Regular", "KFGQPC Uthmanic Script HAFS", "Uthmani", "KFGQPC Uthman Taha Naskh", "Amiri Quran", "Noto Naskh Arabic", serif';
          } else if (clip.fontFamily === 'Amiri Quran') {
            fontStack = '"Amiri Quran", "Uthmani", "Amiri", serif';
          } else if (clip.fontFamily === 'Noto Naskh Arabic') {
            fontStack = '"Noto Naskh Arabic", "Uthmani", "Amiri", serif';
          } else if (clip.fontFamily === 'Amiri') {
            fontStack = '"Amiri", serif';
          }
          else if (clip.fontFamily === 'Traditional Arabic') fontStack = '"Traditional Arabic", "Amiri", serif';
          else if (clip.fontFamily === 'Lateef') fontStack = '"Lateef", serif';
          else if (clip.fontFamily === 'Scheherazade New') fontStack = '"Scheherazade New", serif';
          else if (clip.fontFamily === 'Reem Kufi') fontStack = '"Reem Kufi", sans-serif';
          else if (clip.fontFamily === 'Noto Nastaliq Urdu') fontStack = '"Noto Nastaliq Urdu", serif';
          else if (clip.fontFamily === 'Cinzel') fontStack = '"Cinzel", serif';
          else if (clip.fontFamily === 'Montserrat') fontStack = '"Montserrat", sans-serif';
          else if (clip.fontFamily === 'Space Grotesk') fontStack = '"Space Grotesk", sans-serif';
          else if (clip.fontFamily === 'Playfair Display') fontStack = '"Playfair Display", serif';
          else if (clip.fontFamily === 'JetBrains Mono') fontStack = '"JetBrains Mono", monospace';
          else if (clip.fontFamily) fontStack = clip.fontFamily;

          ctx.font = `bold ${fontSize}px ${fontStack}`;
          ctx.textAlign = alignment;
          ctx.textBaseline = 'middle';

          const rawText = clip.textTransform === 'uppercase' ? clip.text.toUpperCase() : clip.text;
          
          let lines: string[] = [rawText];
          if (wrapEnabled) {
            const manualParagraphs = rawText.split('\n');
            const wrappedLines: string[] = [];
            for (const para of manualParagraphs) {
              const words = para.trim().split(/\s+/);
              if (words.length <= 1) {
                wrappedLines.push(para);
              } else {
                let currentLine = words[0];
                for (let i = 1; i < words.length; i++) {
                  const word = words[i];
                  const testLine = currentLine + " " + word;
                  const metrics = ctx.measureText(testLine);
                  if (metrics.width > maxPxWidth) {
                    wrappedLines.push(currentLine);
                    currentLine = word;
                  } else {
                    currentLine = testLine;
                  }
                }
                wrappedLines.push(currentLine);
              }
            }
            lines = wrappedLines.filter(l => l.trim().length > 0);
          }
          
          if (lines.length === 0) lines = [''];

          const lineGap = fontSize * lineHeightMult;
          const totalHeight = (lines.length - 1) * lineGap;
          const startY = yPos - totalHeight / 2;

          let maxLineWidth = 0;
          lines.forEach((lText) => {
            const w = ctx.measureText(lText).width;
            if (w > maxLineWidth) maxLineWidth = w;
          });

          const blockW = Math.max(80, maxLineWidth + 24);
          const blockH = Math.max(40, lines.length * lineGap + 16);
          const boxLeft = alignment === 'center' ? xPos - blockW / 2 : alignment === 'right' ? xPos - blockW : xPos;
          const boxTop = yPos - blockH / 2;

          textBoundsRef.current[clip.id] = {
            left: boxLeft,
            top: boxTop,
            width: blockW,
            height: blockH,
            centerX: xPos,
            centerY: yPos,
            clip,
          };

          // ------------------ CapCut Text Animation Calculations ------------------
          const clipTime = Math.max(0, currentTime - clip.start);
          const animConfig = clip.textAnimation || {};
          const inAnim = animConfig.inAnimation || 'none';
          const inDur = animConfig.inDuration ?? 0.4;
          const outAnim = animConfig.outAnimation || 'none';
          const outDur = animConfig.outDuration ?? 0.4;
          const loopAnim = animConfig.loopAnimation || 'none';

          const inProgress = inDur > 0 ? Math.min(1, Math.max(0, clipTime / inDur)) : 1;
          const remainingTime = clip.duration - clipTime;
          const outProgress = outDur > 0 ? Math.min(1, Math.max(0, remainingTime / outDur)) : 1;

          const cubicEaseOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
          const cubicEaseIn = (t: number) => Math.pow(Math.min(1, Math.max(0, t)), 3);
          const elasticOut = (t: number) => {
            const clamped = Math.min(1, Math.max(0, t));
            if (clamped === 0 || clamped === 1) return clamped;
            const p = 0.3;
            return Math.pow(2, -10 * clamped) * Math.sin((clamped - p / 4) * (2 * Math.PI) / p) + 1;
          };

          let animAlpha = 1.0;
          let animScale = 1.0;
          let animOffsetX = 0;
          let animOffsetY = 0;
          let animGlowBoost = 0;

          // In Animation
          if (inAnim === 'fade') {
            animAlpha *= cubicEaseOut(inProgress);
          } else if (inAnim === 'pop' || inAnim === 'zoom-in') {
            animScale *= 0.15 + 0.85 * cubicEaseOut(inProgress);
            animAlpha *= Math.min(1, inProgress * 2.5);
          } else if (inAnim === 'slide-up') {
            animOffsetY += (1 - cubicEaseOut(inProgress)) * (fontSize * 1.5);
            animAlpha *= Math.min(1, inProgress * 2.5);
          } else if (inAnim === 'slide-down') {
            animOffsetY -= (1 - cubicEaseOut(inProgress)) * (fontSize * 1.5);
            animAlpha *= Math.min(1, inProgress * 2.5);
          } else if (inAnim === 'slide-left') {
            animOffsetX += (1 - cubicEaseOut(inProgress)) * (fontSize * 2.5);
            animAlpha *= Math.min(1, inProgress * 2.5);
          } else if (inAnim === 'slide-right') {
            animOffsetX -= (1 - cubicEaseOut(inProgress)) * (fontSize * 2.5);
            animAlpha *= Math.min(1, inProgress * 2.5);
          } else if (inAnim === 'bounce') {
            animScale *= elasticOut(inProgress);
            animAlpha *= Math.min(1, inProgress * 3);
          } else if (inAnim === 'glitch') {
            if (inProgress < 1.0) {
              animAlpha *= Math.random() > 0.3 ? cubicEaseOut(inProgress) : 0.2;
              animOffsetX += (Math.random() - 0.5) * 18 * (1 - inProgress);
              animOffsetY += (Math.random() - 0.5) * 10 * (1 - inProgress);
            }
          }

          // Out Animation
          if (outAnim === 'fade') {
            animAlpha *= cubicEaseIn(outProgress);
          } else if (outAnim === 'zoom-out') {
            animScale *= 0.15 + 0.85 * cubicEaseIn(outProgress);
            animAlpha *= cubicEaseIn(outProgress);
          } else if (outAnim === 'slide-down') {
            animOffsetY += (1 - cubicEaseIn(outProgress)) * (fontSize * 1.5);
            animAlpha *= cubicEaseIn(outProgress);
          } else if (outAnim === 'slide-up') {
            animOffsetY -= (1 - cubicEaseIn(outProgress)) * (fontSize * 1.5);
            animAlpha *= cubicEaseIn(outProgress);
          } else if (outAnim === 'slide-left') {
            animOffsetX -= (1 - cubicEaseIn(outProgress)) * (fontSize * 2.5);
            animAlpha *= cubicEaseIn(outProgress);
          } else if (outAnim === 'slide-right') {
            animOffsetX += (1 - cubicEaseIn(outProgress)) * (fontSize * 2.5);
            animAlpha *= cubicEaseIn(outProgress);
          }

          // Loop Animation
          if (loopAnim === 'pulse') {
            animScale *= 1 + 0.04 * Math.sin(clipTime * 4.5);
          } else if (loopAnim === 'float') {
            animOffsetY += Math.sin(clipTime * 2.5) * 7;
          } else if (loopAnim === 'bounce-loop') {
            animOffsetY += -Math.abs(Math.sin(clipTime * 5.5)) * 12;
          } else if (loopAnim === 'shimmer') {
            animGlowBoost = (Math.sin(clipTime * 6) + 1) * 10;
          }

          // Save Canvas Context for Animation Transforms
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, ctx.globalAlpha * animAlpha));
          ctx.translate(xPos + animOffsetX, yPos + animOffsetY);
          ctx.scale(animScale, animScale);
          ctx.translate(-xPos, -yPos);

          // Typewriter Karaoke reveal line text processing
          let renderLines = lines;
          if (inAnim === 'typewriter') {
            const totalChars = lines.join('').length;
            const revealCount = Math.floor(totalChars * cubicEaseOut(inProgress));
            let charAcc = 0;
            renderLines = lines.map((l) => {
              if (charAcc >= revealCount) return '';
              if (charAcc + l.length <= revealCount) {
                charAcc += l.length;
                return l;
              }
              const take = revealCount - charAcc;
              charAcc += l.length;
              return l.slice(0, take);
            });
          }

          // Render 'Viral Reels Style' or custom background box overlay if specified
          if (clip.textStyle === ('viral-reels' as any) || (clip as any).backgroundColor) {
            ctx.save();
            ctx.fillStyle = (clip as any).backgroundColor || 'rgba(0, 0, 0, 0.82)';
            ctx.beginPath();
            ctx.roundRect(boxLeft - 6, boxTop - 4, blockW + 12, blockH + 8, 8);
            ctx.fill();
            ctx.restore();
          }

          renderLines.forEach((lineText, idx) => {
            if (!lineText) return;
            const currentY = startY + idx * lineGap;

            // 3D Text Extrusion Depth Layering
            if (clip.text3D && clip.text3D.depth3D && clip.text3D.depth3D > 0) {
              const depth = clip.text3D.depth3D;
              const shadowColor = clip.text3D.neonGlowColor || 'rgba(0,0,0,0.85)';
              ctx.save();
              ctx.fillStyle = shadowColor;
              for (let d = depth; d > 0; d--) {
                ctx.fillText(lineText, xPos + d * 0.8, currentY + d * 0.8);
              }
              if (clip.text3D.metallicBorder) {
                ctx.strokeStyle = '#e2e8f0';
                ctx.lineWidth = 1.5;
                ctx.strokeText(lineText, xPos + depth * 0.8, currentY + depth * 0.8);
              }
              ctx.restore();
            }
            
            const strokeWidth = clip.textStrokeWidth !== undefined 
              ? clip.textStrokeWidth 
              : (clip.textStyle === 'outline' ? 4 : (clip.textStyle === ('gold-glow' as any) ? 2 : 0));

            if (strokeWidth > 0) {
              ctx.strokeStyle = clip.textStrokeColor || (clip.textStyle === ('gold-glow' as any) ? '#78350f' : '#000000');
              ctx.lineWidth = strokeWidth;
              ctx.strokeText(lineText, xPos, currentY);
            }

            const effectiveGlow = (clip.textGlowIntensity ?? (clip.textStyle === 'neon' ? 15 : 0)) + animGlowBoost;

            if (effectiveGlow > 0) {
              ctx.shadowColor = clip.textGlowColor || color;
              ctx.shadowBlur = effectiveGlow;
            } else if (clip.textStyle === ('gold-glow' as any)) {
              ctx.shadowColor = '#f59e0b';
              ctx.shadowBlur = 24 + animGlowBoost;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
            } else if (clip.textStyle === 'neon') {
              ctx.shadowColor = clip.textGlowColor || color;
              ctx.shadowBlur = 18 + animGlowBoost;
            } else if (clip.textStyle === 'shadow') {
              ctx.shadowColor = 'rgba(0,0,0,0.85)';
              ctx.shadowBlur = 6;
              ctx.shadowOffsetX = 2;
              ctx.shadowOffsetY = 2;
            }

            ctx.fillStyle = clip.textStyle === 'neon' ? '#FFFFFF' : (clip.textStyle === ('gold-glow' as any) ? '#fbbf24' : (clip.textStyle === ('viral-reels' as any) ? '#facc15' : color));
            ctx.fillText(lineText, xPos, currentY);
          });

          ctx.restore(); // Restore Canvas Context after Animation Transforms

          // Draw CapCut Pro Selection Handles & Bounding Box if Selected
          if (selectedClip?.id === clip.id && !isExporting) {
            ctx.save();
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(boxLeft, boxTop, blockW, blockH);
            ctx.setLineDash([]);

            // Render 4 corner resize handles
            const corners = [
              { x: boxLeft, y: boxTop },
              { x: boxLeft + blockW, y: boxTop },
              { x: boxLeft, y: boxTop + blockH },
              { x: boxLeft + blockW, y: boxTop + blockH },
            ];

            corners.forEach((c) => {
              ctx.fillStyle = '#06b6d4';
              ctx.beginPath();
              ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
              ctx.fill();
            });

            // CapCut Pro Floating Tag
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(boxLeft, boxTop - 26, 210, 20, 6);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('✨ CapCut Pro Text • Drag / Corner Scale', boxLeft + 8, boxTop - 16);

            ctx.restore();
          }

          ctx.restore();
        }
      });

      // ------------------ CAPCUT PRO MULTI-SELECTION GROUP TRANSFORM MATRIX ------------------
      const activeSelectedIds = selectedClipIds && selectedClipIds.length > 0
        ? selectedClipIds
        : (selectedClip ? [selectedClip.id] : []);
      const activeSelectedClips = activeFrameClips.filter(c => activeSelectedIds.includes(c.id));

      if (activeSelectedClips.length > 1 && !isExporting) {
        let minLeft = Infinity;
        let minTop = Infinity;
        let maxRight = -Infinity;
        let maxBottom = -Infinity;

        activeSelectedClips.forEach(c => {
          if (c.type === ClipType.TEXT) {
            const bound = textBoundsRef.current[c.id];
            if (bound) {
              minLeft = Math.min(minLeft, bound.left);
              minTop = Math.min(minTop, bound.top);
              maxRight = Math.max(maxRight, bound.left + bound.width);
              maxBottom = Math.max(maxBottom, bound.top + bound.height);
            } else {
              const xPos = ((c.textX ?? 50) / 100) * dimensions.width;
              const yPos = ((c.textY ?? 50) / 100) * dimensions.height;
              minLeft = Math.min(minLeft, xPos - 80);
              minTop = Math.min(minTop, yPos - 30);
              maxRight = Math.max(maxRight, xPos + 80);
              maxBottom = Math.max(maxBottom, yPos + 30);
            }
          } else if (c.type === ClipType.VIDEO) {
            const interpolated = getInterpolatedClipProperties(c, currentTime);
            const scale = interpolated.scale / 100;
            const posX = interpolated.posX;
            const posY = interpolated.posY;
            const boxW = dimensions.width * scale;
            const boxH = dimensions.height * scale;
            const cLeft = dimensions.width / 2 + posX - boxW / 2;
            const cTop = dimensions.height / 2 + posY - boxH / 2;
            minLeft = Math.min(minLeft, cLeft);
            minTop = Math.min(minTop, cTop);
            maxRight = Math.max(maxRight, cLeft + boxW);
            maxBottom = Math.max(maxBottom, cTop + boxH);
          }
        });

        if (isFinite(minLeft) && isFinite(minTop) && isFinite(maxRight) && isFinite(maxBottom)) {
          const groupW = maxRight - minLeft;
          const groupH = maxBottom - minTop;
          const groupLeft = minLeft;
          const groupTop = minTop;

          groupBoundsRef.current = {
            left: groupLeft,
            top: groupTop,
            width: groupW,
            height: groupH,
            centerX: groupLeft + groupW / 2,
            centerY: groupTop + groupH / 2,
            clips: activeSelectedClips,
          };

          ctx.save();
          // Render Bright Red snap lines guides (#ef4444) with glowing bounding box
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([8, 4]);
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 10;
          ctx.strokeRect(groupLeft - 8, groupTop - 8, groupW + 16, groupH + 16);
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;

          // Corner Handles (Bright Red with White inner dot)
          const corners = [
            { x: groupLeft - 8, y: groupTop - 8 },
            { x: groupLeft + groupW + 8, y: groupTop - 8 },
            { x: groupLeft - 8, y: groupTop + groupH + 8 },
            { x: groupLeft + groupW + 8, y: groupTop + groupH + 8 },
          ];

          corners.forEach((c) => {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
          });

          // CapCut Pro Floating Group Matrix Tag
          ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(groupLeft - 8, groupTop - 34, 300, 22, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`🎯 CapCut Pro Group Matrix (${activeSelectedClips.length} Items Selected)`, groupLeft, groupTop - 23);

          ctx.restore();
        }
      } else {
        groupBoundsRef.current = null;
      }

      // ------------------ SAFE AREA GRID OVERLAY & BOUNDARY MASK ------------------
      if (showSafeArea && !isExporting) {
        ctx.save();
        ctx.lineWidth = 1.5;

        // 1. Title/Action Safe Outer Margin Box (80% / 90% Safe Zone)
        const marginX = dimensions.width * 0.08;
        const marginY = dimensions.height * 0.08;
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)'; // Amber dashed
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(marginX, marginY, dimensions.width - marginX * 2, dimensions.height - marginY * 2);

        // Inner 90% Action Safe Line
        const marginX90 = dimensions.width * 0.05;
        const marginY90 = dimensions.height * 0.05;
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)'; // Cyan dashed
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(marginX90, marginY90, dimensions.width - marginX90 * 2, dimensions.height - marginY90 * 2);

        // 2. 9:16 Smartphone Platform UI Safety Zones (YouTube Shorts, Reels, TikTok)
        // Top Header / Search / Notch Danger Zone (Top 12%)
        const topDangerH = dimensions.height * 0.12;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
        ctx.fillRect(0, 0, dimensions.width, topDangerH);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, topDangerH);
        ctx.lineTo(dimensions.width, topDangerH);
        ctx.stroke();

        // Bottom Captions & Description Danger Zone (Bottom 20%)
        const bottomDangerY = dimensions.height * 0.80;
        const bottomDangerH = dimensions.height * 0.20;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
        ctx.fillRect(0, bottomDangerY, dimensions.width, bottomDangerH);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.beginPath();
        ctx.moveTo(0, bottomDangerY);
        ctx.lineTo(dimensions.width, bottomDangerY);
        ctx.stroke();

        // Right Side Action Buttons Margin (Right 16%, Y: 35% to 80%)
        const rightDangerX = dimensions.width * 0.84;
        const rightDangerY = dimensions.height * 0.35;
        const rightDangerW = dimensions.width * 0.16;
        const rightDangerH = dimensions.height * 0.45;
        ctx.fillStyle = 'rgba(6, 182, 212, 0.10)';
        ctx.fillRect(rightDangerX, rightDangerY, rightDangerW, rightDangerH);

        // Draw Labels for Safety Zones
        ctx.setLineDash([]);
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Top Label
        ctx.fillStyle = '#fca5a5';
        ctx.fillText('📱 TOP HEADER / NOTCH DANGER ZONE', dimensions.width / 2, topDangerH / 2);

        // Bottom Label
        ctx.fillStyle = '#fde68a';
        ctx.fillText('💬 SUBTITLE / CAPTION SAFE ZONE (Shorts/Reels)', dimensions.width / 2, bottomDangerY + 16);

        // 9:16 Vertical Crop Guidelines for 16:9 Canvas
        if (dimensions.width > dimensions.height) {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
          ctx.setLineDash([6, 6]);
          const cropX1 = dimensions.width * 0.28125;
          const cropX2 = dimensions.width * 0.71875;
          ctx.beginPath();
          ctx.moveTo(cropX1, 0); ctx.lineTo(cropX1, dimensions.height);
          ctx.moveTo(cropX2, 0); ctx.lineTo(cropX2, dimensions.height);
          ctx.stroke();

          ctx.fillStyle = '#67e8f9';
          ctx.font = '10px monospace';
          ctx.fillText('📱 9:16 Shorts/Reels Center Crop Frame', dimensions.width / 2, marginY + 12);
        }

        ctx.restore();
      }

      // ------------------ WATERMARK / LOGO LAYER ------------------
      if (watermark && watermark.enabled && watermark.url) {
        ctx.save();
        let wmImg = watermarkImgRef.current;
        if (!wmImg || wmImg.getAttribute('data-src') !== watermark.url) {
          wmImg = new Image();
          wmImg.setAttribute('data-src', watermark.url);
          wmImg.crossOrigin = getSafeCrossOrigin(watermark.url) || 'anonymous';
          wmImg.src = normalizeMediaUrl(watermark.url);
          watermarkImgRef.current = wmImg;
        }

        if (wmImg.complete && wmImg.naturalWidth > 0) {
          ctx.globalAlpha = Math.max(0.05, Math.min(1, watermark.opacity ?? 0.8));
          
          const scalePct = (watermark.scale ?? 20) / 100;
          const targetW = dimensions.width * scalePct;
          const targetH = targetW * (wmImg.naturalHeight / wmImg.naturalWidth);
          const margin = 24;

          let wmX = margin;
          let wmY = margin;

          if (watermark.position === 'top-right') {
            wmX = dimensions.width - targetW - margin;
            wmY = margin;
          } else if (watermark.position === 'bottom-left') {
            wmX = margin;
            wmY = dimensions.height - targetH - margin;
          } else if (watermark.position === 'bottom-right') {
            wmX = dimensions.width - targetW - margin;
            wmY = dimensions.height - targetH - margin;
          }

          ctx.drawImage(wmImg, wmX, wmY, targetW, targetH);
        }
        ctx.restore();
      }

      // ------------------ SMART ALIGNMENT GUIDELINES & SNAPPING LINES ------------------
      const activeSnap = activeSnapRef.current;
      if ((activeSnap.x !== null || activeSnap.y !== null || activeSnap.label) && !isExporting) {
        ctx.save();
        ctx.lineWidth = 1.5;

        // Vertical guideline for X-axis snap
        if (activeSnap.x !== null) {
          const lineX = dimensions.width * (activeSnap.x / 100);
          ctx.strokeStyle = activeSnap.x === 50 ? '#ef4444' : '#06b6d4'; // Red for center 50%, Cyan for others
          ctx.setLineDash([8, 4]);
          ctx.beginPath();
          ctx.moveTo(lineX, 0);
          ctx.lineTo(lineX, dimensions.height);
          ctx.stroke();

          // Center Crosshair Node
          ctx.fillStyle = activeSnap.x === 50 ? '#ef4444' : '#06b6d4';
          ctx.beginPath();
          ctx.arc(lineX, dimensions.height / 2, 6, 0, Math.PI * 2);
          ctx.fill();
        }

        // Horizontal guideline for Y-axis snap
        if (activeSnap.y !== null) {
          const lineY = dimensions.height * (activeSnap.y / 100);
          ctx.strokeStyle = activeSnap.y === 50 ? '#ef4444' : '#06b6d4';
          ctx.setLineDash([8, 4]);
          ctx.beginPath();
          ctx.moveTo(0, lineY);
          ctx.lineTo(dimensions.width, lineY);
          ctx.stroke();

          // Center Crosshair Node
          ctx.fillStyle = activeSnap.y === 50 ? '#ef4444' : '#06b6d4';
          ctx.beginPath();
          ctx.arc(dimensions.width / 2, lineY, 6, 0, Math.PI * 2);
          ctx.fill();
        }

        // Dynamic Alignment Coordinate Badge Overlay
        if (activeSnap.label) {
          ctx.setLineDash([]);
          ctx.font = 'bold 11px monospace';
          const textWidth = ctx.measureText(activeSnap.label).width;
          const badgeW = textWidth + 24;
          const badgeH = 26;
          const badgeX = (dimensions.width - badgeW) / 2;
          const badgeY = 16;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
          ctx.strokeStyle = activeSnap.x === 50 || activeSnap.y === 50 ? '#ef4444' : '#06b6d4';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = activeSnap.x === 50 || activeSnap.y === 50 ? '#fca5a5' : '#67e8f9';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`🎯 ${activeSnap.label}`, dimensions.width / 2, badgeY + badgeH / 2);
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [tracks, currentTime, dimensions, isPlaying, videoNodes, showGrid, showSafeArea, selectedClip]);

  // Canvas Mouse Coordinates Helper
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = dimensions.width / rect.width;
    const scaleY = dimensions.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    const boundsList: TextBound[] = Object.values(textBoundsRef.current);

    // Check group corner handles first if group bounds active
    if (groupBoundsRef.current && groupBoundsRef.current.clips.length > 1) {
      const gb = groupBoundsRef.current;
      const corners = [
        { x: gb.left - 8, y: gb.top - 8 },
        { x: gb.left + gb.width + 8, y: gb.top - 8 },
        { x: gb.left - 8, y: gb.top + gb.height + 8 },
        { x: gb.left + gb.width + 8, y: gb.top + gb.height + 8 },
      ];
      for (const c of corners) {
        if (Math.hypot(coords.x - c.x, coords.y - c.y) <= 18) {
          setIsResizingGroup(true);
          setDragStart(coords);
          initialGroupClipsPos.current = gb.clips.map(clip => ({
            clip,
            initialX: clip.textX ?? 50,
            initialY: clip.textY ?? 50,
            initialFontSize: clip.fontSize ?? 32,
            initialScale: clip.transform?.scale ?? 100,
          }));
          return;
        }
      }

      // Check inside group bounding box for multi-clip dragging
      if (
        coords.x >= gb.left - 8 &&
        coords.x <= gb.left + gb.width + 8 &&
        coords.y >= gb.top - 8 &&
        coords.y <= gb.top + gb.height + 8
      ) {
        setIsDraggingGroup(true);
        setDragStart(coords);
        initialGroupClipsPos.current = gb.clips.map(clip => ({
          clip,
          initialX: clip.type === ClipType.TEXT ? (clip.textX ?? 50) : (clip.transform?.posX ?? 0),
          initialY: clip.type === ClipType.TEXT ? (clip.textY ?? 50) : (clip.transform?.posY ?? 0),
          initialFontSize: clip.fontSize ?? 32,
          initialScale: clip.transform?.scale ?? 100,
        }));
        return;
      }
    }

    // Check single selected video clip dragging & handle
    if (selectedClip && selectedClip.type === ClipType.VIDEO) {
      const interpolated = getInterpolatedClipProperties(selectedClip, currentTime);
      const scale = interpolated.scale / 100;
      const posX = interpolated.posX;
      const posY = interpolated.posY;
      const boxW = dimensions.width * scale;
      const boxH = dimensions.height * scale;
      const vLeft = dimensions.width / 2 + posX - boxW / 2;
      const vTop = dimensions.height / 2 + posY - boxH / 2;

      // Check corner handles of single video clip
      const corners = [
        { x: vLeft, y: vTop },
        { x: vLeft + boxW, y: vTop },
        { x: vLeft, y: vTop + boxH },
        { x: vLeft + boxW, y: vTop + boxH },
      ];
      for (const c of corners) {
        if (Math.hypot(coords.x - c.x, coords.y - c.y) <= 18) {
          setIsResizingGroup(true);
          setDragStart(coords);
          initialGroupClipsPos.current = [{
            clip: selectedClip,
            initialX: posX,
            initialY: posY,
            initialFontSize: 32,
            initialScale: scale * 100,
          }];
          return;
        }
      }

      // Check inside video box for dragging
      if (coords.x >= vLeft && coords.x <= vLeft + boxW && coords.y >= vTop && coords.y <= vTop + boxH) {
        setIsDraggingGroup(true);
        setDragStart(coords);
        initialGroupClipsPos.current = [{
          clip: selectedClip,
          initialX: posX,
          initialY: posY,
          initialFontSize: 32,
          initialScale: scale * 100,
        }];
        return;
      }
    }

    // Check corner handles of single selected clip
    if (selectedClip && selectedClip.type === ClipType.TEXT) {
      const bound = textBoundsRef.current[selectedClip.id];
      if (bound) {
        const corners = [
          { x: bound.left, y: bound.top },
          { x: bound.left + bound.width, y: bound.top },
          { x: bound.left, y: bound.top + bound.height },
          { x: bound.left + bound.width, y: bound.top + bound.height },
        ];
        for (const c of corners) {
          if (Math.hypot(coords.x - c.x, coords.y - c.y) <= 18) {
            setIsResizingText(true);
            setDragStart(coords);
            setInitialTextPos({
              x: selectedClip.textX ?? 50,
              y: selectedClip.textY ?? 50,
              fontSize: selectedClip.fontSize ?? 32,
            });
            return;
          }
        }
      }
    }

    // Check inside bounding boxes for click selection & drag
    for (const item of boundsList) {
      if (
        coords.x >= item.left &&
        coords.x <= item.left + item.width &&
        coords.y >= item.top &&
        coords.y <= item.top + item.height
      ) {
        onSelectClip?.(item.clip);
        setIsDraggingText(true);
        setDragStart(coords);
        setInitialTextPos({
          x: item.clip.textX ?? 50,
          y: item.clip.textY ?? 50,
          fontSize: item.clip.fontSize ?? 32,
        });
        return;
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    if (isDraggingGroup && initialGroupClipsPos.current.length > 0) {
      const rawDeltaX = coords.x - dragStart.x;
      const rawDeltaY = coords.y - dragStart.y;

      // Determine center position of the dragged item / group
      let primaryCenterX = dimensions.width / 2;
      let primaryCenterY = dimensions.height / 2;

      if (groupBoundsRef.current && groupBoundsRef.current.clips.length > 1) {
        primaryCenterX = groupBoundsRef.current.centerX + rawDeltaX;
        primaryCenterY = groupBoundsRef.current.centerY + rawDeltaY;
      } else if (initialGroupClipsPos.current.length === 1) {
        const item = initialGroupClipsPos.current[0];
        if (item.clip.type === ClipType.VIDEO) {
          primaryCenterX = dimensions.width / 2 + item.initialX + rawDeltaX;
          primaryCenterY = dimensions.height / 2 + item.initialY + rawDeltaY;
        } else {
          const rawXPct = item.initialX + (rawDeltaX / dimensions.width) * 100;
          const rawYPct = item.initialY + (rawDeltaY / dimensions.height) * 100;
          primaryCenterX = (rawXPct / 100) * dimensions.width;
          primaryCenterY = (rawYPct / 100) * dimensions.height;
        }
      }

      const canvasCenterX = dimensions.width / 2;
      const canvasCenterY = dimensions.height / 2;
      const snapThreshold = 14; // pixels

      let snappedDeltaX = rawDeltaX;
      let snappedDeltaY = rawDeltaY;
      let snapXPct: number | null = null;
      let snapYPct: number | null = null;
      const snapLabels: string[] = [];

      // Horizontal Center Alignment Snap (50%)
      if (Math.abs(primaryCenterX - canvasCenterX) < snapThreshold) {
        snappedDeltaX = rawDeltaX + (canvasCenterX - primaryCenterX);
        snapXPct = 50;
        snapLabels.push('X: CENTER (50%)');
      } else if (Math.abs(primaryCenterX - dimensions.width * 0.25) < snapThreshold) {
        snappedDeltaX = rawDeltaX + (dimensions.width * 0.25 - primaryCenterX);
        snapXPct = 25;
        snapLabels.push('X: 25%');
      } else if (Math.abs(primaryCenterX - dimensions.width * 0.75) < snapThreshold) {
        snappedDeltaX = rawDeltaX + (dimensions.width * 0.75 - primaryCenterX);
        snapXPct = 75;
        snapLabels.push('X: 75%');
      }

      // Vertical Center Alignment Snap (50%)
      if (Math.abs(primaryCenterY - canvasCenterY) < snapThreshold) {
        snappedDeltaY = rawDeltaY + (canvasCenterY - primaryCenterY);
        snapYPct = 50;
        snapLabels.push('Y: CENTER (50%)');
      } else if (Math.abs(primaryCenterY - dimensions.height * 0.25) < snapThreshold) {
        snappedDeltaY = rawDeltaY + (dimensions.height * 0.25 - primaryCenterY);
        snapYPct = 25;
        snapLabels.push('Y: 25%');
      } else if (Math.abs(primaryCenterY - dimensions.height * 0.75) < snapThreshold) {
        snappedDeltaY = rawDeltaY + (dimensions.height * 0.75 - primaryCenterY);
        snapYPct = 75;
        snapLabels.push('Y: 75%');
      }

      activeSnapRef.current = {
        x: snapXPct,
        y: snapYPct,
        label: snapLabels.length > 0
          ? snapLabels.join(' • ')
          : `X: ${Math.round((primaryCenterX / dimensions.width) * 100)}% | Y: ${Math.round((primaryCenterY / dimensions.height) * 100)}%`
      };

      const deltaXPct = (snappedDeltaX / dimensions.width) * 100;
      const deltaYPct = (snappedDeltaY / dimensions.height) * 100;

      const updates: { id: string; updates: Partial<Clip> }[] = [];

      initialGroupClipsPos.current.forEach(item => {
        const clip = item.clip;
        if (clip.type === ClipType.TEXT) {
          const newX = Math.max(2, Math.min(98, item.initialX + deltaXPct));
          const newY = Math.max(2, Math.min(98, item.initialY + deltaYPct));
          updates.push({ id: clip.id, updates: { textX: newX, textY: newY } });
        } else if (clip.type === ClipType.VIDEO) {
          const newPosX = item.initialX + snappedDeltaX;
          const newPosY = item.initialY + snappedDeltaY;
          updates.push({
            id: clip.id,
            updates: {
              transform: {
                scale: clip.transform?.scale ?? 100,
                rotation: clip.transform?.rotation ?? 0,
                posX: newPosX,
                posY: newPosY,
              }
            }
          });
        }
      });

      if (onBatchUpdateClips) {
        onBatchUpdateClips(updates);
      } else {
        updates.forEach(u => onUpdateClip?.(u.id, u.updates));
      }
      return;
    }

    if (isResizingGroup && groupBoundsRef.current && initialGroupClipsPos.current.length > 0) {
      const gb = groupBoundsRef.current;
      const dist = Math.hypot(coords.x - gb.centerX, coords.y - gb.centerY);
      const initDist = Math.hypot(dragStart.x - gb.centerX, dragStart.y - gb.centerY);
      const factor = dist / (initDist || 1);

      const updates: { id: string; updates: Partial<Clip> }[] = [];

      initialGroupClipsPos.current.forEach(item => {
        const clip = item.clip;
        if (clip.type === ClipType.TEXT) {
          const newFontSize = Math.max(10, Math.min(180, Math.round(item.initialFontSize * factor)));
          updates.push({ id: clip.id, updates: { fontSize: newFontSize } });
        } else if (clip.type === ClipType.VIDEO) {
          const newScale = Math.max(10, Math.min(500, Math.round(item.initialScale * factor)));
          updates.push({
            id: clip.id,
            updates: {
              transform: {
                ...clip.transform,
                scale: newScale,
                posX: clip.transform?.posX ?? 0,
                posY: clip.transform?.posY ?? 0,
                rotation: clip.transform?.rotation ?? 0,
              }
            }
          });
        }
      });

      if (onBatchUpdateClips) {
        onBatchUpdateClips(updates);
      } else {
        updates.forEach(u => onUpdateClip?.(u.id, u.updates));
      }
      return;
    }

    if (isDraggingText && selectedClip) {
      const deltaX = coords.x - dragStart.x;
      const deltaY = coords.y - dragStart.y;
      const rawX = initialTextPos.x + (deltaX / dimensions.width) * 100;
      const rawY = initialTextPos.y + (deltaY / dimensions.height) * 100;

      const rawPixelX = (rawX / 100) * dimensions.width;
      const rawPixelY = (rawY / 100) * dimensions.height;

      // Active text bounding box dimensions
      const bound = textBoundsRef.current[selectedClip.id];
      const textW = bound ? bound.width : 100;
      const textH = bound ? bound.height : 40;

      const rawLeft = rawPixelX - textW / 2;
      const rawRight = rawPixelX + textW / 2;
      const rawTop = rawPixelY - textH / 2;
      const rawBottom = rawPixelY + textH / 2;

      const SNAP_THRESHOLD_PX = 7; // 7px threshold check
      let snappedPixelX = rawPixelX;
      let snappedPixelY = rawPixelY;
      let snapX: number | null = null;
      let snapY: number | null = null;
      const snapLabels: string[] = [];

      // Canvas viewport center axes (50% X & Y)
      const canvasCenterX = dimensions.width / 2;
      const canvasCenterY = dimensions.height / 2;

      // 1. Horizontal Snapping (X-axis) - Bounding rect (centerX, left, right)
      if (Math.abs(rawPixelX - canvasCenterX) <= SNAP_THRESHOLD_PX) {
        snappedPixelX = canvasCenterX;
        snapX = 50;
        snapLabels.push('X: CENTER (50%)');
      } else if (Math.abs(rawLeft - 20) <= SNAP_THRESHOLD_PX) {
        snappedPixelX = 20 + textW / 2;
        snapX = (snappedPixelX / dimensions.width) * 100;
        snapLabels.push('X: LEFT MARGIN');
      } else if (Math.abs(rawRight - (dimensions.width - 20)) <= SNAP_THRESHOLD_PX) {
        snappedPixelX = dimensions.width - 20 - textW / 2;
        snapX = (snappedPixelX / dimensions.width) * 100;
        snapLabels.push('X: RIGHT MARGIN');
      }

      // Check static video/text layer objects on canvas at currentTime
      if (snapX === null) {
        for (const trk of tracks) {
          for (const clp of trk.clips) {
            if (clp.id === selectedClip.id) continue;
            if (clp.start <= currentTime && clp.start + clp.duration >= currentTime) {
              const otherBound = textBoundsRef.current[clp.id];
              const otherCenterX = clp.type === ClipType.TEXT 
                ? ((clp.textX ?? 50) / 100) * dimensions.width 
                : dimensions.width / 2 + (clp.transform?.posX ?? 0);

              if (Math.abs(rawPixelX - otherCenterX) <= SNAP_THRESHOLD_PX) {
                snappedPixelX = otherCenterX;
                snapX = (otherCenterX / dimensions.width) * 100;
                snapLabels.push(`X: ALIGNED TO ${clp.name || 'LAYER'}`);
                break;
              }
            }
          }
          if (snapX !== null) break;
        }
      }

      // 2. Vertical Snapping (Y-axis) - Bounding rect (centerY, top, bottom)
      if (Math.abs(rawPixelY - canvasCenterY) <= SNAP_THRESHOLD_PX) {
        snappedPixelY = canvasCenterY;
        snapY = 50;
        snapLabels.push('Y: CENTER (50%)');
      } else if (Math.abs(rawTop - 20) <= SNAP_THRESHOLD_PX) {
        snappedPixelY = 20 + textH / 2;
        snapY = (snappedPixelY / dimensions.height) * 100;
        snapLabels.push('Y: TOP MARGIN');
      } else if (Math.abs(rawBottom - (dimensions.height - 20)) <= SNAP_THRESHOLD_PX) {
        snappedPixelY = dimensions.height - 20 - textH / 2;
        snapY = (snappedPixelY / dimensions.height) * 100;
        snapLabels.push('Y: BOTTOM MARGIN');
      }

      // Check static video/text layer objects vertically
      if (snapY === null) {
        for (const trk of tracks) {
          for (const clp of trk.clips) {
            if (clp.id === selectedClip.id) continue;
            if (clp.start <= currentTime && clp.start + clp.duration >= currentTime) {
              const otherCenterY = clp.type === ClipType.TEXT 
                ? ((clp.textY ?? 50) / 100) * dimensions.height 
                : dimensions.height / 2 + (clp.transform?.posY ?? 0);

              if (Math.abs(rawPixelY - otherCenterY) <= SNAP_THRESHOLD_PX) {
                snappedPixelY = otherCenterY;
                snapY = (otherCenterY / dimensions.height) * 100;
                snapLabels.push(`Y: ALIGNED TO ${clp.name || 'LAYER'}`);
                break;
              }
            }
          }
          if (snapY !== null) break;
        }
      }

      const finalPctX = Math.max(2, Math.min(98, (snappedPixelX / dimensions.width) * 100));
      const finalPctY = Math.max(2, Math.min(98, (snappedPixelY / dimensions.height) * 100));

      activeSnapRef.current = {
        x: snapX,
        y: snapY,
        label: snapLabels.length > 0 ? snapLabels.join(' • ') : `X: ${Math.round(finalPctX)}% | Y: ${Math.round(finalPctY)}%`
      };

      onUpdateClip?.(selectedClip.id, { textX: finalPctX, textY: finalPctY });
      return;
    }

    if (isResizingText && selectedClip) {
      const bound = textBoundsRef.current[selectedClip.id];
      if (bound) {
        const dist = Math.hypot(coords.x - bound.centerX, coords.y - bound.centerY);
        const initDist = Math.hypot(dragStart.x - bound.centerX, dragStart.y - bound.centerY);
        const factor = dist / (initDist || 1);
        const newFontSize = Math.max(12, Math.min(160, Math.round(initialTextPos.fontSize * factor)));
        onUpdateClip?.(selectedClip.id, { fontSize: newFontSize });
        return;
      }
    }

    // Hover detection for dynamic mouse cursor feedback
    let hoverCursor: 'default' | 'pointer' | 'move' | 'nwse-resize' = 'default';
    if (groupBoundsRef.current && groupBoundsRef.current.clips.length > 1) {
      const gb = groupBoundsRef.current;
      const corners = [
        { x: gb.left - 8, y: gb.top - 8 },
        { x: gb.left + gb.width + 8, y: gb.top - 8 },
        { x: gb.left - 8, y: gb.top + gb.height + 8 },
        { x: gb.left + gb.width + 8, y: gb.top + gb.height + 8 },
      ];
      for (const c of corners) {
        if (Math.hypot(coords.x - c.x, coords.y - c.y) <= 18) {
          hoverCursor = 'nwse-resize';
          break;
        }
      }
      if (hoverCursor === 'default' && coords.x >= gb.left - 8 && coords.x <= gb.left + gb.width + 8 && coords.y >= gb.top - 8 && coords.y <= gb.top + gb.height + 8) {
        hoverCursor = 'move';
      }
    }

    if (hoverCursor === 'default' && selectedClip && selectedClip.type === ClipType.TEXT) {
      const bound = textBoundsRef.current[selectedClip.id];
      if (bound) {
        const corners = [
          { x: bound.left, y: bound.top },
          { x: bound.left + bound.width, y: bound.top },
          { x: bound.left, y: bound.top + bound.height },
          { x: bound.left + bound.width, y: bound.top + bound.height },
        ];
        for (const c of corners) {
          if (Math.hypot(coords.x - c.x, coords.y - c.y) <= 18) {
            hoverCursor = 'nwse-resize';
            break;
          }
        }
      }
    }

    if (hoverCursor === 'default') {
      for (const item of (Object.values(textBoundsRef.current) as TextBound[])) {
        if (
          coords.x >= item.left &&
          coords.x <= item.left + item.width &&
          coords.y >= item.top &&
          coords.y <= item.top + item.height
        ) {
          hoverCursor = 'move';
          break;
        }
      }
    }

    setActiveCursor(hoverCursor);
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingText(false);
    setIsResizingText(false);
    setIsDraggingGroup(false);
    setIsResizingGroup(false);
    initialGroupClipsPos.current = [];
    activeSnapRef.current = { x: null, y: null };
  };

  return (
    <div id="preview-player" ref={playerFrameRef} className="flex-1 bg-[#0c0c0f] flex flex-col h-full border border-[#202028] rounded-xl select-none overflow-hidden shadow-lg m-1 mx-1">
      
      {/* Exact CapCut Player Header */}
      <div className="h-9 border-b border-[#24242c] px-3 flex items-center justify-between bg-[#1e1e24] shrink-0 text-xs text-gray-300">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-200 text-xs tracking-wide">Player</span>
        </div>

        <div className="relative flex items-center gap-1">
          <button
            id="btn-player-menu"
            onClick={() => setShowPlayerMenu(!showPlayerMenu)}
            className="p-1 rounded hover:bg-[#2c2c36] text-gray-400 hover:text-white transition cursor-pointer"
            title="Player Options"
          >
            <Menu className="w-4 h-4" />
          </button>

          {showPlayerMenu && (
            <div className="absolute top-full right-0 mt-1 w-44 bg-[#1a1a20] border border-[#2a2a34] rounded-lg shadow-2xl p-1 z-50 text-xs text-gray-300">
              <button
                onClick={() => { setShowGrid(!showGrid); setShowPlayerMenu(false); }}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#2a2a36] flex items-center justify-between"
              >
                <span>Grid Guides</span>
                <span className="text-[10px] text-cyan-400">{showGrid ? 'ON' : 'OFF'}</span>
              </button>
              <button
                onClick={() => { setShowSafeArea(!showSafeArea); setShowPlayerMenu(false); }}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#2a2a36] flex items-center justify-between"
              >
                <span>Safe Area Margin</span>
                <span className="text-[10px] text-amber-400">{showSafeArea ? 'ON' : 'OFF'}</span>
              </button>
              <div className="h-px bg-[#2a2a34] my-1" />
              <div className="px-2.5 py-1 text-[10px] text-gray-500 font-bold uppercase">Zoom Scale</div>
              {(['fit', 50, 75, 100] as const).map(z => (
                <button
                  key={z}
                  onClick={() => { setCanvasZoom(z); setShowPlayerMenu(false); }}
                  className={`w-full text-left px-2.5 py-1 rounded hover:bg-[#2a2a36] text-[11px] ${canvasZoom === z ? 'text-cyan-400 font-bold' : ''}`}
                >
                  {z === 'fit' ? 'Fit Screen' : `${z}% Zoom`}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Viewport Stage Canvas */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center p-3 relative min-h-0 bg-[#070709] overflow-hidden">
        <div
          className="relative rounded-sm shadow-2xl overflow-hidden bg-black flex items-center justify-center transition-all duration-300 border border-white/80 group"
          style={{
            width: canvasZoom === 'fit' ? (aspectRatio === '16:9' ? '100%' : 'auto') : `${canvasZoom}%`,
            height: canvasZoom === 'fit' ? (aspectRatio === '16:9' ? 'auto' : '100%') : `${canvasZoom}%`,
            maxWidth: `${dimensions.width}px`,
            maxHeight: `${dimensions.height}px`,
            aspectRatio: aspectRatio === '16:9' ? '16/9' : aspectRatio === '9:16' ? '9/16' : '1/1'
          }}
        >
          {/* White Corner Frame Handle Anchors */}
          <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white rounded-xs shadow-md z-30" />
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-xs shadow-md z-30" />
          <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white rounded-xs shadow-md z-30" />
          <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white rounded-xs shadow-md z-30" />

          <canvas
            ref={canvasRef}
            width={dimensions.width}
            height={dimensions.height}
            className="w-full h-full object-contain block"
            style={{ cursor: activeCursor }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />



          {isExporting && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/90 border border-cyan-400/80 px-4 py-2 rounded-full shadow-2xl flex items-center gap-2.5 z-40 animate-pulse backdrop-blur-md">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
              <span className="text-xs font-mono font-extrabold text-cyan-300 tracking-wide whitespace-nowrap">
                Exporting Video Components to Local Storage (100% Full Done HD)...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CapCut Pro Player Transport Controls Bar */}
      <div className="h-11 border-t border-[#24242c] bg-[#1a1a20] px-3 flex items-center justify-between shrink-0 select-none text-xs text-gray-300">
        
        {/* Left: Timecode Scrubber & Audio VU Meter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-cyan-400 font-bold tracking-tight">{formatTimeCode(currentTime)}</span>
            <span className="text-gray-500">/</span>
            <span className="text-gray-400">{formatTimeCode(duration)}</span>
          </div>

          {/* Audio VU Level Meter Bars */}
          <div className="flex items-end gap-0.5 h-3.5 px-1 py-0.5 bg-[#121216] rounded border border-[#2a2a34]" title="Audio VU Meter">
            <div className={`w-1 bg-emerald-400 rounded-xs transition-all duration-75 ${isPlaying ? 'h-3 animate-pulse' : 'h-1.5 opacity-60'}`} />
            <div className={`w-1 bg-emerald-400 rounded-xs transition-all duration-75 ${isPlaying ? 'h-2.5 animate-pulse' : 'h-2 opacity-60'}`} />
            <div className={`w-1 bg-emerald-500 rounded-xs transition-all duration-75 ${isPlaying ? 'h-3.5 animate-pulse' : 'h-1 opacity-60'}`} />
            <div className={`w-1 bg-emerald-400 rounded-xs transition-all duration-75 ${isPlaying ? 'h-2 animate-pulse' : 'h-1.5 opacity-60'}`} />
          </div>
        </div>

        {/* Center: Play / Pause */}
        <div className="flex items-center gap-2">
          <button
            id="btn-play-pause-main"
            onClick={onPlayPause}
            className="p-1.5 rounded hover:bg-[#2a2a36] text-gray-200 hover:text-white transition cursor-pointer"
            title="Play / Pause (Spacebar)"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current text-gray-200" />
            ) : (
              <Play className="w-4 h-4 fill-current text-gray-200 ml-0.5" />
            )}
          </button>
        </div>

        {/* Right: Fit, Ratio & Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Fit / Frame Search Tool */}
          <button
            onClick={() => setCanvasZoom('fit')}
            className="p-1 rounded hover:bg-[#2a2a36] text-gray-400 hover:text-white transition"
            title="Fit Canvas to Preview Area"
          >
            <Scan className="w-3.5 h-3.5" />
          </button>

          {/* Aspect Ratio Button & Dropdown */}
          <div className="relative">
            <button
              id="btn-aspect-ratio-toggle"
              onClick={() => setShowRatioMenu(!showRatioMenu)}
              className="px-2 py-0.5 rounded border border-[#3a3a48] hover:border-cyan-400 bg-[#22222c] hover:bg-[#2c2c38] text-[11px] font-semibold text-gray-200 transition flex items-center gap-1 cursor-pointer"
              title="Aspect Ratio Options"
            >
              <span>Ratio</span>
            </button>

            {showRatioMenu && (
              <div className="absolute bottom-full right-0 mb-1 w-36 bg-[#1a1a20] border border-[#2a2a34] rounded-lg shadow-2xl p-1 z-50 text-xs text-gray-300">
                <button
                  onClick={() => { onSetAspectRatio('16:9'); setShowRatioMenu(false); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded hover:bg-[#2a2a36] flex items-center justify-between ${aspectRatio === '16:9' ? 'text-cyan-400 font-bold bg-[#242430]' : ''}`}
                >
                  <span>16:9 Landscape</span>
                  <Monitor className="w-3 h-3" />
                </button>
                <button
                  onClick={() => { onSetAspectRatio('9:16'); setShowRatioMenu(false); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded hover:bg-[#2a2a36] flex items-center justify-between ${aspectRatio === '9:16' ? 'text-cyan-400 font-bold bg-[#242430]' : ''}`}
                >
                  <span>9:16 Portrait</span>
                  <Smartphone className="w-3 h-3" />
                </button>
                <button
                  onClick={() => { onSetAspectRatio('1:1'); setShowRatioMenu(false); }}
                  className={`w-full text-left px-2.5 py-1.5 rounded hover:bg-[#2a2a36] flex items-center justify-between ${aspectRatio === '1:1' ? 'text-cyan-400 font-bold bg-[#242430]' : ''}`}
                >
                  <span>1:1 Square</span>
                  <Square className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1 rounded hover:bg-[#2a2a36] text-gray-400 hover:text-white transition"
            title="Toggle Player Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
