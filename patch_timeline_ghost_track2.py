import re
with open('src/components/Timeline.tsx', 'r') as f:
    content = f.read()

new_render = """
              ) : (
                [...sortedTracks, ...(draggingClips && !draggingClips.handle ? [{ id: 'new-track-placeholder', name: 'New Track (Drop to create)', type: draggingClips.clips[0]?.type || ClipType.VIDEO, clips: [], hidden: true, locked: false } as any] : [])].map((track, trackIdx) => {
"""

content = re.sub(
    r'\) : \(\s*sortedTracks\.map\(\(track, trackIdx\) => \{',
    new_render.strip(),
    content,
    flags=re.DOTALL
)

with open('src/components/Timeline.tsx', 'w') as f:
    f.write(content)
