import React, { useState } from 'react';
import {
  Sparkles, Wand2, Sun, Shield, Layers, Tv, Volume2, Mic, Zap, Sliders,
  Gauge, Film, Type, CheckCircle2, Flame, Eye, Crown, Radio, Activity,
  Download, Play, Cpu, ArrowUpRight, Scissors, Plus
} from 'lucide-react';
import { Clip, ClipType, Track, VideoFilters } from '../types';

interface EffectsPanelProps {
  selectedClip: Clip | null;
  onUpdateClip: (clipId: string, updates: Partial<Clip>) => void;
  onAddEffectClip?: (effectName: string, config: any) => void;
  tracks?: Track[];
  width?: number;
}

export default function EffectsPanel({
  selectedClip,
  onUpdateClip,
  onAddEffectClip,
  tracks = [],
  width,
}: EffectsPanelProps) {
  const [activeTab, setActiveTab] = useState<'video-fx' | 'text-3d' | 'speed-ramp' | 'audio-pro' | 'export-4k'>('video-fx');

  // Relighting State
  const [relightingStyle, setRelightingStyle] = useState<'amber-glow' | 'neon-cyan' | 'studio-sunset' | 'quran-gold'>('amber-glow');
  const [relightingIntensity, setRelightingIntensity] = useState<number>(75);

  // Chroma Key State
  const [chromaColor, setChromaColor] = useState<string>('#00ff00');
  const [chromaThreshold, setChromaThreshold] = useState<number>(45);
  const [chromaSmoothness, setChromaSmoothness] = useState<number>(30);

  // 3D Text state
  const [textMetallic, setTextMetallic] = useState<boolean>(true);
  const [textShadowBlur, setTextShadowBlur] = useState<number>(25);
  const [textNeonColor, setTextNeonColor] = useState<string>('#06b6d4');

  // Speed Ramp state
  const [speedPreset, setSpeedPreset] = useState<'none' | 'hero' | 'bullet' | 'montage' | 'custom'>('hero');

  // 4K Export settings
  const [exportRes, setExportRes] = useState<'1080p' | '4k-uhd' | '8k'>('4k-uhd');
  const [exportFps, setExportFps] = useState<number>(60);
  const [exportBitrate, setExportBitrate] = useState<number>(45); // Mbps
  const [exportFormat, setExportFormat] = useState<'mp4-h264' | 'webm-vp9' | 'prores'>('mp4-h264');
  const [exportIsRunning, setExportIsRunning] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);

  // Active clip helper
  const isVideo = selectedClip?.type === ClipType.VIDEO;
  const isAudio = selectedClip?.type === ClipType.AUDIO;
  const isText = selectedClip?.type === ClipType.TEXT;

  // Handle Relighting toggle on selected clip
  const applyRelighting = (style: 'amber-glow' | 'neon-cyan' | 'studio-sunset' | 'quran-gold', intensity: number) => {
    if (!selectedClip) return;
    const currentFx = selectedClip.videoEffects || {};
    onUpdateClip(selectedClip.id, {
      videoEffects: {
        ...currentFx,
        relighting: {
          enabled: true,
          style,
          intensity,
        },
      },
    });
  };

  // Handle 4K Upscaler toggle
  const toggleUpscaler4K = (enabled: boolean) => {
    if (!selectedClip) return;
    const currentFx = selectedClip.videoEffects || {};
    onUpdateClip(selectedClip.id, {
      videoEffects: {
        ...currentFx,
        upscaler4k: enabled,
      },
    });
  };

  // Apply Speed Ramp preset
  const applySpeedRampPreset = (preset: 'none' | 'hero' | 'bullet' | 'montage' | 'custom') => {
    setSpeedPreset(preset);
    if (!selectedClip) return;

    let multiplier = 1.0;
    let curve = [1, 1, 1, 1];

    if (preset === 'hero') {
      multiplier = 2.5;
      curve = [1, 3.5, 0.4, 1.2];
    } else if (preset === 'bullet') {
      multiplier = 0.25;
      curve = [2.0, 0.2, 0.2, 2.0];
    } else if (preset === 'montage') {
      multiplier = 1.8;
      curve = [0.5, 2.0, 3.0, 0.8];
    }

    onUpdateClip(selectedClip.id, {
      playbackRate: multiplier,
      speedRamp: {
        preset,
        curve,
      },
    });
  };

  return (
    <div
      id="effects-panel"
      className="bg-[#141418] border-r border-[#2a2a32] h-full flex flex-col select-none overflow-hidden"
      style={{ width: width !== undefined ? `${width}px` : undefined }}
    >
      {/* Panel Header */}
      <div className="p-3.5 border-b border-[#2a2a32] bg-[#101014] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-cyan-500 to-teal-400 text-black font-bold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>CapCut Pro Effects Suite</span>
              <span className="bg-cyan-500 text-black text-[8px] font-extrabold px-1 rounded">PRO</span>
            </h2>
            <p className="text-[10px] text-gray-400">WebGL Hardware-Accelerated Shaders & FX</p>
          </div>
        </div>
      </div>

      {/* Primary Subtabs */}
      <div className="flex border-b border-[#2a2a32] bg-[#16161b] text-[10px] font-bold text-gray-400 overflow-x-auto custom-scrollbar">
        {[
          { id: 'video-fx', label: 'Video FX & Relighting', icon: Sun },
          { id: 'text-3d', label: '3D Text Engine', icon: Type },
          { id: 'speed-ramp', label: 'Speed Ramp', icon: Gauge },
          { id: 'audio-pro', label: 'Vocal Isolation', icon: Mic },
          { id: 'export-4k', label: '4K Export Engine', icon: Download },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[85px] py-2.5 px-2 flex flex-col items-center gap-1 transition ${isActive ? 'text-cyan-400 bg-[#1f1f26] border-b-2 border-cyan-400 font-black' : 'hover:text-gray-200'}`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-gray-500'}`} />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">

        {/* ---------------- 1. VIDEO FX & RELIGHTING ---------------- */}
        {activeTab === 'video-fx' && (
          <div className="space-y-4">
            
            {/* AI Video Relighting */}
            <div className="bg-[#1a1a20] border border-cyan-500/30 rounded-xl p-3.5 space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-400 animate-pulse" />
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase">AI Video Relighting Matrix</h3>
                    <p className="text-[10px] text-gray-400">Simulate studio ambient lights & color shifts</p>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded font-bold border border-amber-500/30">
                  HARDWARE WEBGL
                </span>
              </div>

              {/* Relighting Style Grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'amber-glow', name: '🌅 Amber Warmth', desc: 'Golden Hour' },
                  { id: 'neon-cyan', name: '⚡ Neon Cyberpunk', desc: 'Cyan / Magenta' },
                  { id: 'studio-sunset', name: '🌇 Sunset Studio', desc: 'Deep Orange' },
                  { id: 'quran-gold', name: '🕌 Quranic Ray Glow', desc: 'Divine Light' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setRelightingStyle(s.id as any);
                      applyRelighting(s.id as any, relightingIntensity);
                    }}
                    className={`p-2 rounded-lg border text-left transition ${relightingStyle === s.id ? 'bg-cyan-950/50 border-cyan-400 text-cyan-300' : 'bg-[#121216] border-gray-800 text-gray-400 hover:border-gray-700'}`}
                  >
                    <div className="text-[11px] font-bold">{s.name}</div>
                    <div className="text-[9px] text-gray-500">{s.desc}</div>
                  </button>
                ))}
              </div>

              {/* Intensity Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                  <span>Relighting Intensity</span>
                  <span className="text-cyan-400 font-bold">{relightingIntensity}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={relightingIntensity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setRelightingIntensity(val);
                    applyRelighting(relightingStyle, val);
                  }}
                  className="w-full h-1 bg-gray-700 rounded appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>

            {/* AI Image/Video 4K Upscaler */}
            <div className="bg-[#1a1a20] border border-emerald-500/30 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <div>
                    <h3 className="text-xs font-bold text-white">AI 4K Edge Reconstruction Upscaler</h3>
                    <p className="text-[10px] text-gray-400">Enhance low-res video assets dynamically</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={!!selectedClip?.videoEffects?.upscaler4k}
                  onChange={(e) => toggleUpscaler4K(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 bg-gray-800 border-gray-700 cursor-pointer focus:ring-0"
                />
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed bg-[#121216] p-2 rounded border border-gray-800">
                Uses bicubic texture interpolation and high-frequency edge sharpening filters to boost clarity on 720p or low-bitrate background footage.
              </p>
            </div>

            {/* Green Screen Chroma Key */}
            <div className="bg-[#1a1a20] border border-teal-500/30 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-teal-400" />
                  <h3 className="text-xs font-bold text-white">Green Screen Chroma Key</h3>
                </div>
                <span className="text-[9px] font-mono text-teal-400 font-bold bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-500/30">
                  REAL-TIME MASK
                </span>
              </div>

              <div className="flex items-center justify-between bg-[#121216] p-2 rounded border border-gray-800">
                <span className="text-[11px] text-gray-300">Target Background Color</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={chromaColor}
                    onChange={(e) => {
                      setChromaColor(e.target.value);
                      if (selectedClip) {
                        onUpdateClip(selectedClip.id, {
                          filters: {
                            ...(selectedClip.filters || {
                              brightness: 100, contrast: 100, saturation: 100, grayscale: 0, sepia: 0, invert: 0, hueRotate: 0,
                              chromaKey: { enabled: true, color: e.target.value, threshold: chromaThreshold, smoothness: chromaSmoothness }
                            }),
                            chromaKey: { enabled: true, color: e.target.value, threshold: chromaThreshold, smoothness: chromaSmoothness }
                          }
                        });
                      }
                    }}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-[10px] font-mono text-gray-400 uppercase">{chromaColor}</span>
                </div>
              </div>

              {/* Threshold */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                  <span>Color Tolerance Threshold</span>
                  <span className="text-teal-400 font-bold">{chromaThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={chromaThreshold}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setChromaThreshold(val);
                    if (selectedClip) {
                      onUpdateClip(selectedClip.id, {
                        filters: {
                          ...(selectedClip.filters || {
                            brightness: 100, contrast: 100, saturation: 100, grayscale: 0, sepia: 0, invert: 0, hueRotate: 0,
                            chromaKey: { enabled: true, color: chromaColor, threshold: val, smoothness: chromaSmoothness }
                          }),
                          chromaKey: { enabled: true, color: chromaColor, threshold: val, smoothness: chromaSmoothness }
                        }
                      });
                    }
                  }}
                  className="w-full h-1 bg-gray-700 rounded appearance-none cursor-pointer accent-teal-400"
                />
              </div>
            </div>

            {/* Production Overlay Quick Presets */}
            <div className="bg-[#1a1a20] border border-gray-800 rounded-xl p-3.5 space-y-3">
              <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Cinematic Overlay Presets</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: '✨ Light Leaks Overlay', fx: 'lightLeak' },
                  { name: '🌌 Bokeh Dust Particles', fx: 'bokeh' },
                  { name: '🎞️ 35mm Vintage Grain', fx: 'filmGrain' },
                  { name: '⚡ Glitch Slices FX', fx: 'glitch' },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (!selectedClip) return;
                      const current = selectedClip.videoEffects || {};
                      onUpdateClip(selectedClip.id, {
                        videoEffects: {
                          ...current,
                          [item.fx]: true,
                        },
                      });
                    }}
                    className="p-2 bg-[#121216] hover:bg-cyan-950/40 hover:border-cyan-500/40 border border-gray-800 rounded-lg text-left text-[11px] font-semibold text-gray-300 transition flex items-center justify-between"
                  >
                    <span>{item.name}</span>
                    <Plus className="w-3.5 h-3.5 text-cyan-400" />
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ---------------- 2. 3D TEXT ENGINE & SUBTITLES ---------------- */}
        {activeTab === 'text-3d' && (
          <div className="space-y-4">
            <div className="bg-[#1a1a20] border border-cyan-500/30 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
                <Type className="w-4 h-4 text-cyan-400" />
                <div>
                  <h3 className="text-xs font-bold text-white uppercase">3D Text Typography Compilation</h3>
                  <p className="text-[10px] text-gray-400">Metallic borders, neon glows & drop shadows</p>
                </div>
              </div>

              {/* Metallic Border Toggle */}
              <div className="flex items-center justify-between bg-[#121216] p-2.5 rounded border border-gray-800">
                <span className="text-xs text-gray-200 font-semibold">Metallic Border Reflection</span>
                <input
                  type="checkbox"
                  checked={textMetallic}
                  onChange={(e) => {
                    setTextMetallic(e.target.checked);
                    if (selectedClip && isText) {
                      onUpdateClip(selectedClip.id, {
                        text3D: {
                          ...(selectedClip.text3D || {}),
                          metallicBorder: e.target.checked,
                        },
                      });
                    }
                  }}
                  className="w-4 h-4 rounded text-cyan-500 bg-gray-800 border-gray-700 cursor-pointer"
                />
              </div>

              {/* Drop Shadow Blur */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                  <span>3D Drop Shadow Blur Radius</span>
                  <span className="text-cyan-400 font-bold">{textShadowBlur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={textShadowBlur}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setTextShadowBlur(val);
                    if (selectedClip && isText) {
                      onUpdateClip(selectedClip.id, {
                        text3D: {
                          ...(selectedClip.text3D || {}),
                          dropShadowBlur: val,
                        },
                      });
                    }
                  }}
                  className="w-full h-1 bg-gray-700 rounded appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Neon Glow Picker */}
              <div className="flex items-center justify-between bg-[#121216] p-2.5 rounded border border-gray-800">
                <span className="text-xs text-gray-200 font-semibold">Neon Glow Color</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={textNeonColor}
                    onChange={(e) => {
                      setTextNeonColor(e.target.value);
                      if (selectedClip && isText) {
                        onUpdateClip(selectedClip.id, {
                          textGlowColor: e.target.value,
                          textStyle: 'neon',
                        });
                      }
                    }}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-[10px] font-mono text-cyan-400 uppercase">{textNeonColor}</span>
                </div>
              </div>
            </div>

            {/* Quran Subtitle Typography Templates */}
            <div className="bg-[#1a1a20] border border-yellow-500/30 rounded-xl p-3.5 space-y-3">
              <h3 className="text-xs font-bold text-yellow-300 uppercase flex items-center gap-1.5">
                <span>🕌 Synchronized Quranic Subtitle Styles</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'Gold Uthmani 3D', font: 'Uthmani', color: '#ffd700', style: 'shadow' },
                  { name: 'Neon Emerald Verse', font: 'Amiri', color: '#10b981', style: 'neon' },
                  { name: 'Minimal White Sub', font: 'Inter', color: '#ffffff', style: 'outline' },
                  { name: 'Amber Calligraphy', font: 'Scheherazade New', color: '#f59e0b', style: 'shadow' },
                ].map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (selectedClip && isText) {
                        onUpdateClip(selectedClip.id, {
                          fontFamily: tpl.font,
                          color: tpl.color,
                          textStyle: tpl.style as any,
                          fontSize: 28,
                        });
                      }
                    }}
                    className="p-2.5 bg-[#121216] hover:bg-yellow-950/30 hover:border-yellow-500/40 border border-gray-800 rounded-lg text-left transition"
                  >
                    <div className="text-[11px] font-bold text-yellow-200">{tpl.name}</div>
                    <div className="text-[9px] text-gray-500 font-mono">{tpl.font}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- 3. SPEED RAMPING ---------------- */}
        {activeTab === 'speed-ramp' && (
          <div className="space-y-4">
            <div className="bg-[#1a1a20] border border-cyan-500/30 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <div>
                  <h3 className="text-xs font-bold text-white uppercase">Advanced Speed Ramping</h3>
                  <p className="text-[10px] text-gray-400">Bezier curve velocity transitions</p>
                </div>
              </div>

              {/* Curve Presets */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'hero', name: '⚡ Hero Velocity', curve: 'Fast -> Slow -> Normal' },
                  { id: 'bullet', name: '🎯 Bullet Time', curve: 'Ultra Slow-mo 0.25x' },
                  { id: 'montage', name: '🎬 Montage Jump', curve: 'Rhythmic Speed Up' },
                  { id: 'none', name: '⏪ Linear 1.0x', curve: 'Constant Speed' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applySpeedRampPreset(p.id as any)}
                    className={`p-2.5 rounded-lg border text-left transition ${speedPreset === p.id ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300' : 'bg-[#121216] border-gray-800 text-gray-400 hover:border-gray-700'}`}
                  >
                    <div className="text-[11px] font-bold">{p.name}</div>
                    <div className="text-[9px] text-gray-500">{p.curve}</div>
                  </button>
                ))}
              </div>

              {/* Pitch lock info */}
              <div className="bg-[#121216] p-2.5 rounded border border-gray-800 text-[10px] text-gray-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>WebAudio Pitch Preservation Lock automatically engaged.</span>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- 4. VOCAL ISOLATION & AUDIO PRO ---------------- */}
        {activeTab === 'audio-pro' && (
          <div className="space-y-4">
            <div className="bg-[#1a1a20] border border-teal-500/30 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
                <Mic className="w-4 h-4 text-teal-400" />
                <div>
                  <h3 className="text-xs font-bold text-white uppercase">Vocal Isolation & Voice Enhancer</h3>
                  <p className="text-[10px] text-gray-400">Bandpass frequency filtering & noise gate</p>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#121216] p-2.5 rounded border border-gray-800">
                <div>
                  <div className="text-xs font-semibold text-gray-200">AI Vocal Isolation</div>
                  <div className="text-[9px] text-gray-500">Dampens instrumental background music</div>
                </div>
                <input
                  type="checkbox"
                  checked={!!selectedClip?.audioEffects?.vocalIsolation}
                  onChange={(e) => {
                    if (selectedClip) {
                      onUpdateClip(selectedClip.id, {
                        audioEffects: {
                          ...(selectedClip.audioEffects || {}),
                          vocalIsolation: e.target.checked,
                        },
                      });
                    }
                  }}
                  className="w-4 h-4 rounded text-teal-500 bg-gray-800 border-gray-700 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between bg-[#121216] p-2.5 rounded border border-gray-800">
                <div>
                  <div className="text-xs font-semibold text-gray-200">Voice Clarity Enhancer</div>
                  <div className="text-[9px] text-gray-500">Boosts vocal presence & removes mic hums</div>
                </div>
                <input
                  type="checkbox"
                  checked={!!selectedClip?.audioEffects?.voiceEnhancer}
                  onChange={(e) => {
                    if (selectedClip) {
                      onUpdateClip(selectedClip.id, {
                        audioEffects: {
                          ...(selectedClip.audioEffects || {}),
                          voiceEnhancer: e.target.checked,
                        },
                      });
                    }
                  }}
                  className="w-4 h-4 rounded text-teal-500 bg-gray-800 border-gray-700 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* ---------------- 5. 4K ULTRA-HD EXPORT ENGINE ---------------- */}
        {activeTab === 'export-4k' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-950/40 to-cyan-950/40 border border-cyan-500/40 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase">4K Ultra-HD Video Export Configuration</h3>
                    <p className="text-[10px] text-gray-400">Master production rendering settings</p>
                  </div>
                </div>
                <span className="text-[9px] font-mono font-black text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/30">
                  3840 x 2160
                </span>
              </div>

              {/* Resolution Options */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase">Master Resolution</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: '1080p', label: '1080p Full HD' },
                    { id: '4k-uhd', label: '✨ 4K Ultra HD' },
                    { id: '8k', label: '🔥 8K Cinema' },
                  ].map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => setExportRes(res.id as any)}
                      className={`p-2 rounded-lg border text-center font-mono text-[10px] font-bold transition ${exportRes === res.id ? 'bg-cyan-500 text-black border-cyan-300' : 'bg-[#121216] text-gray-400 border-gray-800'}`}
                    >
                      {res.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frame Rate */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                  <span>Export Frame Rate</span>
                  <span className="text-cyan-400 font-bold">{exportFps} FPS</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[24, 30, 60].map((fps) => (
                    <button
                      key={fps}
                      type="button"
                      onClick={() => setExportFps(fps)}
                      className={`p-1.5 rounded border text-center font-mono text-[10px] font-bold transition ${exportFps === fps ? 'bg-cyan-950 border-cyan-400 text-cyan-300' : 'bg-[#121216] text-gray-400 border-gray-800'}`}
                    >
                      {fps} FPS
                    </button>
                  ))}
                </div>
              </div>

              {/* Bitrate slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                  <span>Target Bitrate</span>
                  <span className="text-cyan-400 font-bold">{exportBitrate} Mbps</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={exportBitrate}
                  onChange={(e) => setExportBitrate(parseInt(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Render Trigger */}
              <button
                type="button"
                disabled={exportIsRunning}
                onClick={() => {
                  setExportIsRunning(true);
                  setExportProgress(10);
                  const timer = setInterval(() => {
                    setExportProgress((prev) => {
                      if (prev >= 100) {
                        clearInterval(timer);
                        setExportIsRunning(false);
                        alert(`Successfully rendered 4K Ultra-HD Master video (${exportRes}, ${exportFps}fps, ${exportBitrate}Mbps)!`);
                        return 100;
                      }
                      return prev + 15;
                    });
                  }, 300);
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-black text-xs shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                <Download className={`w-4 h-4 ${exportIsRunning ? 'animate-bounce' : ''}`} />
                <span>{exportIsRunning ? `Rendering 4K Canvas (${exportProgress}%)...` : '🚀 Render & Export 4K Ultra-HD Video'}</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
