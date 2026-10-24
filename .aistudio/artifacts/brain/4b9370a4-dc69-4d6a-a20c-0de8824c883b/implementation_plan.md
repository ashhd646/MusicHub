# MusicHub — YouTube API + Universal Music Search Integration

MusicHub is a universal music discovery and streaming platform connecting listeners with YouTube videos and open-license Jamendo tracks. It features official YouTube IFrame playback, multi-lingual search filters, resilient quota/error management, and a dual-mode API key configuration system.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were aligned during Phase 1 interactive clarification:

- **Dual API Key Mode (Confirmed)**: The backend supports server-side `YOUTUBE_API_KEY` in environment variables while also providing a client-side API Key settings modal. If the server key is missing or quota is exhausted, users can supply their own key securely stored in browser storage and passed in the `X-YouTube-Key` request header. Clear setup instructions are provided if neither is present.
- **Provider Scope (Confirmed)**: Integrated dual-provider architecture featuring the official YouTube Data API v3 (primary video provider) and Jamendo Open Audio API (royalty-free audio stream provider), unified through an extensible Provider Adapter Architecture.
- **Playback Interface (Confirmed)**: A dockable floating mini-player at the bottom right that can expand into a full theater modal view with video details, playback controls, channel info, and direct YouTube link.

---

### 1. Overview & Core Concept

- **What It Does**: Enables users to search, explore, and play music across languages (Hindi, Punjabi, Bhojpuri, Tamil, Telugu, English Pop, Korean, Classical) and categories (Latest Releases, Bollywood, Retro Classics, Regional Hits). Results show live thumbnail, channel/artist, duration/published date, source provider badge, and playback capability.
- **Target Audience**: Music lovers, regional language listeners, and creators seeking a fast discovery hub that respects official YouTube developer policies and terms of service.
- **Key Value**: Clean, ad-respecting official playback through YouTube's Iframe Player API, without scraping or unauthorized stream extraction, paired with instant fallback handling, memory-cached responses, and rate limiting.

---

### 2. User Experience & Visual Design

- **Visual Identity & Theme**:
  - *Aesthetic*: Premium dark-slate streaming studio (`#090D16` canvas, `#111827` elevated cards, `#1E293B` borders).
  - *Accent & Energy*: Deep Crimson & Amber glow (`#EF4444` YouTube red accent, `#F59E0B` Jamendo amber, `#3B82F6` primary focus).
  - *Zero-Pill Discipline*: Categories and publication dates rendered with clean typography and unboxed separators (`Channel · 2 weeks ago · HD Video`).
  - *Typography*: Bold geometric headlines (`Plus Jakarta Sans`), high-readability body copy, and tabular figures for duration and dates.
- **Key User Flows**:
  1. **Discovery & Quick Filters**: Browse trending queries (Tum Hi Ho, Old Hindi Classics, Latest Punjabi, Telugu Hits, Lo-fi Beats, Billboard Hot 100) and language pills.
  2. **Universal Search**: Debounced search (400ms) with Enter-key and button support, query clear, search history, and provider filter tabs (All, YouTube, Jamendo).
  3. **Official Playback**: Clicking any YouTube track opens the floating dockable player using the YouTube IFrame Player API. Supports minimize, theater expansion, video status badges (e.g. embeddability check), and "Watch on YouTube" fallback.
  4. **API Key Setup & Diagnostics**: Dedicated Key status modal with a 1-click test button, quota monitor, and step-by-step setup guide for generating free Google Cloud YouTube Data API v3 credentials.

---

### 3. Key Product Decisions & Trade-Offs

- **Official YouTube IFrame Player vs Stream Extraction**:
  - *Approach*: Exclusively use the official YouTube Iframe Player API (`window.YT.Player`).
  - *Rationale*: Strict compliance with Google & YouTube Developer Policies and Terms of Service. Stream extraction/scraping is prohibited and brittle.
- **Backend Memory Caching & Rate Limiting**:
  - *Approach*: In-memory LRU cache on Express (TTL: 15 minutes) with duplicate in-flight request deduplication.
  - *Rationale*: Conserves YouTube's 10,000 daily quota units (search costs 100 units per request; 15-min cache avoids redundant quota consumption on popular queries).
- **Graceful Quota & Embed Failure Handling**:
  - *Approach*: Clear error diagnosis with specific recovery actions: prompt for personal key, switch to Jamendo audio, or direct "Open on YouTube" link for non-embeddable videos (error 101/150).

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    MusicHub React 19 Frontend                   │
│                                                                 │
│  ┌─────────────────────────┐  ┌──────────────────────────────┐  │
│  │   Search & Filter Bar   │  │    Dual Provider Selector    │  │
│  └───────────┬─────────────┘  └──────────────┬───────────────┘  │
│              ▼                               ▼                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │       Video & Track Grid (Skeletons, Error Banners)       │  │
│  └───────────────────────────┬───────────────────────────────┘  │
│                              │ Selected Video                   │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │   YouTubePlayer.tsx (Official YT IFrame API, Dock/Modal)  │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP /api/*
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Express API Service                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Rate Limiter (express-rate-limit) & In-Memory TTL Cache   │  │
│  └───────────────────────────┬───────────────────────────────┘  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                Universal Search Adapter                   │  │
│  │       ┌──────────────────────┐  ┌────────────────────┐    │  │
│  │       │  youtubeProvider.js  │  │ jamendoProvider.js │    │  │
│  │       └──────────┬───────────┘  └─────────┬──────────┘    │  │
│  └──────────────────┼────────────────────────┼───────────────┘  │
└─────────────────────┼────────────────────────┼──────────────────┘
                      ▼                        ▼
           YouTube Data API v3           Jamendo Audio API
```

#### Core Components & Endpoints

- **Backend Endpoints**:
  - `GET /api/health` — Returns status, cached item counts, and configured provider status.
  - `GET /api/search/youtube?q=...&pageToken=...&regionCode=...` — Direct YouTube search via `youtubeProvider.js`.
  - `GET /api/search/universal?q=...&provider=...` — Unified multi-provider endpoint returning standard items.
  - `GET /api/videos/:videoId` — Fetches detailed snippet, contentDetails (duration, definition), and statistics.
  - `GET /api/config/status` — Checks if server key is configured without exposing secrets.
- **Unified Track Schema**:
  - `videoId` (string), `title` (string), `description` (string), `thumbnail` (string), `channelTitle` (string), `publishedAt` (string), `source` (`'youtube'` | `'jamendo'`), `playbackType` (`'youtube-iframe'` | `'audio-stream'`), `audioStreamUrl` (optional), `duration` (string), `externalUrl` (string).
- **Frontend Architecture**:
  - `App.tsx`: Main layout, state coordination, and notification alerts.
  - `components/Navbar.tsx`: Brand wordmark, quick search bar, key settings trigger.
  - `components/FilterBar.tsx`: Language/genre pills (Bollywood, Punjabi, Telugu, Pop, etc.) and provider switch.
  - `components/VideoCard.tsx`: Thumbnail, channel info, duration badge, play trigger, external YouTube link.
  - `components/YouTubePlayer.tsx`: Official IFrame player instance, error handler (codes 101/150 for embedding restrictions), volume, progress, docking/fullscreen modes.
  - `components/KeySettingsModal.tsx`: Dual-mode key manager with validation tester and instructions.
  - `services/api.ts`: Debounced API client handling local credentials and pagination.

---

### 5. Execution Steps

1. **Backend Integration**: Implement `server.ts` with Express, rate-limiting, LRU search cache, and official YouTube & Jamendo adapters in `server/providers/`.
2. **Vite & Server Proxy Config**: Wire Vite dev server to seamlessly handle `/api/*` routes and support `npm run build` production bundling.
3. **Core Player & Frontend UI**: Implement `YouTubePlayer.tsx` with official `https://www.youtube.com/iframe_api`, responsive media grid, skeleton states, and multi-language discovery chips.
4. **Key Configuration & Error Resilience**: Build `KeySettingsModal.tsx` and integrate friendly fallback flows for missing keys and quota limits.
5. **Testing & Verification**: Verify `GET /api/health`, test Hindi & English search queries, verify pagination, validate YouTube Iframe playback and error handling, and run `compile_applet`.
