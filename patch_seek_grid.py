import re
with open('src/components/Timeline.tsx', 'r') as f:
    content = f.read()

new_logic = """
  // Start marquee selection on grid background (Right-Click Drag or Left-Click Drag)
  const handleGridMouseDown = (e: React.MouseEvent) => {
    if (!gridWrapperRef.current) return;
    if (e.button !== 0 && e.button !== 2) return;

    if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      handleScrub(e.clientX);
    }

    const rect = gridWrapperRef.current.getBoundingClientRect();
"""

content = re.sub(
    r'// Start marquee selection on grid background \(Right-Click Drag or Left-Click Drag\)\s*const handleGridMouseDown = \(e: React\.MouseEvent\) => \{\s*if \(!gridWrapperRef\.current\) return;\s*if \(e\.button !== 0 && e\.button !== 2\) return;\s*const rect = gridWrapperRef\.current\.getBoundingClientRect\(\);',
    new_logic.strip(),
    content,
    flags=re.DOTALL
)

with open('src/components/Timeline.tsx', 'w') as f:
    f.write(content)
