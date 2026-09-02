import re

with open('src/components/MediaPanel.tsx', 'r') as f:
    content = f.read()

# We replaced up to: <div className="flex flex-col items-center py-2 gap-2">
# The next line is:           {/* Left Scroll Button */}

# We want to remove the left scroll button, the tabs container wrapper, 
# modify the button classes to be vertical, remove the right scroll button,
# and remove the bottom tab navigation slider.

# Let's replace the button classes first to match the CapCut style.
# We will use regex to find the buttons inside the tabs container.

start_idx = content.find('          {/* Left Scroll Button */}')
end_idx = content.find('      {/* Content Area */}')

if start_idx != -1 and end_idx != -1:
    tabs_section = content[start_idx:end_idx]
    
    # Let's create the new vertical tabs section
    new_tabs = """
          <button
            id="tab-upload"
            onClick={() => setActiveTab('upload')}
            className={`w-12 h-14 rounded-lg flex flex-col items-center justify-center gap-1 transition ${activeTab === 'upload' ? 'text-cyan-400 bg-[#22222a] font-bold border border-cyan-500/30' : 'text-gray-400 hover:text-white hover:bg-[#1a1a20]'}`}
          >
            <Upload className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Upload</span>
          </button>
          <button
            id="tab-video"
            onClick={() => setActiveTab('video')}
            className={`w-12 h-14 rounded-lg flex flex-col items-center justify-center gap-1 transition ${activeTab === 'video' ? 'text-cyan-400 bg-[#22222a] font-bold border border-cyan-500/30' : 'text-gray-400 hover:text-white hover:bg-[#1a1a20]'}`}
          >
            <Film className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Media</span>
          </button>
          <button
            id="tab-audio"
            onClick={() => setActiveTab('audio')}
            className={`w-12 h-14 rounded-lg flex flex-col items-center justify-center gap-1 transition ${activeTab === 'audio' ? 'text-cyan-400 bg-[#22222a] font-bold border border-cyan-500/30' : 'text-gray-400 hover:text-white hover:bg-[#1a1a20]'}`}
          >
            <Music className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Audio</span>
          </button>
          <button
            id="tab-image"
            onClick={() => setActiveTab('image')}
            className={`w-12 h-14 rounded-lg flex flex-col items-center justify-center gap-1 transition ${activeTab === 'image' ? 'text-cyan-400 bg-[#22222a] font-bold border border-cyan-500/30' : 'text-gray-400 hover:text-white hover:bg-[#1a1a20]'}`}
          >
            <ImageIcon className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Image</span>
          </button>
          <button
            id="tab-text"
            onClick={() => setActiveTab('text')}
            className={`w-12 h-14 rounded-lg flex flex-col items-center justify-center gap-1 transition ${activeTab === 'text' ? 'text-cyan-400 bg-[#22222a] font-bold border border-cyan-500/30' : 'text-gray-400 hover:text-white hover:bg-[#1a1a20]'}`}
          >
            <Type className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Text</span>
          </button>
          <button
            id="tab-quran"
            onClick={() => setActiveTab('quran')}
            className={`w-12 h-14 rounded-lg flex flex-col items-center justify-center gap-1 transition ${activeTab === 'quran' ? 'text-amber-400 bg-amber-950/40 font-bold border border-amber-500/50' : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-950/20'}`}
            title="Quran AI v4"
          >
            <BookOpen className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Quran</span>
          </button>
          <button
            id="tab-quran-visuals"
            onClick={() => setActiveTab('quran-visuals')}
            className={`w-12 h-14 rounded-lg flex flex-col items-center justify-center gap-1 transition ${activeTab === 'quran-visuals' ? 'text-emerald-400 bg-emerald-950/50 font-bold border border-emerald-500/50' : 'text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-950/20'}`}
            title="AI Ayah Media & Background Scenery Generator"
          >
            <Sparkles className="w-4 h-4 mb-0.5" />
            <span className="text-[9px] leading-tight text-center">Visuals</span>
          </button>
          <button
            id="tab-effects"
            onClick={() => setActiveTab('effects')}
            className={`w-12 h-14 rounded-lg flex flex-col items-center justify-center gap-1 transition ${activeTab === 'effects' ? 'text-pink-400 bg-[#22222a] font-bold border border-pink-500/30' : 'text-gray-400 hover:text-white hover:bg-[#1a1a20]'}`}
          >
            <Wand2 className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Effect</span>
          </button>
          <button
            id="tab-background"
            onClick={() => setActiveTab('background')}
            className={`w-12 h-14 rounded-lg flex flex-col items-center justify-center gap-1 transition ${activeTab === 'background' ? 'text-cyan-400 bg-[#22222a] font-bold border border-cyan-500/30' : 'text-gray-400 hover:text-white hover:bg-[#1a1a20]'}`}
          >
            <Globe className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Free BG</span>
          </button>
          <button
            id="tab-watermark"
            onClick={() => setActiveTab('watermark')}
            className={`w-12 h-14 rounded-lg flex flex-col items-center justify-center gap-1 transition ${activeTab === 'watermark' ? 'text-amber-400 bg-[#22222a] font-bold border border-amber-500/30' : 'text-gray-400 hover:text-white hover:bg-[#1a1a20]'}`}
          >
            <Shield className="w-4 h-4 mb-0.5" />
            <span className="text-[9px]">Branding</span>
          </button>
        </div>
      </div>
"""

    new_content = content[:start_idx] + new_tabs + content[end_idx:]
    with open('src/components/MediaPanel.tsx', 'w') as f:
        f.write(new_content)
    print("Patched MediaPanel layout")
else:
    print("Could not find bounds")
