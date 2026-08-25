import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Scissors, Trash2, ZoomIn, ZoomOut, Layers, SquareSlash, Undo2, Redo2,
  Copy, Snowflake, Volume2, VolumeX, Lock, Unlock, Eye, EyeOff, Plus, Minus,
  Magnet, Gauge, RotateCcw, RotateCw, Music, Maximize2, Sparkles, Smartphone, Monitor, Square,
  MousePointer, MousePointer2, CheckSquare, FastForward, Film, Check, ExternalLink, ChevronRight,
  Zap, Split, Radio, ChevronDown, Flag, FlipHorizontal, Crop, UserCheck, Mic, Link, Link2, Crosshair, Repeat,
  Image as ImageIcon, Type as TypeIcon, BoxSelect, CheckCheck, X
} from 'lucide-react';
import { Track, Clip, ClipType } from '../types';
import { formatTimeCode } from '../utils/editorUtils';
import AudioWaveformGraph from './AudioWaveformGraph';
import VideoFilmstripVisual from './VideoFilmstripVisual';

interface DraggingClipItem {
  id: string;
  initialStart: number;
  initialDuration: number;
  trackId: string;
}

interface MarqueeBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isSelecting: boolean;
  activeCount?: number;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  clip: Clip | null;
  track: Track | null;
  seekTime?: number;
}

interface TimelineProps {
  tracks: Track[];
  currentTime: number;
  duration: number;
  zoom: number; // Pixels per second
  selectedClipId: string | null;
  selectedClipIds?: string[];
  onSelectClip: (id: string | null, isMultiSelect?: boolean) => void;
  onSelectClips?: (ids: string[]) => void;
  onSeek: (time: number) => void;
  onSplitClip: () => void;
  onDeleteClip: (id: string) => void;
  onDeleteSelectedClips?: () => void;
  onRippleDelete: (direction: 'left' | 'right') => void;
  onUpdateClipTimes: (clipId: string, start: number, duration: number) => void;
  onBatchUpdateClipTimes?: (updates: { id: string; start: number; duration: number }[]) => void;
  onZoomChange: (zoom: number) => void;
  height?: number;
  onUpdateDuration?: (newDuration: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isPlaying?: boolean;
  isLooping?: boolean;
  onToggleLoop?: () => void;

  // CapCut Pro Timeline Handlers
  onDuplicateClip?: () => void;
  onFreezeFrame?: () => void;
  onExtractAudio?: () => void;
  onSetClipSpeed?: (speed: number) => void;
  onToggleTrackMute?: (trackId: string) => void;
  onToggleTrackLock?: (trackId: string) => void;
  onToggleTrackHidden?: (trackId: string) => void;
  onAddTrack?: (type: ClipType) => void;
  onDeleteTrack?: (trackId: string) => void;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  onAspectRatioChange?: (ratio: '16:9' | '9:16' | '1:1') => void;
  onUpdateClip?: (clipId: string, updates: Partial<Clip>) => void;

  // Auto-Segmentation Suite
  onAutoSegmentAudio?: (clipId?: string) => void;
  onAutoSyncVideoToAyahs?: () => void;
  onAutoRemoveSilence?: (clipId?: string) => void;
  onAutoSegmentRhythm?: (clipId?: string, interval?: number) => void;
}

export default function Timeline({
  tracks,
  currentTime,
  duration,
  zoom,
  selectedClipId,
  selectedClipIds = [],
  onSelectClip,
  onSelectClips,
  onSeek,
  onSplitClip,
  onDeleteClip,
  onDeleteSelectedClips,
  onRippleDelete,
  onUpdateClipTimes,
  onBatchUpdateClipTimes,
  onZoomChange,
  height,
  onUpdateDuration,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isPlaying = false,
  isLooping = true,
  onToggleLoop,
  onDuplicateClip,
  onFreezeFrame,
  onExtractAudio,
  onSetClipSpeed,
  onToggleTrackMute,
  onToggleTrackLock,
  onToggleTrackHidden,
  onAddTrack,
  onDeleteTrack,
  aspectRatio = '16:9',
  onAspectRatioChange,
  onUpdateClip,
  onAutoSegmentAudio,
  onAutoSyncVideoToAyahs,
  onAutoRemoveSilence,
  onAutoSegmentRhythm,
}: TimelineProps) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const tracksContainerRef = useRef<HTMLDivElement>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const headersScrollRef = useRef<HTMLDivElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  const handleVerticalScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (headersScrollRef.current && e.currentTarget !== headersScrollRef.current) {
      headersScrollRef.current.scrollTop = scrollTop;
    }
    if (gridScrollRef.current && e.currentTarget !== gridScrollRef.current) {
      gridScrollRef.current.scrollTop = scrollTop;
    }
  };
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isSnapping, setIsSnapping] = useState(true);
  const [timelineTool, setTimelineTool] = useState<'pointer' | 'marquee' | 'split'>('pointer');
  const [showToolDropdown, setShowToolDropdown] = useState(false);
  const [showSelectMenu, setShowSelectMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showAddTrackMenu, setShowAddTrackMenu] = useState(false);
  const [showAutoSegmentMenu, setShowAutoSegmentMenu] = useState(false);
  const [showSilenceGuide, setShowSilenceGuide] = useState(true);

  // Multi-Selection Marquee (Rubberband Box Selection)
  const [marquee, setMarquee] = useState<MarqueeBox | null>(null);

  // Right-Click Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    clip: null,
    track: null,
  });

  const [draggingClips, setDraggingClips] = useState<{
    primaryId: string;
    dragStartPos: number;
    handle?: 'left' | 'right';
    clips: DraggingClipItem[];
  } | null>(null);

  // Sorting order mapping for timeline: TEXT -> VIDEO -> IMAGE -> AUDIO -> EFFECT
  const sortedTracks = useMemo(() => {
    const TRACK_TYPE_ORDER: Record<ClipType, number> = {
      [ClipType.TEXT]: 0,
      [ClipType.VIDEO]: 1,
      [ClipType.IMAGE]: 1,
      [ClipType.AUDIO]: 2,
      [ClipType.EFFECT]: 3,
    };
    return [...tracks].sort((a, b) => {
      const orderA = TRACK_TYPE_ORDER[a.type] ?? 99;
      const orderB = TRACK_TYPE_ORDER[b.type] ?? 99;
      return orderA - orderB;
    });
  }, [tracks]);

  const activeSelectedIds = useMemo(() => {
    return selectedClipIds && selectedClipIds.length > 0
      ? selectedClipIds
      : (selectedClipId ? [selectedClipId] : []);
  }, [selectedClipIds, selectedClipId]);

  // Keep latest mutable references to callbacks and dynamic state values to prevent recreation loops
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const sortedTracksRef = useRef(sortedTracks);
  sortedTracksRef.current = sortedTracks;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const activeSelectedIdsRef = useRef(activeSelectedIds);
  activeSelectedIdsRef.current = activeSelectedIds;
  const onSelectClipsRef = useRef(onSelectClips);
  onSelectClipsRef.current = onSelectClips;
  const onSelectClipRef = useRef(onSelectClip);
  onSelectClipRef.current = onSelectClip;
  const onUpdateClipTimesRef = useRef(onUpdateClipTimes);
  onUpdateClipTimesRef.current = onUpdateClipTimes;
  const onBatchUpdateClipTimesRef = useRef(onBatchUpdateClipTimes);
  onBatchUpdateClipTimesRef.current = onBatchUpdateClipTimes;
  const onDeleteSelectedClipsRef = useRef(onDeleteSelectedClips);
  onDeleteSelectedClipsRef.current = onDeleteSelectedClips;
  const onDeleteClipRef = useRef(onDeleteClip);
  onDeleteClipRef.current = onDeleteClip;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const isScrubbingRef = useRef(isScrubbing);
  isScrubbingRef.current = isScrubbing;
  const draggingClipsRef = useRef(draggingClips);
  draggingClipsRef.current = draggingClips;
  const marqueeRef = useRef(marquee);
  marqueeRef.current = marquee;

  const selectedClip = selectedClipId ? tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId) : null;

  // Selection statistics by clip type for multi-selection
  const selectedClipsList = useMemo(() => {
    return tracks.flatMap(t => t.clips).filter(c => activeSelectedIds.includes(c.id));
  }, [tracks, activeSelectedIds]);

  const selectedCounts = useMemo(() => {
    return {
      text: selectedClipsList.filter(c => c.type === ClipType.TEXT).length,
      audio: selectedClipsList.filter(c => c.type === ClipType.AUDIO).length,
      video: selectedClipsList.filter(c => c.type === ClipType.VIDEO).length,
      image: selectedClipsList.filter(c => c.type === ClipType.IMAGE).length,
      effect: selectedClipsList.filter(c => c.type === ClipType.EFFECT).length,
      total: selectedClipsList.length,
    };
  }, [selectedClipsList]);

  // Quick Select Helper Handlers
  const handleSelectAllClips = useCallback(() => {
    const allIds: string[] = [];
    tracksRef.current.forEach(track => {
      if (track.locked || track.hidden) return;
      track.clips.forEach(clip => allIds.push(clip.id));
    });
    if (allIds.length > 0) {
      if (onSelectClipsRef.current) {
        onSelectClipsRef.current(allIds);
      } else if (onSelectClipRef.current) {
        onSelectClipRef.current(allIds[0]);
      }
    }
  }, []);

  const handleSelectClipsByType = useCallback((type: ClipType | 'video_image') => {
    const matchedIds: string[] = [];
    tracksRef.current.forEach(track => {
      if (track.locked || track.hidden) return;
      track.clips.forEach(clip => {
        if (type === 'video_image') {
          if (clip.type === ClipType.VIDEO || clip.type === ClipType.IMAGE) {
            matchedIds.push(clip.id);
          }
        } else if (clip.type === type) {
          matchedIds.push(clip.id);
        }
      });
    });
    if (matchedIds.length > 0) {
      if (onSelectClipsRef.current) {
        onSelectClipsRef.current(matchedIds);
      } else if (onSelectClipRef.current) {
        onSelectClipRef.current(matchedIds[0]);
      }
    } else {
      if (onSelectClipRef.current) onSelectClipRef.current(null);
      if (onSelectClipsRef.current) onSelectClipsRef.current([]);
    }
  }, []);

  const handleClearSelection = useCallback(() => {
    if (onSelectClipRef.current) onSelectClipRef.current(null);
    if (onSelectClipsRef.current) onSelectClipsRef.current([]);
  }, []);

  // Handle seeking / scrubbing playhead on Ruler
  const handleRulerMouseDown = (e: React.MouseEvent) => {
    // Only scrub if left mouse click
    if (e.button !== 0) return;
    setIsScrubbing(true);
    handleScrub(e.clientX);
  };

  const handleRulerTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      setIsScrubbing(true);
      handleScrub(e.touches[0].clientX);
    }
  };

  const handleScrub = (clientX: number) => {
    if (!tracksContainerRef.current) return;
    const rect = tracksContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left + tracksContainerRef.current.scrollLeft;
    const time = Math.max(0, Math.min(durationRef.current, x / zoomRef.current));
    if (onSeekRef.current) onSeekRef.current(time);
  };

  // Close menus on outside click or Esc, and handle selection keyboard shortcuts
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(prev => prev.isOpen ? { ...prev, isOpen: false } : prev);
      setShowToolDropdown(false);
      setShowSelectMenu(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (e.key === 'Escape') {
        setContextMenu(prev => prev.isOpen ? { ...prev, isOpen: false } : prev);
        if (activeSelectedIdsRef.current.length > 0) {
          handleClearSelection();
        }
      }

      if (!isInput) {
        // Ctrl+A / Cmd+A : Select All clips across timeline
        if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
          e.preventDefault();
          handleSelectAllClips();
        }

        // V : Pointer Tool
        if (e.key === 'v' || e.key === 'V') {
          setTimelineTool('pointer');
        }

        // M / S : Marquee Box Select Tool
        if (e.key === 'm' || e.key === 'M' || e.key === 's' || e.key === 'S') {
          setTimelineTool('marquee');
        }

        // B / C : Blade Split Tool
        if (e.key === 'b' || e.key === 'B' || e.key === 'c' || e.key === 'C') {
          setTimelineTool('split');
        }

        // Delete / Backspace : Delete selected clip(s)
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (activeSelectedIdsRef.current.length > 0) {
            e.preventDefault();
            if (onDeleteSelectedClipsRef.current) {
              onDeleteSelectedClipsRef.current();
            } else if (onDeleteClipRef.current && activeSelectedIdsRef.current[0]) {
              onDeleteClipRef.current(activeSelectedIdsRef.current[0]);
            }
          }
        }
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClearSelection, handleSelectAllClips]);

  // Helper to calculate intersected clip IDs from marquee box
  const getIntersectedClipIds = useCallback((boxLeft: number, boxRight: number, boxTop: number, boxBottom: number) => {
    const intersectedIds: string[] = [];
    const currentSortedTracks = sortedTracksRef.current;
    const currentZoom = zoomRef.current;

    currentSortedTracks.forEach((track) => {
      if (track.locked || track.hidden) return;
      track.clips.forEach((clip) => {
        const clipEl = document.getElementById(`clip-${clip.id}`);
        if (clipEl && gridWrapperRef.current) {
          const clipRect = clipEl.getBoundingClientRect();
          const gridRect = gridWrapperRef.current.getBoundingClientRect();
          const scrollLeft = tracksContainerRef.current?.scrollLeft || 0;

          const clipLeft = clipRect.left - gridRect.left + scrollLeft;
          const clipRight = clipLeft + clipRect.width;
          const clipTop = clipRect.top - gridRect.top;
          const clipBottom = clipTop + clipRect.height;

          const isOverlap = !(
            clipRight < boxLeft ||
            clipLeft > boxRight ||
            clipBottom < boxTop ||
            clipTop > boxBottom
          );

          if (isOverlap) {
            intersectedIds.push(clip.id);
          }
        } else {
          // Fallback time overlap calculation
          const startTimeSec = Math.max(0, boxLeft / currentZoom);
          const endTimeSec = Math.max(0, boxRight / currentZoom);
          if (clip.start < endTimeSec && clip.start + clip.duration > startTimeSec) {
            intersectedIds.push(clip.id);
          }
        }
      });
    });

    return intersectedIds;
  }, []);

  // Dragging and resizing clips & Marquee selection drag listener
  useEffect(() => {
    const hasActiveDrag = isScrubbing || draggingClips !== null || marquee !== null;
    if (!hasActiveDrag) return;

    const handleMove = (clientX: number, clientY: number) => {
      if (isScrubbingRef.current) {
        handleScrub(clientX);
      } else if (draggingClipsRef.current) {
        const activeDragging = draggingClipsRef.current;
        const currentZoom = zoomRef.current;
        const deltaX = clientX - activeDragging.dragStartPos;
        const deltaTime = deltaX / currentZoom;

        if (activeDragging.handle === 'left') {
          // Resize left boundary of ALL selected clips concurrently
          const updates = activeDragging.clips.map(item => {
            const rawStart = item.initialStart + deltaTime;
            const boundedStart = Math.max(0, Math.min(item.initialStart + item.initialDuration - 0.2, rawStart));
            const newDuration = (item.initialStart + item.initialDuration) - boundedStart;
            return {
              id: item.id,
              start: boundedStart,
              duration: Math.max(0.2, newDuration),
            };
          });

          if (onBatchUpdateClipTimesRef.current) {
            onBatchUpdateClipTimesRef.current(updates);
          } else if (onUpdateClipTimesRef.current) {
            updates.forEach(u => onUpdateClipTimesRef.current?.(u.id, u.start, u.duration));
          }
        } else if (activeDragging.handle === 'right') {
          // Resize right boundary of ALL selected clips concurrently
          const updates = activeDragging.clips.map(item => {
            const rawEnd = item.initialStart + item.initialDuration + deltaTime;
            const rawDuration = rawEnd - item.initialStart;
            const boundedDuration = Math.max(0.2, Math.min(durationRef.current - item.initialStart, rawDuration));
            return {
              id: item.id,
              start: item.initialStart,
              duration: boundedDuration,
            };
          });

          if (onBatchUpdateClipTimesRef.current) {
            onBatchUpdateClipTimesRef.current(updates);
          } else if (onUpdateClipTimesRef.current) {
            updates.forEach(u => onUpdateClipTimesRef.current?.(u.id, u.start, u.duration));
          }
        } else {
          // Move all selected clip nodes concurrently
          const minInitialStart = Math.min(...activeDragging.clips.map(c => c.initialStart));
          const maxDeltaLeft = -minInitialStart;
          const effectiveDelta = Math.max(maxDeltaLeft, deltaTime);

          const updates = activeDragging.clips.map(item => ({
            id: item.id,
            start: Math.max(0, item.initialStart + effectiveDelta),
            duration: item.initialDuration,
          }));

          if (onBatchUpdateClipTimesRef.current) {
            onBatchUpdateClipTimesRef.current(updates);
          } else if (onUpdateClipTimesRef.current) {
            updates.forEach(u => onUpdateClipTimesRef.current?.(u.id, u.start, u.duration));
          }
        }
      } else if (marqueeRef.current && marqueeRef.current.isSelecting && gridWrapperRef.current) {
        // Update marquee drag bounds relative to the grid wrapper
        const activeMarquee = marqueeRef.current;
        const rect = gridWrapperRef.current.getBoundingClientRect();
        const currentX = clientX - rect.left + (tracksContainerRef.current?.scrollLeft || 0);
        const currentY = clientY - rect.top;

        const boxLeft = Math.min(activeMarquee.startX, currentX);
        const boxRight = Math.max(activeMarquee.startX, currentX);
        const boxTop = Math.min(activeMarquee.startY, currentY);
        const boxBottom = Math.max(activeMarquee.startY, currentY);

        const intersectedIds = getIntersectedClipIds(boxLeft, boxRight, boxTop, boxBottom);

        setMarquee(prev => prev ? { ...prev, currentX, currentY, activeCount: intersectedIds.length } : null);
      }
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleEnd = () => {
      if (isScrubbingRef.current) {
        setIsScrubbing(false);
      }
      if (draggingClipsRef.current) {
        setDraggingClips(null);
      }
      if (marqueeRef.current && marqueeRef.current.isSelecting) {
        const activeMarquee = marqueeRef.current;
        const boxLeft = Math.min(activeMarquee.startX, activeMarquee.currentX);
        const boxRight = Math.max(activeMarquee.startX, activeMarquee.currentX);
        const boxTop = Math.min(activeMarquee.startY, activeMarquee.currentY);
        const boxBottom = Math.max(activeMarquee.startY, activeMarquee.currentY);

        const width = boxRight - boxLeft;
        const height = boxBottom - boxTop;

        if (width > 4 || height > 4) {
          const intersectedIds = getIntersectedClipIds(boxLeft, boxRight, boxTop, boxBottom);

          if (intersectedIds.length > 0) {
            if (onSelectClipsRef.current) {
              onSelectClipsRef.current(intersectedIds);
            } else if (onSelectClipRef.current) {
              onSelectClipRef.current(intersectedIds[0]);
            }
          } else {
            if (onSelectClipRef.current) onSelectClipRef.current(null);
            if (onSelectClipsRef.current) onSelectClipsRef.current([]);
          }
        }
        setMarquee(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };
  }, [isScrubbing, draggingClips !== null, marquee !== null, getIntersectedClipIds]);

  // Start marquee selection & jump playhead slider when clicking on grid space
  const handleGridMouseDown = (e: React.MouseEvent) => {
    // Only handle left click on background
    if (e.button !== 0 || !gridWrapperRef.current) return;

    const rect = gridWrapperRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left + (tracksContainerRef.current?.scrollLeft || 0);
    const startY = e.clientY - rect.top;

    // Immediately jump playhead slider to clicked timeline timestamp
    const clickTime = Math.max(0, Math.min(duration, startX / zoom));
    onSeek(clickTime);

    const isMultiSelect = e.ctrlKey || e.metaKey || e.shiftKey;
    if (!isMultiSelect && timelineTool !== 'marquee') {
      onSelectClip(null);
    }

    setMarquee({
      startX,
      startY,
      currentX: startX,
      currentY: startY,
      isSelecting: true,
      activeCount: 0,
    });
  };

  // Right-click context menu handler on clips or empty space
  const handleContextMenu = (e: React.MouseEvent, clip: Clip | null, track: Track | null) => {
    e.preventDefault();
    e.stopPropagation();

    // Determine seek time if right-clicked on canvas/ruler
    let seekTime: number | undefined;
    if (tracksContainerRef.current) {
      const rect = tracksContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + tracksContainerRef.current.scrollLeft;
      seekTime = Math.max(0, Math.min(duration, x / zoom));
    }

    if (clip) {
      // If right-clicked clip is not already selected, select it
      if (!activeSelectedIds.includes(clip.id)) {
        onSelectClip(clip.id, false);
      }
    }

    // Keep context menu inside screen viewport
    const menuWidth = 230;
    const menuHeight = 360;
    const posX = Math.min(window.innerWidth - menuWidth - 10, Math.max(10, e.clientX));
    const posY = Math.min(window.innerHeight - menuHeight - 10, Math.max(10, e.clientY));

    setContextMenu({
      isOpen: true,
      x: posX,
      y: posY,
      clip,
      track,
      seekTime,
    });
  };

  // Render ticks on Timeline Ruler
  const renderRulerTicks = () => {
    const ticks: React.ReactNode[] = [];
    const step = zoom < 20 ? 5 : zoom < 50 ? 2 : 1; // Notch interval based on zoom
    const totalSecs = Math.max(Math.ceil(duration), 300);

    for (let s = 0; s <= totalSecs; s += step) {
      const left = s * zoom;
      ticks.push(
        <div
          key={s}
          className="absolute top-0 h-full border-l border-[#2e2e34] flex flex-col justify-between"
          style={{ left: `${left}px` }}
        >
          <span className="text-[9px] font-mono text-gray-500 pl-1 pt-1 select-none">
            {formatTimeCode(s, false)}
          </span>
          <div className="h-2 w-px bg-[#3e3e44]" />
        </div>
      );

      // Minor tick marks
      if (step > 1) {
        for (let sub = s + step / 2; sub < s + step && sub <= totalSecs; sub += step / 2) {
          ticks.push(
            <div
              key={`sub-${sub}`}
              className="absolute bottom-0 h-3 border-l border-[#1e1e24]"
              style={{ left: `${sub * zoom}px` }}
            />
          );
        }
      }
    }
    return ticks;
  };

  // Start clip dragging or selection and jump playhead slider on click
  const startClipDrag = (e: React.MouseEvent | React.TouchEvent, clip: Clip, handle?: 'left' | 'right') => {
    // Only respond to primary mouse button if mouse event
    if ('button' in e && (e as React.MouseEvent).button !== 0) return;

    e.stopPropagation();

    // Jump playhead slider immediately to where user clicked on the timeline
    if (tracksContainerRef.current) {
      const rect = tracksContainerRef.current.getBoundingClientRect();
      const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const x = clientX - rect.left + tracksContainerRef.current.scrollLeft;
      const clickTime = Math.max(0, Math.min(duration, x / zoom));
      onSeek(clickTime);
    }

    // If user is using the Split/Blade tool, clicking on a clip splits it at playhead/click position
    if (timelineTool === 'split') {
      onSelectClip(clip.id, false);
      if (onSplitClip) {
        onSplitClip();
      }
      return;
    }

    const isMultiSelect = 'ctrlKey' in e ? (e.ctrlKey || e.metaKey || e.shiftKey) : false;

    onSelectClip(clip.id, isMultiSelect);

    // Compute which clips to include in current move matrix
    let targetIds: string[];
    if (isMultiSelect) {
      if (activeSelectedIds.includes(clip.id)) {
        targetIds = activeSelectedIds;
      } else {
        targetIds = [...activeSelectedIds, clip.id];
      }
    } else {
      if (activeSelectedIds.includes(clip.id)) {
        targetIds = activeSelectedIds;
      } else {
        targetIds = [clip.id];
      }
    }

    const clipsToMove: DraggingClipItem[] = [];
    tracks.forEach(track => {
      if (track.locked) return;
      track.clips.forEach(c => {
        if (targetIds.includes(c.id)) {
          clipsToMove.push({
            id: c.id,
            initialStart: c.start,
            initialDuration: c.duration,
            trackId: track.id,
          });
        }
      });
    });

    const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;

    setDraggingClips({
      primaryId: clip.id,
      dragStartPos: clientX,
      handle,
      clips: clipsToMove.length > 0 ? clipsToMove : [{ id: clip.id, initialStart: clip.start, initialDuration: clip.duration, trackId: clip.trackId }],
    });
  };

  const getTrackIcon = (type: ClipType) => {
    switch (type) {
      case ClipType.VIDEO:
        return <span className="text-cyan-400 text-[10px] font-bold uppercase tracking-wider font-mono">VID</span>;
      case ClipType.IMAGE:
        return <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider font-mono">IMG</span>;
      case ClipType.AUDIO:
        return <span className="text-teal-400 text-[10px] font-bold uppercase tracking-wider font-mono">AUD</span>;
      case ClipType.TEXT:
        return <span className="text-purple-400 text-[10px] font-bold uppercase tracking-wider font-mono">TXT</span>;
      case ClipType.EFFECT:
        return <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider font-mono">FX</span>;
    }
  };

  return (
    <div
      id="timeline-engine"
      className="bg-[#121216] border-t border-[#2a2a30] flex flex-col select-none relative"
      style={{ height: height !== undefined ? `${height}px` : undefined }}
    >
      
      {/* CapCut Pro Exact Timeline Toolbar */}
      <div className="h-10 border-b border-[#25252e] px-2 flex items-center justify-between bg-[#15151c] text-gray-300 text-xs select-none gap-2 shrink-0 overflow-x-auto custom-scrollbar">
        {/* Left Section: Editing Tools */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Select / Blade Tool Dropdown */}
          <div className="relative">
            <button
              id="btn-tool-select"
              onClick={(e) => {
                e.stopPropagation();
                setShowToolDropdown(prev => !prev);
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded transition border ${
                timelineTool === 'pointer'
                  ? 'bg-[#252538] text-cyan-400 border-cyan-500/40 shadow-xs'
                  : timelineTool === 'marquee'
                  ? 'bg-[#252538] text-amber-400 border-amber-500/40 shadow-xs'
                  : 'bg-[#252538] text-rose-400 border-rose-500/40 shadow-xs'
              }`}
              title="Select / Tool Mode (V / M / C)"
            >
              {timelineTool === 'pointer' && <MousePointer2 className="w-3.5 h-3.5 text-cyan-400" />}
              {timelineTool === 'marquee' && <BoxSelect className="w-3.5 h-3.5 text-amber-400" />}
              {timelineTool === 'split' && <Scissors className="w-3.5 h-3.5 text-rose-400" />}
              <span className="text-[11px] font-medium hidden sm:inline">
                {timelineTool === 'pointer' ? 'Select (V)' : timelineTool === 'marquee' ? 'Box (M)' : 'Split (C)'}
              </span>
              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>

            {showToolDropdown && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-full left-0 mt-1 bg-[#1a1a24] border border-[#2e2e3e] rounded-lg shadow-2xl py-1 w-44 z-50 text-gray-200 text-xs animate-in fade-in zoom-in-95 duration-100 divide-y divide-[#262634]"
              >
                <div className="py-0.5">
                  <button
                    onClick={() => {
                      setTimelineTool('pointer');
                      setShowToolDropdown(false);
                    }}
                    className={`w-full px-2.5 py-1.5 text-left flex items-center gap-2 hover:bg-[#252536] transition ${timelineTool === 'pointer' ? 'text-cyan-400 font-semibold bg-cyan-950/30' : 'text-gray-300'}`}
                  >
                    <MousePointer2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Pointer Tool (V)</span>
                  </button>
                  <button
                    onClick={() => {
                      setTimelineTool('marquee');
                      setShowToolDropdown(false);
                    }}
                    className={`w-full px-2.5 py-1.5 text-left flex items-center gap-2 hover:bg-[#252536] transition ${timelineTool === 'marquee' ? 'text-amber-400 font-semibold bg-amber-950/30' : 'text-gray-300'}`}
                  >
                    <BoxSelect className="w-3.5 h-3.5 text-amber-400" />
                    <span>Box Select Tool (M)</span>
                  </button>
                  <button
                    onClick={() => {
                      setTimelineTool('split');
                      setShowToolDropdown(false);
                    }}
                    className={`w-full px-2.5 py-1.5 text-left flex items-center gap-2 hover:bg-[#252536] transition ${timelineTool === 'split' ? 'text-rose-400 font-semibold bg-rose-950/30' : 'text-gray-300'}`}
                  >
                    <Scissors className="w-3.5 h-3.5 text-rose-400" />
                    <span>Razor Blade Tool (C)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Select Helper Dropdown */}
          <div className="relative">
            <button
              id="btn-quick-select-menu"
              onClick={(e) => {
                e.stopPropagation();
                setShowSelectMenu(prev => !prev);
              }}
              className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-[#252532] text-gray-300 transition text-[11px]"
              title="Multi-Selection Filter Menu"
            >
              <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
              <span className="hidden md:inline">Select</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>

            {showSelectMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-full left-0 mt-1 bg-[#1a1a24] border border-[#2e2e3e] rounded-lg shadow-2xl py-1 w-48 z-50 text-gray-200 text-xs animate-in fade-in zoom-in-95 duration-100 divide-y divide-[#262634]"
              >
                <div className="py-0.5">
                  <button
                    onClick={() => {
                      handleSelectAllClips();
                      setShowSelectMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 text-left flex items-center justify-between hover:bg-[#252536] text-gray-200 transition"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>Select All Clips</span>
                    </div>
                    <span className="text-[9px] font-mono text-gray-500">Ctrl+A</span>
                  </button>

                  <button
                    onClick={() => {
                      handleSelectClipsByType(ClipType.TEXT);
                      setShowSelectMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 text-left flex items-center justify-between hover:bg-[#252536] text-gray-200 transition"
                  >
                    <div className="flex items-center gap-2">
                      <TypeIcon className="w-3.5 h-3.5 text-purple-400" />
                      <span>Select All Text</span>
                    </div>
                    <span className="text-[9px] font-mono text-purple-400/70">TXT</span>
                  </button>

                  <button
                    onClick={() => {
                      handleSelectClipsByType(ClipType.AUDIO);
                      setShowSelectMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 text-left flex items-center justify-between hover:bg-[#252536] text-gray-200 transition"
                  >
                    <div className="flex items-center gap-2">
                      <Music className="w-3.5 h-3.5 text-teal-400" />
                      <span>Select All Audio</span>
                    </div>
                    <span className="text-[9px] font-mono text-teal-400/70">AUD</span>
                  </button>

                  <button
                    onClick={() => {
                      handleSelectClipsByType('video_image');
                      setShowSelectMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 text-left flex items-center justify-between hover:bg-[#252536] text-gray-200 transition"
                  >
                    <div className="flex items-center gap-2">
                      <Film className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Select Video & Image</span>
                    </div>
                    <span className="text-[9px] font-mono text-cyan-400/70">VID/IMG</span>
                  </button>
                </div>

                {activeSelectedIds.length > 0 && (
                  <div className="py-0.5">
                    <button
                      onClick={() => {
                        handleClearSelection();
                        setShowSelectMenu(false);
                      }}
                      className="w-full px-2.5 py-1.5 text-left flex items-center justify-between hover:bg-red-950/40 text-red-300 transition"
                    >
                      <div className="flex items-center gap-2">
                        <X className="w-3.5 h-3.5" />
                        <span>Clear Selection</span>
                      </div>
                      <span className="text-[9px] font-mono text-gray-500">Esc</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-[#2a2a35] mx-0.5" />

          {/* Undo */}
          <button
            id="btn-undo"
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded transition ${canUndo ? 'hover:bg-[#252532] text-gray-200' : 'text-gray-600 cursor-not-allowed'}`}
            title="Undo (Ctrl + Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          {/* Redo */}
          <button
            id="btn-redo"
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded transition ${canRedo ? 'hover:bg-[#252532] text-gray-200' : 'text-gray-600 cursor-not-allowed'}`}
            title="Redo (Ctrl + Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          {/* Split (Ctrl + B) */}
          <button
            id="btn-split-clip"
            onClick={onSplitClip}
            disabled={activeSelectedIds.length === 0}
            className={`p-1.5 rounded transition ${activeSelectedIds.length > 0 ? 'hover:bg-[#252532] text-cyan-400' : 'text-gray-600 cursor-not-allowed'}`}
            title="Split Clip at Playhead (Ctrl + B)"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>

          {/* Trim Left / Delete Left (Q) */}
          <button
            id="btn-ripple-left"
            onClick={() => onRippleDelete('left')}
            disabled={activeSelectedIds.length === 0}
            className={`p-1.5 rounded transition ${activeSelectedIds.length > 0 ? 'hover:bg-[#252532] text-amber-400' : 'text-gray-600 cursor-not-allowed'}`}
            title="Delete Left / Trim (Q)"
          >
            <SquareSlash className="w-3.5 h-3.5" />
          </button>

          {/* Trim Right / Delete Right (W) */}
          <button
            id="btn-ripple-right"
            onClick={() => onRippleDelete('right')}
            disabled={activeSelectedIds.length === 0}
            className={`p-1.5 rounded transition ${activeSelectedIds.length > 0 ? 'hover:bg-[#252532] text-amber-400' : 'text-gray-600 cursor-not-allowed'}`}
            title="Delete Right / Trim (W)"
          >
            <SquareSlash className="w-3.5 h-3.5 scale-x-[-1]" />
          </button>

          {/* Delete / Trash (Del) */}
          <button
            id="btn-delete-clip"
            onClick={() => {
              if (onDeleteSelectedClips) {
                onDeleteSelectedClips();
              } else if (selectedClipId) {
                onDeleteClip(selectedClipId);
              }
            }}
            disabled={activeSelectedIds.length === 0}
            className={`p-1.5 rounded transition ${activeSelectedIds.length > 0 ? 'hover:bg-red-950/60 hover:text-red-400 text-gray-300' : 'text-gray-600 cursor-not-allowed'}`}
            title={`Delete Selected Clip (Del)`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Marker (M) */}
          <button
            id="btn-add-marker"
            onClick={() => {
              // Add timeline bookmark marker at currentTime
            }}
            className="p-1.5 rounded hover:bg-[#252532] text-amber-400 transition"
            title="Add Timeline Marker (M)"
          >
            <Flag className="w-3.5 h-3.5" />
          </button>

          {/* Freeze Frame */}
          <button
            id="btn-freeze-frame"
            onClick={onFreezeFrame}
            disabled={!selectedClipId}
            className={`p-1.5 rounded transition ${selectedClipId ? 'hover:bg-[#252532] text-sky-400' : 'text-gray-600 cursor-not-allowed'}`}
            title="Freeze Frame (3s)"
          >
            <Snowflake className="w-3.5 h-3.5" />
          </button>

          {/* Reverse Playback */}
          <button
            id="btn-reverse-clip"
            onClick={() => {
              if (selectedClip && onSetClipSpeed) {
                onSetClipSpeed(-1.0);
              }
            }}
            disabled={!selectedClipId}
            className={`p-1.5 rounded transition ${selectedClipId ? 'hover:bg-[#252532] text-gray-200' : 'text-gray-600 cursor-not-allowed'}`}
            title="Reverse Playback"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Flip / Mirror */}
          <button
            id="btn-flip-clip"
            onClick={() => {
              // Toggle horizontal mirror state on clip
            }}
            disabled={!selectedClipId}
            className={`p-1.5 rounded transition ${selectedClipId ? 'hover:bg-[#252532] text-gray-200' : 'text-gray-600 cursor-not-allowed'}`}
            title="Flip / Mirror Horizontal"
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Rotate */}
          <button
            id="btn-rotate-clip"
            onClick={() => {
              // Rotate clip 90 degrees
            }}
            disabled={!selectedClipId}
            className={`p-1.5 rounded transition ${selectedClipId ? 'hover:bg-[#252532] text-gray-200' : 'text-gray-600 cursor-not-allowed'}`}
            title="Rotate 90°"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* Crop */}
          <button
            id="btn-crop-clip"
            disabled={!selectedClipId}
            className={`p-1.5 rounded transition ${selectedClipId ? 'hover:bg-[#252532] text-gray-200' : 'text-gray-600 cursor-not-allowed'}`}
            title="Crop & Frame Settings"
          >
            <Crop className="w-3.5 h-3.5" />
          </button>

          {/* Auto Cutout / Background Remover PRO */}
          <button
            id="btn-pro-cutout"
            className="flex items-center gap-1 p-1.5 rounded hover:bg-[#252532] text-purple-400 transition"
            title="AI Smart Background Cutout (PRO)"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="text-[8px] bg-gradient-to-r from-cyan-400 to-purple-500 text-black font-extrabold px-1 rounded-xs uppercase tracking-tighter leading-tight">
              PRO
            </span>
          </button>

          {/* Auto-Segment & Acoustic Tools Dropdown */}
          <div className="relative ml-1">
            <button
              id="btn-auto-segment-menu"
              onClick={() => setShowAutoSegmentMenu(!showAutoSegmentMenu)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold bg-gradient-to-r from-emerald-600/30 to-cyan-600/30 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 transition shadow-sm cursor-pointer"
              title="Smart Audio & Video Auto-Segmenter"
            >
              <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400/20 animate-pulse" />
              <span className="hidden sm:inline">Auto-Cut</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-70" />
            </button>

            {showAutoSegmentMenu && (
              <div className="absolute top-full mt-1 left-0 bg-[#16161c] border border-emerald-500/30 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col w-64 divide-y divide-gray-800 text-xs backdrop-blur-md">
                <div className="py-1">
                  <button
                    id="btn-action-autosegment-audio"
                    onClick={() => {
                      if (onAutoSegmentAudio) onAutoSegmentAudio(selectedClip?.id);
                      setShowAutoSegmentMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-emerald-950/60 hover:text-emerald-300 text-gray-200 transition flex items-center gap-2 group"
                  >
                    <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-bold text-[11px] text-white">🎙️ Auto-Segment Audio by Pauses</div>
                      <div className="text-[9px] text-gray-400">Slice audio into discrete phrases at pauses</div>
                    </div>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    id="btn-action-autosync-video"
                    onClick={() => {
                      if (onAutoSyncVideoToAyahs) onAutoSyncVideoToAyahs();
                      setShowAutoSegmentMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-cyan-950/60 hover:text-cyan-300 text-gray-200 transition flex items-center gap-2 group"
                  >
                    <Film className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <div>
                      <div className="font-bold text-[11px] text-white">🎬 Auto-Segment Video to Ayahs</div>
                      <div className="text-[9px] text-gray-400">Cut background video at each Ayah change</div>
                    </div>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    id="btn-action-remove-silence"
                    onClick={() => {
                      if (onAutoRemoveSilence) onAutoRemoveSilence(selectedClip?.id);
                      setShowAutoSegmentMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-amber-950/60 hover:text-amber-300 text-gray-200 transition flex items-center gap-2 group"
                  >
                    <Scissors className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-bold text-[11px] text-white">✂️ Smart Silence Remover</div>
                      <div className="text-[9px] text-gray-400">Auto-trim dead air & ripple delete gaps</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Voice, Magnet, Ripple, Link & Zoom Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Voice Record Mic */}
          <button
            id="btn-mic-recorder"
            className="p-1.5 rounded hover:bg-[#252532] text-gray-300 hover:text-emerald-400 transition"
            title="Record Voiceover"
          >
            <Mic className="w-3.5 h-3.5" />
          </button>

          {/* Timeline Continuous Loop Toggle */}
          <button
            id="btn-loop-playback-toggle"
            onClick={onToggleLoop}
            className={`p-1.5 rounded transition ${isLooping ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/50 shadow-xs ring-1 ring-emerald-500/30' : 'text-gray-400 hover:text-gray-200'}`}
            title={`Timeline Continuous Loop: ${isLooping ? 'ENABLED (00:00 to End)' : 'DISABLED'}`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Magnet / Snapping Toggle */}
          <button
            id="btn-snap-toggle"
            onClick={() => setIsSnapping(!isSnapping)}
            className={`p-1.5 rounded transition ${isSnapping ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-500/50 shadow-xs' : 'text-gray-400 hover:text-gray-200'}`}
            title={`Auto Snapping Magnet: ${isSnapping ? 'ON' : 'OFF'}`}
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>

          {/* Auto Ripple / Link Tracks Toggle */}
          <button
            id="btn-ripple-tracks-toggle"
            className="p-1.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-500/50 shadow-xs transition"
            title="Auto Ripple / Track Synchronization (ON)"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>

          {/* Linked Editing */}
          <button
            id="btn-linked-editing"
            className="p-1.5 rounded hover:bg-[#252532] text-gray-300 transition"
            title="Linked Editing"
          >
            <Link className="w-3.5 h-3.5" />
          </button>

          {/* Align / Center Playhead */}
          <button
            id="btn-center-playhead"
            onClick={() => {
              if (tracksContainerRef.current) {
                tracksContainerRef.current.scrollLeft = Math.max(0, currentTime * zoom - tracksContainerRef.current.clientWidth / 2);
              }
            }}
            className="p-1.5 rounded hover:bg-[#252532] text-gray-300 transition"
            title="Center Playhead in View"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-[#2a2a35] mx-0.5" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-[#181822] px-2 py-0.5 rounded border border-[#2a2a34]">
            <button
              onClick={() => onZoomChange(Math.max(10, zoom - 5))}
              className="text-gray-400 hover:text-white transition"
              title="Zoom Out"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="range"
              min="10"
              max="100"
              value={zoom}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="w-16 h-1 bg-[#2b2b36] rounded appearance-none cursor-pointer accent-cyan-400"
              title={`Zoom level: ${zoom}`}
            />
            <button
              onClick={() => onZoomChange(Math.min(100, zoom + 5))}
              className="text-gray-400 hover:text-white transition"
              title="Zoom In"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={() => {
                if (tracksContainerRef.current) {
                  const availableWidth = tracksContainerRef.current.clientWidth - 50;
                  const optimalZoom = Math.max(10, Math.min(100, Math.floor(availableWidth / duration)));
                  onZoomChange(optimalZoom);
                }
              }}
              className="p-1 rounded bg-[#1c1c22] hover:bg-[#25252e] text-gray-400 hover:text-cyan-400 transition ml-0.5"
              title="Fit Project to Screen"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Tracks Container */}
      <div className="flex-1 flex min-h-0 relative">
        
        {/* Track Headers (Left sidebar of Timeline with CapCut Pro Mute, Lock, Hide controls) */}
        <div className="w-36 sm:w-44 bg-[#15151a] border-r border-[#2a2a30] flex flex-col z-20 shadow-md shrink-0 select-none">
          <div className="h-8 border-b border-[#2a2a30] flex items-center justify-between px-2 text-[10px] font-semibold text-gray-500 tracking-wider">
            <span>TRACKS ({sortedTracks.length})</span>
            {onAddTrack && (
              <div className="relative">
                <button
                  onClick={() => setShowAddTrackMenu(!showAddTrackMenu)}
                  className="p-1 rounded bg-[#202028] hover:bg-cyan-500 hover:text-black text-gray-300 transition flex items-center gap-0.5 text-[9px]"
                  title="Add New Track"
                >
                  <Plus className="w-3 h-3" />
                  <span>Track</span>
                </button>
                {showAddTrackMenu && (
                  <div className="absolute top-full mt-1 right-0 bg-[#1a1a20] border border-[#2a2a34] rounded-lg shadow-2xl p-1 z-50 flex flex-col w-28">
                    {[ClipType.VIDEO, ClipType.IMAGE, ClipType.AUDIO, ClipType.TEXT, ClipType.EFFECT].map(t => (
                      <button
                        key={t}
                        onClick={() => {
                          onAddTrack(t);
                          setShowAddTrackMenu(false);
                        }}
                        className="px-2 py-1 text-left text-[10px] font-semibold hover:bg-cyan-500/20 hover:text-cyan-300 rounded text-gray-300 uppercase"
                      >
                        + {t} Track
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div ref={headersScrollRef} onScroll={handleVerticalScroll} className="flex-1 flex flex-col p-1.5 gap-2 overflow-y-auto custom-scrollbar">
            {sortedTracks.map((track, trackIdx) => (
              <div
                key={track.id ? `${track.id}-${trackIdx}` : `track-${trackIdx}`}
                onContextMenu={(e) => handleContextMenu(e, null, track)}
                className={`h-14 min-h-[56px] border border-[#2a2a35] rounded-lg flex items-center justify-between px-2 bg-[#16161d] shadow-sm transition-all ${track.locked ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center gap-1.5 overflow-hidden">
                  {getTrackIcon(track.type)}
                  <span className="text-[10px] text-gray-300 font-medium truncate max-w-[70px] sm:max-w-[90px]" title={track.name}>
                    {track.name}
                  </span>
                </div>

                {/* Track Status & Controls (Mute, Lock, Hide, Delete) */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {/* Mute Track */}
                  {onToggleTrackMute && (
                    <button
                      onClick={() => onToggleTrackMute(track.id)}
                      className={`p-1 rounded transition ${track.muted ? 'text-red-400 bg-red-950/50' : 'text-gray-500 hover:text-gray-300'}`}
                      title={track.muted ? 'Unmute Track' : 'Mute Track'}
                    >
                      {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    </button>
                  )}

                  {/* Lock Track */}
                  {onToggleTrackLock && (
                    <button
                      onClick={() => onToggleTrackLock(track.id)}
                      className={`p-1 rounded transition ${track.locked ? 'text-amber-400 bg-amber-950/50' : 'text-gray-500 hover:text-gray-300'}`}
                      title={track.locked ? 'Unlock Track' : 'Lock Track'}
                    >
                      {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>
                  )}

                  {/* Hide Track */}
                  {onToggleTrackHidden && (
                    <button
                      onClick={() => onToggleTrackHidden(track.id)}
                      className={`p-1 rounded transition ${track.hidden ? 'text-purple-400 bg-purple-950/50' : 'text-gray-500 hover:text-gray-300'}`}
                      title={track.hidden ? 'Show Track' : 'Hide Track'}
                    >
                      {track.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  )}

                  {/* Delete Track */}
                  {onDeleteTrack && sortedTracks.length > 1 && (
                    <button
                      onClick={() => onDeleteTrack(track.id)}
                      className="p-1 rounded text-gray-600 hover:text-red-400 transition"
                      title="Delete Track"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tracks Grid Timeline Grid (Scrollable) */}
        <div ref={tracksContainerRef} className="flex-1 overflow-x-auto overflow-y-hidden relative custom-scrollbar">
          
          {/* Scrollable Tracks Canvas Wrapper */}
          <div
            ref={gridWrapperRef}
            style={{ width: `${Math.max(100, duration * zoom + 100)}px`, minWidth: '100%' }}
            className="h-full relative min-w-full"
            onMouseDown={handleGridMouseDown}
            onContextMenu={(e) => handleContextMenu(e, null, null)}
          >
            
            {/* Timeline Ruler */}
            <div
              ref={rulerRef}
              onMouseDown={handleRulerMouseDown}
              onTouchStart={handleRulerTouchStart}
              onContextMenu={(e) => handleContextMenu(e, null, null)}
              className="h-8 bg-[#18181d] border-b border-[#2a2a30] relative cursor-ew-resize select-none overflow-hidden"
            >
              {renderRulerTicks()}
              {/* Loop Region Span */}
              {isLooping && (
                <div
                  style={{ left: 0, width: `${Math.max(20, duration * zoom)}px` }}
                  className="absolute top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-500 rounded-b shadow-[0_0_8px_rgba(52,211,153,0.6)] z-20 flex items-center justify-between px-1"
                  title={`Loop Region Active: 00:00 - ${formatTimeCode(duration)}`}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-ping" />
                </div>
              )}
            </div>

            {/* Visual Grid rows */}
            <div ref={gridScrollRef} onScroll={handleVerticalScroll} className="absolute top-8 bottom-0 left-0 right-0 flex flex-col p-1.5 gap-2 overflow-y-auto custom-scrollbar min-w-full w-full">
              {sortedTracks.map((track, trackIdx) => (
                <div
                  key={track.id ? `grid-${track.id}-${trackIdx}` : `grid-track-${trackIdx}`}
                  onContextMenu={(e) => handleContextMenu(e, null, track)}
                  className={`h-14 min-h-[56px] border border-[#22222c] rounded-lg relative bg-[#131318] flex items-center shadow-sm overflow-hidden ${track.hidden ? 'opacity-30 pointer-events-none' : ''}`}
                >
                  {/* Subtle Grid backdrop lines */}
                  <div className="absolute inset-0 bg-grid-pattern opacity-5" />

                  {/* Clips list */}
                  {track.clips.map((clip, clipIdx) => {
                    const isSelected = activeSelectedIds.includes(clip.id);
                    const left = clip.start * zoom;
                    const width = clip.duration * zoom;

                    // Track specific clip styling with Multi-Selection Matrix glow
                    let clipStyleClass = isSelected
                      ? 'bg-[#2a2200] border-2 border-amber-400 text-amber-100 font-bold shadow-[0_0_15px_rgba(251,191,36,0.5)] ring-2 ring-amber-400/40 z-30 scale-[1.01]'
                      : 'bg-[#1a1a24] hover:bg-[#20202c] border-gray-800 text-gray-300';

                    if (!isSelected) {
                      if (clip.type === ClipType.AUDIO) {
                        clipStyleClass = 'bg-gradient-to-r from-teal-950/90 via-emerald-950/90 to-teal-950/90 hover:from-teal-900/90 border-teal-500/40 text-teal-200';
                      } else if (clip.type === ClipType.VIDEO) {
                        clipStyleClass = 'bg-gradient-to-r from-slate-900/90 via-cyan-950/90 to-slate-900/90 hover:from-slate-800/90 border-cyan-500/40 text-cyan-200';
                      } else if (clip.type === ClipType.IMAGE) {
                        clipStyleClass = 'bg-gradient-to-r from-emerald-950/90 via-teal-950/90 to-emerald-950/90 hover:from-emerald-900/90 border-emerald-500/40 text-emerald-200';
                      } else if (clip.type === ClipType.TEXT) {
                        clipStyleClass = 'bg-gradient-to-r from-purple-950/90 via-indigo-950/90 to-purple-950/90 hover:from-purple-900/90 border-purple-500/40 text-purple-200';
                      } else if (clip.type === ClipType.EFFECT) {
                        clipStyleClass = 'bg-amber-950/90 border-amber-500/40 text-amber-200';
                      }
                    } else {
                      if (clip.type === ClipType.AUDIO) {
                        clipStyleClass = 'bg-gradient-to-r from-teal-900 via-teal-800 to-teal-900 border-2 border-amber-400 text-teal-100 font-bold shadow-[0_0_15px_rgba(251,191,36,0.55)] ring-2 ring-amber-400/40 z-30';
                      } else if (clip.type === ClipType.TEXT) {
                        clipStyleClass = 'bg-gradient-to-r from-purple-900 via-purple-800 to-purple-900 border-2 border-amber-400 text-purple-100 font-bold shadow-[0_0_15px_rgba(251,191,36,0.55)] ring-2 ring-amber-400/40 z-30';
                      } else if (clip.type === ClipType.IMAGE) {
                        clipStyleClass = 'bg-gradient-to-r from-emerald-900 via-teal-800 to-emerald-900 border-2 border-amber-400 text-emerald-100 font-bold shadow-[0_0_15px_rgba(251,191,36,0.55)] ring-2 ring-amber-400/40 z-30';
                      } else if (clip.type === ClipType.VIDEO) {
                        clipStyleClass = 'bg-gradient-to-r from-cyan-950 via-cyan-900 to-cyan-950 border-2 border-amber-400 text-cyan-100 font-bold shadow-[0_0_15px_rgba(251,191,36,0.55)] ring-2 ring-amber-400/40 z-30';
                      }
                    }

                    return (
                      <div
                        key={clip.id ? `${clip.id}-${clipIdx}` : `clip-${track.id}-${clipIdx}`}
                        id={`clip-${clip.id}`}
                        onMouseDown={(e) => startClipDrag(e, clip)}
                        onTouchStart={(e) => startClipDrag(e, clip)}
                        onContextMenu={(e) => handleContextMenu(e, clip, track)}
                        className={`absolute top-[4px] bottom-[4px] rounded-lg flex items-center justify-between px-2 cursor-pointer transition-all select-none group border shadow-xs ${clipStyleClass}`}
                        style={{
                          left: `${left}px`,
                          width: `${width}px`,
                        }}
                      >
                        {/* Audio Waveform Graph for Audio Tracks */}
                        {clip.type === ClipType.AUDIO && (
                          <AudioWaveformGraph
                            clipId={clip.id}
                            url={clip.url}
                            width={width}
                            isSelected={isSelected}
                            volume={clip.volume}
                            showSilenceHighlights={showSilenceGuide}
                            currentTime={currentTime}
                            clipStart={clip.start}
                            clipDuration={clip.duration}
                            isPlaying={isPlaying}
                          />
                        )}

                        {/* Video Frame Strip Visuals for Video Tracks */}
                        {clip.type === ClipType.VIDEO && (
                          <VideoFilmstripVisual
                            clip={clip}
                            width={width}
                            isSelected={isSelected}
                            zoom={zoom}
                          />
                        )}

                        {/* Drag Resize Handle Left */}
                        <div
                          onMouseDown={(e) => startClipDrag(e, clip, 'left')}
                          onTouchStart={(e) => startClipDrag(e, clip, 'left')}
                          className={`absolute left-0 top-0 bottom-0 w-3.5 bg-black/50 hover:bg-cyan-500 rounded-l-md cursor-ew-resize flex items-center justify-center transition-all z-20 ${isSelected ? 'opacity-90' : 'opacity-0 group-hover:opacity-100'}`}
                          title="Drag to adjust start time (ew-resize)"
                        >
                          <div className="w-0.5 h-3.5 bg-white/90 rounded-full" />
                        </div>

                        {/* Title text & Metadata Badge Overlay */}
                        <div className="flex-1 mx-2 overflow-hidden pointer-events-none z-10 flex items-center justify-between">
                          <div className="truncate">
                            <div className="flex items-center gap-1.5 truncate">
                              <p className={`text-[10px] font-bold truncate tracking-wide ${isSelected ? 'text-amber-200' : 'text-white'}`}>
                                {clip.name}
                              </p>

                              {/* Transition Indicator Badge */}
                              {clip.transition && (clip.transition.inType !== 'none' || clip.transition.outType !== 'none' || clip.transition.type !== 'none') && (
                                <span
                                  className="px-1 py-0.2 rounded text-[7px] font-mono font-black bg-cyan-950/90 text-cyan-300 border border-cyan-500/60 shrink-0 shadow-xs uppercase flex items-center gap-0.5"
                                  title={`Transition Effect: ${clip.transition.type || clip.transition.inType || 'Active'} (${clip.transition.duration || 1.0}s)`}
                                >
                                  ✨ {clip.transition.type || clip.transition.inType || 'Trans'}
                                </span>
                              )}

                              {/* Audio Peak Indicator Badge */}
                              {clip.peakDb !== undefined && (
                                <span
                                  className={`px-1 py-0.2 rounded text-[7px] font-mono font-black border shrink-0 shadow-xs ${
                                    clip.peakDb > -0.5
                                      ? 'bg-red-500/90 text-white border-red-300'
                                      : clip.peakDb > -6
                                      ? 'bg-amber-500/90 text-black border-amber-200'
                                      : 'bg-emerald-500/90 text-black border-emerald-200'
                                  }`}
                                  title={`Audio Peak Level: ${clip.peakDb > 0 ? '+' : ''}${clip.peakDb.toFixed(1)} dBFS`}
                                >
                                  Peak {clip.peakDb > 0 ? `+${clip.peakDb.toFixed(1)}` : clip.peakDb.toFixed(1)}dB
                                </span>
                              )}
                            </div>
                            <p className={`text-[8px] font-mono mt-0.5 ${isSelected ? 'text-amber-300/80' : 'text-gray-300'}`}>
                              {clip.duration.toFixed(2)}s • x{clip.playbackRate.toFixed(1)}
                              {clip.peakDb !== undefined && ` • Peak: ${clip.peakDb > 0 ? '+' : ''}${clip.peakDb.toFixed(1)}dB`}
                            </p>
                          </div>

                          {/* Track type indicator tag & Selected Matrix Badge */}
                          <div className="flex items-center gap-1 shrink-0 ml-1">
                            {isSelected && (
                              <span className="px-1 py-0.2 rounded text-[7px] font-mono font-black bg-amber-400 text-black border border-amber-300 uppercase shadow-xs">
                                SEL
                              </span>
                            )}
                            <div className="px-1 py-0.5 rounded text-[7px] font-mono font-extrabold uppercase bg-black/40 text-white/80 border border-white/10 shrink-0">
                              {clip.type}
                            </div>
                          </div>
                        </div>

                        {/* Drag Resize Handle Right */}
                        <div
                          onMouseDown={(e) => startClipDrag(e, clip, 'right')}
                          onTouchStart={(e) => startClipDrag(e, clip, 'right')}
                          className={`absolute right-0 top-0 bottom-0 w-3.5 bg-black/50 hover:bg-cyan-500 rounded-r-md cursor-ew-resize flex items-center justify-center transition-all z-20 ${isSelected ? 'opacity-90' : 'opacity-0 group-hover:opacity-100'}`}
                          title="Drag to adjust end time (ew-resize)"
                        >
                          <div className="w-0.5 h-3.5 bg-white/90 rounded-full" />
                        </div>

                        {/* Real-time microsecond alignment tooltip badge when dragging */}
                        {draggingClips && draggingClips.clips.some(c => c.id === clip.id) && (
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-950 text-amber-300 border border-amber-500/60 px-2 py-0.5 rounded text-[9px] font-mono font-bold shadow-xl z-50 whitespace-nowrap pointer-events-none">
                            Start: {clip.start.toFixed(2)}s | Len: {clip.duration.toFixed(2)}s | End: {(clip.start + clip.duration).toFixed(2)}s
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Marquee Rubberband Selection Box */}
            {marquee && marquee.isSelecting && (
              <div
                className="absolute bg-cyan-500/20 border-2 border-cyan-400 border-dashed rounded-lg shadow-lg pointer-events-none z-40"
                style={{
                  left: `${Math.min(marquee.startX, marquee.currentX)}px`,
                  top: `${Math.min(marquee.startY, marquee.currentY)}px`,
                  width: `${Math.abs(marquee.currentX - marquee.startX)}px`,
                  height: `${Math.abs(marquee.currentY - marquee.startY)}px`,
                }}
              >
                {(marquee.activeCount ?? 0) > 0 && (
                  <div className="absolute -top-7 left-2 bg-[#121218]/95 text-cyan-300 border border-cyan-500/60 px-2 py-0.5 rounded text-[10px] font-mono font-bold shadow-xl whitespace-nowrap flex items-center gap-1.5 backdrop-blur-md">
                    <BoxSelect className="w-3 h-3 text-cyan-400 animate-pulse" />
                    <span>{marquee.activeCount} {marquee.activeCount === 1 ? 'clip' : 'clips'} selected</span>
                  </div>
                )}
              </div>
            )}

            {/* Playhead vertical red line */}
            <div
              id="timeline-playhead"
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none"
              style={{ left: `${currentTime * zoom}px` }}
            >
              {/* Playhead head icon */}
              <div className="w-3 h-3 bg-red-500 rounded-b-sm absolute -top-1.5 -left-1.5 transform rotate-45" />
            </div>

          </div>

        </div>
      </div>

      {/* Floating Multi-Selection Action Bar (When 2 or more clips are selected) */}
      {activeSelectedIds.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 bg-[#161622]/95 backdrop-blur-xl border border-amber-500/40 rounded-full px-4 py-1.5 shadow-2xl flex items-center gap-3 text-xs text-gray-200 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-1.5 font-semibold text-amber-300">
            <CheckCheck className="w-4 h-4 text-amber-400" />
            <span>{selectedCounts.total} Clips Selected</span>
          </div>

          <div className="h-3.5 w-px bg-white/10" />

          {/* Breakdown tags */}
          <div className="flex items-center gap-1 text-[10px] font-mono">
            {selectedCounts.text > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-500/30">
                {selectedCounts.text} Text
              </span>
            )}
            {selectedCounts.audio > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-teal-950/80 text-teal-300 border border-teal-500/30">
                {selectedCounts.audio} Audio
              </span>
            )}
            {selectedCounts.video > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                {selectedCounts.video} Video
              </span>
            )}
            {selectedCounts.image > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                {selectedCounts.image} Image
              </span>
            )}
          </div>

          <div className="h-3.5 w-px bg-white/10" />

          {/* Actions */}
          <div className="flex items-center gap-1">
            {onSplitClip && (
              <button
                onClick={onSplitClip}
                className="px-2 py-0.5 rounded bg-[#252538] hover:bg-[#303046] text-cyan-300 hover:text-cyan-200 transition text-[11px] flex items-center gap-1"
                title="Split Selected Clips at Playhead"
              >
                <Scissors className="w-3 h-3" />
                <span>Split All</span>
              </button>
            )}

            <button
              onClick={() => {
                if (onDeleteSelectedClips) {
                  onDeleteSelectedClips();
                } else if (selectedClipId) {
                  onDeleteClip(selectedClipId);
                }
              }}
              className="px-2 py-0.5 rounded bg-red-950/60 hover:bg-red-900/80 text-red-300 hover:text-red-200 transition text-[11px] flex items-center gap-1 border border-red-500/30"
              title="Delete all selected clips (Del)"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>

            <button
              onClick={handleClearSelection}
              className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-gray-200 transition ml-1"
              title="Deselect All (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Right-Click Context Menu */}
      {contextMenu.isOpen && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 bg-[#161620]/95 backdrop-blur-xl border border-[#2d2d3e] rounded-xl shadow-2xl py-1.5 min-w-[220px] text-gray-200 text-xs animate-in fade-in zoom-in-95 duration-100 divide-y divide-[#222230]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header context info */}
          <div className="px-3 py-1.5 flex items-center justify-between text-[10px] text-gray-400 font-mono">
            <span>{contextMenu.clip ? contextMenu.clip.name : 'Timeline Canvas'}</span>
            {contextMenu.seekTime !== undefined && (
              <span>{formatTimeCode(contextMenu.seekTime, false)}</span>
            )}
          </div>

          {/* Clip Actions (When right-clicked on clip) */}
          {contextMenu.clip && (
            <div className="py-1">
              {/* Split at Playhead */}
              <button
                type="button"
                onClick={() => {
                  onSplitClip();
                  setContextMenu(prev => ({ ...prev, isOpen: false }));
                }}
                className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-cyan-500 hover:text-black transition"
              >
                <div className="flex items-center gap-2">
                  <Scissors className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Split at Playhead</span>
                </div>
                <span className="text-[10px] opacity-60 font-mono">Ctrl+B</span>
              </button>

              {/* Duplicate */}
              {onDuplicateClip && (
                <button
                  type="button"
                  onClick={() => {
                    onDuplicateClip();
                    setContextMenu(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-purple-500 hover:text-white transition"
                >
                  <div className="flex items-center gap-2">
                    <Copy className="w-3.5 h-3.5 text-purple-400" />
                    <span>Duplicate Clip</span>
                  </div>
                  <span className="text-[10px] opacity-60 font-mono">Ctrl+D</span>
                </button>
              )}

              {/* Ripple Delete Left (Q) */}
              <button
                type="button"
                onClick={() => {
                  onRippleDelete('left');
                  setContextMenu(prev => ({ ...prev, isOpen: false }));
                }}
                className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-amber-500 hover:text-black transition"
              >
                <div className="flex items-center gap-2">
                  <SquareSlash className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ripple Trim Left</span>
                </div>
                <span className="text-[10px] opacity-60 font-mono">Q</span>
              </button>

              {/* Ripple Delete Right (W) */}
              <button
                type="button"
                onClick={() => {
                  onRippleDelete('right');
                  setContextMenu(prev => ({ ...prev, isOpen: false }));
                }}
                className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-amber-500 hover:text-black transition"
              >
                <div className="flex items-center gap-2">
                  <SquareSlash className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ripple Trim Right</span>
                </div>
                <span className="text-[10px] opacity-60 font-mono">W</span>
              </button>
            </div>
          )}

          {/* Clip Specialized Operations: Speed, Freeze, Extract Audio, Mute */}
          {contextMenu.clip && (
            <div className="py-1">
              {/* Extract Audio (for video clips) */}
              {contextMenu.clip.type === ClipType.VIDEO && onExtractAudio && (
                <button
                  type="button"
                  onClick={() => {
                    onExtractAudio();
                    setContextMenu(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-teal-500 hover:text-black transition"
                >
                  <Music className="w-3.5 h-3.5 text-teal-400" />
                  <span>Extract Audio to Track</span>
                </button>
              )}

              {/* Freeze Frame (for video clips) */}
              {contextMenu.clip.type === ClipType.VIDEO && onFreezeFrame && (
                <button
                  type="button"
                  onClick={() => {
                    onFreezeFrame();
                    setContextMenu(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-sky-500 hover:text-black transition"
                >
                  <Snowflake className="w-3.5 h-3.5 text-sky-400" />
                  <span>Freeze Frame (3.0s)</span>
                </button>
              )}

              {/* Toggle Audio Volume / Mute */}
              {contextMenu.clip.type === ClipType.AUDIO && onUpdateClip && (
                <button
                  type="button"
                  onClick={() => {
                    const isMuted = contextMenu.clip!.volume === 0;
                    onUpdateClip(contextMenu.clip!.id, { volume: isMuted ? 80 : 0 });
                    setContextMenu(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-gray-700 transition"
                >
                  <div className="flex items-center gap-2">
                    {contextMenu.clip.volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-teal-400" />}
                    <span>{contextMenu.clip.volume === 0 ? 'Unmute Audio Clip' : 'Mute Audio Clip'}</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-70">
                    {contextMenu.clip.volume === 0 ? '0%' : `${contextMenu.clip.volume || 80}%`}
                  </span>
                </button>
              )}

              {/* Auto-Segment Audio / Video Context Actions */}
              {contextMenu.clip.type === ClipType.AUDIO && onAutoSegmentAudio && (
                <button
                  type="button"
                  onClick={() => {
                    onAutoSegmentAudio(contextMenu.clip!.id);
                    setContextMenu(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-emerald-600 hover:text-white text-emerald-300 transition"
                >
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Auto-Segment Audio by Speech Pauses</span>
                </button>
              )}

              {contextMenu.clip.type === ClipType.AUDIO && onAutoRemoveSilence && (
                <button
                  type="button"
                  onClick={() => {
                    onAutoRemoveSilence(contextMenu.clip!.id);
                    setContextMenu(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-amber-600 hover:text-white text-amber-300 transition"
                >
                  <Scissors className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto-Trim Dead Air Silences</span>
                </button>
              )}

              {contextMenu.clip.type === ClipType.VIDEO && onAutoSyncVideoToAyahs && (
                <button
                  type="button"
                  onClick={() => {
                    onAutoSyncVideoToAyahs();
                    setContextMenu(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-cyan-600 hover:text-white text-cyan-300 transition"
                >
                  <Film className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Auto-Segment Video to Ayah Timings</span>
                </button>
              )}

              {/* Playback Speed Quick Submenu */}
              {onSetClipSpeed && (
                <div className="px-3 py-1.5 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                    <Gauge className="w-3 h-3 text-cyan-400" />
                    <span>Speed:</span>
                  </span>
                  <div className="flex items-center gap-1">
                    {[0.5, 1.0, 1.5, 2.0].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => {
                          onSetClipSpeed(spd);
                          setContextMenu(prev => ({ ...prev, isOpen: false }));
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                          contextMenu.clip?.playbackRate === spd
                            ? 'bg-cyan-500 text-black font-bold'
                            : 'bg-[#222232] hover:bg-[#2e2e44] text-gray-300'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Track & Canvas Level Actions */}
          <div className="py-1">
            {/* Move Playhead Here */}
            {contextMenu.seekTime !== undefined && (
              <button
                type="button"
                onClick={() => {
                  if (contextMenu.seekTime !== undefined) onSeek(contextMenu.seekTime);
                  setContextMenu(prev => ({ ...prev, isOpen: false }));
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-gray-700 transition text-gray-300 hover:text-white"
              >
                <FastForward className="w-3.5 h-3.5 text-cyan-400" />
                <span>Move Playhead to This Point</span>
              </button>
            )}

            {/* Select All on Track */}
            {contextMenu.track && onSelectClips && (
              <button
                type="button"
                onClick={() => {
                  const ids = contextMenu.track!.clips.map(c => c.id);
                  onSelectClips(ids);
                  setContextMenu(prev => ({ ...prev, isOpen: false }));
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-gray-700 transition text-gray-300 hover:text-white"
              >
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>Select All on This Track</span>
              </button>
            )}

            {/* Select All in Timeline */}
            {onSelectClips && (
              <button
                type="button"
                onClick={() => {
                  const allIds = tracks.flatMap(t => t.clips.map(c => c.id));
                  onSelectClips(allIds);
                  setContextMenu(prev => ({ ...prev, isOpen: false }));
                }}
                className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-gray-700 transition text-gray-300 hover:text-white"
              >
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                  <span>Select All Clips</span>
                </div>
                <span className="text-[10px] opacity-60 font-mono">Ctrl+A</span>
              </button>
            )}

            {/* Deselect All */}
            {activeSelectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onSelectClip(null);
                  setContextMenu(prev => ({ ...prev, isOpen: false }));
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-gray-700 transition text-gray-400 hover:text-gray-200"
              >
                <MousePointer className="w-3.5 h-3.5" />
                <span>Deselect All</span>
              </button>
            )}
          </div>

          {/* Add Track Submenu */}
          {onAddTrack && (
            <div className="py-1">
              <div className="px-3 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                + Add Track
              </div>
              <div className="grid grid-cols-2 gap-1 px-2">
                {[ClipType.VIDEO, ClipType.AUDIO, ClipType.TEXT, ClipType.EFFECT].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      onAddTrack(t);
                      setContextMenu(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="px-2 py-1 text-left text-[10px] font-semibold bg-[#20202e] hover:bg-cyan-500 hover:text-black rounded text-gray-300 uppercase transition"
                  >
                    + {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Delete Action (at bottom of menu) */}
          {contextMenu.clip && (
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  if (activeSelectedIds.length > 1 && onDeleteSelectedClips) {
                    onDeleteSelectedClips();
                  } else {
                    onDeleteClip(contextMenu.clip!.id);
                  }
                  setContextMenu(prev => ({ ...prev, isOpen: false }));
                }}
                className="w-full px-3 py-1.5 text-left flex items-center justify-between text-red-400 hover:bg-red-600 hover:text-white transition font-semibold"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {activeSelectedIds.length > 1
                      ? `Delete ${activeSelectedIds.length} Selected Clips`
                      : 'Delete Clip'}
                  </span>
                </div>
                <span className="text-[10px] opacity-70 font-mono">Del</span>
              </button>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
