import React from 'react';
import { Compass, Globe2 } from 'lucide-react';

interface FilterBarProps {
  selectedTag: string;
  onSelectTag: (query: string) => void;
  regionCode: string;
  onChangeRegion: (region: string) => void;
}

const DISCOVERY_TAGS = [
  { label: '🔥 New Releases 2026', query: 'Latest new songs release 2026' },
  { label: 'Trending Music', query: 'Trending songs India latest hits' },
  { label: 'Bollywood Hits', query: 'Latest Bollywood songs' },
  { label: 'Tum Hi Ho & Arijit', query: 'Tum Hi Ho Arijit Singh' },
  { label: 'Old Hindi Classics', query: 'Old Hindi classic songs evergreen' },
  { label: 'Punjabi Music', query: 'Punjabi music hits latest' },
  { label: 'Bhojpuri Hits', query: 'Bhojpuri songs latest' },
  { label: 'Tamil Melodies', query: 'Tamil melody songs Anirudh AR Rahman' },
  { label: 'Telugu Cinema', query: 'Telugu movie songs hit' },
  { label: 'English Pop', query: 'English pop music billboard hot 100' },
  { label: 'K-Pop', query: 'Korean music kpop hits' },
  { label: 'Indian Classical', query: 'Classical Indian music raga' },
  { label: 'Lo-Fi Chill', query: 'lofi hip hop music beats chill' },
];

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedTag,
  onSelectTag,
  regionCode,
  onChangeRegion,
}) => {
  return (
    <div className="border-b border-slate-800/80 bg-[#0B0F19]/50 py-2 sm:py-3">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 overflow-x-auto scrollbar-none snap-x touch-pan-x py-0.5">
          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-slate-400 mr-1 shrink-0">
              <Compass className="w-3.5 h-3.5 text-red-500" />
              <span>Explore:</span>
            </div>
            {DISCOVERY_TAGS.map((tag) => {
              const isActive = selectedTag.toLowerCase() === tag.query.toLowerCase();
              return (
                <button
                  key={tag.label}
                  onClick={() => onSelectTag(tag.query)}
                  className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 snap-start cursor-pointer ${
                    isActive
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>

          {/* Region selector */}
          <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-slate-800">
            <Globe2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={regionCode}
              onChange={(e) => onChangeRegion(e.target.value)}
              className="bg-slate-900 text-slate-300 text-[11px] sm:text-xs font-medium rounded-lg px-2 sm:px-2.5 py-1.5 border border-slate-800 focus:outline-none focus:border-red-500 cursor-pointer"
              aria-label="Search region"
            >
              <option value="IN">IN</option>
              <option value="US">US (Global)</option>
              <option value="GB">GB</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
