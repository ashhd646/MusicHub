import React, { useState } from 'react';
import { Sliders, CheckCircle, X, Headphones, Sparkles, Trash2, Check, Music2, ShieldCheck } from 'lucide-react';

interface KeySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasServerKey?: boolean;
  onKeyUpdated?: () => void;
}

export const KeySettingsModal: React.FC<KeySettingsModalProps> = ({
  isOpen,
  onClose,
  onKeyUpdated,
}) => {
  const [backgroundPlay, setBackgroundPlay] = useState<boolean>(() => {
    try {
      return localStorage.getItem('musichub_background_play') !== 'false';
    } catch {
      return true;
    }
  });

  const [audioQuality, setAudioQuality] = useState<string>(() => {
    try {
      return localStorage.getItem('musichub_audio_quality') || '320kbps';
    } catch {
      return '320kbps';
    }
  });

  const [clearedMessage, setClearedMessage] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = () => {
    try {
      localStorage.setItem('musichub_background_play', String(backgroundPlay));
      localStorage.setItem('musichub_audio_quality', audioQuality);
    } catch {}
    onKeyUpdated?.();
    onClose();
  };

  const handleClearCache = () => {
    try {
      localStorage.removeItem('musichub_recent_searches');
      localStorage.removeItem('musichub_yt_user_api_key');
      setClearedMessage(true);
      setTimeout(() => setClearedMessage(false), 2500);
      onKeyUpdated?.();
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
              <Sliders className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white">Playback & Audio Settings</h3>
              <p className="text-[11px] sm:text-xs text-slate-400">Configure playback behavior and preferences</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Status banner */}
          <div className="p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            <div>
              <span className="font-semibold">Automatic Cloud Music Discovery Active</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                All songs play directly with complete full duration and Smart Shuffle. No API key required.
              </p>
            </div>
          </div>

          {/* Setting 1: Background Music Playback */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-emerald-400" />
                <span className="text-xs sm:text-sm font-semibold text-white">Background Music Playback</span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                Music keeps playing continuously when you switch tabs, minimize the player, or browse other sections.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={backgroundPlay}
                onChange={(e) => setBackgroundPlay(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>

          {/* Setting 2: Audio Stream Quality */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <Music2 className="w-4 h-4 text-rose-400" />
              <span className="text-xs sm:text-sm font-semibold text-white">Audio Quality Target</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Preferred bitrate for full-duration music streaming and MP3 downloads.
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { id: '320kbps', label: '320 kbps', sub: 'Ultra HD' },
                { id: '192kbps', label: '192 kbps', sub: 'Standard' },
                { id: '128kbps', label: '128 kbps', sub: 'Saver' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAudioQuality(opt.id)}
                  className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                    audioQuality === opt.id
                      ? 'bg-rose-950/40 border-rose-500 text-rose-300 font-bold'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs">{opt.label}</div>
                  <div className="text-[10px] text-slate-500 font-normal">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Setting 3: Cache & Storage Cleanup */}
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs sm:text-sm font-semibold text-white">Search Cache & History</span>
              <p className="text-[11px] text-slate-400">
                Clear recent search queries and cached search results from device.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearCache}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {clearedMessage ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Cleared</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-slate-800 bg-slate-900/90">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-lg transition-colors cursor-pointer"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};
