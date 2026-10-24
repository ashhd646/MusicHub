import React, { useState } from 'react';
import { Sliders, CheckCircle, AlertTriangle, ExternalLink, X, ShieldCheck, Loader2, Headphones, ChevronDown, ChevronUp } from 'lucide-react';
import { getCustomApiKey, setCustomApiKey } from '../services/api.ts';

interface KeySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasServerKey: boolean;
  onKeyUpdated: () => void;
}

export const KeySettingsModal: React.FC<KeySettingsModalProps> = ({
  isOpen,
  onClose,
  hasServerKey,
  onKeyUpdated,
}) => {
  const [keyInput, setKeyInput] = useState<string>(getCustomApiKey());
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showAdvancedKey, setShowAdvancedKey] = useState<boolean>(false);
  const [backgroundPlay, setBackgroundPlay] = useState<boolean>(() => {
    try {
      return localStorage.getItem('musichub_background_play') !== 'false';
    } catch {
      return true;
    }
  });

  if (!isOpen) return null;

  const handleTestKey = async () => {
    const keyToTest = keyInput.trim();
    if (!keyToTest) {
      setTestResult({ success: false, message: 'Please enter an API key to test.' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(`/api/search/youtube?q=tum+hi+ho&apiKey=${encodeURIComponent(keyToTest)}`);
      const data = await res.json();

      if (res.ok && Array.isArray(data.items)) {
        setTestResult({
          success: true,
          message: `Verified! Successfully fetched ${data.items.length} YouTube results with this key.`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Key verification failed with YouTube API.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network test failed.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setCustomApiKey(keyInput);
    try {
      localStorage.setItem('musichub_background_play', String(backgroundPlay));
    } catch {}
    onKeyUpdated();
    onClose();
  };

  const handleClear = () => {
    setKeyInput('');
    setCustomApiKey('');
    setTestResult(null);
    onKeyUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="p-1.5 sm:p-2 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20">
              <Sliders className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white">Playback & Audio Settings</h3>
              <p className="text-[11px] sm:text-xs text-slate-400">Configure playback behavior and audio preferences</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Primary Setting: Background Audio Playback */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-white">Background Music Playback</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Keep playing music continuously when switching browser tabs, minimizing the player, or browsing other songs on the website.
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

          {/* Collapsible Advanced Developer Key Options */}
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvancedKey(!showAdvancedKey)}
              className="w-full px-4 py-3 bg-slate-900/60 hover:bg-slate-900 flex items-center justify-between text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span>Advanced API Credentials</span>
              {showAdvancedKey ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvancedKey && (
              <div className="p-4 bg-slate-950/60 border-t border-slate-800 space-y-4 text-xs">
                {/* Server Key Status Banner */}
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                    hasServerKey
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : 'bg-amber-950/30 border-amber-800/50 text-amber-300'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">
                      {hasServerKey ? 'Default Live YouTube Search Active' : 'Automatic Web Discovery Active'}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      All songs play in full duration directly from YouTube without requiring any setup.
                    </p>
                  </div>
                </div>

                {/* Key Input Field */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Custom YouTube Data API Key (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="AIzaSy..."
                      value={keyInput}
                      onChange={(e) => {
                        setKeyInput(e.target.value);
                        setTestResult(null);
                      }}
                      className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleTestKey}
                      disabled={testing || !keyInput.trim()}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-slate-200 rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      <span>Test</span>
                    </button>
                  </div>
                </div>

                {/* Test Status feedback */}
                {testResult && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                      testResult.success
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                        : 'bg-red-950/40 text-red-300 border-red-800/60'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <button
            onClick={handleClear}
            className="text-xs font-medium text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
          >
            Reset Preferences
          </button>

          <div className="flex items-center gap-2">
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
    </div>
  );
};
