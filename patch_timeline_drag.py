import re

with open('src/components/Timeline.tsx', 'r') as f:
    content = f.read()

# Update interface
content = content.replace(
    'onBatchUpdateClipTimes?: (updates: { id: string; start: number; duration: number; trackId?: string }[]) => void;',
    'onBatchUpdateClipTimes?: (updates: { id: string; start: number; duration: number; trackId?: string }[], isDragEnd?: boolean) => void;'
)

# Update handleMove
content = re.sub(
    r'const targetTrack = tracksRef\.current\.find\(t => t\.id === currentTargetTrackId\);\s*if \(targetTrack && !targetTrack\.locked\) \{',
    r'const targetTrack = tracksRef.current.find(t => t.id === currentTargetTrackId);\n          const isNewTrack = currentTargetTrackId.startsWith(\'new-track-\');\n          if ((targetTrack && !targetTrack.locked) || isNewTrack) {',
    content
)

content = content.replace(
    'onBatchUpdateClipTimesRef.current(updates);',
    'onBatchUpdateClipTimesRef.current(updates, false);'
)

# Update handleEnd
content = re.sub(
    r'if \(!activeDragging\.handle && targetTrackId && targetTrack && !targetTrack\.locked\) \{',
    r'if (!activeDragging.handle && targetTrackId && ((targetTrack && !targetTrack.locked) || targetTrackId.startsWith(\'new-track-\'))) {',
    content
)

# In handleEnd, we want to call onBatchUpdateClipTimes with true for isDragEnd
content = re.sub(
    r'if \(onBatchUpdateClipTimesRef\.current\) \{\s*onBatchUpdateClipTimesRef\.current\(updates\);\s*\}',
    r'if (onBatchUpdateClipTimesRef.current) {\n            onBatchUpdateClipTimesRef.current(updates, true);\n          }',
    content
)

with open('src/components/Timeline.tsx', 'w') as f:
    f.write(content)

