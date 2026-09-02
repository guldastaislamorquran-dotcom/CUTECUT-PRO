with open('src/components/Timeline.tsx', 'r') as f:
    content = f.read()

import re

# In `handleMove`:
# else if (gridWrapperRef.current && gridScrollRef.current) {
#   const gridRect = gridWrapperRef.current.getBoundingClientRect();
#   const relativeY = (clientY - gridRect.top) + gridScrollRef.current.scrollTop;
#   const calculatedIdx = Math.floor((relativeY - 6) / 80);
#   if (calculatedIdx >= 0 && calculatedIdx < tracksRef.current.length) {
#     currentTargetTrackId = tracksRef.current[calculatedIdx].id;
#     currentTargetTrackIdx = calculatedIdx;
#   }
# }

new_code = """
          } else if (gridWrapperRef.current && gridScrollRef.current) {
            const gridRect = gridWrapperRef.current.getBoundingClientRect();
            const relativeY = (clientY - gridRect.top) + gridScrollRef.current.scrollTop;
            const calculatedIdx = Math.floor((relativeY - 6) / 80);
            if (calculatedIdx >= 0 && calculatedIdx < tracksRef.current.length) {
              currentTargetTrackId = tracksRef.current[calculatedIdx].id;
              currentTargetTrackIdx = calculatedIdx;
            } else if (calculatedIdx >= tracksRef.current.length) {
              // Create a new track placeholder ID if dragging below all tracks
              // We need a stable ID for the drag session to group them together
              if (!activeDragging.targetTrackId || !activeDragging.targetTrackId.startsWith('new-track-')) {
                currentTargetTrackId = 'new-track-' + Date.now();
              } else {
                currentTargetTrackId = activeDragging.targetTrackId;
              }
              currentTargetTrackIdx = tracksRef.current.length;
            }
          }
"""

content = re.sub(
    r'\} else if \(gridWrapperRef\.current && gridScrollRef\.current\) \{.*?currentTargetTrackIdx = calculatedIdx;\s*\}\s*\}',
    new_code.strip(),
    content,
    flags=re.DOTALL
)

with open('src/components/Timeline.tsx', 'w') as f:
    f.write(content)

