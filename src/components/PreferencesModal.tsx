import React, { useState, useEffect } from 'react';
import { X, Cpu, Zap, HardDrive, Settings, Monitor, Volume2, Save, MousePointerClick } from 'lucide-react';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'performance' | 'general' | 'editing'>('performance');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) setSaved(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#121217] w-full max-w-2xl rounded-xl border border-[#232330] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#232330] bg-[#0c0c10]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#232330] rounded-lg">
              <Settings className="w-5 h-5 text-gray-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-100">Preferences & Settings</h2>
              <p className="text-xs text-gray-500">Configure performance, hardware, and UI behaviors.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-[#232330] text-gray-400 hover:text-white rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex h-[400px]">
          {/* Sidebar */}
          <div className="w-48 bg-[#0c0c10] border-r border-[#232330] flex flex-col p-2 gap-1">
            <button 
              onClick={() => setActiveTab('performance')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activeTab === 'performance' ? 'bg-[#232330] text-white font-medium' : 'text-gray-400 hover:bg-[#1a1a24] hover:text-gray-200'}`}
            >
              <Cpu className="w-4 h-4" /> Performance
            </button>
            <button 
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activeTab === 'general' ? 'bg-[#232330] text-white font-medium' : 'text-gray-400 hover:bg-[#1a1a24] hover:text-gray-200'}`}
            >
              <Monitor className="w-4 h-4" /> General
            </button>
            <button 
              onClick={() => setActiveTab('editing')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activeTab === 'editing' ? 'bg-[#232330] text-white font-medium' : 'text-gray-400 hover:bg-[#1a1a24] hover:text-gray-200'}`}
            >
              <MousePointerClick className="w-4 h-4" /> Editing
            </button>
          </div>

          {/* Main Area */}
          <div className="flex-1 p-6 overflow-y-auto bg-[#121217]">
            
            {/* Performance Tab */}
            {activeTab === 'performance' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-cyan-400" /> Hardware Acceleration
                  </h3>
                  <div className="bg-[#1a1a24] p-4 rounded-lg border border-[#2a2a35]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-200">GPU Rendering (WebGL/WebGPU)</div>
                        <div className="text-xs text-gray-500 mt-1">Accelerates playback and effects rendering using graphics hardware.</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-[#3a3a45] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-purple-400" /> Timeline Preview Resolution
                  </h3>
                  <div className="bg-[#1a1a24] p-4 rounded-lg border border-[#2a2a35] space-y-3">
                    <div className="text-xs text-gray-500 mb-2">Lower resolutions improve playback smoothness on slower devices.</div>
                    <select className="w-full bg-[#121217] border border-[#3a3a45] text-sm text-gray-200 rounded-md px-3 py-2 outline-none focus:border-cyan-500">
                      <option value="1">Full Quality (1080p+)</option>
                      <option value="2">1/2 Quality (720p)</option>
                      <option value="4" selected>1/4 Quality (480p) - Recommended</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-amber-400" /> Cache & Memory Limit
                  </h3>
                  <div className="bg-[#1a1a24] p-4 rounded-lg border border-[#2a2a35] space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300">Max Render Cache Size</span>
                        <span className="text-cyan-400">4.0 GB</span>
                      </div>
                      <input type="range" min="1" max="16" defaultValue="4" className="w-full accent-cyan-500" />
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 bg-[#2a2a35] hover:bg-[#3a3a45] text-xs rounded transition-colors text-gray-300">
                        Clear Cache (2.1GB Used)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300">Application Settings</h3>
                  <div className="bg-[#1a1a24] p-4 rounded-lg border border-[#2a2a35] space-y-4">
                    <div>
                      <div className="text-sm text-gray-200 mb-2">Interface Language</div>
                      <select className="w-full bg-[#121217] border border-[#3a3a45] text-sm text-gray-200 rounded-md px-3 py-2 outline-none focus:border-cyan-500">
                        <option value="en">English</option>
                        <option value="ur">Urdu (اردو)</option>
                        <option value="ar">Arabic (العربية)</option>
                      </select>
                    </div>
                    <hr className="border-[#2a2a35]" />
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-200">Auto-Save Project</div>
                        <div className="text-xs text-gray-500 mt-1">Automatically save to cloud/local state</div>
                      </div>
                      <select className="bg-[#121217] border border-[#3a3a45] text-sm text-gray-200 rounded-md px-3 py-1 outline-none">
                        <option value="1">Every 1 min</option>
                        <option value="5" selected>Every 5 mins</option>
                        <option value="10">Every 10 mins</option>
                        <option value="0">Off</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Editing Tab */}
            {activeTab === 'editing' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300">Default Durations</h3>
                  <div className="bg-[#1a1a24] p-4 rounded-lg border border-[#2a2a35] space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-200">Photo / Image Duration</div>
                      <div className="flex items-center gap-2">
                        <input type="number" defaultValue="5.0" step="0.5" className="w-20 bg-[#121217] border border-[#3a3a45] text-sm text-center text-gray-200 rounded-md px-2 py-1 outline-none" />
                        <span className="text-xs text-gray-500">secs</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-200">Transition Duration</div>
                      <div className="flex items-center gap-2">
                        <input type="number" defaultValue="1.0" step="0.1" className="w-20 bg-[#121217] border border-[#3a3a45] text-sm text-center text-gray-200 rounded-md px-2 py-1 outline-none" />
                        <span className="text-xs text-gray-500">secs</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#232330] bg-[#0c0c10] flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${saved ? 'bg-green-500 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white'} flex items-center gap-2`}
          >
            {saved ? <><Save className="w-4 h-4" /> Saved!</> : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
};
