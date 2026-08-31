import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Scissors, Trash2, ZoomIn, ZoomOut, Layers, SquareSlash, Undo2, Redo2,
  Copy, Snowflake, Volume2, VolumeX, Lock, Unlock, Eye, EyeOff, Plus, Minus,
  Magnet, Gauge, Music, Maximize2, Sparkles, Smartphone, Monitor, Square,
  MousePointer, MousePointer2, CheckSquare, FastForward, Film, Check, ExternalLink, ChevronRight,
  Zap, Split, Radio, ChevronDown, Flag, UserCheck, Mic, Link, Link2, Crosshair, Repeat, Grid,
  Image as ImageIcon, Type as TypeIcon, BoxSelect, CheckCheck, X, Merge,
  GripHorizontal, Move, LocateFixed, AlertTriangle, CheckCircle2, Wand2, FileText, BookOpen,
  Cpu, Activity
} from 'lucide-react';
import { Track, Clip, ClipType } from '../types';
import { formatTimeCode, extractAyahNumberFromClip } from '../utils/editorUtils';
import { getSystemSpecs, PerformanceTier } from '../utils/systemPerformance';
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
  onMergeClips?: () => void;
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
  snapToGrid?: boolean;
  onToggleSnapToGrid?: () => void;

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
  onAddClip?: (clip: Partial<Clip>) => void;

  // Auto-Segmentation Suite
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
  onMergeClips,
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
  onAddClip,
  onAutoSegmentAudio,
  onAutoSyncVideoToAyahs,
  onAutoRemoveSilence,
  onAutoSegmentRhythm,
  snapToGrid: propSnapToGrid = true,
  onToggleSnapToGrid,
}: TimelineProps) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const tracksContainerRef = useRef<HTMLDivElement>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const headersScrollRef = useRef<HTMLDivElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  // Live Timeline Microphone Voiceover Recorder State
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
        throw new Error('Microphone recording is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      micChunksRef.current = [];

      // Determine best supported MIME type
      let recorderOptions: MediaRecorderOptions = {};
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          recorderOptions = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          recorderOptions = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          recorderOptions = { mimeType: 'audio/mp4' };
        }
      }

      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          micChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(micChunksRef.current, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        const recordDuration = Math.max(1, micRecordingTime);

        if (onAddClip) {
          onAddClip({
            name: `Voiceover Recording (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})`,
            type: ClipType.AUDIO,
            url: audioUrl,
            start: currentTime,
            duration: recordDuration,
            sourceStart: 0,
            sourceDuration: recordDuration,
            playbackRate: 1.0,
            volume: 1.0,
          });
        }

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
      console.error('Mic recording error on Timeline toolbar:', err);
      let msg = err.message || 'Microphone access denied or unreadable.';
      if (err.name === 'NotAllowedError' || msg.toLowerCase().includes('permission denied')) {
        msg = 'Microphone permission blocked. Please allow mic access in browser settings or open in a new tab.';
      }
      setMicError(msg);
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
  const [snapToGrid, setSnapToGrid] = useState(propSnapToGrid);

  useEffect(() => {
    if (propSnapToGrid !== undefined) {
      setSnapToGrid(propSnapToGrid);
    }
  }, [propSnapToGrid]);

  const snapToGridRef = useRef(snapToGrid);
  snapToGridRef.current = snapToGrid;
  const [timelineTool, setTimelineTool] = useState<'pointer' | 'marquee' | 'split'>('pointer');
  const [showToolDropdown, setShowToolDropdown] = useState(false);

  const canMerge = useMemo(() => {
    const activeIds = selectedClipIds.length > 0 ? selectedClipIds : (selectedClipId ? [selectedClipId] : []);
    if (activeIds.length < 2) return false;
    for (const track of tracks) {
      const selectedTrackClips = track.clips.filter(c => activeIds.includes(c.id));
      if (selectedTrackClips.length >= 2) {
        const sortedAllClips = [...track.clips].sort((a, b) => a.start - b.start);
        const selectedIndices = selectedTrackClips
          .map(c => sortedAllClips.findIndex(sc => sc.id === c.id))
          .filter(idx => idx !== -1)
          .sort((a, b) => a - b);

        if (selectedIndices.length >= 2) {
          const minIdx = selectedIndices[0];
          const maxIdx = selectedIndices[selectedIndices.length - 1];
          if (maxIdx - minIdx === selectedIndices.length - 1) {
            return true;
          }
        }
      }
    }
    return false;
  }, [tracks, selectedClipIds, selectedClipId]);
  const [showSelectMenu, setShowSelectMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showAddTrackMenu, setShowAddTrackMenu] = useState(false);
  const [showAutoSegmentMenu, setShowAutoSegmentMenu] = useState(false);
  const [showSilenceGuide, setShowSilenceGuide] = useState(true);
  const [followPlayheadMode, setFollowPlayheadMode] = useState<'page' | 'smooth' | 'off'>('page');
  const lastAutoScrollRef = useRef<number>(0);

  // Hardware System Performance Spec & Virtualization Engine
  const systemSpecs = useMemo(() => getSystemSpecs(), []);
  const [perfMode, setPerfMode] = useState<'auto' | PerformanceTier>('auto');
  const [showPerfMenu, setShowPerfMenu] = useState(false);
  const activePerfTier = perfMode === 'auto' ? systemSpecs.tier : perfMode;

  // Viewport Scroll Virtualization Tracking (DOM Windowing for 60 FPS)
  const [viewportScrollLeft, setViewportScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(1200);

  useEffect(() => {
    const el = tracksContainerRef.current;
    if (!el) return;

    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        setViewportScrollLeft(el.scrollLeft);
        rafId = null;
      });
    };

    const updateWidth = () => {
      if (el) setViewportWidth(el.clientWidth || 1200);
    };

    updateWidth();
    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateWidth);

    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateWidth);
      ro.disconnect();
    };
  }, []);

  // Visible timeline time window for off-screen clip virtualization
  const { visibleStartTime, visibleEndTime } = useMemo(() => {
    const marginPx = activePerfTier === 'power_saver' ? 200 : 400;
    const start = Math.max(0, (viewportScrollLeft - marginPx) / zoom);
    const end = (viewportScrollLeft + viewportWidth + marginPx) / zoom;
    return { visibleStartTime: start, visibleEndTime: end };
  }, [viewportScrollLeft, viewportWidth, zoom, activePerfTier]);

  // Multi-Selection Marquee (Rubberband Box Selection)
  const [marquee, setMarquee] = useState<MarqueeBox | null>(null);

  // Timeline Time Snapping & Vertical Guide Line State
  const [timelineSnapInfo, setTimelineSnapInfo] = useState<{
    time: number;
    label: string;
    type: 'playhead' | 'clip-edge' | 'zero';
  } | null>(null);

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
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const isSnappingRef = useRef(isSnapping);
  isSnappingRef.current = isSnapping;
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
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Auto-scroll timeline when video is playing so playhead stays in view without glitching or freezing
  useEffect(() => {
    if (!isPlaying || followPlayheadMode === 'off') return;
    const container = tracksContainerRef.current;
    if (!container) return;

    // Do not auto-scroll if user is actively dragging or marquee-selecting
    if (draggingClipsRef.current || isScrubbingRef.current || marqueeRef.current) return;

    const playheadX = currentTime * zoom;
    const scrollLeft = container.scrollLeft;
    const clientWidth = container.clientWidth;
    const rightThreshold = scrollLeft + clientWidth - 70;
    const leftThreshold = scrollLeft - 10;
    const now = Date.now();

    // Check if playhead moved beyond visible timeline window
    if (playheadX > rightThreshold || (playheadX < leftThreshold && currentTime < 0.6)) {
      if (followPlayheadMode === 'page') {
        // Cooldown between page scrolls to eliminate browser layout thrashing and jitter
        if (now - lastAutoScrollRef.current < 450) return;
        lastAutoScrollRef.current = now;

        const targetLeft = playheadX < leftThreshold 
          ? 0 
          : Math.max(0, playheadX - Math.floor(clientWidth * 0.18));
        
        container.scrollLeft = targetLeft;
      } else if (followPlayheadMode === 'smooth') {
        // Debounce smooth scroll so competing smooth animations never stutter the UI
        if (now - lastAutoScrollRef.current < 650) return;
        lastAutoScrollRef.current = now;

        container.scrollTo({
          left: Math.max(0, playheadX - Math.floor(clientWidth * 0.25)),
          behavior: 'smooth'
        });
      }
    }
  }, [currentTime, isPlaying, zoom, followPlayheadMode]);

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

  // Calculate multi-selection bounding box encompassing all selected clips
  const multiSelectionBounds = useMemo(() => {
    if (selectedClipsList.length <= 1) return null;

    let minTime = Infinity;
    let maxTime = -Infinity;
    const trackIndices: number[] = [];

    sortedTracks.forEach((track, trkIdx) => {
      let trackHasSelected = false;
      track.clips.forEach(clip => {
        if (activeSelectedIds.includes(clip.id)) {
          minTime = Math.min(minTime, clip.start);
          maxTime = Math.max(maxTime, clip.start + clip.duration);
          trackHasSelected = true;
        }
      });
      if (trackHasSelected) {
        trackIndices.push(trkIdx);
      }
    });

    if (minTime === Infinity || maxTime === -Infinity || trackIndices.length === 0) {
      return null;
    }

    const minTrackIdx = Math.min(...trackIndices);
    const maxTrackIdx = Math.max(...trackIndices);

    const left = minTime * zoom;
    const width = Math.max(24, (maxTime - minTime) * zoom);
    // Track row height = 56px, gap = 8px, padding top = 6px
    const top = 6 + minTrackIdx * 64;
    const height = (maxTrackIdx - minTrackIdx) * 64 + 56;

    return {
      minTime,
      maxTime,
      duration: maxTime - minTime,
      left,
      width,
      top,
      height,
      clipCount: selectedClipsList.length,
      trackCount: trackIndices.length,
    };
  }, [selectedClipsList, sortedTracks, activeSelectedIds, zoom]);

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
      setShowAutoSegmentMenu(false);
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

    let autoScrollRaf: number | null = null;
    let latestClientX = 0;
    let latestClientY = 0;

    // Edge Auto-Scroll function when dragging near viewport boundaries
    const checkEdgeAutoScroll = () => {
      const container = tracksContainerRef.current;
      if (!container || (!draggingClipsRef.current && (!marqueeRef.current || !marqueeRef.current.isSelecting))) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const edgeMargin = 60;
      let scrollSpeed = 0;

      if (latestClientX > rect.right - edgeMargin && latestClientX <= rect.right + 200) {
        const factor = Math.min(1, Math.max(0.2, (latestClientX - (rect.right - edgeMargin)) / edgeMargin));
        scrollSpeed = 16 * factor;
      } else if (latestClientX < rect.left + edgeMargin && latestClientX >= rect.left - 200) {
        const factor = Math.min(1, Math.max(0.2, ((rect.left + edgeMargin) - latestClientX) / edgeMargin));
        scrollSpeed = -16 * factor;
      }

      if (scrollSpeed !== 0) {
        container.scrollLeft += scrollSpeed;

        // If in marquee mode, update coordinates as container scrolls
        if (marqueeRef.current && marqueeRef.current.isSelecting && gridWrapperRef.current) {
          const gridRect = gridWrapperRef.current.getBoundingClientRect();
          const currentX = latestClientX - gridRect.left + container.scrollLeft;
          const currentY = latestClientY - gridRect.top;

          const boxLeft = Math.min(marqueeRef.current.startX, currentX);
          const boxRight = Math.max(marqueeRef.current.startX, currentX);
          const boxTop = Math.min(marqueeRef.current.startY, currentY);
          const boxBottom = Math.max(marqueeRef.current.startY, currentY);

          const intersectedIds = getIntersectedClipIds(boxLeft, boxRight, boxTop, boxBottom);
          setMarquee(prev => prev ? { ...prev, currentX, currentY, activeCount: intersectedIds.length } : null);
        }
      }

      autoScrollRaf = requestAnimationFrame(checkEdgeAutoScroll);
    };

    autoScrollRaf = requestAnimationFrame(checkEdgeAutoScroll);

    const handleMove = (clientX: number, clientY: number) => {
      latestClientX = clientX;
      latestClientY = clientY;

      if (isScrubbingRef.current) {
        handleScrub(clientX);
      } else if (draggingClipsRef.current) {
        const activeDragging = draggingClipsRef.current;
        const currentZoom = zoomRef.current;
        const deltaX = clientX - activeDragging.dragStartPos;
        const deltaTime = deltaX / currentZoom;
        const draggingClipIds = activeDragging.clips.map((c) => c.id);

        // Time Matrix Magnetism Snap Calculator
        const calculateTimeSnap = (
          candidateTime: number
        ): { snappedTime: number; snapInfo: { time: number; label: string; type: 'playhead' | 'clip-edge' | 'zero' } | null } => {
          // Threshold of 0.1s or 8px
          const threshold = Math.max(0.1, 8 / currentZoom);
          let bestDist = threshold;
          let bestTime = candidateTime;
          let bestSnapInfo: { time: number; label: string; type: 'playhead' | 'clip-edge' | 'zero' } | null = null;

          // 1. Playhead Snap
          const playheadDist = Math.abs(candidateTime - currentTimeRef.current);
          if (playheadDist <= bestDist) {
            bestDist = playheadDist;
            bestTime = currentTimeRef.current;
            bestSnapInfo = {
              time: currentTimeRef.current,
              label: `Playhead (${currentTimeRef.current.toFixed(2)}s)`,
              type: 'playhead',
            };
          }

          // 2. Timeline Start Snap (0.00s)
          const zeroDist = Math.abs(candidateTime - 0);
          if (zeroDist <= bestDist) {
            bestDist = zeroDist;
            bestTime = 0;
            bestSnapInfo = {
              time: 0,
              label: 'Start (0.00s)',
              type: 'zero',
            };
          }

          // 3. Adjacent Clip Boundaries across all tracks
          for (const trk of tracksRef.current) {
            for (const clp of trk.clips) {
              if (draggingClipIds.includes(clp.id)) continue;

              // Start edge of adjacent clip
              const startDist = Math.abs(candidateTime - clp.start);
              if (startDist <= bestDist) {
                bestDist = startDist;
                bestTime = clp.start;
                bestSnapInfo = {
                  time: clp.start,
                  label: `${clp.name || 'Clip'} Start (${clp.start.toFixed(2)}s)`,
                  type: 'clip-edge',
                };
              }

              // End edge of adjacent clip
              const clipEnd = clp.start + clp.duration;
              const endDist = Math.abs(candidateTime - clipEnd);
              if (endDist <= bestDist) {
                bestDist = endDist;
                bestTime = clipEnd;
                bestSnapInfo = {
                  time: clipEnd,
                  label: `${clp.name || 'Clip'} End (${clipEnd.toFixed(2)}s)`,
                  type: 'clip-edge',
                };
              }
            }
          }

          return { snappedTime: bestTime, snapInfo: bestSnapInfo };
        };

        if (activeDragging.handle === 'left') {
          // Trimming Left Handle with Time Matrix Magnetism
          const primaryItem = activeDragging.clips.find((c) => c.id === activeDragging.primaryId) || activeDragging.clips[0];
          const rawPrimaryStart = primaryItem.initialStart + deltaTime;
          const { snappedTime, snapInfo } = calculateTimeSnap(rawPrimaryStart);
          setTimelineSnapInfo(snapInfo);

          const effectiveDelta = snapInfo ? snappedTime - primaryItem.initialStart : deltaTime;

          const updates = activeDragging.clips.map(item => {
            const rawStart = item.initialStart + effectiveDelta;
            const boundedStart = Math.max(0, Math.min(item.initialStart + item.initialDuration - 0.2, rawStart));
            const finalStart = snapToGridRef.current && !snapInfo ? Math.round(boundedStart * 30) / 30 : boundedStart;
            const newDuration = (item.initialStart + item.initialDuration) - finalStart;
            return {
              id: item.id,
              start: finalStart,
              duration: Math.max(0.033, snapToGridRef.current && !snapInfo ? Math.round(newDuration * 30) / 30 : newDuration),
            };
          });

          if (onBatchUpdateClipTimesRef.current) {
            onBatchUpdateClipTimesRef.current(updates);
          } else if (onUpdateClipTimesRef.current) {
            updates.forEach(u => onUpdateClipTimesRef.current?.(u.id, u.start, u.duration));
          }
        } else if (activeDragging.handle === 'right') {
          // Trimming Right Handle with Time Matrix Magnetism
          const primaryItem = activeDragging.clips.find((c) => c.id === activeDragging.primaryId) || activeDragging.clips[0];
          const rawPrimaryEnd = primaryItem.initialStart + primaryItem.initialDuration + deltaTime;
          const { snappedTime, snapInfo } = calculateTimeSnap(rawPrimaryEnd);
          setTimelineSnapInfo(snapInfo);

          const effectiveDelta = snapInfo ? snappedTime - (primaryItem.initialStart + primaryItem.initialDuration) : deltaTime;

          const updates = activeDragging.clips.map(item => {
            const rawEnd = item.initialStart + item.initialDuration + effectiveDelta;
            const rawDuration = rawEnd - item.initialStart;
            const boundedDuration = Math.max(0.033, Math.min(durationRef.current - item.initialStart, rawDuration));
            const finalDuration = snapToGridRef.current && !snapInfo ? Math.round(boundedDuration * 30) / 30 : boundedDuration;
            return {
              id: item.id,
              start: item.initialStart,
              duration: finalDuration,
            };
          });

          if (onBatchUpdateClipTimesRef.current) {
            onBatchUpdateClipTimesRef.current(updates);
          } else if (onUpdateClipTimesRef.current) {
            updates.forEach(u => onUpdateClipTimesRef.current?.(u.id, u.start, u.duration));
          }
        } else {
          // Dragging Clip Node horizontally with Time Matrix Magnetism
          const primaryItem = activeDragging.clips.find((c) => c.id === activeDragging.primaryId) || activeDragging.clips[0];
          const minInitialStart = Math.min(...activeDragging.clips.map(c => c.initialStart));
          const maxDeltaLeft = -minInitialStart;
          let effectiveDelta = Math.max(maxDeltaLeft, deltaTime);

          const candidateStart = primaryItem.initialStart + effectiveDelta;
          const candidateEnd = candidateStart + primaryItem.initialDuration;

          const snapStart = calculateTimeSnap(candidateStart);
          const snapEnd = calculateTimeSnap(candidateEnd);

          if (snapStart.snapInfo) {
            effectiveDelta = snapStart.snappedTime - primaryItem.initialStart;
            setTimelineSnapInfo(snapStart.snapInfo);
          } else if (snapEnd.snapInfo) {
            effectiveDelta = snapEnd.snappedTime - (primaryItem.initialStart + primaryItem.initialDuration);
            setTimelineSnapInfo(snapEnd.snapInfo);
          } else {
            setTimelineSnapInfo(null);
          }

          const updates = activeDragging.clips.map(item => {
            let targetStart = Math.max(0, item.initialStart + effectiveDelta);
            if (snapToGridRef.current && !snapStart.snapInfo && !snapEnd.snapInfo) {
              targetStart = Math.round(targetStart * 30) / 30; // 1/30s frame boundary precision
            }
            return {
              id: item.id,
              start: targetStart,
              duration: item.initialDuration,
            };
          });

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
        setTimelineSnapInfo(null);
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
      if (autoScrollRaf) {
        cancelAnimationFrame(autoScrollRaf);
      }
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

  // Start group dragging of all selected clips from the multi-selection drag-handle
  const startGroupDrag = (e: React.MouseEvent | React.TouchEvent) => {
    // Only respond to primary mouse button if mouse event
    if ('button' in e && (e as React.MouseEvent).button !== 0) return;

    e.stopPropagation();
    e.preventDefault();

    // Jump playhead slider immediately to clicked position
    if (tracksContainerRef.current) {
      const rect = tracksContainerRef.current.getBoundingClientRect();
      const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const x = clientX - rect.left + tracksContainerRef.current.scrollLeft;
      const clickTime = Math.max(0, Math.min(duration, x / zoom));
      onSeek(clickTime);
    }

    const clipsToMove: DraggingClipItem[] = [];
    tracksRef.current.forEach(track => {
      if (track.locked) return;
      track.clips.forEach(c => {
        if (activeSelectedIdsRef.current.includes(c.id)) {
          clipsToMove.push({
            id: c.id,
            initialStart: c.start,
            initialDuration: c.duration,
            trackId: track.id,
          });
        }
      });
    });

    if (clipsToMove.length === 0) return;

    const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;

    // Sort to make the leftmost clip the primary reference
    clipsToMove.sort((a, b) => a.initialStart - b.initialStart);

    setDraggingClips({
      primaryId: clipsToMove[0].id,
      dragStartPos: clientX,
      clips: clipsToMove,
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
      className="bg-[#121216] border border-[#202028] rounded-xl flex flex-col select-none relative overflow-hidden shadow-lg mx-1 mb-1"
      style={{ height: height !== undefined ? `${height}px` : undefined }}
    >
      
      {/* CapCut Pro Exact Timeline Toolbar */}
      <div className="h-10 border-b border-[#25252e] px-2 flex items-center justify-between bg-[#15151c] text-gray-300 text-xs select-none gap-2 shrink-0 relative z-30 overflow-visible">
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
                className="absolute top-full left-0 mt-1 bg-[#1a1a24] border border-[#2e2e3e] rounded-lg shadow-2xl py-1 w-44 z-[60] text-gray-200 text-xs animate-in fade-in zoom-in-95 duration-100 divide-y divide-[#262634]"
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

          {/* Auto-Segment Ayahs & Audio Menu */}
          {onAutoSegmentAudio && (
            <div className="relative">
              <button
                id="btn-toolbar-auto-segment"
                onClick={() => setShowAutoSegmentMenu(!showAutoSegmentMenu)}
                className={`p-1.5 rounded transition flex items-center gap-1 cursor-pointer ${
                  showAutoSegmentMenu
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                    : 'hover:bg-[#252532] text-amber-400'
                }`}
                title="Auto-Segment Quran Ayahs & Audio by Waqf / Pauses"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <ChevronDown className="w-2.5 h-2.5 opacity-70" />
              </button>

              {showAutoSegmentMenu && (
                <div
                  className="absolute top-full left-0 mt-1 z-50 bg-[#16161e] border border-amber-500/40 rounded-xl shadow-2xl p-2 w-64 text-xs space-y-1.5 backdrop-blur-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-1 border-b border-gray-800 px-1">
                    <span className="font-extrabold text-[10px] text-amber-400 tracking-wider uppercase flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Auto-Segment Ayahs
                    </span>
                    <button
                      onClick={() => setShowAutoSegmentMenu(false)}
                      className="text-gray-400 hover:text-white text-xs px-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onAutoSegmentAudio(selectedClipId || undefined, 'quran-ayah');
                      setShowAutoSegmentMenu(false);
                    }}
                    className="w-full text-left p-1.5 rounded-lg hover:bg-amber-500/20 text-gray-200 hover:text-amber-200 transition cursor-pointer flex items-center gap-2"
                  >
                    <span className="text-sm">🕌</span>
                    <div>
                      <p className="font-bold text-[11px] leading-tight">Quran Ayah (Standard Waqf)</p>
                      <p className="text-[9px] text-gray-400">480ms natural verse pause</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onAutoSegmentAudio(selectedClipId || undefined, 'tartil');
                      setShowAutoSegmentMenu(false);
                    }}
                    className="w-full text-left p-1.5 rounded-lg hover:bg-amber-500/20 text-gray-200 hover:text-amber-200 transition cursor-pointer flex items-center gap-2"
                  >
                    <span className="text-sm">📖</span>
                    <div>
                      <p className="font-bold text-[11px] leading-tight">Slow Tartil / Mujawwad</p>
                      <p className="text-[9px] text-gray-400">600ms long Madd & deep pause</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onAutoSegmentAudio(selectedClipId || undefined, 'hadr');
                      setShowAutoSegmentMenu(false);
                    }}
                    className="w-full text-left p-1.5 rounded-lg hover:bg-amber-500/20 text-gray-200 hover:text-amber-200 transition cursor-pointer flex items-center gap-2"
                  >
                    <span className="text-sm">⚡</span>
                    <div>
                      <p className="font-bold text-[11px] leading-tight">Fast Hadr Recitation</p>
                      <p className="text-[9px] text-gray-400">340ms quick pause detection</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onAutoSegmentAudio(selectedClipId || undefined, 'mosque');
                      setShowAutoSegmentMenu(false);
                    }}
                    className="w-full text-left p-1.5 rounded-lg hover:bg-amber-500/20 text-gray-200 hover:text-amber-200 transition cursor-pointer flex items-center gap-2"
                  >
                    <span className="text-sm">🏛️</span>
                    <div>
                      <p className="font-bold text-[11px] leading-tight">Mosque Reverb & Echo</p>
                      <p className="text-[9px] text-gray-400">Reverb ambient suppression</p>
                    </div>
                  </button>

                  {onAutoSegmentRhythm && (
                    <button
                      type="button"
                      onClick={() => {
                        onAutoSegmentRhythm(selectedClipId || undefined, 3.0);
                        setShowAutoSegmentMenu(false);
                      }}
                      className="w-full text-left p-1.5 rounded-lg hover:bg-cyan-500/20 text-gray-200 hover:text-cyan-200 transition cursor-pointer flex items-center gap-2 border-t border-gray-800/80 mt-1"
                    >
                      <span className="text-sm">✂️</span>
                      <div>
                        <p className="font-bold text-[11px] leading-tight">Fixed Rhythm Cut (3s)</p>
                        <p className="text-[9px] text-gray-400">Equal beat intervals</p>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Merge Selected Adjacent Clips (Ctrl + M) */}
          {onMergeClips && (
            <button
              id="btn-merge-clips"
              onClick={onMergeClips}
              disabled={!canMerge}
              className={`p-1.5 rounded transition ${canMerge ? 'hover:bg-purple-950/60 text-purple-400 bg-purple-950/20 border border-purple-500/30' : 'text-gray-600 cursor-not-allowed'}`}
              title="Merge Selected Adjacent Clips (Ctrl + M)"
            >
              <Merge className="w-3.5 h-3.5" />
            </button>
          )}

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
        </div>

        {/* Right Section: Voice, Magnet, Ripple, Link & Zoom Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Voice Record Mic Toolbar Control */}
          <div className="flex items-center gap-1 relative">
            {!isRecordingMic ? (
              <button
                id="btn-mic-recorder"
                onClick={startMicRecording}
                className="px-2 py-1 rounded hover:bg-[#252532] text-gray-200 hover:text-red-400 border border-[#333342] hover:border-red-500/50 transition flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
                title="Record Live Voiceover on Timeline (Click to Start)"
              >
                <Mic className="w-3.5 h-3.5 text-red-400" />
                <span>Voiceover</span>
              </button>
            ) : (
              <button
                id="btn-mic-recorder-stop"
                onClick={stopMicRecording}
                className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-red-950/90 border border-red-500 text-white font-mono text-[11px] font-bold transition shadow-lg animate-pulse cursor-pointer"
                title="Recording Voiceover Live... Click to Stop & Add to Timeline"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <Mic className="w-3.5 h-3.5 text-red-300 animate-bounce" />
                <span>REC {Math.floor(micRecordingTime / 60).toString().padStart(2, '0')}:{(micRecordingTime % 60).toString().padStart(2, '0')}</span>
                <span className="bg-red-600 hover:bg-red-500 text-white px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ml-1">STOP</span>
              </button>
            )}

            {micError && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-red-950/95 border border-red-500/80 rounded-lg p-2 shadow-2xl text-[11px] text-red-200 max-w-xs flex items-start gap-1.5">
                <span className="shrink-0">⚠️</span>
                <div className="flex-1 leading-snug">
                  {micError}
                </div>
                <button
                  onClick={() => setMicError(null)}
                  className="text-red-400 hover:text-white font-bold text-xs px-1 cursor-pointer"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

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

          {/* Snap-to-Grid (1/30s Frame Boundaries) Toggle */}
          <button
            id="btn-snap-grid-toggle"
            onClick={() => {
              if (onToggleSnapToGrid) {
                onToggleSnapToGrid();
              } else {
                setSnapToGrid(prev => !prev);
              }
            }}
            className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition flex items-center gap-1 ${
              snapToGrid
                ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-500/50 shadow-xs ring-1 ring-cyan-500/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#252532]'
            }`}
            title={`Snap to Frame Grid (1/30s): ${snapToGrid ? 'ENABLED (Restricts clip placement to 30 FPS frame boundaries to prevent AV desync)' : 'DISABLED'}`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[10px]">Grid (1/30s)</span>
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

          {/* Follow Playhead Mode Switcher (Page / Smooth / Off) */}
          <button
            id="btn-follow-playhead"
            onClick={() => {
              setFollowPlayheadMode(prev => {
                if (prev === 'page') return 'smooth';
                if (prev === 'smooth') return 'off';
                return 'page';
              });
            }}
            className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
              followPlayheadMode !== 'off'
                ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-500/50 shadow-xs'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#252532] border border-[#333342]'
            }`}
            title={`Follow Playhead: ${followPlayheadMode.toUpperCase()} (Click to toggle: Page -> Smooth -> Off)`}
          >
            <LocateFixed className={`w-3.5 h-3.5 ${followPlayheadMode !== 'off' ? 'text-cyan-400 animate-pulse' : 'text-gray-500'}`} />
            <span className="hidden sm:inline text-[10px]">
              {followPlayheadMode === 'page' ? 'Page Follow' : followPlayheadMode === 'smooth' ? 'Smooth' : 'Follow Off'}
            </span>
          </button>

          <div className="h-4 w-px bg-[#2a2a35] mx-0.5" />

          {/* System Specs & Hardware Performance Indicator Pill */}
          <div className="relative">
            <button
              onClick={() => setShowPerfMenu(!showPerfMenu)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition flex items-center gap-1 border shadow-xs cursor-pointer ${
                activePerfTier === 'ultra'
                  ? 'bg-purple-950/90 text-purple-200 border-purple-500/50 hover:bg-purple-900/90'
                  : activePerfTier === 'high'
                  ? 'bg-cyan-950/90 text-cyan-200 border-cyan-500/50 hover:bg-cyan-900/90'
                  : activePerfTier === 'balanced'
                  ? 'bg-amber-950/90 text-amber-200 border-amber-500/50 hover:bg-amber-900/90'
                  : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
              title="System Hardware Performance Specs & Timeline Optimization Settings"
            >
              <Cpu className="w-3 h-3 text-cyan-400" />
              <span className="hidden sm:inline">
                {activePerfTier === 'ultra' ? '⚡ Ultra (60 FPS)' : activePerfTier === 'high' ? '⚡ 60 FPS' : activePerfTier === 'balanced' ? '⚡ 45 FPS' : '⚡ Power Saver'}
              </span>
              <ChevronDown className="w-2.5 h-2.5 opacity-70" />
            </button>

            {showPerfMenu && (
              <div className="absolute top-full mt-1.5 right-0 bg-[#121218]/98 border border-[#2a2a38] rounded-xl shadow-2xl p-3 z-50 w-72 backdrop-blur-md text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
                  <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                    <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                    <span>Hardware Performance</span>
                  </div>
                  <button onClick={() => setShowPerfMenu(false)} className="text-gray-400 hover:text-white cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Specs Info */}
                <div className="bg-[#1a1a24] p-2 rounded-lg border border-white/5 space-y-1 mb-2.5 text-[10.5px]">
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-400">CPU Cores:</span>
                    <span className="font-mono font-bold text-white">{systemSpecs.cpuCores} Threads</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-400">RAM Memory:</span>
                    <span className="font-mono font-bold text-white">~{systemSpecs.deviceMemoryGb} GB</span>
                  </div>
                  <div className="flex justify-between text-gray-300 truncate">
                    <span className="text-gray-400 shrink-0">GPU Accel:</span>
                    <span className="font-mono font-bold text-cyan-300 truncate max-w-[130px]" title={systemSpecs.gpuRenderer}>
                      {systemSpecs.hasHardwareAcceleration ? 'WebGL Active' : 'Software'}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span className="text-gray-400">Timeline Mode:</span>
                    <span className="font-mono font-bold text-amber-300 uppercase">{activePerfTier}</span>
                  </div>
                </div>

                {/* Performance Tier Selectors */}
                <div className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">Performance Presets</div>
                <div className="space-y-1">
                  {[
                    { mode: 'auto', label: '🤖 Auto Hardware Detection', desc: 'Auto-adapts to your CPU/GPU specs' },
                    { mode: 'ultra', label: '🚀 Ultra Performance (60 FPS)', desc: 'Max visual quality for 8+ core PCs' },
                    { mode: 'high', label: '⚡ High FPS Mode (60 FPS)', desc: 'Optimized for fast smooth editing' },
                    { mode: 'balanced', label: '⚖️ Balanced Mode (45 FPS)', desc: 'Saves battery & CPU resources' },
                    { mode: 'power_saver', label: '🔋 Power Saver Mode (30 FPS)', desc: 'Smooth rendering on budget PCs' },
                  ].map((item) => (
                    <button
                      key={item.mode}
                      onClick={() => {
                        setPerfMode(item.mode as any);
                        setShowPerfMenu(false);
                      }}
                      className={`w-full text-left p-1.5 rounded-lg border transition flex flex-col cursor-pointer ${
                        perfMode === item.mode
                          ? 'bg-cyan-950/90 text-cyan-200 border-cyan-500'
                          : 'bg-[#181822] text-gray-300 border-[#2a2a35] hover:bg-[#20202e]'
                      }`}
                    >
                      <span className="font-bold text-[11px]">{item.label}</span>
                      <span className="text-[9.5px] text-gray-400">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

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
            {sortedTracks.length === 0 ? (
              <div className="h-24 border border-dashed border-[#2a2a35] rounded-lg flex flex-col items-center justify-center text-center p-2 text-gray-500 text-[10px]">
                <span>No tracks</span>
                <span className="text-[9px] text-gray-600 mt-0.5">Drop files to create</span>
              </div>
            ) : (
              sortedTracks.map((track, trackIdx) => (
                <div
                  key={track.id ? `${track.id}-${trackIdx}` : `track-${trackIdx}`}
                  onContextMenu={(e) => handleContextMenu(e, null, track)}
                  className={`h-20 min-h-[80px] border border-[#2a2a35] rounded-lg flex items-center justify-between px-2.5 bg-[#16161d] shadow-sm transition-all ${track.locked ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="p-1.5 rounded-md bg-[#20202d] text-cyan-400">
                      {getTrackIcon(track.type)}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-[11px] text-gray-200 font-semibold truncate max-w-[65px] sm:max-w-[85px]" title={track.name}>
                        {track.name}
                      </span>
                      <span className="text-[9px] text-gray-400 uppercase font-mono tracking-wider">
                        {track.type}
                      </span>
                    </div>
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
                        {track.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    {/* Lock Track */}
                    {onToggleTrackLock && (
                      <button
                        onClick={() => onToggleTrackLock(track.id)}
                        className={`p-1 rounded transition ${track.locked ? 'text-amber-400 bg-amber-950/50' : 'text-gray-500 hover:text-gray-300'}`}
                        title={track.locked ? 'Unlock Track' : 'Lock Track'}
                      >
                        {track.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    {/* Hide Track */}
                    {onToggleTrackHidden && (
                      <button
                        onClick={() => onToggleTrackHidden(track.id)}
                        className={`p-1 rounded transition ${track.hidden ? 'text-purple-400 bg-purple-950/50' : 'text-gray-500 hover:text-gray-300'}`}
                        title={track.hidden ? 'Show Track' : 'Hide Track'}
                      >
                        {track.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    {/* Delete Track */}
                    {onDeleteTrack && (
                      <button
                        onClick={() => onDeleteTrack(track.id)}
                        className="p-1 rounded text-gray-600 hover:text-red-400 transition"
                        title="Delete Track"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
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
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (!onAddClip) return;

              const rect = tracksContainerRef.current?.getBoundingClientRect();
              const scrollLeft = tracksContainerRef.current?.scrollLeft || 0;
              const dropX = rect ? e.clientX - rect.left + scrollLeft : 0;
              const dropTime = Math.max(0, Math.round((dropX / zoom) * 10) / 10);

              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                Array.from(e.dataTransfer.files).forEach((file: File) => {
                  const isVideo = file.type.startsWith('video/');
                  const isAudio = file.type.startsWith('audio/');
                  const isImage = file.type.startsWith('image/');
                  const url = URL.createObjectURL(file);
                  const clipType = isVideo ? ClipType.VIDEO : isAudio ? ClipType.AUDIO : isImage ? ClipType.IMAGE : ClipType.VIDEO;

                  if (isVideo || isAudio) {
                    const tempEl = document.createElement(isVideo ? 'video' : 'audio');
                    tempEl.src = url;
                    tempEl.onloadedmetadata = () => {
                      const dur = tempEl.duration || 10;
                      onAddClip({
                        name: file.name,
                        type: clipType,
                        url,
                        start: dropTime,
                        duration: dur,
                        sourceDuration: dur,
                      });
                    };
                  } else {
                    onAddClip({
                      name: file.name,
                      type: clipType,
                      url,
                      start: dropTime,
                      duration: 5,
                    });
                  }
                });
                return;
              }

              const rawData = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
              if (rawData) {
                try {
                  const asset = JSON.parse(rawData);
                  if (asset.url) {
                    const isVideo = asset.type === 'video' || asset.url.endsWith('.mp4');
                    const isAudio = asset.type === 'audio' || asset.url.endsWith('.mp3');
                    const isImage = asset.type === 'image';
                    const clipType = isVideo ? ClipType.VIDEO : isAudio ? ClipType.AUDIO : isImage ? ClipType.IMAGE : ClipType.VIDEO;

                    onAddClip({
                      name: asset.title || asset.name || 'Media Clip',
                      type: clipType,
                      url: asset.url,
                      start: dropTime,
                      duration: asset.duration || 5,
                    });
                  }
                } catch {}
              }
            }}
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
              {/* Clean Ruler without top overlays */}
            </div>

            {/* Visual Grid rows */}
            <div ref={gridScrollRef} onScroll={handleVerticalScroll} className="absolute top-8 bottom-0 left-0 right-0 flex flex-col p-1.5 gap-2 overflow-y-auto custom-scrollbar min-w-full w-full">
              {sortedTracks.length === 0 ? (
                <div
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'video/*,audio/*,image/*';
                    input.onchange = (ev: any) => {
                      const files = ev.target.files;
                      if (!files || files.length === 0 || !onAddClip) return;
                      const file = files[0];
                      const isVideo = file.type.startsWith('video/');
                      const isAudio = file.type.startsWith('audio/');
                      const isImage = file.type.startsWith('image/');
                      const url = URL.createObjectURL(file);
                      const clipType = isVideo ? ClipType.VIDEO : isAudio ? ClipType.AUDIO : isImage ? ClipType.IMAGE : ClipType.VIDEO;

                      if (isVideo || isAudio) {
                        const tempEl = document.createElement(isVideo ? 'video' : 'audio');
                        tempEl.src = url;
                        tempEl.onloadedmetadata = () => {
                          const dur = tempEl.duration || 10;
                          onAddClip({
                            name: file.name,
                            type: clipType,
                            url,
                            start: 0,
                            duration: dur,
                            sourceDuration: dur,
                          });
                        };
                      } else {
                        onAddClip({
                          name: file.name,
                          type: clipType,
                          url,
                          start: 0,
                          duration: 5,
                        });
                      }
                    };
                    input.click();
                  }}
                  className="h-32 border-2 border-dashed border-[#2d2d3c] hover:border-cyan-500/60 rounded-xl flex flex-col items-center justify-center p-6 text-center bg-[#13131b]/60 hover:bg-[#181824]/80 transition-all cursor-pointer group select-none m-2"
                >
                  <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-2 text-cyan-400 group-hover:scale-110 transition-transform">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-gray-200">Drag & drop files here to add media</span>
                  <span className="text-[10px] text-gray-400 mt-1 max-w-sm">
                    Tracks will be created automatically for Video, Audio & Text
                  </span>
                </div>
              ) : (
                sortedTracks.map((track, trackIdx) => (
                  <div
                    key={track.id ? `grid-${track.id}-${trackIdx}` : `grid-track-${trackIdx}`}
                    onContextMenu={(e) => handleContextMenu(e, null, track)}
                    className={`h-20 min-h-[80px] border border-[#22222c] rounded-lg relative bg-[#131318] flex items-center shadow-sm overflow-hidden ${track.hidden ? 'opacity-30 pointer-events-none' : ''}`}
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

                    // Timeline Virtualization: Check if clip is within visible viewport window
                    const isClipVisible = (clip.start + clip.duration >= visibleStartTime) && (clip.start <= visibleEndTime);

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
                        {/* Video & Image Frame Strip Visuals for Visual Tracks (Only rendered when visible in viewport window) */}
                        {isClipVisible && (clip.type === ClipType.VIDEO || clip.type === ClipType.IMAGE) && (
                          <VideoFilmstripVisual
                            clip={clip}
                            width={width}
                            isSelected={isSelected}
                            zoom={zoom}
                          />
                        )}

                        {/* Real-time Audio Waveform Graph Visualizer (Only rendered for AUDIO clips) */}
                        {isClipVisible && clip.type === ClipType.AUDIO && (
                          <AudioWaveformGraph
                            clipId={clip.id}
                            url={clip.url}
                            width={width}
                            isSelected={isSelected}
                            volume={clip.volume}
                            showSilenceHighlights={showSilenceGuide}
                            showBeatMarkers={true}
                            overlayMode={false}
                            currentTime={currentTime}
                            clipStart={clip.start}
                            clipDuration={clip.duration}
                            clipOffset={clip.offset || 0}
                            mediaDuration={clip.mediaDuration}
                            isPlaying={isPlaying}
                          />
                        )}

                        {/* Drag Resize Handle Left */}
                        <div
                          onMouseDown={(e) => startClipDrag(e, clip, 'left')}
                          onTouchStart={(e) => startClipDrag(e, clip, 'left')}
                          className={`absolute left-0 top-0 bottom-0 w-3.5 bg-black/60 hover:bg-cyan-500 rounded-l-md cursor-ew-resize flex items-center justify-center transition-all z-20 group/handle ${isSelected ? 'opacity-100 ring-1 ring-amber-400' : 'opacity-0 group-hover:opacity-100'}`}
                          title="Drag to trim start time (ew-resize)"
                        >
                          <div className="w-0.5 h-3.5 bg-white/90 rounded-full group-hover/handle:bg-white" />
                        </div>

                        {/* Title text & Metadata Badge Overlay with Glass Floating Card */}
                        <div className="flex-1 mx-1.5 overflow-hidden pointer-events-none z-10 flex items-center justify-between">
                          <div className="truncate bg-black/75 backdrop-blur-xs px-1.5 py-0.5 rounded border border-white/10 shadow-xs max-w-[calc(100%-40px)]">
                            <div className="flex items-center gap-1 truncate">
                              <p className={`text-[9.5px] font-bold truncate tracking-wide ${isSelected ? 'text-amber-200' : 'text-white'}`}>
                                {clip.name}
                              </p>

                              {/* Transition Indicator Badge */}
                                  {clip.transition && (clip.transition.inType !== 'none' || clip.transition.outType !== 'none' || clip.transition.type !== 'none') && (
                                    <span
                                      className="px-1 py-0.2 rounded text-[6.5px] font-mono font-black bg-cyan-950/90 text-cyan-300 border border-cyan-500/60 shrink-0 shadow-xs uppercase flex items-center gap-0.5"
                                      title={`Transition Effect: ${clip.transition.type || clip.transition.inType || 'Active'} (${clip.transition.duration || 1.0}s)`}
                                    >
                                      ✨ {clip.transition.type || clip.transition.inType || 'Trans'}
                                    </span>
                                  )}

                                  {/* Audio Peak Indicator Badge */}
                                  {clip.peakDb !== undefined && (
                                    <span
                                      className={`px-1 py-0.2 rounded text-[6.5px] font-mono font-black border shrink-0 shadow-xs ${
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
                                <p className={`text-[7.5px] font-mono leading-none mt-0.5 ${isSelected ? 'text-amber-300/90' : 'text-gray-300'}`}>
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
                                <div className="px-1 py-0.5 rounded text-[7px] font-mono font-extrabold uppercase bg-black/60 backdrop-blur-xs text-white/90 border border-white/15 shrink-0 shadow-xs">
                                  {clip.type}
                                </div>
                              </div>
                            </div>


                        {/* Drag Resize Handle Right */}
                        <div
                          onMouseDown={(e) => startClipDrag(e, clip, 'right')}
                          onTouchStart={(e) => startClipDrag(e, clip, 'right')}
                          className={`absolute right-0 top-0 bottom-0 w-3.5 bg-black/60 hover:bg-cyan-500 rounded-r-md cursor-ew-resize flex items-center justify-center transition-all z-20 group/handle ${isSelected ? 'opacity-100 ring-1 ring-amber-400' : 'opacity-0 group-hover:opacity-100'}`}
                          title="Drag to trim end time (ew-resize)"
                        >
                          <div className="w-0.5 h-3.5 bg-white/90 rounded-full group-hover/handle:bg-white" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )))
            }

              {/* Multi-Selection Bounding Box & Interactive Group Move Drag-Handle */}
              {multiSelectionBounds && (
                <div
                  id="timeline-multi-selection-bounding-box"
                  className="absolute border-2 border-amber-400/90 rounded-xl bg-amber-500/5 shadow-[0_0_25px_rgba(251,191,36,0.2)] ring-2 ring-amber-400/30 transition-all pointer-events-none z-35"
                  style={{
                    left: `${multiSelectionBounds.left}px`,
                    top: `${multiSelectionBounds.top}px`,
                    width: `${multiSelectionBounds.width}px`,
                    height: `${multiSelectionBounds.height}px`,
                  }}
                >
                  {/* Corner Accent Markers */}
                  <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-amber-400 border-2 border-[#121218] rounded-sm shadow-md" />
                  <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber-400 border-2 border-[#121218] rounded-sm shadow-md" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-amber-400 border-2 border-[#121218] rounded-sm shadow-md" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-amber-400 border-2 border-[#121218] rounded-sm shadow-md" />

                  {/* Interactive Group Drag-Handle Bar */}
                  <div
                    id="multi-selection-group-drag-handle"
                    onMouseDown={startGroupDrag}
                    onTouchStart={startGroupDrag}
                    className="absolute -top-7 left-1/2 -translate-x-1/2 pointer-events-auto cursor-grab active:cursor-grabbing bg-[#151206]/95 hover:bg-amber-400 text-amber-300 hover:text-black border border-amber-400/90 px-2.5 py-0.5 rounded-md shadow-2xl flex items-center gap-1.5 backdrop-blur-md transition-all group/handle z-40 select-none"
                    title="Click and drag to move all selected clips together across the timeline"
                  >
                    <GripHorizontal className="w-3.5 h-3.5 text-amber-400 group-hover/handle:text-black" />
                    <Move className="w-3 h-3 text-amber-400/80 group-hover/handle:text-black" />
                    <span className="text-[10px] font-mono font-bold whitespace-nowrap">
                      {multiSelectionBounds.clipCount} Clips ({multiSelectionBounds.duration.toFixed(2)}s)
                    </span>
                    <span className="text-[9px] font-mono opacity-80 whitespace-nowrap border-l border-amber-400/40 pl-1.5 ml-0.5">
                      Drag Group
                    </span>
                  </div>
                </div>
              )}
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

            {/* Vertical Time Guide Line Slicing Down Through All Tracks */}
            {timelineSnapInfo && (
              <div
                id="timeline-vertical-time-guide"
                className="absolute top-0 bottom-0 w-[2px] bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,1),0_0_4px_rgba(251,191,36,0.9)] z-40 pointer-events-none transition-all duration-75"
                style={{ left: `${timelineSnapInfo.time * zoom}px` }}
              >
                {/* Top Arrow Cap */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-[6px] border-t-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,1)]" />
                
                {/* Synchronized Time Badge Pill at Top */}
                <div className="absolute top-1 -left-16 bg-[#091520]/95 border border-cyan-400 text-cyan-200 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold shadow-2xl flex items-center gap-1.5 backdrop-blur-md whitespace-nowrap z-50">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  <span>{timelineSnapInfo.label}</span>
                </div>

                {/* Bottom Arrow Cap */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-b-[6px] border-b-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,1)]" />
              </div>
            )}

            {/* Playhead vertical red line with GPU translate3d hardware layer acceleration */}
            <div
              id="timeline-playhead"
              className="absolute top-0 bottom-0 left-0 w-0.5 bg-red-500 z-30 pointer-events-none will-change-transform"
              style={{ transform: `translate3d(${currentTime * zoom}px, 0, 0)` }}
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

              {/* Merge Selected Clips */}
              {onMergeClips && (
                <button
                  type="button"
                  onClick={() => {
                    onMergeClips();
                    setContextMenu(prev => ({ ...prev, isOpen: false }));
                  }}
                  disabled={!canMerge}
                  className={`w-full px-3 py-1.5 text-left flex items-center justify-between transition ${
                    canMerge ? 'hover:bg-purple-500 hover:text-white text-purple-300' : 'text-gray-600 cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Merge className="w-3.5 h-3.5 text-purple-400" />
                    <span>Merge Selected Clips</span>
                  </div>
                  <span className="text-[10px] opacity-60 font-mono">Ctrl+M</span>
                </button>
              )}

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
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onAutoSegmentAudio(contextMenu.clip!.id, 'quran-ayah');
                      setContextMenu(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-amber-600 hover:text-white text-amber-300 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>🕌 Auto-Segment into Ayahs (Waqf)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onAutoSegmentAudio(contextMenu.clip!.id, 'tartil');
                      setContextMenu(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-amber-600 hover:text-white text-amber-300 transition text-[11px]"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>📖 Tartil Recitation Mode (0.6s+ Pause)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onAutoSegmentAudio(contextMenu.clip!.id, 'hadr');
                      setContextMenu(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-amber-600 hover:text-white text-amber-300 transition text-[11px]"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>⚡ Hadr Fast Recitation Mode (0.34s Pause)</span>
                  </button>
                </>
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

