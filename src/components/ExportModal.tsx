import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X, Folder, ChevronDown, ChevronRight, Edit3,
  Minimize2, RefreshCw, CheckCircle2, Terminal, Download,
  Film, Music, Clock, Square, Play, Pause, FolderOpen,
  Sliders, Sparkles, FileVideo, RotateCcw, AlertTriangle
} from 'lucide-react';
import { formatTimeCode, getExportResolutionDimensions } from '../utils/editorUtils';
import { Track } from '../types';

export interface ExportConfig {
  filename: string;
  outputDirectory: string;
  exportVideo: boolean;
  resolution: '4K' | '2K' | '1080p' | '720p' | '480p';
  bitrateProfile: 'recommended' | 'higher' | 'lower';
  codec: 'h264' | 'hevc' | 'av1' | 'vp9' | 'vp8';
  format: 'mp4' | 'mov' | 'webm' | 'mkv';
  frameRate: 24 | 25 | 30 | 50 | 60;
  exportAudioSeparately: boolean;
  audioFormat: 'wav' | 'mp3' | 'aac' | 'opus';
  coverTimestamp?: number;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  duration: number;
  aspectRatio: '16:9' | '9:16' | '1:1';
  tracks: Track[];
  exporting: boolean;
  exportProgress: number;
  exportTerminalLogs: string[];
  downloadUrl: string | null;
  savedLocalPath: string | null;
  onStartExport: (config: ExportConfig) => void;
  onCancelExport?: () => void;
  onSaveToNativeStorage: (videoUrlOrBlob: string, filename: string) => void;
}

export default function ExportModal({
  isOpen,
  onClose,
  isMinimized,
  onToggleMinimize,
  duration,
  aspectRatio,
  tracks,
  exporting,
  exportProgress,
  exportTerminalLogs,
  downloadUrl,
  savedLocalPath,
  onStartExport,
  onCancelExport,
  onSaveToNativeStorage,
}: ExportModalProps) {
  const [config, setConfig] = useState<ExportConfig>({
    filename: `CUTECUT_PRO_Video_${new Date().toISOString().slice(0, 10)}`,
    outputDirectory: 'C:/Users/Videos/CuteCut',
    exportVideo: true,
    resolution: '1080p',
    bitrateProfile: 'recommended',
    codec: 'h264',
    format: 'mp4',
    frameRate: 30,
    exportAudioSeparately: false,
    audioFormat: 'mp3',
    coverTimestamp: 0,
  });

  const [isVideoExpanded, setIsVideoExpanded] = useState(true);
  const [isAudioExpanded, setIsAudioExpanded] = useState(true);
  const [isEditingCover, setIsEditingCover] = useState(false);
  const [coverSnapshot, setCoverSnapshot] = useState<string | null>(null);
  const [coverTime, setCoverTime] = useState(0);
  const [showLogs, setShowLogs] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [liveRenderFrame, setLiveRenderFrame] = useState<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // Capture cover thumbnail snapshot from active preview canvas
  useEffect(() => {
    if (isOpen && !exporting) {
      try {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
        if (canvas) {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setCoverSnapshot(dataUrl);
        }
      } catch (e) {
        console.warn('Canvas cover snapshot note:', e);
      }
    }
  }, [isOpen, coverTime, exporting]);

  // Live frame capture while exporting to show inside the export window
  useEffect(() => {
    if (exporting) {
      const interval = setInterval(() => {
        try {
          const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
          if (canvas) {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setLiveRenderFrame(dataUrl);
          }
        } catch (e) {}
      }, 350);
      return () => clearInterval(interval);
    }
  }, [exporting]);

  // Dynamic bitrates in Mbps
  const videoBitrateMbps = useMemo(() => {
    let base = 35; // 4K default
    switch (config.resolution) {
      case '4K': base = 35; break;
      case '2K': base = 20; break;
      case '1080p': base = 10; break;
      case '720p': base = 5; break;
      case '480p': base = 2.5; break;
    }

    if (config.bitrateProfile === 'higher') base *= 1.6;
    if (config.bitrateProfile === 'lower') base *= 0.6;
    if (config.frameRate >= 50) base *= 1.3;

    return base;
  }, [config.resolution, config.bitrateProfile, config.frameRate]);

  // Size estimation engine (Megabytes)
  const estimatedSizeMB = useMemo(() => {
    const dur = Math.max(1, duration || 31);
    const audioMbps = 0.192;
    const totalMbps = (config.exportVideo ? videoBitrateMbps : 0) + (config.exportAudioSeparately ? 0.32 : audioMbps);
    const totalBytes = (totalMbps * 1_000_000 * dur) / 8;
    const mb = totalBytes / (1024 * 1024);
    return Math.max(1, Math.round(mb));
  }, [videoBitrateMbps, duration, config.exportVideo, config.exportAudioSeparately]);

  const formattedFilename = useMemo(() => {
    const ext = config.format || 'mp4';
    return config.filename.endsWith(`.${ext}`)
      ? config.filename
      : `${config.filename}.${ext}`;
  }, [config.filename, config.format]);

  // Time calculations during export
  const totalSec = Math.max(1, Math.round(duration || 10));
  const currentRenderSec = Math.min(totalSec, Math.round((exportProgress / 100) * totalSec));
  const remainingSec = Math.max(0, totalSec - currentRenderSec);

  const handleBrowseDirectory = async () => {
    try {
      if (typeof window !== 'undefined') {
        const electron = (window as any).require ? (window as any).require('electron') : null;
        if (electron && electron.ipcRenderer) {
          const folder = await electron.ipcRenderer.invoke('show-open-dialog-folder');
          if (folder) {
            setConfig(prev => ({ ...prev, outputDirectory: folder }));
            return;
          }
        }
      }
    } catch (e) {}

    const custom = window.prompt('Enter local export destination directory path:', config.outputDirectory);
    if (custom) {
      setConfig(prev => ({ ...prev, outputDirectory: custom }));
    }
  };

  if (!isOpen) return null;

  // Minimized floating status badge
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-[#1a1a22]/95 border border-cyan-500/50 rounded-xl p-3.5 shadow-2xl backdrop-blur-md flex items-center gap-3.5 max-w-md animate-in slide-in-from-bottom-4 duration-200">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-cyan-950/80 border border-cyan-500/60 flex-shrink-0">
          {exporting ? (
            <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
          ) : downloadUrl ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <Terminal className="w-4 h-4 text-cyan-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-white truncate">
              {exporting ? `Exporting (${config.resolution})...` : downloadUrl ? 'Export Complete!' : 'Export Window'}
            </span>
            <span className="text-xs font-mono font-bold text-cyan-400">
              {exporting ? `${exportProgress}%` : downloadUrl ? '100%' : ''}
            </span>
          </div>

          {exporting && (
            <div className="w-full bg-[#2a2a34] h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-gradient-to-r from-cyan-400 to-teal-400 h-full transition-all duration-200"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 pl-2 border-l border-[#333340]">
          {exporting && onCancelExport && (
            <button
              type="button"
              onClick={onCancelExport}
              className="p-1.5 text-red-400 hover:text-white hover:bg-red-950/60 rounded-md transition cursor-pointer"
              title="Stop Export"
            >
              <Square className="w-3.5 h-3.5 fill-red-400" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleMinimize}
            className="p-1.5 text-cyan-400 hover:text-white hover:bg-cyan-950/60 rounded-md transition cursor-pointer"
            title="Expand Export Window"
          >
            <Minimize2 className="w-4 h-4 rotate-180" />
          </button>
          {!exporting && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#1e1e24] border border-[#32323e] rounded-xl w-full max-w-[680px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] select-none text-gray-200">
        
        {/* Modal Title Bar */}
        <div className="h-11 px-4 flex items-center justify-between border-b border-[#282834] bg-[#22222a] shrink-0">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white tracking-wide">
              {exporting ? 'Exporting Video...' : downloadUrl ? 'Export Finished' : 'Export Settings'}
            </span>
            {exporting && (
              <span className="flex items-center gap-1 text-[10px] bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded-full font-medium animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                Silent Studio Render
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMinimize}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#30303c] transition cursor-pointer"
              title="Minimize to floating window"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            {!exporting && (
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#30303c] transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          
          {/* ======================================================== */}
          {/* 1. SETTINGS SCREEN (CapCut Pro Layout)                    */}
          {/* ======================================================== */}
          {!exporting && !downloadUrl && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              
              {/* Left Column: Video Thumbnail Preview with "Edit cover" */}
              <div className="md:col-span-5 flex flex-col gap-2">
                <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-[#353544] flex items-center justify-center group shadow-md">
                  {coverSnapshot ? (
                    <img
                      src={coverSnapshot}
                      alt="Cover Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-500 gap-1.5 p-4 text-center">
                      <Film className="w-8 h-8 opacity-40 text-cyan-400" />
                      <span className="text-[10px]">Active Frame Preview</span>
                    </div>
                  )}

                  {/* "Edit cover" Top-Left Overlay Button */}
                  <button
                    type="button"
                    onClick={() => setIsEditingCover(prev => !prev)}
                    className="absolute top-2 left-2 bg-black/65 hover:bg-black/85 backdrop-blur-md border border-white/20 hover:border-white/40 text-white text-[11px] font-medium px-2.5 py-1 rounded flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  >
                    <Edit3 className="w-3 h-3 text-cyan-400" />
                    <span>Edit cover</span>
                  </button>

                  <div className="absolute bottom-2 right-2 bg-black/75 px-1.5 py-0.5 rounded text-[9px] font-mono text-cyan-300 border border-white/10">
                    {formatTimeCode(coverTime || 0)}
                  </div>
                </div>

                {/* Edit Cover Slider Drawer */}
                {isEditingCover && (
                  <div className="bg-[#16161c] border border-[#2e2e3c] rounded-lg p-2.5 space-y-2 animate-in fade-in duration-150 text-[11px]">
                    <div className="flex items-center justify-between text-gray-300">
                      <span>Cover Frame Time:</span>
                      <span className="font-mono text-cyan-400">{coverTime.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(duration, 1)}
                      step={0.1}
                      value={coverTime}
                      onChange={(e) => {
                        const t = parseFloat(e.target.value);
                        setCoverTime(t);
                        setConfig(prev => ({ ...prev, coverTimestamp: t }));
                      }}
                      className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-[#2a2a36] rounded-lg"
                    />
                  </div>
                )}
              </div>

              {/* Right Column: Name, Export To, Video & Audio Param Form */}
              <div className="md:col-span-7 flex flex-col gap-3.5 text-xs">
                
                {/* 1. Name Field */}
                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-4 text-gray-300 text-[11px] font-medium">Name</label>
                  <div className="col-span-8">
                    <input
                      type="text"
                      value={config.filename}
                      onChange={(e) => setConfig({ ...config, filename: e.target.value })}
                      className="w-full bg-[#15151a] border border-[#2f2f3e] focus:border-cyan-400 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none transition"
                      placeholder="CUTECUT_PRO_Video"
                    />
                  </div>
                </div>

                {/* 2. Export to Directory Field */}
                <div className="grid grid-cols-12 items-center gap-2">
                  <label className="col-span-4 text-gray-300 text-[11px] font-medium">Export to</label>
                  <div className="col-span-8 flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={config.outputDirectory}
                        onChange={(e) => setConfig({ ...config, outputDirectory: e.target.value })}
                        className="w-full bg-[#15151a] border border-[#2f2f3e] focus:border-cyan-400 rounded pl-2.5 pr-7 py-1.5 text-xs text-gray-300 focus:outline-none truncate"
                        placeholder="C:/Users/Videos"
                      />
                      <button
                        type="button"
                        onClick={handleBrowseDirectory}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition cursor-pointer p-0.5"
                        title="Browse local folder"
                      >
                        <Folder className="w-3.5 h-3.5 text-gray-300 hover:text-cyan-400" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#2a2a36] pt-1" />

                {/* 3. Video Collapsible Section */}
                <div className="space-y-2">
                  <div
                    className="flex items-center justify-between cursor-pointer select-none text-gray-200 py-0.5"
                    onClick={() => setIsVideoExpanded(!isVideoExpanded)}
                  >
                    <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={config.exportVideo}
                        onChange={(e) => setConfig({ ...config, exportVideo: e.target.checked })}
                        className="w-3.5 h-3.5 rounded text-cyan-500 bg-[#121218] border-[#383848] accent-cyan-400 cursor-pointer"
                      />
                      <span className="text-[12px] font-semibold text-white">Video</span>
                    </label>
                    <button type="button" className="text-gray-400 hover:text-white p-0.5">
                      {isVideoExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {isVideoExpanded && config.exportVideo && (
                    <div className="space-y-2 pl-5 pt-1 text-[11px]">
                      
                      {/* Resolution */}
                      <div className="grid grid-cols-12 items-center gap-2">
                        <span className="col-span-4 text-gray-400">Resolution</span>
                        <div className="col-span-8">
                          <select
                            value={config.resolution}
                            onChange={(e) => setConfig({ ...config, resolution: e.target.value as any })}
                            className="w-full bg-[#15151a] border border-[#2f2f3e] focus:border-cyan-400 rounded px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
                          >
                            <option value="4K">4K (3840 x 2160)</option>
                            <option value="2K">2K (2560 x 1440)</option>
                            <option value="1080p">1080p (1920 x 1080)</option>
                            <option value="720p">720p (1280 x 720)</option>
                            <option value="480p">480p (854 x 480)</option>
                          </select>
                        </div>
                      </div>

                      {/* Bit rate */}
                      <div className="grid grid-cols-12 items-center gap-2">
                        <span className="col-span-4 text-gray-400">Bit rate</span>
                        <div className="col-span-8">
                          <select
                            value={config.bitrateProfile}
                            onChange={(e) => setConfig({ ...config, bitrateProfile: e.target.value as any })}
                            className="w-full bg-[#15151a] border border-[#2f2f3e] focus:border-cyan-400 rounded px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
                          >
                            <option value="recommended">Recommended (Smart CBR)</option>
                            <option value="higher">Higher (Ultra Quality)</option>
                            <option value="lower">Lower (Compact Size)</option>
                          </select>
                        </div>
                      </div>

                      {/* Codec */}
                      <div className="grid grid-cols-12 items-center gap-2">
                        <span className="col-span-4 text-gray-400">Codec</span>
                        <div className="col-span-8">
                          <select
                            value={config.codec}
                            onChange={(e) => setConfig({ ...config, codec: e.target.value as any })}
                            className="w-full bg-[#15151a] border border-[#2f2f3e] focus:border-cyan-400 rounded px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
                          >
                            <option value="h264">H.264 / AVC</option>
                            <option value="hevc">HEVC / H.265</option>
                            <option value="av1">AV1</option>
                            <option value="vp9">VP9</option>
                          </select>
                        </div>
                      </div>

                      {/* Format */}
                      <div className="grid grid-cols-12 items-center gap-2">
                        <span className="col-span-4 text-gray-400">Format</span>
                        <div className="col-span-8">
                          <select
                            value={config.format}
                            onChange={(e) => setConfig({ ...config, format: e.target.value as any })}
                            className="w-full bg-[#15151a] border border-[#2f2f3e] focus:border-cyan-400 rounded px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
                          >
                            <option value="mp4">mp4</option>
                            <option value="mov">mov</option>
                            <option value="webm">webm</option>
                          </select>
                        </div>
                      </div>

                      {/* Frame rate */}
                      <div className="grid grid-cols-12 items-center gap-2">
                        <span className="col-span-4 text-gray-400">Frame rate</span>
                        <div className="col-span-8">
                          <select
                            value={config.frameRate}
                            onChange={(e) => setConfig({ ...config, frameRate: parseInt(e.target.value, 10) as any })}
                            className="w-full bg-[#15151a] border border-[#2f2f3e] focus:border-cyan-400 rounded px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
                          >
                            <option value={30}>30fps</option>
                            <option value={60}>60fps</option>
                            <option value={50}>50fps</option>
                            <option value={25}>25fps</option>
                            <option value={24}>24fps</option>
                          </select>
                        </div>
                      </div>

                      <div className="text-[10px] text-gray-400 pt-0.5">
                        Color space: Rec. 709 SDR
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Audio Collapsible Section */}
                <div className="space-y-2 border-t border-[#2a2a36] pt-2">
                  <div
                    className="flex items-center justify-between cursor-pointer select-none text-gray-200 py-0.5"
                    onClick={() => setIsAudioExpanded(!isAudioExpanded)}
                  >
                    <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={config.exportAudioSeparately}
                        onChange={(e) => setConfig({ ...config, exportAudioSeparately: e.target.checked })}
                        className="w-3.5 h-3.5 rounded text-cyan-500 bg-[#121218] border-[#383848] accent-cyan-400 cursor-pointer"
                      />
                      <span className="text-[12px] font-semibold text-white">Audio</span>
                    </label>
                    <button type="button" className="text-gray-400 hover:text-white p-0.5">
                      {isAudioExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {isAudioExpanded && config.exportAudioSeparately && (
                    <div className="space-y-2 pl-5 pt-1 text-[11px]">
                      <div className="grid grid-cols-12 items-center gap-2">
                        <span className="col-span-4 text-gray-400">Audio Format</span>
                        <div className="col-span-8">
                          <select
                            value={config.audioFormat}
                            onChange={(e) => setConfig({ ...config, audioFormat: e.target.value as any })}
                            className="w-full bg-[#15151a] border border-[#2f2f3e] focus:border-cyan-400 rounded px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
                          >
                            <option value="mp3">MP3 (320kbps)</option>
                            <option value="wav">WAV (Lossless 24-bit)</option>
                            <option value="aac">AAC (192kbps)</option>
                            <option value="opus">Opus</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 2. IN-PROGRESS EXPORTING SCREEN (CapCut In-Window Render) */}
          {/* ======================================================== */}
          {exporting && (
            <div className="space-y-4 py-2 animate-in fade-in duration-200">
              
              {/* Top Banner: Video live preview thumbnail + progress details */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-[#14141a] border border-[#282836] rounded-xl p-4">
                
                {/* Live Render Canvas Snapshot */}
                <div className="md:col-span-4 flex flex-col items-center justify-center">
                  <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-cyan-500/30 flex items-center justify-center shadow-lg">
                    {liveRenderFrame || coverSnapshot ? (
                      <img
                        src={liveRenderFrame || coverSnapshot!}
                        alt="Live Encoding Frame"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-cyan-400/70 gap-1.5 p-3 text-center">
                        <Film className="w-6 h-6 animate-pulse" />
                        <span className="text-[10px]">Rendering frames...</span>
                      </div>
                    )}
                    <div className="absolute top-1.5 left-1.5 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-mono text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                      REC
                    </div>
                    <div className="absolute bottom-1.5 right-1.5 bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-mono text-gray-300 border border-white/10">
                      {formatTimeCode(currentRenderSec)} / {formatTimeCode(totalSec)}
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1.5">
                    Audio plays silently during export
                  </span>
                </div>

                {/* Progress Stats & Status */}
                <div className="md:col-span-8 flex flex-col justify-center space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                        <span className="text-sm font-bold text-white">
                          Rendering {config.resolution} ({config.format.toUpperCase()})
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Encoding visual tracks, Quran typography & studio audio mix...
                      </p>
                    </div>
                    <span className="text-2xl font-black font-mono text-cyan-400 tracking-tight">
                      {exportProgress}%
                    </span>
                  </div>

                  {/* High Precision Progress Bar */}
                  <div className="w-full bg-[#0c0c12] h-3 rounded-full overflow-hidden border border-gray-800 p-0.5">
                    <div
                      className="bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 h-full rounded-full transition-all duration-200 shadow-sm shadow-cyan-500/50"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>

                  {/* Real-time Render Metrics Grid */}
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    <div className="bg-[#1c1c24] border border-[#2b2b38] rounded-md p-2 text-center">
                      <div className="text-[9px] text-gray-400 uppercase tracking-wider">Elapsed</div>
                      <div className="text-xs font-mono font-bold text-gray-200">{currentRenderSec}s</div>
                    </div>
                    <div className="bg-[#1c1c24] border border-[#2b2b38] rounded-md p-2 text-center">
                      <div className="text-[9px] text-gray-400 uppercase tracking-wider">Remaining</div>
                      <div className="text-xs font-mono font-bold text-cyan-300">~{remainingSec}s</div>
                    </div>
                    <div className="bg-[#1c1c24] border border-[#2b2b38] rounded-md p-2 text-center">
                      <div className="text-[9px] text-gray-400 uppercase tracking-wider">FPS / Rate</div>
                      <div className="text-xs font-mono font-bold text-gray-200">{config.frameRate} FPS</div>
                    </div>
                    <div className="bg-[#1c1c24] border border-[#2b2b38] rounded-md p-2 text-center">
                      <div className="text-[9px] text-gray-400 uppercase tracking-wider">Codec</div>
                      <div className="text-xs font-mono font-bold text-gray-200">{config.codec.toUpperCase()}</div>
                    </div>
                  </div>

                </div>

              </div>

              {/* Collapsible Studio Logs */}
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setShowLogs(!showLogs)}
                  className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-cyan-400 transition cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>{showLogs ? 'Hide Render Terminal' : 'Show Render Terminal & Engine Details'}</span>
                  {showLogs ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>

                {showLogs && (
                  <div className="bg-black/90 rounded-lg p-3 h-36 border border-gray-900 font-mono text-[10px] text-emerald-400 overflow-y-auto flex flex-col gap-1 custom-scrollbar animate-in fade-in duration-150">
                    {exportTerminalLogs.map((log, idx) => (
                      <div key={idx} className="leading-relaxed truncate">
                        {log}
                      </div>
                    ))}
                    <div className="text-gray-500 animate-pulse mt-0.5">
                      ▋ Processing multi-layer compositions & high-bitrate encoding...
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* 3. EXPORT COMPLETED SCREEN (CapCut Completion)           */}
          {/* ======================================================== */}
          {!exporting && downloadUrl && (
            <div className="space-y-5 py-2 animate-in fade-in duration-200">
              
              <div className="bg-gradient-to-b from-cyan-950/40 to-[#141820] border border-cyan-500/40 rounded-xl p-5 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/20">
                  <CheckCircle2 className="w-7 h-7 text-cyan-300" />
                </div>

                <div>
                  <h3 className="text-base font-bold text-white">Video Exported Successfully!</h3>
                  <p className="text-xs text-gray-300 mt-1">
                    Your project duration ({totalSec}s) has been encoded into {config.resolution} ({config.format.toUpperCase()}).
                  </p>
                </div>

                {/* Video Playback Preview Card */}
                <div className="max-w-md mx-auto bg-black rounded-lg overflow-hidden border border-gray-800 shadow-xl">
                  <video
                    ref={videoPreviewRef}
                    src={downloadUrl}
                    controls
                    className="w-full aspect-video object-contain bg-black"
                    onPlay={() => setPreviewPlaying(true)}
                    onPause={() => setPreviewPlaying(false)}
                  />
                </div>

                {savedLocalPath && (
                  <div className="bg-[#0b0f16] border border-cyan-500/30 p-2.5 rounded-lg text-xs font-mono text-cyan-300 flex items-center justify-center gap-2 max-w-lg mx-auto truncate">
                    <FolderOpen className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="truncate">Saved: {savedLocalPath}</span>
                  </div>
                )}

                {/* Main Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onSaveToNativeStorage(downloadUrl, formattedFilename)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 font-bold text-xs rounded-lg transition shadow-lg shadow-cyan-500/20 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-950" />
                    <span>Save / Download {formattedFilename}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (videoPreviewRef.current) {
                        if (videoPreviewRef.current.paused) videoPreviewRef.current.play();
                        else videoPreviewRef.current.pause();
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#252532] hover:bg-[#323242] text-gray-200 text-xs font-semibold rounded-lg transition cursor-pointer border border-[#3c3c4e]"
                  >
                    {previewPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>{previewPlaying ? 'Pause Video' : 'Play Video Preview'}</span>
                  </button>
                </div>

              </div>

            </div>
          )}

        </div>

        {/* Modal Bottom Action Bar (Identical to CapCut) */}
        <div className="h-14 px-5 flex items-center justify-between border-t border-[#282834] bg-[#22222a] shrink-0 text-xs">
          
          {/* Bottom Left Stats: Duration & Estimated File Size */}
          <div className="flex items-center gap-2 text-gray-400 text-[11px]">
            <Film className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              Duration: <strong className="text-gray-200 font-normal">{totalSec}s</strong> | Size: about <strong className="text-gray-200 font-normal">{estimatedSizeMB} MB</strong>
            </span>
          </div>

          {/* Bottom Right Actions */}
          <div className="flex items-center gap-2.5">
            
            {/* Setting Screen: Export & Cancel */}
            {!exporting && !downloadUrl && (
              <>
                <button
                  type="button"
                  id="export-panel-start-btn"
                  onClick={() => onStartExport(config)}
                  className="px-6 py-2 bg-[#00e5ff] hover:bg-[#33ebff] active:bg-[#00cce6] text-black font-bold text-xs rounded-lg transition shadow-md shadow-cyan-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-[#2d2d38] hover:bg-[#383846] text-gray-300 hover:text-white text-xs rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
              </>
            )}

            {/* In-Progress Screen: Stop Export & Minimize */}
            {exporting && (
              <>
                {onCancelExport && (
                  <button
                    type="button"
                    id="export-panel-stop-btn"
                    onClick={onCancelExport}
                    className="px-4 py-2 bg-red-950/80 hover:bg-red-900 border border-red-500/50 hover:border-red-400 text-red-200 hover:text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-red-950/40"
                    title="Abort and Stop Export Immediately"
                  >
                    <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
                    <span>Stop Export</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleMinimize}
                  className="px-4 py-2 bg-[#2d2d38] hover:bg-[#383846] text-gray-300 text-xs rounded-lg transition cursor-pointer flex items-center gap-1"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Minimize</span>
                </button>
              </>
            )}

            {/* Completed Screen: Re-Export & Done */}
            {downloadUrl && !exporting && (
              <>
                <button
                  type="button"
                  onClick={() => onStartExport(config)}
                  className="px-4 py-2 bg-[#2d2d38] hover:bg-[#383846] text-cyan-300 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 border border-cyan-500/30"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Re-Export</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-[#00e5ff] hover:bg-[#33ebff] text-black font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  Done
                </button>
              </>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
