import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X, Folder, ChevronDown, ChevronRight, Edit3, Image as ImageIcon,
  Minimize2, RefreshCw, CheckCircle2, Terminal, Download, Sliders,
  Film, Music, HardDrive, Clock
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
  onSaveToNativeStorage,
}: ExportModalProps) {
  const [config, setConfig] = useState<ExportConfig>({
    filename: `0906 (4)`,
    outputDirectory: 'C:/Users/GOOD WILL/Videos/CuteCut',
    exportVideo: true,
    resolution: '4K',
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

  // Capture thumbnail snapshot from active preview canvas
  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen, coverTime]);

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

  if (!isOpen) return null;

  // Minimized floating status badge
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c22]/95 border border-cyan-500/50 rounded-xl p-3.5 shadow-2xl backdrop-blur-md flex items-center gap-3 max-w-md animate-in slide-in-from-bottom-4 duration-200">
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
              {exporting ? `Rendering ${config.resolution}...` : downloadUrl ? 'Export Complete!' : 'Export Window'}
            </span>
            <span className="text-xs font-mono font-bold text-cyan-400">
              {exporting ? `${exportProgress}%` : downloadUrl ? '100%' : ''}
            </span>
          </div>

          {exporting && (
            <div className="w-full bg-[#2a2a34] h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-gradient-to-r from-cyan-400 to-teal-400 h-full transition-all duration-300"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 pl-2 border-l border-[#333340]">
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

  const formattedFilename = config.filename.endsWith(`.${config.format}`)
    ? config.filename
    : `${config.filename}.${config.format}`;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#1e1e24] border border-[#32323e] rounded-xl w-full max-w-[660px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] select-none text-gray-200">
        
        {/* Modal Title Bar */}
        <div className="h-11 px-4 flex items-center justify-between border-b border-[#282834] bg-[#22222a] shrink-0">
          <span className="text-xs font-semibold text-white tracking-wide">Export</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMinimize}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#30303c] transition cursor-pointer"
              title="Minimize"
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
          
          {/* Main 2-Column Split Preview & Settings Layout */}
          {!exporting && !downloadUrl ? (
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
                      <Film className="w-8 h-8 opacity-40" />
                      <span className="text-[10px]">Active Frame Preview</span>
                    </div>
                  )}

                  {/* "Edit cover" Top-Left Overlay Button */}
                  <button
                    type="button"
                    onClick={() => setIsEditingCover(prev => !prev)}
                    className="absolute top-2 left-2 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-white/40 text-white text-[11px] font-medium px-2.5 py-1 rounded flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  >
                    <Edit3 className="w-3 h-3 text-white" />
                    <span>Edit cover</span>
                  </button>

                  <div className="absolute bottom-2 right-2 bg-black/70 px-1.5 py-0.5 rounded text-[9px] font-mono text-gray-300 border border-white/10">
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
                      placeholder="0906 (4)"
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
                    <button
                      type="button"
                      className="text-gray-400 hover:text-white p-0.5"
                    >
                      {isVideoExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {isVideoExpanded && config.exportVideo && (
                    <div className="space-y-2 pl-5 pt-1 text-[11px]">
                      
                      {/* Resolution */}
                      <div className="grid grid-cols-12 items-center gap-2">
                        <span className="col-span-4 text-gray-400">Resol...</span>
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
                            <option value="recommended">Recommended</option>
                            <option value="higher">Higher</option>
                            <option value="lower">Lower</option>
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
                            <option value="h264">H.264</option>
                            <option value="hevc">HEVC</option>
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

                      {/* Color Space Subtext */}
                      <div className="text-[10px] text-gray-400 pt-1">
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
                    <button
                      type="button"
                      className="text-gray-400 hover:text-white p-0.5"
                    >
                      {isAudioExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
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
                            <option value="mp3">MP3</option>
                            <option value="wav">WAV</option>
                            <option value="aac">AAC</option>
                            <option value="opus">Opus</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          ) : (
            /* Active Export Progress State */
            <div className="space-y-4 py-2">
              <div className="bg-[#15151c] border border-[#2d2d3c] rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white flex items-center gap-2">
                    {exporting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                        <span>Rendering {config.resolution} @ {config.frameRate}fps (Full project duration: {Math.round(duration)}s)...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Video Export Complete!</span>
                      </>
                    )}
                  </span>
                  <span className="font-mono font-bold text-cyan-400 text-sm">
                    {exporting ? `${exportProgress}%` : '100%'}
                  </span>
                </div>

                <div className="w-full bg-[#0c0c12] h-2.5 rounded-full overflow-hidden border border-gray-800">
                  <div
                    className="bg-gradient-to-r from-cyan-400 to-teal-400 h-full transition-all duration-200"
                    style={{ width: `${exporting ? exportProgress : 100}%` }}
                  />
                </div>
              </div>

              {/* Terminal Logs Box */}
              <div className="bg-black/90 rounded-lg p-3 h-44 border border-gray-900 font-mono text-[10px] text-emerald-400 overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                {exportTerminalLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed truncate">
                    {log}
                  </div>
                ))}
                {exporting && (
                  <div className="text-gray-500 animate-pulse mt-0.5">
                    ▋ Processing multi-track visual compositions & audio stream...
                  </div>
                )}
              </div>

              {/* Save Trigger */}
              {!exporting && downloadUrl && (
                <div className="bg-cyan-950/30 border border-cyan-500/40 rounded-xl p-4 text-center space-y-2.5">
                  <p className="text-xs text-gray-200">
                    🎉 Full Video Duration ({Math.round(duration)}s) encoded successfully!
                  </p>
                  {savedLocalPath && (
                    <div className="bg-[#0b0f16] border border-cyan-500/40 p-2 rounded text-[11px] font-mono text-cyan-300 truncate">
                      📁 Output: {savedLocalPath}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onSaveToNativeStorage(downloadUrl, formattedFilename)}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 font-extrabold text-xs rounded transition shadow-md shadow-cyan-500/20 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-950" />
                    <span>Save {formattedFilename}</span>
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Bottom Action Bar (Identical to Screenshot) */}
        <div className="h-14 px-5 flex items-center justify-between border-t border-[#282834] bg-[#22222a] shrink-0 text-xs">
          
          {/* Bottom Left Stats: Duration & Estimated File Size */}
          <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
            <Film className="w-3.5 h-3.5 text-gray-400" />
            <span>
              Duration: <strong className="text-gray-200 font-normal">{Math.round(duration || 31)}s</strong> | Size: about <strong className="text-gray-200 font-normal">{estimatedSizeMB} MB</strong>
            </span>
          </div>

          {/* Bottom Right Actions: Export (Cyan Highlight) & Cancel */}
          <div className="flex items-center gap-2.5">
            {!exporting && !downloadUrl && (
              <>
                <button
                  type="button"
                  id="export-panel-start-btn"
                  onClick={() => onStartExport(config)}
                  className="px-5 py-1.5 bg-[#00e5ff] hover:bg-[#33ebff] active:bg-[#00cce6] text-black font-bold text-xs rounded transition shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  Export
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 bg-[#2d2d38] hover:bg-[#383846] text-gray-300 hover:text-white text-xs rounded transition cursor-pointer"
                >
                  Cancel
                </button>
              </>
            )}

            {exporting && (
              <button
                type="button"
                onClick={onToggleMinimize}
                className="px-4 py-1.5 bg-[#2d2d38] hover:bg-[#383846] text-gray-300 text-xs rounded transition cursor-pointer"
              >
                Minimize
              </button>
            )}

            {downloadUrl && !exporting && (
              <>
                <button
                  type="button"
                  onClick={() => onStartExport(config)}
                  className="px-4 py-1.5 bg-[#00e5ff] hover:bg-[#33ebff] text-black font-bold text-xs rounded transition cursor-pointer"
                >
                  Re-Export
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 bg-[#2d2d38] hover:bg-[#383846] text-gray-300 hover:text-white text-xs rounded transition cursor-pointer"
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
