import re
with open('src/components/Timeline.tsx', 'r') as f:
    content = f.read()

# Fix the call in handleEnd:
content = re.sub(
    r'let targetStart = Math\.max\(0, item\.initialStart \+ effectiveDelta\);\s*if \(snapToGridRef\.current\) \{\s*targetStart = Math\.round\(targetStart \* 30\) / 30;\s*\}\s*return \{\s*id: item\.id,\s*start: targetStart,\s*duration: item\.initialDuration,\s*trackId: targetTrackId,\s*\};\s*\}\);\s*if \(onBatchUpdateClipTimesRef\.current\) \{\s*onBatchUpdateClipTimesRef\.current\(updates, false\);\s*\}',
    r'let targetStart = Math.max(0, item.initialStart + effectiveDelta);\n            if (snapToGridRef.current) {\n              targetStart = Math.round(targetStart * 30) / 30;\n            }\n            return {\n              id: item.id,\n              start: targetStart,\n              duration: item.initialDuration,\n              trackId: targetTrackId,\n            };\n          });\n          if (onBatchUpdateClipTimesRef.current) {\n            onBatchUpdateClipTimesRef.current(updates, true);\n          }',
    content
)

with open('src/components/Timeline.tsx', 'w') as f:
    f.write(content)
