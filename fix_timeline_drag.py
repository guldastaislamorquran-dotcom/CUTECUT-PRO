import re
with open('src/components/Timeline.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'trackId: targetTrack.id,',
    'trackId: targetTrackId,'
)

with open('src/components/Timeline.tsx', 'w') as f:
    f.write(content)
