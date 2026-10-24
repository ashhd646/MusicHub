import { UnifiedTrack } from '../types/index.ts';

const SAVED_TRACKS_KEY = 'musichub_saved_tracks_v1';
let memoryStorageFallback: UnifiedTrack[] = [];

export function getSavedTracks(): UnifiedTrack[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return memoryStorageFallback;
    }
    const raw = localStorage.getItem(SAVED_TRACKS_KEY);
    if (!raw) return memoryStorageFallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return memoryStorageFallback;
  } catch (e) {
    return memoryStorageFallback;
  }
}

export function isTrackSaved(videoId: string): boolean {
  try {
    if (!videoId) return false;
    const saved = getSavedTracks();
    return Array.isArray(saved) && saved.some((t) => t && t.videoId === videoId);
  } catch {
    return false;
  }
}

export function saveTrackToDevice(track: UnifiedTrack): boolean {
  if (!track || !track.videoId) return false;
  try {
    const saved = getSavedTracks();
    if (saved.some((t) => t && t.videoId === track.videoId)) {
      return true;
    }
    const updated = [track, ...saved];
    memoryStorageFallback = updated;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(SAVED_TRACKS_KEY, JSON.stringify(updated));
    }
    return true;
  } catch (err) {
    memoryStorageFallback = [track, ...memoryStorageFallback];
    return true;
  }
}

export function removeTrackFromDevice(videoId: string): void {
  if (!videoId) return;
  try {
    const saved = getSavedTracks();
    const updated = saved.filter((t) => t && t.videoId !== videoId);
    memoryStorageFallback = updated;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(SAVED_TRACKS_KEY, JSON.stringify(updated));
    }
  } catch {
    memoryStorageFallback = memoryStorageFallback.filter((t) => t && t.videoId !== videoId);
  }
}

/**
 * Triggers native browser file download directly to the user device's Downloads folder / ROM
 */
export async function downloadAudioFile(url: string, filename: string): Promise<boolean> {
  if (!url) return false;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename.endsWith('.mp3') ? filename : `${filename}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    return true;
  } catch (err) {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    } catch {
      return false;
    }
  }
}
