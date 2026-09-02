import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# signature
content = content.replace(
    'const batchUpdateClipTimes = (updates: { id: string; start: number; duration: number; trackId?: string }[]) => {',
    'const batchUpdateClipTimes = (updates: { id: string; start: number; duration: number; trackId?: string }[], isDragEnd: boolean = false) => {'
)

# first return path
new_path1 = """
    if (!hasTrackChange) {
      setTracks(prev => {
        const result = prev.map(t => ({
          ...t,
          clips: t.clips.map(c => {
            const u = updateMap.get(c.id);
            return u ? { ...c, start: u.start, duration: u.duration } : c;
          })
        }));
        if (isDragEnd) return result.filter(track => track.clips.length > 0 || track.id === '1');
        return result;
      });
      return;
    }
"""
content = re.sub(
    r'if \(!hasTrackChange\) \{.*?return;\s*\}',
    new_path1.strip(),
    content,
    flags=re.DOTALL
)

# second return path
new_path2 = """
      if (isDragEnd) {
        return resultTracks.filter(track => track.clips.length > 0 || track.id === '1');
      }
      return resultTracks;
    });
  };
"""
content = re.sub(
    r'return resultTracks;\s*\}\);\s*\};',
    new_path2.strip(),
    content,
    flags=re.DOTALL
)

with open('src/App.tsx', 'w') as f:
    f.write(content)

