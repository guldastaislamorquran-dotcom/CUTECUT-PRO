import re
with open('src/components/Timeline.tsx', 'r') as f:
    content = f.read()

new_logic = """
              let clipTargetTrackId = item.sourceTrackId || item.trackId;
              if (isNewTrack) {
                clipTargetTrackId = currentTargetTrackId;
              } else if (trackIdxDelta !== 0) {
                const clipSourceTrackIdx = tracksRef.current.findIndex(t => t.id === (item.sourceTrackId || item.trackId));
                if (clipSourceTrackIdx !== -1) {
                  const clipTargetTrackIdx = Math.max(0, Math.min(tracksRef.current.length - 1, clipSourceTrackIdx + trackIdxDelta));
                  clipTargetTrackId = tracksRef.current[clipTargetTrackIdx].id;
                }
              }
"""

content = re.sub(
    r'let clipTargetTrackId = item\.sourceTrackId \|\| item\.trackId;\s*if \(trackIdxDelta !== 0\) \{.*?\}\s*\}',
    new_logic.strip(),
    content,
    flags=re.DOTALL
)

with open('src/components/Timeline.tsx', 'w') as f:
    f.write(content)
