import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  X,
  History,
  TrendingUp,
  ArrowUpLeft,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { fetchSearchSuggestions } from '../services/api.ts';

interface SearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (query: string) => void;
  onClear: () => void;
  recentSearches: string[];
  placeholder?: string;
}

export const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  value,
  onChange,
  onSubmit,
  onClear,
  recentSearches,
  placeholder = 'Search songs, artists, Bollywood, Punjabi, English pop, albums...',
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, string[]>>(new Map());
  const originalTypedQueryRef = useRef<string>(value);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch YouTube suggestions with 150ms debounce
  useEffect(() => {
    const query = value.trim();

    // If query is empty, clear suggestions
    if (!query) {
      setSuggestions([]);
      setIsLoading(false);
      setSelectedIndex(-1);
      return;
    }

    // Check client cache first for instant feedback
    const cached = cacheRef.current.get(query.toLowerCase());
    if (cached) {
      setSuggestions(cached);
      setIsLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const results = await fetchSearchSuggestions(query, controller.signal);
        cacheRef.current.set(query.toLowerCase(), results);
        setSuggestions(results);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Failed to load suggestions:', err);
        }
      } finally {
        setIsLoading(false);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const activeItems = value.trim() ? suggestions : recentSearches;
    const totalItems = activeItems.length;

    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      if (totalItems > 0) {
        setIsOpen(true);
        e.preventDefault();
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (totalItems === 0) return;

      const nextIndex = selectedIndex < totalItems - 1 ? selectedIndex + 1 : 0;
      setSelectedIndex(nextIndex);
      onChange(activeItems[nextIndex]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (totalItems === 0) return;

      if (selectedIndex <= 0) {
        setSelectedIndex(-1);
        onChange(originalTypedQueryRef.current);
      } else {
        const prevIndex = selectedIndex - 1;
        setSelectedIndex(prevIndex);
        onChange(activeItems[prevIndex]);
      }
    } else if (e.key === 'Enter') {
      if (isOpen && selectedIndex >= 0 && selectedIndex < totalItems) {
        e.preventDefault();
        const selectedQuery = activeItems[selectedIndex];
        handleSelectSuggestion(selectedQuery);
      } else {
        setIsOpen(false);
        setSelectedIndex(-1);
        if (value.trim()) {
          onSubmit(value.trim());
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setIsOpen(false);
    setSelectedIndex(-1);
    onSubmit(suggestion);
    inputRef.current?.blur();
  };

  const handleFillSuggestion = (e: React.MouseEvent, suggestion: string) => {
    e.stopPropagation();
    onChange(suggestion);
    originalTypedQueryRef.current = suggestion;
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    originalTypedQueryRef.current = val;
    setSelectedIndex(-1);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  // Render suggestion text with highlighted match
  const renderSuggestionText = (text: string, query: string) => {
    const trimmedQuery = query.trim().toLowerCase();
    const lowerText = text.toLowerCase();

    if (trimmedQuery && lowerText.startsWith(trimmedQuery)) {
      const matchPart = text.slice(0, trimmedQuery.length);
      const completionPart = text.slice(trimmedQuery.length);
      return (
        <span className="truncate">
          <span className="text-slate-400 font-medium">{matchPart}</span>
          <span className="text-white font-bold">{completionPart}</span>
        </span>
      );
    }

    return <span className="text-slate-200 font-medium truncate">{text}</span>;
  };

  const showRecentSearches = !value.trim() && recentSearches.length > 0;
  const showSuggestions = Boolean(value.trim() && suggestions.length > 0);
  const shouldShowDropdown = isOpen && (showRecentSearches || showSuggestions);

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      {/* Search Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) {
            setIsOpen(false);
            setSelectedIndex(-1);
            onSubmit(value.trim());
          }
        }}
        className="relative flex items-center"
      >
        <Search className="absolute left-3 sm:left-4 w-4 h-4 sm:w-5 sm:h-5 text-slate-400 pointer-events-none" />

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder="Search songs, artists, Bollywood..."
          autoComplete="off"
          spellCheck={false}
          className="w-full pl-9 sm:pl-12 pr-16 sm:pr-28 py-2.5 sm:py-3.5 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-xs sm:text-base text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 shadow-xl transition-all"
        />

        {/* Clear Button */}
        {value && (
          <button
            type="button"
            onClick={() => {
              onClear();
              setSuggestions([]);
              setSelectedIndex(-1);
              inputRef.current?.focus();
            }}
            className="absolute right-12 sm:right-20 p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}

        {/* Search Submit Button */}
        <button
          type="submit"
          className="absolute right-1.5 sm:right-2.5 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5"
          aria-label="Search"
        >
          {isLoading && value.trim() ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5 sm:hidden" />
          )}
          <span className="hidden sm:inline">Search</span>
        </button>
      </form>

      {/* Autocomplete Dropdown Menu */}
      {shouldShowDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#0F172A]/98 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden transition-all animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-slate-800/80 bg-slate-900/80 text-[11px] font-semibold text-slate-400">
            <div className="flex items-center gap-1.5">
              {showSuggestions ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-slate-300">Popular Suggestions</span>
                </>
              ) : (
                <>
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-300">Recent Searches</span>
                </>
              )}
            </div>

            <span className="hidden sm:inline text-[10px] text-slate-500 font-normal">
              Press <kbd className="px-1 py-0.5 bg-slate-800 rounded text-[9px] text-slate-300">↑</kbd>{' '}
              <kbd className="px-1 py-0.5 bg-slate-800 rounded text-[9px] text-slate-300">↓</kbd> to navigate
            </span>
          </div>

          {/* Suggestions List */}
          <ul ref={listRef} className="py-1.5 max-h-[50vh] sm:max-h-72 overflow-y-auto">
            {showSuggestions &&
              suggestions.map((suggestion, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <li
                    key={`${suggestion}-${idx}`}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm cursor-pointer transition-colors group ${
                      isSelected
                        ? 'bg-rose-950/40 text-white border-l-2 border-rose-500 pl-[14px]'
                        : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                      <Search
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isSelected ? 'text-rose-400' : 'text-slate-500 group-hover:text-slate-300'
                        }`}
                      />
                      {renderSuggestionText(suggestion, value)}
                    </div>

                    {/* Insert / Fill Query Icon button */}
                    <button
                      type="button"
                      onClick={(e) => handleFillSuggestion(e, suggestion)}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Insert into search input"
                    >
                      <ArrowUpLeft className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}

            {showRecentSearches &&
              recentSearches.map((recent, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <li
                    key={`${recent}-${idx}`}
                    onClick={() => handleSelectSuggestion(recent)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm cursor-pointer transition-colors group ${
                      isSelected
                        ? 'bg-rose-950/40 text-white border-l-2 border-rose-500 pl-[14px]'
                        : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                      <History
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isSelected ? 'text-rose-400' : 'text-slate-500 group-hover:text-slate-300'
                        }`}
                      />
                      <span className="text-slate-200 font-medium truncate">{recent}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleFillSuggestion(e, recent)}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Insert into search input"
                    >
                      <ArrowUpLeft className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
};
