import React, { useState } from 'react';
import {
  Download,
  FolderHeart,
  ExternalLink,
  X,
  CheckCircle,
  AlertCircle,
  HardDrive,
  FileAudio,
  Sparkles,
} from 'lucide-react';
import { UnifiedTrack } from '../types/index.ts';
import {
  saveTrackToDevice,
  isTrackSaved,
  removeTrackFromDevice,
  downloadAudioFile,
} from '../services/deviceStorage.ts';
import { openPagalworldDownload } from '../services/pagalworldService.ts';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: UnifiedTrack | null;
  onStorageChanged?: () => void;
  onOpenConverter?: () => void;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  isOpen,
  onClose,
  track,
  onStorageChanged,
  onOpenConverter,
}) => {
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  React.useEffect(() => {
    if (track?.videoId) {
      setIsSaved(isTrackSaved(track.videoId));
    }
  }, [track?.videoId]);

  if (!isOpen || !track) return null;

  const handleSaveToDevice = () => {
    if (isSaved) {
      removeTrackFromDevice(track.videoId);
      setIsSaved(false);
    } else {
      saveTrackToDevice(track);
      setIsSaved(true);
    }
    onStorageChanged?.();
  };

  const handleDirectDownload = async () => {
    if (!track.audioStreamUrl) return;
    setDownloading(true);
    const sanitizedTitle = track.title.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'track';
    await downloadAudioFile(track.audioStreamUrl, `${sanitizedTitle}.mp3`);
    setDownloading(false);
    setDownloadSuccess(true);
  };

  const isMp3Available = Boolean(track.audioStreamUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="p-1.5 sm:p-2 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20">
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white">Download & Save Track</h3>
              <p className="text-[11px] sm:text-xs text-slate-400">Save song to your device storage (ROM)</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Track Preview Box */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
            <img
              src={track.thumbnail}
              alt={track.title}
              className="w-14 h-14 rounded-lg object-cover border border-slate-700/80 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-white truncate" title={track.title}>
                {track.title}
              </h4>
              <p className="text-xs text-slate-400 truncate mt-0.5">{track.channelTitle}</p>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                <span>{track.duration || 'Full Duration'}</span>
                <span>·</span>
                <span className="capitalize">{track.source === 'youtube' ? 'YouTube' : 'Audio Stream'}</span>
              </div>
            </div>
          </div>

          {/* Option 1: Direct MP3 File Download (if audio stream is available) */}
          {isMp3Available ? (
            <div className="space-y-3">
              <button
                onClick={handleDirectDownload}
                disabled={downloading}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg transition-all cursor-pointer"
              >
                <FileAudio className="w-4 h-4" />
                <span>{downloading ? 'Downloading MP3 File...' : 'Download MP3 to Device Storage'}</span>
              </button>

              {downloadSuccess && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>MP3 file downloaded to your device Downloads folder!</span>
                </div>
              )}
            </div>
          ) : (
            /* Option 2: YouTube Track - Save to Device Storage & Official Offline Flow */
            <div className="space-y-4">
              {/* Direct PagalWorld Song Download Page Redirect */}
              <button
                type="button"
                onClick={() => openPagalworldDownload(track)}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all cursor-pointer border border-rose-500/50"
              >
                <FileAudio className="w-4 h-4 text-white animate-pulse" />
                <span>Convert to MP3 & Download on PagalWorld (320kbps) ➔</span>
              </button>

              {/* Save in Local Device Storage (ROM) */}
              <button
                onClick={handleSaveToDevice}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                  isSaved
                    ? 'bg-emerald-950/50 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/50'
                    : 'bg-red-600 hover:bg-red-500 text-white border-transparent shadow-lg'
                }`}
              >
                <HardDrive className="w-4 h-4" />
                <span>
                  {isSaved ? '✓ Saved in Device Storage (Click to Remove)' : 'Save to Device Storage (Offline Library)'}
                </span>
              </button>

              {isSaved && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Saved! You can now access and play this track anytime from your "Saved" tab on this device.</span>
                </div>
              )}

              {/* YouTube Policy Notice */}
              <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-[11px] uppercase tracking-wider">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>YouTube Copyright & Terms Policy</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Third-party audio stream extraction (YouTube-to-MP3 ripping) is strictly restricted under Google &
                  YouTube Developer Terms of Service to protect artist copyrights.
                </p>
                <div className="pt-1 flex items-center justify-between gap-3">
                  <a
                    href={track.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                  >
                    <span>YouTube Music App</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  {onOpenConverter && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenConverter();
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                    >
                      <FileAudio className="w-3.5 h-3.5" />
                      <span>Video to MP3 Converter Studio →</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-slate-800 bg-slate-900/90">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
