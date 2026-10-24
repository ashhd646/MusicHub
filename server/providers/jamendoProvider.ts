/**
 * Jamendo Open Audio Music Provider
 * Provides royalty-free music discovery and full streaming previews.
 */

import type { UnifiedTrack } from '../../src/types/index.ts';

export interface JamendoSearchParams {
  q: string;
  limit?: number;
}

export class JamendoProvider {
  // Public developer test client_id for Jamendo API (documented on Jamendo developer docs)
  private clientId: string;

  constructor(clientId: string = '') {
    this.clientId = clientId || process.env.JAMENDO_CLIENT_ID || 'c045b780';
  }

  async search(params: JamendoSearchParams): Promise<{ items: UnifiedTrack[]; totalResults: number }> {
    const query = (params.q || '').trim();
    if (!query) {
      return { items: [], totalResults: 0 };
    }

    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 50);

    const url = new URL('https://api.jamendo.com/v3.0/tracks/');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('namesearch', query);
    url.searchParams.set('audioformat', 'mp32');
    url.searchParams.set('include', 'musicinfo');

    let response: Response | null = null;
    let results: any[] = [];

    // Try Jamendo API first if configured
    if (this.clientId) {
      try {
        response = await fetch(url.toString(), {
          headers: { Accept: 'application/json' },
        });
        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          results = data.results || [];
        }
      } catch (err: any) {
        console.warn('Jamendo API fetch failed, trying open audio fallback:', err.message);
      }
    }

    // If Jamendo returned empty or failed, fetch full-duration tracks via YouTube provider
    if (results.length === 0) {
      try {
        const { defaultYouTubeProvider } = await import('./youtubeProvider.ts');
        const ytResults = await defaultYouTubeProvider.searchWebYouTube(query, limit);
        return {
          items: ytResults.items,
          totalResults: ytResults.totalResults,
        };
      } catch (err) {
        console.warn('Fallback full-duration music search error:', err);
      }
    }

    const unifiedTracks: UnifiedTrack[] = results.map((track: any) => {
      const minutes = Math.floor((track.duration || 0) / 60);
      const seconds = Math.floor((track.duration || 0) % 60);
      const durationStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

      return {
        videoId: `jamendo_${track.id}`,
        title: track.name || 'Untitled',
        description: `Album: ${track.album_name || 'Single'} · Artist: ${track.artist_name || 'Independent Artist'}`,
        thumbnail: track.album_image || track.image || 'https://images.jamendo.com/track/default.jpg',
        channelTitle: track.artist_name || 'Jamendo Music',
        publishedAt: track.releasedate || new Date().toISOString(),
        source: 'jamendo' as const,
        playbackType: 'audio-stream' as const,
        externalUrl: track.shareurl || `https://www.jamendo.com/track/${track.id}`,
        duration: durationStr,
        audioStreamUrl: track.audio,
        isEmbeddable: true,
      };
    });

    return {
      items: unifiedTracks,
      totalResults: unifiedTracks.length,
    };
  }
}

export const defaultJamendoProvider = new JamendoProvider();
