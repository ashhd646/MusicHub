import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  X,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  History,
  Music,
  Music2,
  SlidersHorizontal,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  FileAudio,
  Flame,
  HardDrive,
  Settings,
  FileImage,
  Minimize2,
  FileText,
  Shuffle,
  Repeat,
  Repeat1,
} from 'lucide-react';
import { Navbar, MainAppTab } from './components/Navbar.tsx';
import { FilterBar } from './components/FilterBar.tsx';
import { VideoCard } from './components/VideoCard.tsx';
import { SkeletonCard } from './components/SkeletonCard.tsx';
import { YouTubePlayer } from './components/YouTubePlayer.tsx';
import { KeySettingsModal } from './components/KeySettingsModal.tsx';
import { DownloadModal } from './components/DownloadModal.tsx';
import { VideoToMp3Modal } from './components/VideoToMp3Modal.tsx';
import { SearchAutocomplete } from './components/SearchAutocomplete.tsx';
import { ImageConverter } from './components/tools/ImageConverter.tsx';
import { ImageCompressor } from './components/tools/ImageCompressor.tsx';
import { DocumentConverter } from './components/tools/DocumentConverter.tsx';
import { getSavedTracks } from './services/deviceStorage.ts';
import { openPagalworldDownload } from './services/pagalworldService.ts';
import { setStoredSmartShuffle, generateSmartShuffleQueue } from './services/smartQueue.ts';
import {
  searchUniversalMusic,
  checkApiHealth,
} from './services/api.ts';
import { UnifiedTrack, ApiStatus } from './types/index.ts';

const RECENT_SEARCHES_KEY = 'musichub_recent_searches';

const TRENDING_SUGGESTIONS = [
  'Tum Hi Ho Arijit Singh',
  'Latest Bollywood songs 2026',
  'Old Hindi songs evergreen',
  'Sidhu Moose Wala Punjabi',
  'Bhojpuri superhit songs',
  'Tamil melody songs Anirudh',
  'Telugu movie songs hit',
  'Taylor Swift billboard hits',
  'K-Pop BTS Blackpink',
  'Indian Classical Shivkumar Sharma',
];

export default function App() {
  const [searchQuery, setSearchQuery] = useState<string>('Tum Hi Ho Arijit Singh');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('Tum Hi Ho Arijit Singh');
  const [activeProvider, setActiveProvider] = useState<'all' | 'youtube' | 'jamendo'>('youtube');
  const [regionCode, setRegionCode] = useState<string>('IN');
  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<{ message: string; code?: string; instructions?: string[] } | null>(null);
  const [currentTrack, setCurrentTrack] = useState<UnifiedTrack | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [downloadModalTrack, setDownloadModalTrack] = useState<UnifiedTrack | null>(null);
  const [savedTracks, setSavedTracks] = useState<UnifiedTrack[]>(() => getSavedTracks());
  const [isSavedViewActive, setIsSavedViewActive] = useState<boolean>(false);
  const [isConverterModalOpen, setIsConverterModalOpen] = useState<boolean>(false);
  const [selectedTrackForConverter, setSelectedTrackForConverter] = useState<UnifiedTrack | null>(null);
  const [activeTab, setActiveTab] = useState<MainAppTab>('music');

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {}
  }, []);

  // Check health and server configuration
  const refreshStatus = useCallback(async () => {
    const status = await checkApiHealth();
    setApiStatus(status);
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Debounce search input by 400ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const saveRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 8);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Smart Shuffle and Play Queue
  const handleSmartShufflePlay = (sourceTracks: UnifiedTrack[]) => {
    if (!sourceTracks || sourceTracks.length === 0) return;
    setStoredSmartShuffle(true);
    const shuffled = generateSmartShuffleQueue(sourceTracks);
    if (shuffled.length > 0) {
      setCurrentTrack(shuffled[0]);
    }
  };

  // Primary search executor
  const performSearch = useCallback(
    async (query: string, provider: 'all' | 'youtube' | 'jamendo', region: string, append: boolean = false) => {
      const q = query.trim();
      if (!q) {
        setTracks([]);
        setNextPageToken(null);
        setError(null);
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await searchUniversalMusic({
          q,
          provider,
          regionCode: region,
          pageToken: append ? nextPageToken || undefined : undefined,
          signal: abortControllerRef.current.signal,
        });

        if (append) {
          setTracks((prev) => [...prev, ...response.items]);
        } else {
          setTracks(response.items);
          saveRecentSearch(q);
        }

        setNextPageToken(response.nextPageToken || null);
        setError(null);
      } catch (err: any) {
        if (err.name === 'AbortError') return;

        const payload = err.payload || {};
        let rawMessage = payload.error || err.message || 'Unable to retrieve search results.';
        if (typeof rawMessage === 'object' && rawMessage !== null) {
          rawMessage = rawMessage.message || JSON.stringify(rawMessage);
        }

        let rawCode = payload.code || (typeof payload.error === 'object' ? payload.error?.code : undefined);
        if (typeof rawCode === 'object' && rawCode !== null) {
          rawCode = rawCode.code || JSON.stringify(rawCode);
        }

        setError({
          message: String(rawMessage),
          code: rawCode ? String(rawCode) : undefined,
          instructions: Array.isArray(payload.instructions)
            ? payload.instructions.map((i: any) =>
                typeof i === 'string' ? i : typeof i?.message === 'string' ? i.message : JSON.stringify(i)
              )
            : undefined,
        });
        if (!append) {
          setTracks([]);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [nextPageToken]
  );

  // Trigger search on debounced query, provider, or region change
  useEffect(() => {
    performSearch(debouncedQuery, activeProvider, regionCode, false);
  }, [debouncedQuery, activeProvider, regionCode]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setDebouncedQuery(searchQuery);
      performSearch(searchQuery, activeProvider, regionCode, false);
    }
  };

  const handleTagClick = (tagQuery: string) => {
    setSearchQuery(tagQuery);
    setDebouncedQuery(tagQuery);
    performSearch(tagQuery, activeProvider, regionCode, false);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    setTracks([]);
    setError(null);
  };

  const hasServerKey = Boolean(apiStatus?.hasServerKey);

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-['Plus_Jakarta_Sans'] selection:bg-red-500/30 selection:text-white flex flex-col pb-36 md:pb-28">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'music') {
            setIsSavedViewActive(false);
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenSettings={() => setIsKeyModalOpen(true)}
        onSelectCategory={(cat) => {
          setActiveTab('music');
          setIsSavedViewActive(false);
          handleTagClick(cat);
        }}
        onOpenSaved={() => {
          setActiveTab('music');
          setIsSavedViewActive(true);
        }}
        onOpenConverter={() => setIsConverterModalOpen(true)}
        savedCount={savedTracks.length}
      />

      {/* Tool 1: Universal Image Extension Converter */}
      {activeTab === 'image-converter' && (
        <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 pb-28 sm:pb-16 w-full">
          <ImageConverter />
        </main>
      )}

      {/* Tool 2: Smart Image Compressor */}
      {activeTab === 'image-compressor' && (
        <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 pb-28 sm:pb-16 w-full">
          <ImageCompressor />
        </main>
      )}

      {/* Tool 3: Document & PDF Conversion Suite */}
      {activeTab === 'document-converter' && (
        <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 pb-28 sm:pb-16 w-full">
          <DocumentConverter />
        </main>
      )}

      {/* Tool 4: Universal Music & Player Discovery */}
      {activeTab === 'music' && (
        <>
          {/* Language & Genre Filter Bar */}
          <FilterBar
            selectedTag={debouncedQuery}
            onSelectTag={handleTagClick}
            regionCode={regionCode}
            onChangeRegion={setRegionCode}
          />

          {/* Hero Search Section */}
          <section className="relative px-3 sm:px-6 lg:px-8 pt-5 sm:pt-8 pb-4 sm:pb-6 border-b border-slate-800/60 bg-gradient-to-b from-[#0F172A]/40 to-transparent">
            <div className="max-w-4xl mx-auto text-center space-y-3 sm:space-y-4">
              <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white">
                Universal Music & Video Discovery
              </h1>
          <p className="hidden sm:block text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto">
            Search songs, artists, music videos, Bollywood, Punjabi, regional tracks, and international releases
            with full duration playback, Smart Shuffle, and background listening.
          </p>

          {/* YouTube Suggest API Autocomplete Search Input */}
          <div className="mt-4">
            <SearchAutocomplete
              value={searchQuery}
              onChange={(val) => setSearchQuery(val)}
              onSubmit={(query) => {
                setIsSavedViewActive(false);
                setSearchQuery(query);
                setDebouncedQuery(query);
                performSearch(query, activeProvider, regionCode, false);
              }}
              onClear={handleClearSearch}
              recentSearches={recentSearches}
            />
          </div>

          {/* Recent Searches Strip */}
          {recentSearches.length > 0 && (
            <div className="flex items-center justify-center flex-wrap gap-2 pt-2">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <History className="w-3 h-3" />
                <span>Recent:</span>
              </div>
              {recentSearches.map((rec) => (
                <button
                  key={rec}
                  onClick={() => handleTagClick(rec)}
                  className="text-xs text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-800 transition-colors"
                >
                  {rec}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Main Results Viewport */}
      <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 pb-28 sm:pb-16 w-full">
        {/* Error State Banner */}
        {error && (
          <div className="mb-6 sm:mb-8 p-4 sm:p-5 bg-red-950/40 border border-red-800/80 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-900/50 text-red-400 rounded-xl mt-0.5">
                <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-red-200">
                  Search Notice
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  {typeof error.message === 'string' ? error.message : JSON.stringify(error.message)}
                </p>
                {Array.isArray(error.instructions) && error.instructions.length > 0 && (
                  <ul className="text-[11px] text-slate-400 list-disc list-inside space-y-0.5 pt-1">
                    {error.instructions.map((inst, i) => (
                      <li key={i}>{typeof inst === 'string' ? inst : JSON.stringify(inst)}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
              <button
                onClick={() => performSearch(debouncedQuery, activeProvider, regionCode, false)}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Search</span>
              </button>
            </div>
          </div>
        )}

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 sm:mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {isSavedViewActive
                ? 'Saved on Device Storage (ROM)'
                : debouncedQuery
                ? `Results for "${debouncedQuery}"`
                : 'Browse Music'}
            </h2>
            {!loading && (
              <span className="text-xs font-mono tabular-nums text-slate-500">
                ({isSavedViewActive ? savedTracks.length : tracks.length} tracks)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {isSavedViewActive ? (
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {savedTracks.length > 0 && (
                  <button
                    onClick={() => handleSmartShufflePlay(savedTracks)}
                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-600/25 to-teal-600/25 hover:from-emerald-600/35 hover:to-teal-600/35 border border-emerald-500/40 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    title="Shuffle and play saved tracks in smart order"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>Smart Shuffle</span>
                  </button>
                )}
                <button
                  onClick={() => setIsConverterModalOpen(true)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Open Video to MP3 Converter Studio"
                >
                  <FileAudio className="w-3.5 h-3.5" />
                  <span>Convert Video to MP3</span>
                </button>
                <button
                  onClick={() => setIsSavedViewActive(false)}
                  className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                >
                  ← Back to Online Search
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                {tracks.length > 0 && (
                  <button
                    onClick={() => handleSmartShufflePlay(tracks)}
                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-600/25 to-teal-600/25 hover:from-emerald-600/35 hover:to-teal-600/35 border border-emerald-500/40 text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    title="Shuffle and play results in intelligent non-repeating order"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>Smart Shuffle Play</span>
                  </button>
                )}
                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-slate-300 font-medium">Full Duration Music</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Media Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {isSavedViewActive ? (
            savedTracks.length > 0 ? (
              savedTracks.map((track) => (
                <div key={track.videoId} className="flex flex-col gap-2">
                  <VideoCard
                    track={track}
                    isCurrentlyPlaying={currentTrack?.videoId === track.videoId}
                    onPlay={(selected) => setCurrentTrack(selected)}
                    onDownload={(selected) => setDownloadModalTrack(selected)}
                  />
                  <button
                    onClick={() => openPagalworldDownload(track)}
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/25 border border-rose-500/40"
                    title="Convert to MP3 & Download on PagalWorld"
                  >
                    <FileAudio className="w-3.5 h-3.5 text-white animate-pulse" />
                    <span>Convert to MP3 & Download (PagalWorld) ➔</span>
                  </button>
                </div>
              ))
            ) : (
              <div className="col-span-full py-16 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                  <Music2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">No saved tracks yet</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    Click the download icon on any song to save it directly into your device storage (ROM).
                  </p>
                </div>
                <button
                  onClick={() => setIsSavedViewActive(false)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-xs font-semibold text-white rounded-xl shadow-md transition-colors"
                >
                  Browse & Search Songs
                </button>
              </div>
            )
          ) : loading ? (
            /* Skeleton Loading Cards */
            Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          ) : tracks.length > 0 ? (
            tracks.map((track) => (
              <VideoCard
                key={track.videoId}
                track={track}
                isCurrentlyPlaying={currentTrack?.videoId === track.videoId}
                onPlay={(selected) => setCurrentTrack(selected)}
                onDownload={(selected) => setDownloadModalTrack(selected)}
              />
            ))
          ) : !error ? (
            /* Empty Results View */
            <div className="col-span-full py-16 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                <Music2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">No tracks found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Try searching for a different song, artist, or pick one of the trending suggestions below.
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto pt-2">
                {TRENDING_SUGGESTIONS.slice(0, 5).map((sug) => (
                  <button
                    key={sug}
                    onClick={() => handleTagClick(sug)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 rounded-lg border border-slate-800 transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Pagination: Load More Button */}
        {!isSavedViewActive && nextPageToken && !loading && (
          <div className="flex justify-center mt-10">
            <button
              onClick={() => performSearch(debouncedQuery, activeProvider, regionCode, true)}
              disabled={loadingMore}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-white rounded-xl border border-slate-700 shadow-lg transition-all flex items-center gap-2"
            >
              {loadingMore ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading more tracks...</span>
                </>
              ) : (
                <>
                  <span>Load More Results</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
        </main>
        </>
      )}

      {/* Official YouTube IFrame Player (Dockable Floating / Theater Modal) */}
      <YouTubePlayer
        currentTrack={currentTrack}
        playlist={isSavedViewActive ? savedTracks : tracks}
        onSelectTrack={(selected) => setCurrentTrack(selected)}
        onClose={() => setCurrentTrack(null)}
        onDownload={(selected) => setDownloadModalTrack(selected)}
      />

      {/* Download & Save Modal */}
      <DownloadModal
        isOpen={Boolean(downloadModalTrack)}
        track={downloadModalTrack}
        onClose={() => setDownloadModalTrack(null)}
        onStorageChanged={() => setSavedTracks(getSavedTracks())}
        onOpenConverter={() => {
          setSelectedTrackForConverter(downloadModalTrack);
          setIsConverterModalOpen(true);
        }}
      />

      {/* Video to MP3 Converter Studio */}
      <VideoToMp3Modal
        isOpen={isConverterModalOpen}
        onClose={() => {
          setIsConverterModalOpen(false);
          setSelectedTrackForConverter(null);
        }}
        savedTracks={savedTracks}
        initialSelectedTrack={selectedTrackForConverter}
      />

      {/* API Key Configuration Modal */}
      <KeySettingsModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        hasServerKey={hasServerKey}
        onKeyUpdated={() => {
          refreshStatus();
          performSearch(debouncedQuery, activeProvider, regionCode, false);
        }}
      />

      {/* Mobile Bottom Navigation Bar (Docked Touch Tab Bar) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F19]/95 backdrop-blur-xl border-t border-slate-800/90 px-2 py-1 flex items-center justify-around shadow-2xl">
        <button
          onClick={() => {
            setActiveTab('music');
            setIsSavedViewActive(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 p-1 text-[10px] transition-colors cursor-pointer ${
            activeTab === 'music' ? 'text-red-500 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Music className="w-5 h-5" />
          <span>Music</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('image-converter');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 p-1 text-[10px] transition-colors cursor-pointer ${
            activeTab === 'image-converter' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileImage className="w-5 h-5" />
          <span>Convert</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('image-compressor');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 p-1 text-[10px] transition-colors cursor-pointer ${
            activeTab === 'image-compressor' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Minimize2 className="w-5 h-5" />
          <span>Compress</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('document-converter');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-0.5 p-1 text-[10px] transition-colors cursor-pointer ${
            activeTab === 'document-converter' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span>Doc Suite</span>
        </button>

        <button
          onClick={() => setIsKeyModalOpen(true)}
          className="flex flex-col items-center gap-0.5 p-1 text-[10px] text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
}
