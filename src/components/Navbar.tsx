import React from 'react';
import {
  Music,
  Settings,
  Sparkles,
  Flame,
  HardDrive,
  FileAudio,
  FileImage,
  Minimize2,
  FileText,
} from 'lucide-react';

export type MainAppTab = 'music' | 'image-converter' | 'image-compressor' | 'document-converter';

interface NavbarProps {
  activeTab: MainAppTab;
  onSelectTab: (tab: MainAppTab) => void;
  onOpenSettings: () => void;
  onSelectCategory: (category: string) => void;
  onOpenSaved: () => void;
  onOpenConverter: () => void;
  savedCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenSettings,
  onSelectCategory,
  onOpenSaved,
  onOpenConverter,
  savedCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0B0F19]/95 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-6">
          {/* Zone 1: Wordmark */}
          <div
            onClick={() => onSelectTab('music')}
            className="flex items-center gap-2 sm:gap-2.5 shrink-0 cursor-pointer group"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-red-600 via-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-red-500/20 group-hover:scale-105 transition-transform">
              <Music className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-bold tracking-tight text-white font-['Plus_Jakarta_Sans'] whitespace-nowrap">
                Media<span className="text-red-500">Hub</span>
                <span className="text-[10px] font-mono ml-1 px-1.5 py-0.2 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 hidden md:inline-block">
                  Studio
                </span>
              </span>
            </div>
          </div>

          {/* Zone 2: Main Suite Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-1 px-1 max-w-[calc(100vw-130px)] sm:max-w-none">
            {/* Tab: Music */}
            <button
              onClick={() => onSelectTab('music')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'music'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
              <span className="hidden sm:inline">Music & Player</span>
              <span className="sm:hidden">Music</span>
            </button>

            {/* Tab: Image Converter */}
            <button
              onClick={() => onSelectTab('image-converter')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'image-converter'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Convert any image extension to another & vice versa"
            >
              <FileImage className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />
              <span className="hidden sm:inline">Image Converter</span>
              <span className="sm:hidden">Images</span>
            </button>

            {/* Tab: Image Compressor */}
            <button
              onClick={() => onSelectTab('image-compressor')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'image-compressor'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Compress and reduce image size with live preview"
            >
              <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              <span className="hidden sm:inline">Image Compressor</span>
              <span className="sm:hidden">Compress</span>
            </button>

            {/* Tab: Document Suite */}
            <button
              onClick={() => onSelectTab('document-converter')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'document-converter'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Images to PDF, PDF to Images, PDF Merger, Text to PDF"
            >
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
              <span className="hidden sm:inline">Doc & PDF Suite</span>
              <span className="sm:hidden">PDFs</span>
            </button>
          </nav>

          {/* Zone 3: Settings & Saved Shortcuts */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Saved quick shortcut */}
            {activeTab === 'music' && (
              <button
                onClick={onOpenSaved}
                className="relative p-2 text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Saved Songs on Device"
              >
                <HardDrive className="w-4 h-4 text-emerald-400" />
                {savedCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-red-600 text-white font-mono px-1.5 py-0.2 rounded-full font-bold shadow">
                    {savedCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
              title="Settings & Export App"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
