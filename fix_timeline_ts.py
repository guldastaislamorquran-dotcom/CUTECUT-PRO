import re
with open('src/components/Timeline.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    ': clip.type === ClipType.TEXT \n                                ? \'bg-[#2e1065]/90 text-purple-200 border-purple-800/60\' ',
    ''
)
content = content.replace(
    ': clip.type === ClipType.TEXT\n                                ? \'bg-[#2e1065]/90 text-purple-200 border-purple-800/60\'',
    ''
)
content = content.replace(
    ": clip.type === ClipType.TEXT \n                                ? 'bg-[#2e1065]/90 text-purple-200 border-purple-800/60' ",
    ""
)
# Let's just use regex
content = re.sub(
    r': clip\.type === ClipType\.TEXT\s*\? \'bg-\[#2e1065\]/90 text-purple-200 border-purple-800/60\'',
    '',
    content
)

with open('src/components/Timeline.tsx', 'w') as f:
    f.write(content)
