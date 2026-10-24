import React from 'react';
import { Play, ExternalLink, Download } from 'lucide-react';
import { UnifiedTrack } from '../types/index.ts';

interface VideoCardProps {
  track: UnifiedTrack;
  isCurrentlyPlaying: boolean;
  onPlay: (track: UnifiedTrack) => void;
  onDownload?: (track: UnifiedTrack) => void;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (isNaN(diffSecs)) return '';

    if (diffSecs < 3600) return 'Just now';
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
    if (diffSecs < 2592000) return `${Math.floor(diffSecs / 86400)}d ago`;
    if (diffSecs < 31536000) return `${Math.floor(diffSecs / 2592000)}mo ago`;
    return `${Math.floor(diffSecs / 31536000)}y ago`;
  } catch {
    return '';
  }
}

export const VideoCard: React.FC<VideoCardProps> = ({
  track,
  isCurrentlyPlaying,
  onPlay,
  onDownload,
}) => {
  const relativeTime = formatRelativeTime(track.publishedAt);

  return (
    <article
      className={`group flex flex-col bg-slate-900/90 rounded-2xl border transition-all duration-200 overflow-hidden hover:border-slate-700 hover:shadow-xl hover:shadow-black/40 ${
        isCurrentlyPlaying
          ? 'border-red-500/80 ring-1 ring-red-500/50 bg-slate-900'
          : 'border-slate-800/80'
      }`}
    >
      {/* Thumbnail Slot */}
      <div className="relative aspect-video w-full bg-slate-950 overflow-hidden cursor-pointer" onClick={() => onPlay(track)}>
        <img
          src={track.thumbnail}
          alt={track.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            // Styled fallback if thumbnail fails
            const target = e.currentTarget;
            target.src = `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`;
          }}
        />

        {/* Hover play overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
          <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
            <Play className="w-6 h-6 fill-white ml-0.5" />
          </div>
        </div>

        {/* Duration badge in bottom right (tabular numbers) */}
        {track.duration && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/85 text-white font-mono text-[11px] font-medium rounded-md tabular-nums backdrop-blur-sm">
            {track.duration}
          </div>
        )}

        {/* Source tag in top-left */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 bg-slate-950/80 backdrop-blur-md rounded-md border border-slate-800 text-[11px] font-medium text-slate-200">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              track.source === 'youtube' ? 'bg-red-500' : 'bg-amber-400'
            }`}
          />
          <span>{track.source === 'youtube' ? 'YouTube' : 'Jamendo'}</span>
        </div>
      </div>

      {/* Content & Metadata */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h3
            onClick={() => onPlay(track)}
            className="text-sm font-semibold text-slate-100 line-clamp-2 hover:text-red-400 cursor-pointer transition-colors mb-2 leading-snug"
            title={track.title}
          >
            {track.title}
          </h3>

          {/* Clean Unboxed Metadata with · separator */}
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-slate-400 mb-3">
            <span className="font-medium text-slate-300 truncate max-w-[180px]" title={track.channelTitle}>
              {track.channelTitle}
            </span>
            {relativeTime && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-slate-400">{relativeTime}</span>
              </>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
          <button
            onClick={() => onPlay(track)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              isCurrentlyPlaying
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isCurrentlyPlaying ? 'Playing' : 'Play Video'}</span>
          </button>

          <div className="flex items-center gap-1">
            {onDownload && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(track);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Download / Save to Device"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            <a
              href={track.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Open directly on YouTube"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
};
