with open('src/components/Timeline.tsx', 'r') as f:
    content = f.read()

import re

# In Timeline.tsx, we have:
# {sortedTracks.length === 0 ? ( ... ) : (
#   sortedTracks.map((track, trackIdx) => {

new_render = """
              {sortedTracks.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 font-mono text-[10px]">
                  Drop media here to create your first track
                </div>
              ) : (
                [...sortedTracks, { id: 'ghost-track-placeholder', name: 'Drop here to create new track', type: draggingClips?.clips[0]?.type || ClipType.VIDEO, clips: [], hidden: true, locked: true }].map((track, trackIdx) => {
"""

content = re.sub(
    r'\{sortedTracks\.length === 0 \? \(\s*<div className="h-full flex items-center justify-center text-gray-500 font-mono text-\[10px\]">\s*Drop media here to create your first track\s*<\/div>\s*\) : \(\s*sortedTracks\.map\(\(track, trackIdx\) => \{',
    new_render.strip(),
    content,
    flags=re.DOTALL
)

with open('src/components/Timeline.tsx', 'w') as f:
    f.write(content)

