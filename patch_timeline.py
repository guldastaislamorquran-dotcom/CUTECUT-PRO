import re

with open('src/components/Timeline.tsx', 'r') as f:
    content = f.read()

# 1. Update Track Headers Left Panel Heights
content = content.replace(
    'className={`h-[72px] min-h-[72px] border rounded-lg flex flex-col justify-between p-1.5 sm:p-2 bg-[#16161d] shadow-sm transition-all relative ${',
    'className={`border rounded-lg flex flex-col justify-between p-1.5 sm:p-2 bg-[#16161d] shadow-sm transition-all relative ${track.type === ClipType.TEXT ? \'h-[40px] min-h-[40px]\' : \'h-[72px] min-h-[72px]\'} ${'
)

# 2. Update Track Grid Body Heights
content = content.replace(
    'className={`h-[72px] min-h-[72px] border rounded-lg relative bg-[#131318] flex items-center shadow-sm overflow-hidden transition-all ${',
    'className={`border rounded-lg relative bg-[#131318] flex items-center shadow-sm overflow-hidden transition-all ${track.type === ClipType.TEXT ? \'h-[40px] min-h-[40px]\' : \'h-[72px] min-h-[72px]\'} ${'
)

# 3. Ghost Drop preview height
content = content.replace(
    'className="absolute top-[4px] h-[64px] rounded-lg border-2 border-dashed border-cyan-400 bg-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.35)] z-25 pointer-events-none flex flex-col justify-between p-1.5 animate-pulse"',
    'className={`absolute top-[4px] rounded-lg border-2 border-dashed border-cyan-400 bg-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.35)] z-25 pointer-events-none flex flex-col justify-between p-1.5 animate-pulse ${track.type === ClipType.TEXT ? \'h-[32px]\' : \'h-[64px]\'}`}'
)

# 4. Clip styling adjustments
content = content.replace(
    'className={`absolute top-[4px] h-[64px] rounded-lg flex flex-col justify-between cursor-pointer transition-colors duration-100 select-none group border shadow-sm overflow-hidden ${clipStyleClass} ${isDraggingThisClip ? \'pointer-events-none opacity-60\' : \'\'}`}',
    'className={`absolute top-[4px] ${clip.type === ClipType.TEXT ? \'h-[32px] rounded-full justify-center px-2 py-1 items-center font-bold\' : \'h-[64px] rounded-lg justify-between flex-col\'} flex cursor-pointer transition-colors duration-100 select-none group border shadow-sm overflow-hidden ${clipStyleClass} ${isDraggingThisClip ? \'pointer-events-none opacity-60\' : \'\'}`}'
)

# Hide clip header and footer details if it is a text track (to look like a rounded pill block)
# For the top header bar:
content = content.replace(
    '{/* Top Header Bar (~20px) */}',
    '{/* Top Header Bar (~20px) */}\n                            {clip.type !== ClipType.TEXT && ('
)
# We need to close the condition. 
# We need to find the closing div of the top header.
# And add the closing brace.
# Also the bottom bar:
# `{/* Bottom Info Bar (~20px) */}`
# `{clip.type !== ClipType.TEXT && (`
# Let's do this carefully with regex.

import re
content = re.sub(
    r'({\/\* Top Header Bar \(~20px\) \*\/}\s*<div className={`h-5 w-full flex items-center justify-between.*?<\/div>\s*<\/div>)',
    r'{clip.type !== ClipType.TEXT && (\n                              \1\n                            )}',
    content,
    flags=re.DOTALL
)

content = re.sub(
    r'({\/\* Bottom Info Bar \(~20px\) \*\/}\s*<div className="h-5 w-full bg-black\/40 flex items-center justify-between.*?<\/div>\s*<\/div>)',
    r'{clip.type !== ClipType.TEXT && (\n                              \1\n                            )}',
    content,
    flags=re.DOTALL
)

# And inject text content for the text clip pill:
content = content.replace(
    '                            {clip.type !== ClipType.TEXT && (',
    '                            {clip.type === ClipType.TEXT && (\n                              <div className="truncate w-full text-center text-[10px] text-white/90 drop-shadow-sm font-semibold">{clip.name}</div>\n                            )}\n                            {clip.type !== ClipType.TEXT && ('
)

with open('src/components/Timeline.tsx', 'w') as f:
    f.write(content)
print("Patched Timeline layouts")

