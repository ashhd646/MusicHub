export type PlaybackType = 'youtube-iframe' | 'audio-stream';
export type MusicSource = 'youtube' | 'jamendo';

export interface UnifiedTrack {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  source: MusicSource;
  playbackType: PlaybackType;
  externalUrl: string;
  duration?: string;
  viewCount?: string;
  isEmbeddable?: boolean;
  audioStreamUrl?: string;
}

export interface SearchResponse {
  items: UnifiedTrack[];
  nextPageToken?: string | null;
  totalResults?: number;
  query: string;
  source: string;
  cached?: boolean;
}

export interface ApiErrorResponse {
  error: string;
  code: 'MISSING_KEY' | 'QUOTA_EXCEEDED' | 'INVALID_KEY' | 'NETWORK_ERROR' | 'BAD_REQUEST' | 'INTERNAL_ERROR';
  details?: string;
  instructions?: string[];
}

export interface ApiStatus {
  status: 'ok' | 'degraded';
  hasServerKey: boolean;
  cacheSize: number;
  providers: {
    youtube: boolean;
    jamendo: boolean;
  };
}
