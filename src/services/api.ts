import { SearchResponse, UnifiedTrack, ApiStatus, ApiErrorResponse } from '../types/index.ts';

const USER_API_KEY_STORAGE = 'musichub_yt_user_api_key';

export function getCustomApiKey(): string {
  try {
    return localStorage.getItem(USER_API_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function setCustomApiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(USER_API_KEY_STORAGE, key.trim());
    } else {
      localStorage.removeItem(USER_API_KEY_STORAGE);
    }
  } catch {
    // Ignore storage issues
  }
}

function getRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  const customKey = getCustomApiKey();
  if (customKey) {
    headers['x-youtube-key'] = customKey;
  }
  return headers;
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

export async function searchUniversalMusic(params: UniversalSearchParams): Promise<SearchResponse> {
  const queryParams = new URLSearchParams();
  queryParams.set('q', params.q.trim());
  if (params.provider) queryParams.set('provider', params.provider);
  if (params.pageToken) queryParams.set('pageToken', params.pageToken);
  if (params.regionCode) queryParams.set('regionCode', params.regionCode);
  if (params.relevanceLanguage) queryParams.set('relevanceLanguage', params.relevanceLanguage);

  const res = await fetch(`/api/search/universal?${queryParams.toString()}`, {
    headers: getRequestHeaders(),
    signal: params.signal,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorPayload: ApiErrorResponse = {
      error: data.error || 'Search request failed.',
      code: data.code || 'INTERNAL_ERROR',
      instructions: data.instructions,
      details: data.details,
    };
    const err: any = new Error(errorPayload.error);
    err.payload = errorPayload;
    throw err;
  }

  return data as SearchResponse;
}

export async function fetchVideoDetails(videoId: string): Promise<UnifiedTrack> {
  const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}`, {
    headers: getRequestHeaders(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data.error || 'Failed to fetch video details');
    err.payload = data;
    throw err;
  }

  return data as UnifiedTrack;
}

export async function fetchSearchSuggestions(query: string, signal?: AbortSignal): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const res = await fetch(`/api/suggestions?q=${encodeURIComponent(q)}`, {
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.suggestions) ? data.suggestions : [];
  } catch (err: any) {
    if (err.name === 'AbortError') return [];
    console.warn('Failed to fetch suggestions:', err);
    return [];
  }
}
