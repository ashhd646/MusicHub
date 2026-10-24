import { cleanSongTitleToHinglish } from './hindiTransliterator.ts';

/**
 * Service to generate and open direct PagalWorld MP3 download pages
 * Ensures all song titles (Hindi Devanagari or English) are sent in clean Hinglish.
 */

export function cleanSongTitle(title: string): string {
  return cleanSongTitleToHinglish(title);
}

/**
 * Generates the redirect URL for PagalWorld in pure Hinglish
 */
export function getPagalworldRedirectUrl(songTitle: string): string {
  const cleanHinglish = cleanSongTitleToHinglish(songTitle);
  return `/api/redirect/pagalworld?q=${encodeURIComponent(cleanHinglish)}`;
}

/**
 * Triggers direct redirect / opens PagalWorld MP3 download page in a new window/tab
 */
export function openPagalworldDownload(track: { title: string; channelTitle?: string }): void {
  const url = getPagalworldRedirectUrl(track.title);

  // Create and click anchor element to avoid popup blockers in mobile & desktop browsers
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
