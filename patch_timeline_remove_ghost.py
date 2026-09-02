import re
with open('src/components/Timeline.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    '{[...sortedTracks, ...(draggingClips && !draggingClips.handle ? [{ id: \'new-track-placeholder\', name: \'Drop below\', type: draggingClips.clips[0]?.type || ClipType.VIDEO, clips: [], hidden: true, locked: false } as any] : [])].map((track, trackIdx) => {',
    '{sortedTracks.map((track, trackIdx) => {'
)

content = content.replace(
    '[...sortedTracks, ...(draggingClips && !draggingClips.handle ? [{ id: \'new-track-placeholder\', name: \'New Track (Drop to create)\', type: draggingClips.clips[0]?.type || ClipType.VIDEO, clips: [], hidden: true, locked: false } as any] : [])].map((track, trackIdx) => {',
    'sortedTracks.map((track, trackIdx) => {'
)

with open('src/components/Timeline.tsx', 'w') as f:
    f.write(content)
