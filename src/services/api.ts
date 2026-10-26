import { SearchResponse, UnifiedTrack, ApiStatus, ApiErrorResponse } from '../types/index.ts';

// Automatically remove any legacy user API keys from browser storage
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('musichub_yt_user_api_key');
  }
} catch {}

function getRequestHeaders(): Record<string, string> {
  return {
    Accept: 'application/json',
  };
}

export async function checkApiHealth(): Promise<ApiStatus> {
  try {
    const res = await fetch('/api/health', {
      headers: getRequestHeaders(),
    });
    if (!res.ok) throw new Error(`Health check failed with ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      status: 'degraded',
      hasServerKey: false,
      cacheSize: 0,
      providers: { youtube: false, jamendo: true },
    };
  }
}

export interface UniversalSearchParams {
  q: string;
  provider?: 'all' | 'youtube' | 'jamendo';
  pageToken?: string;
  regionCode?: string;
  relevanceLanguage?: string;
  signal?: AbortSignal;
}

// Direct Client-Side Fallback 1: Public High-Availability Piped API for real YouTube videos
async function searchPipedDirect(query: string, signal?: AbortSignal): Promise<UnifiedTrack[]> {
  const instances = [
    'https://api.piped.private.coffee',
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.leptons.xyz',
  ];

  for (const base of instances) {
    try {
      const url = `${base}/search?q=${encodeURIComponent(query)}&filter=videos`;
      const res = await fetch(url, { signal: signal || AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json();
        const items = (data.items || [])
          .filter((i: any) => i.type === 'stream' && i.url)
          .map((i: any) => {
            const videoId = i.url.replace('/watch?v=', '').split('&')[0];
            const durationSecs = Number(i.duration) || 0;
            const durationStr =
              durationSecs > 0
                ? `${Math.floor(durationSecs / 60)}:${String(durationSecs % 60).padStart(2, '0')}`
                : 'Full Track';

            return {
              videoId,
              title: i.title || 'Untitled Track',
              description: i.shortDescription || '',
              thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              channelTitle: i.uploaderName || 'YouTube Music',
              publishedAt: i.uploadedDate || new Date().toISOString(),
              source: 'youtube' as const,
              playbackType: 'youtube-iframe' as const,
              externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
              duration: durationStr,
              isEmbeddable: true,
            };
          });

        if (items.length > 0) return items;
      }
    } catch {}
  }
  return [];
}

// Direct Client-Side Fallback 2: Apple iTunes Music API (CORS-enabled worldwide, instant high-quality music)
async function searchItunesDirect(query: string, signal?: AbortSignal): Promise<UnifiedTrack[]> {
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=25`;
    const res = await fetch(url, { signal: signal || AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      const results = data.results || [];
      return results.map((r: any) => {
        const durationSecs = Math.floor((r.trackTimeMillis || 0) / 1000);
        const durationStr =
          durationSecs > 0
            ? `${Math.floor(durationSecs / 60)}:${String(durationSecs % 60).padStart(2, '0')}`
            : 'Full Track';

        return {
          videoId: `itunes_${r.trackId}`,
          title: r.trackName || 'Untitled Track',
          description: r.collectionName || '',
          thumbnail: (r.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
          channelTitle: r.artistName || 'Unknown Artist',
          publishedAt: r.releaseDate || new Date().toISOString(),
          source: 'youtube' as const,
          playbackType: (r.previewUrl ? 'audio-stream' : 'youtube-iframe') as any,
          externalUrl:
            r.trackViewUrl ||
            `https://www.youtube.com/results?search_query=${encodeURIComponent(r.trackName + ' ' + r.artistName)}`,
          duration: durationStr,
          audioStreamUrl: r.previewUrl,
          isEmbeddable: true,
        };
      });
    }
  } catch {}
  return [];
}

export async function searchClientSidePublicMusic(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  const q = query.trim();
  if (!q) {
    return { items: [], totalResults: 0, query: '', source: 'all' };
  }

  // Run Piped and iTunes queries concurrently
  const [pipedItems, itunesItems] = await Promise.all([
    searchPipedDirect(q, signal).catch(() => []),
    searchItunesDirect(q, signal).catch(() => []),
  ]);

  const items = pipedItems.length > 0 ? pipedItems : itunesItems;

  return {
    items,
    totalResults: items.length,
    query: q,
    source: 'all',
  };
}

export async function searchUniversalMusic(params: UniversalSearchParams): Promise<SearchResponse> {
  const queryParams = new URLSearchParams();
  queryParams.set('q', params.q.trim());
  if (params.provider) queryParams.set('provider', params.provider);
  if (params.pageToken) queryParams.set('pageToken', params.pageToken);
  if (params.regionCode) queryParams.set('regionCode', params.regionCode);
  if (params.relevanceLanguage) queryParams.set('relevanceLanguage', params.relevanceLanguage);

  // Attempt 1: Full-stack backend API route
  try {
    const res = await fetch(`/api/search/universal?${queryParams.toString()}`, {
      headers: getRequestHeaders(),
      signal: params.signal,
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.items) && data.items.length > 0) {
        return data as SearchResponse;
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
  }

  // Attempt 2: Direct client-side public music search (works 100% on static hosts, Vercel, Netlify, Cloud Run)
  try {
    const clientResults = await searchClientSidePublicMusic(params.q, params.signal);
    if (clientResults.items.length > 0) {
      return clientResults;
    }
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
  }

  // Return clean empty state instead of crashing with 404
  return {
    items: [],
    totalResults: 0,
    query: params.q,
    source: 'all',
  };
}

export async function fetchVideoDetails(videoId: string): Promise<UnifiedTrack> {
  // Attempt 1: Backend API route
  try {
    const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}`, {
      headers: getRequestHeaders(),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data && data.videoId) {
        return data as UnifiedTrack;
      }
    }
  } catch {}

  // Attempt 2: Official YouTube oEmbed public endpoint (100% free, CORS friendly)
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      return {
        videoId,
        title: data.title || 'YouTube Track',
        description: '',
        thumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        channelTitle: data.author_name || 'YouTube Music',
        publishedAt: new Date().toISOString(),
        source: 'youtube',
        playbackType: 'youtube-iframe',
        externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        duration: 'Full Track',
        isEmbeddable: true,
      };
    }
  } catch {}

  // Default fallback track
  return {
    videoId,
    title: 'YouTube Track',
    description: '',
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    channelTitle: 'YouTube Music',
    publishedAt: new Date().toISOString(),
    source: 'youtube',
    playbackType: 'youtube-iframe',
    externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    duration: 'Full Track',
    isEmbeddable: true,
  };
}

export async function fetchSearchSuggestions(query: string, signal?: AbortSignal): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];

  // Attempt 1: Backend route
  try {
    const res = await fetch(`/api/suggestions?q=${encodeURIComponent(q)}`, {
      headers: { Accept: 'application/json' },
      signal,
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        return data.suggestions;
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') return [];
  }

  // Attempt 2: Client-side YouTube Suggest endpoint
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { signal });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return (data[1] as string[]).slice(0, 10);
      }
    }
  } catch {}

  return [];
}
