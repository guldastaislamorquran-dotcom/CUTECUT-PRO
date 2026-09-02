import re
with open('src/components/Timeline.tsx', 'r') as f:
    content = f.read()

new_render = """
            <div className="flex flex-col gap-2 min-w-full pb-8">
              {[...sortedTracks, ...(draggingClips && !draggingClips.handle ? [{ id: 'new-track-placeholder', name: 'Drop below', type: draggingClips.clips[0]?.type || ClipType.VIDEO, clips: [], hidden: true, locked: false } as any] : [])].map((track, trackIdx) => {
"""

content = re.sub(
    r'<div className="flex flex-col gap-2 min-w-full pb-8">\s*\{sortedTracks\.map\(\(track, trackIdx\) => \{',
    new_render.strip(),
    content,
    flags=re.DOTALL
)

with open('src/components/Timeline.tsx', 'w') as f:
    f.write(content)

