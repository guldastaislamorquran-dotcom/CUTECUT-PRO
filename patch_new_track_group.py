import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

new_logic = """
      newTracksMap.forEach((clips, targetTrackId) => {
        // Group incoming clips by their type so mixed selections create separate tracks
        const clipsByType = new Map<ClipType, Clip[]>();
        clips.forEach(clip => {
          if (!clipsByType.has(clip.type)) clipsByType.set(clip.type, []);
          clipsByType.get(clip.type)!.push(clip);
        });

        let isFirst = true;
        clipsByType.forEach((typeClips, clipType) => {
          let trackName = 'New Track';
          if (clipType === ClipType.VIDEO) trackName = 'Video Track';
          if (clipType === ClipType.AUDIO) trackName = 'Audio Track';
          if (clipType === ClipType.TEXT) trackName = 'Text Track';
          if (clipType === ClipType.IMAGE) trackName = 'Image Track';
          if (clipType === ClipType.EFFECT) trackName = 'Effect Track';
          
          let newTrackId = targetTrackId;
          if (targetTrackId.startsWith('new-track')) {
            newTrackId = crypto.randomUUID();
          } else if (!isFirst) {
            newTrackId = crypto.randomUUID(); // if reusing an ID, only reuse for the first one
          }
          isFirst = false;

          resultTracks.push({
            id: newTrackId,
            name: trackName,
            type: clipType,
            clips: typeClips.sort((a, b) => a.start - b.start),
          });
        });
      });
"""

content = re.sub(
    r'newTracksMap\.forEach\(\(clips, targetTrackId\) => \{.*?resultTracks\.push\(\{.*?\}\);\s*\}\);',
    new_logic.strip(),
    content,
    flags=re.DOTALL
)

with open('src/App.tsx', 'w') as f:
    f.write(content)

