with open('src/App.tsx', 'r') as f:
    content = f.read()

import re

# In `batchUpdateClipTimes`, we want to create missing tracks.
# Currently it does: 
# return updatedTracks.map(track => { ... });
# Let's replace that with:
new_logic = """
      const resultTracks = updatedTracks.map(track => {
        const incoming = movedClips.filter(m => m.targetTrackId === track.id).map(m => m.clip);
        if (incoming.length > 0) {
          return {
            ...track,
            clips: [...track.clips, ...incoming].sort((a, b) => a.start - b.start),
          };
        }
        return track;
      });
      
      // If there are clips targeted to a track that doesn't exist yet (like 'new-track-uuid'), create it.
      const existingTrackIds = new Set(resultTracks.map(t => t.id));
      const newTracksMap = new Map<string, Clip[]>();
      movedClips.forEach(m => {
        if (!existingTrackIds.has(m.targetTrackId)) {
          if (!newTracksMap.has(m.targetTrackId)) newTracksMap.set(m.targetTrackId, []);
          newTracksMap.get(m.targetTrackId)!.push(m.clip);
        }
      });
      
      newTracksMap.forEach((clips, targetTrackId) => {
        const clipType = clips[0]?.type || ClipType.VIDEO;
        let trackName = 'New Track';
        if (clipType === ClipType.VIDEO) trackName = 'Video Track';
        if (clipType === ClipType.AUDIO) trackName = 'Audio Track';
        if (clipType === ClipType.TEXT) trackName = 'Text Track';
        if (clipType === ClipType.IMAGE) trackName = 'Image Track';
        if (clipType === ClipType.EFFECT) trackName = 'Effect Track';
        
        resultTracks.push({
          id: targetTrackId.startsWith('new-track') ? crypto.randomUUID() : targetTrackId,
          name: trackName,
          type: clipType,
          clips: clips.sort((a, b) => a.start - b.start),
        });
      });

      return resultTracks;
"""

content = re.sub(
    r'return updatedTracks\.map\(track => \{.*?return track;\s*\}\);',
    new_logic,
    content,
    flags=re.DOTALL
)

with open('src/App.tsx', 'w') as f:
    f.write(content)
