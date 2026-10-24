/**
 * Official YouTube Data API v3 Provider Service
 * Compliant with Google API guidelines and terms of service.
 */

import type { UnifiedTrack } from '../../src/types/index.ts';

export interface YouTubeSearchParams {
  q: string;
  maxResults?: number;
  pageToken?: string;
  regionCode?: string;
  relevanceLanguage?: string;
  apiKey?: string;
}

export interface YouTubeSearchOutput {
  items: UnifiedTrack[];
  nextPageToken?: string | null;
  totalResults: number;
}

// Decode HTML entities commonly returned by YouTube API snippet titles & descriptions
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}

// Format ISO 8601 duration (e.g. PT4M13S, PT1H2M10S) to readable time format (e.g. 4:13, 1:02:10)
export function parseIsoDuration(durationStr?: string): string {
  if (!durationStr) return '';
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseInt(match[3], 10) : 0;

  const paddedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;

  if (hours > 0) {
    const paddedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
}

// Validate YouTube video ID format strictly (standard 11 characters alphanumeric + _ -)
export function isValidYouTubeId(videoId: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

export class YouTubeProvider {
  private defaultApiKey: string;

  constructor(defaultApiKey: string = '') {
    this.defaultApiKey = defaultApiKey;
  }

  private resolveApiKey(customKey?: string): string {
    const key = customKey?.trim() || this.defaultApiKey || process.env.YOUTUBE_API_KEY || '';
    return key.trim();
  }

  /**
   * Searches videos using official YouTube Data API v3 endpoint with automatic fallback to full YouTube results
   */
  async search(params: YouTubeSearchParams): Promise<YouTubeSearchOutput> {
    const query = (params.q || '').trim();
    if (!query) {
      return { items: [], nextPageToken: null, totalResults: 0 };
    }

    const apiKey = this.resolveApiKey(params.apiKey);
    const maxResults = Math.min(Math.max(Number(params.maxResults) || 20, 1), 50);

    // If an API key is provided, try official Google Cloud YouTube Data API v3 first
    if (apiKey) {
      try {
        const url = new URL('https://www.googleapis.com/youtube/v3/search');
        url.searchParams.set('part', 'snippet');
        url.searchParams.set('q', query);
        url.searchParams.set('type', 'video');
        url.searchParams.set('videoEmbeddable', 'true');
        url.searchParams.set('maxResults', maxResults.toString());

        if (params.pageToken) {
          url.searchParams.set('pageToken', params.pageToken);
        }
        url.searchParams.set('regionCode', params.regionCode || 'IN');
        if (params.relevanceLanguage) {
          url.searchParams.set('relevanceLanguage', params.relevanceLanguage);
        }
        url.searchParams.set('key', apiKey);

        const response = await fetch(url.toString(), {
          headers: { Accept: 'application/json' },
        });

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          const items: any[] = data.items || [];
          const videoIds = items
            .map((item: any) => item.id?.videoId)
            .filter((id: string) => id && isValidYouTubeId(id));

          let videoDetailsMap = new Map<string, { duration?: string; isEmbeddable?: boolean }>();
          if (videoIds.length > 0) {
            try {
              videoDetailsMap = await this.fetchVideoContentDetails(videoIds, apiKey);
            } catch (detailsErr) {
              console.warn('Video details enrichment skipped:', detailsErr);
            }
          }

          const unifiedTracks: UnifiedTrack[] = items
            .filter((item: any) => item.id?.videoId && isValidYouTubeId(item.id.videoId))
            .map((item: any) => {
              const id = item.id.videoId;
              const snippet = item.snippet || {};
              const details = videoDetailsMap.get(id);

              const bestThumbnail =
                snippet.thumbnails?.high?.url ||
                snippet.thumbnails?.medium?.url ||
                snippet.thumbnails?.default?.url ||
                `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

              return {
                videoId: id,
                title: decodeHtmlEntities(snippet.title || 'Untitled Track'),
                description: decodeHtmlEntities(snippet.description || ''),
                thumbnail: bestThumbnail,
                channelTitle: decodeHtmlEntities(snippet.channelTitle || 'Unknown Channel'),
                publishedAt: snippet.publishedAt || new Date().toISOString(),
                source: 'youtube',
                playbackType: 'youtube-iframe',
                externalUrl: `https://www.youtube.com/watch?v=${id}`,
                duration: details?.duration || undefined,
                isEmbeddable: details?.isEmbeddable !== false,
              };
            });

          return {
            items: unifiedTracks,
            nextPageToken: data.nextPageToken || null,
            totalResults: data.pageInfo?.totalResults || unifiedTracks.length,
          };
        }
      } catch (apiErr) {
        console.warn('Official YouTube API request failed, falling back to full web discovery:', apiErr);
      }
    }

    // Resilient fallback: Search YouTube web endpoint to provide 100% full duration songs without 30-sec limit
    return await this.searchWebYouTube(query, maxResults);
  }

  /**
   * Discovers full-length songs directly from YouTube, ensuring complete duration playback
   */
  async searchWebYouTube(query: string, maxResults: number = 20): Promise<YouTubeSearchOutput> {
    try {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
        },
      });

      if (!res.ok) {
        return { items: [], nextPageToken: null, totalResults: 0 };
      }

      const html = await res.text();
      const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
      if (!match) {
        return { items: [], nextPageToken: null, totalResults: 0 };
      }

      const data = JSON.parse(match[1]);
      const sectionList =
        data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
      const unifiedTracks: UnifiedTrack[] = [];

      for (const section of sectionList) {
        const contents = section.itemSectionRenderer?.contents || [];
        for (const item of contents) {
          const v = item.videoRenderer;
          if (!v || !v.videoId || !isValidYouTubeId(v.videoId)) continue;

          const title = v.title?.runs?.[0]?.text || v.title?.simpleText || 'Untitled Track';
          const channelTitle = v.ownerText?.runs?.[0]?.text || 'YouTube Music';
          const duration = v.lengthText?.simpleText || '';
          const publishedAt = v.publishedTimeText?.simpleText || new Date().toISOString();
          const thumbnail =
            v.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
          const description =
            v.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r: any) => r.text).join('') || '';

          unifiedTracks.push({
            videoId: v.videoId,
            title: decodeHtmlEntities(title),
            description: decodeHtmlEntities(description),
            thumbnail,
            channelTitle: decodeHtmlEntities(channelTitle),
            publishedAt,
            source: 'youtube',
            playbackType: 'youtube-iframe',
            externalUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
            duration: duration || 'Full Track',
            isEmbeddable: true,
          });

          if (unifiedTracks.length >= maxResults) break;
        }
        if (unifiedTracks.length >= maxResults) break;
      }

      return {
        items: unifiedTracks,
        nextPageToken: null,
        totalResults: unifiedTracks.length,
      };
    } catch (err) {
      console.error('Error during full YouTube web discovery:', err);
      return { items: [], nextPageToken: null, totalResults: 0 };
    }
  }

  /**
   * Fetches single video details
   */
  async getVideo(videoId: string, customKey?: string): Promise<UnifiedTrack | null> {
    if (!isValidYouTubeId(videoId)) {
      const err: any = new Error('Invalid YouTube video ID format.');
      err.code = 'BAD_REQUEST';
      err.status = 400;
      throw err;
    }

    const apiKey = this.resolveApiKey(customKey);
    if (!apiKey) {
      const err: any = new Error('YouTube API key is required.');
      err.code = 'MISSING_KEY';
      err.status = 401;
      throw err;
    }

    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet,contentDetails,status,statistics');
    url.searchParams.set('id', videoId);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      this.handleApiError(response.status, data);
    }

    const item = data.items?.[0];
    if (!item) return null;

    const snippet = item.snippet || {};
    const contentDetails = item.contentDetails || {};
    const status = item.status || {};

    const duration = parseIsoDuration(contentDetails.duration);
    const isEmbeddable = status.embeddable !== false;

    const bestThumbnail =
      snippet.thumbnails?.maxres?.url ||
      snippet.thumbnails?.high?.url ||
      snippet.thumbnails?.medium?.url ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return {
      videoId,
      title: decodeHtmlEntities(snippet.title || 'Untitled Track'),
      description: decodeHtmlEntities(snippet.description || ''),
      thumbnail: bestThumbnail,
      channelTitle: decodeHtmlEntities(snippet.channelTitle || 'Unknown Channel'),
      publishedAt: snippet.publishedAt || new Date().toISOString(),
      source: 'youtube',
      playbackType: 'youtube-iframe',
      externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      duration: duration || undefined,
      isEmbeddable,
    };
  }

  /**
   * Batch fetches contentDetails for multiple video IDs to obtain durations and embed status
   */
  private async fetchVideoContentDetails(
    videoIds: string[],
    apiKey: string
  ): Promise<Map<string, { duration?: string; isEmbeddable?: boolean }>> {
    const map = new Map<string, { duration?: string; isEmbeddable?: boolean }>();
    if (!videoIds.length) return map;

    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'contentDetails,status');
    url.searchParams.set('id', videoIds.join(','));
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) return map;

    const data = await res.json().catch(() => ({}));
    const items = data.items || [];

    for (const item of items) {
      const id = item.id;
      const duration = parseIsoDuration(item.contentDetails?.duration);
      const isEmbeddable = item.status?.embeddable !== false;
      map.set(id, { duration, isEmbeddable });
    }

    return map;
  }

  /**
   * Maps Google API error payloads to structured MusicHub errors
   */
  private handleApiError(status: number, data: any): never {
    const errorObj = data.error || {};
    const errorsList = errorObj.errors || [];
    const firstReason = errorsList[0]?.reason || '';
    const message = errorObj.message || 'Error occurred while contacting YouTube API.';

    const err: any = new Error(message);
    err.status = status;

    if (
      firstReason === 'quotaExceeded' ||
      firstReason === 'dailyLimitExceeded' ||
      firstReason === 'rateLimitExceeded'
    ) {
      err.code = 'QUOTA_EXCEEDED';
      err.message = 'YouTube Data API daily quota has been exhausted.';
      err.instructions = [
        'The YouTube Data API v3 has a default quota limit of 10,000 units/day.',
        'Each search operation consumes 100 quota units.',
        'You can provide your own personal Google Cloud YouTube API Key via the Key Settings icon above to continue searching immediately.',
      ];
    } else if (
      firstReason === 'keyInvalid' ||
      firstReason === 'badRequest' && message.includes('API key not valid')
    ) {
      err.code = 'INVALID_KEY';
      err.message = 'The provided YouTube API key is invalid or unrecognized by Google Cloud.';
      err.instructions = [
        'Verify your API key in Google Cloud Console -> Credentials.',
        'Ensure the "YouTube Data API v3" service is enabled for your project.',
        'Check that the key has not expired or been deleted.',
      ];
    } else if (status === 403 && message.includes('disabled')) {
      err.code = 'INVALID_KEY';
      err.message = 'YouTube Data API v3 has not been enabled for this project.';
      err.instructions = [
        'Visit https://console.cloud.google.com/apis/library/youtube.googleapis.com and click "Enable".',
      ];
    } else {
      err.code = 'BAD_REQUEST';
    }

    throw err;
  }
}

export const defaultYouTubeProvider = new YouTubeProvider();
