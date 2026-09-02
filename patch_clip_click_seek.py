import re
with open('src/components/Timeline.tsx', 'r') as f:
    content = f.read()

new_logic = """
    const isMultiSelect = 'ctrlKey' in e ? (e.ctrlKey || e.metaKey || e.shiftKey) : false;

    onSelectClip(clip.id, isMultiSelect);

    // Jump playhead to click location when clicking a clip
    if (!isMultiSelect && !handle) {
      const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      handleScrub(clientX);
    }
"""

content = re.sub(
    r'const isMultiSelect = \'ctrlKey\' in e \? \(e\.ctrlKey \|\| e\.metaKey \|\| e\.shiftKey\) : false;\s*onSelectClip\(clip\.id, isMultiSelect\);',
    new_logic.strip(),
    content,
    flags=re.DOTALL
)

with open('src/components/Timeline.tsx', 'w') as f:
    f.write(content)
