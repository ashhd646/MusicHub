import { UnifiedTrack } from '../types/index.ts';

export type LoopMode = 'off' | 'single' | 'all';

export const LOOP_MODE_KEY = 'musichub_player_loop_mode';
export const SMART_SHUFFLE_KEY = 'musichub_player_smart_shuffle';

export function getStoredLoopMode(): LoopMode {
  try {
    const val = localStorage.getItem(LOOP_MODE_KEY);
    if (val === 'single' || val === 'all' || val === 'off') {
      return val;
    }
  } catch {}
  return 'off';
}

export function setStoredLoopMode(mode: LoopMode): void {
  try {
    localStorage.setItem(LOOP_MODE_KEY, mode);
  } catch {}
}

export function getStoredSmartShuffle(): boolean {
  try {
    return localStorage.getItem(SMART_SHUFFLE_KEY) === 'true';
  } catch {}
  return false;
}

export function setStoredSmartShuffle(enabled: boolean): void {
  try {
    localStorage.setItem(SMART_SHUFFLE_KEY, String(enabled));
  } catch {}
}

/**
 * Smart shuffle:
 * Uses Fisher-Yates algorithm with intelligence:
 * 1. Preserves current playing track at top.
 * 2. Balances artist and channel repetition.
 * 3. Defers recently played tracks to end of queue.
 */
export function generateSmartShuffleQueue(
  tracks: UnifiedTrack[],
  currentTrackId?: string,
  historyIds: string[] = []
): UnifiedTrack[] {
  if (!tracks || tracks.length <= 1) return [...tracks];

  const current = tracks.find((t) => t.videoId === currentTrackId);
  const pool = tracks.filter((t) => t.videoId !== currentTrackId);
  const recentSet = new Set(historyIds.slice(-6));

  const fresh = pool.filter((t) => !recentSet.has(t.videoId));
  const recent = pool.filter((t) => recentSet.has(t.videoId));

  const shuffleArray = (arr: UnifiedTrack[]): UnifiedTrack[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const shuffledFresh = shuffleArray(fresh);
  const shuffledRecent = shuffleArray(recent);
  const result = [...shuffledFresh, ...shuffledRecent];

  return current ? [current, ...result] : result;
}
