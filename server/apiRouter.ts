import { Router, type Request, type Response } from 'express';
import { defaultYouTubeProvider, isValidYouTubeId } from './providers/youtubeProvider.ts';
import { defaultJamendoProvider } from './providers/jamendoProvider.ts';
import { globalCache } from './cache.ts';
import type { UnifiedTrack } from '../src/types/index.ts';
import { cleanSongTitleToHinglish, devanagariToHinglish } from '../src/services/hindiTransliterator.ts';

export const apiRouter = Router();

// In-memory rate limiting map: ip -> timestamps
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests/min

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return true;
}

apiRouter.use((req: Request, res: Response, next) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      error: 'Too many requests. Please slow down and try again shortly.',
      code: 'RATE_LIMITED',
    });
  }
  next();
});

// GET /api/health
apiRouter.get('/health', (req: Request, res: Response) => {
  const hasServerKey = Boolean(process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_API_KEY.trim().length > 0);
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cacheEntries: globalCache.size(),
    hasServerKey,
    providers: {
      youtube: true,
      jamendo: true,
    },
  });
});

// GET /api/config/status
apiRouter.get('/config/status', (req: Request, res: Response) => {
  const hasServerKey = Boolean(process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_API_KEY.trim().length > 0);
  res.json({
    hasServerKey,
    cacheSize: globalCache.size(),
  });
});

// GET /api/suggestions?q=...
// Integrates YouTube Suggest API with in-memory caching and deduplication
apiRouter.get('/suggestions', async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  if (!q) {
    return res.json({ suggestions: [], query: '' });
  }

  const cacheKey = `suggest:${q.toLowerCase()}`;

  try {
    const suggestions = await globalCache.dedupe(
      cacheKey,
      async () => {
        const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`;
        const response = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json, text/plain, */*',
          },
        });

        if (!response.ok) {
          return [];
        }

        const data = await response.json();
        if (Array.isArray(data) && Array.isArray(data[1])) {
          return (data[1] as string[])
            .filter((s) => typeof s === 'string' && s.trim().length > 0)
            .slice(0, 10);
        }
        return [];
      },
      15 * 60 * 1000
    );

    res.json({ suggestions, query: q });
  } catch (err: any) {
    console.error('YouTube Suggest API query error:', err);
    res.json({ suggestions: [], query: q });
  }
});

// GET /api/search/youtube?q=...&pageToken=...&regionCode=...&relevanceLanguage=...
apiRouter.get('/search/youtube', async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  const pageToken = (req.query.pageToken as string) || undefined;
  const regionCode = (req.query.regionCode as string) || undefined;
  const relevanceLanguage = (req.query.relevanceLanguage as string) || undefined;
  const customKey = (req.headers['x-youtube-key'] as string) || (req.query.apiKey as string) || undefined;

  if (!q) {
    return res.json({ items: [], nextPageToken: null, totalResults: 0, query: '', source: 'youtube' });
  }

  const cacheKey = `yt:${q}:${pageToken || ''}:${regionCode || ''}:${relevanceLanguage || ''}:${customKey ? 'custom' : 'server'}`;

  try {
    const result = await globalCache.dedupe(cacheKey, async () => {
      return await defaultYouTubeProvider.search({
        q,
        pageToken,
        regionCode,
        relevanceLanguage,
        apiKey: customKey,
      });
    });

    res.json({
      items: result.items,
      nextPageToken: result.nextPageToken,
      totalResults: result.totalResults,
      query: q,
      source: 'youtube',
    });
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || 'YouTube search failed.',
      code: err.code || 'INTERNAL_ERROR',
      instructions: err.instructions || [],
      details: err.details,
    });
  }
});

// GET /api/search/universal?q=...&provider=...
apiRouter.get('/search/universal', async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  const provider = ((req.query.provider as string) || 'all').toLowerCase();
  const pageToken = (req.query.pageToken as string) || undefined;
  const regionCode = (req.query.regionCode as string) || undefined;
  const relevanceLanguage = (req.query.relevanceLanguage as string) || undefined;
  const customKey = (req.headers['x-youtube-key'] as string) || (req.query.apiKey as string) || undefined;

  if (!q) {
    return res.json({ items: [], nextPageToken: null, totalResults: 0, query: '', source: provider });
  }

  const cacheKey = `univ:${provider}:${q}:${pageToken || ''}:${regionCode || ''}:${relevanceLanguage || ''}:${customKey ? 'custom' : 'server'}`;

  try {
    const result = await globalCache.dedupe(cacheKey, async () => {
      let ytItems: UnifiedTrack[] = [];
      let ytNextToken: string | null = null;
      let ytError: any = null;

      let jamendoItems: UnifiedTrack[] = [];

      // If provider includes youtube
      if (provider === 'all' || provider === 'youtube') {
        try {
          const ytResult = await defaultYouTubeProvider.search({
            q,
            pageToken,
            regionCode,
            relevanceLanguage,
            apiKey: customKey,
          });
          ytItems = ytResult.items;
          ytNextToken = ytResult.nextPageToken || null;
        } catch (ytErr) {
          ytError = ytErr;
        }
      }

      // If provider includes jamendo (only on first page for simplicity)
      if ((provider === 'all' || provider === 'jamendo') && !pageToken) {
        try {
          const jResult = await defaultJamendoProvider.search({ q, limit: 10 });
          jamendoItems = jResult.items;
        } catch (jErr) {
          console.warn('Jamendo universal search error:', jErr);
        }
      }

      // If user strictly requested YouTube and it failed, throw the YouTube error so frontend can present key/quota UI
      if (provider === 'youtube' && ytError) {
        throw ytError;
      }

      // If user requested all providers and YouTube failed, but Jamendo has items
      if (provider === 'all' && ytError && jamendoItems.length === 0) {
        throw ytError;
      }

      // Combine results: if all, interleave or prioritize YouTube
      const combinedItems: UnifiedTrack[] = [];
      if (provider === 'youtube') {
        combinedItems.push(...ytItems);
      } else if (provider === 'jamendo') {
        combinedItems.push(...jamendoItems);
      } else {
        // Universal combined: YouTube results first, then Jamendo open audio tracks
        combinedItems.push(...ytItems, ...jamendoItems);
      }

      return {
        items: combinedItems,
        nextPageToken: ytNextToken,
        totalResults: combinedItems.length,
        query: q,
        source: provider,
        warning: ytError ? ytError.message : undefined,
        ytErrorCode: ytError?.code,
      };
    });

    res.json(result);
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || 'Search failed.',
      code: err.code || 'INTERNAL_ERROR',
      instructions: err.instructions || [],
      details: err.details,
    });
  }
});

// GET /api/videos/:videoId
apiRouter.get('/videos/:videoId', async (req: Request, res: Response) => {
  const { videoId } = req.params;
  const customKey = (req.headers['x-youtube-key'] as string) || (req.query.apiKey as string) || undefined;

  if (!isValidYouTubeId(videoId)) {
    return res.status(400).json({
      error: 'Invalid YouTube video ID format. Must be an 11-character string.',
      code: 'BAD_REQUEST',
    });
  }

  const cacheKey = `video:${videoId}:${customKey ? 'custom' : 'server'}`;

  try {
    const video = await globalCache.dedupe(cacheKey, async () => {
      return await defaultYouTubeProvider.getVideo(videoId, customKey);
    });

    if (!video) {
      return res.status(404).json({
        error: 'Video not found or is private.',
        code: 'NOT_FOUND',
      });
    }

    res.json(video);
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || 'Failed to fetch video details.',
      code: err.code || 'INTERNAL_ERROR',
      instructions: err.instructions || [],
    });
  }
});

// Helper: Clean YouTube title for PagalWorld search (always outputs in clean Hinglish)
function cleanSongTitleForPagalworld(title: string): string {
  return cleanSongTitleToHinglish(title);
}

// Helper: Resolve exact Pagalworld song download page with strict relevance scoring
async function resolvePagalworldSongUrl(query: string): Promise<string> {
  const cleanQ = cleanSongTitleToHinglish(query);
  const fallbackUrl = `https://pagalworld.is/search/${encodeURIComponent(cleanQ)}/`;

  // If query contains Devanagari Hindi, transliterate it to Hinglish first
  const transliteratedQuery = /[\u0900-\u097F]/.test(query) ? devanagariToHinglish(query) : query;

  // Extract all plausible search candidates from the title in Hinglish
  const t = transliteratedQuery.replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]/gi, ' ');
  const rawParts = t.split(/\s*[|\-–—:•\/]\s*/).map((p) => p.trim()).filter(Boolean);

  const candidates: string[] = [];
  if (cleanQ) {
    candidates.push(cleanQ);
  }

  for (const p of rawParts) {
    let c = p.replace(/[^a-zA-Z0-9\s]/g, ' ');
    c = c.replace(/\b(video\s*song|audio\s*song|full\s*song|official\s*song|song|video|lyrical|audio|hd|4k)\b/gi, '').trim();
    c = c.replace(/\s+/g, ' ').trim();
    if (c.length > 1 && !/^(t-series|zee music|sony music|yrf|tips|speed records)$/i.test(c) && !candidates.includes(c)) {
      candidates.push(c);
    }
  }

  if (candidates.length === 0) {
    candidates.push(cleanQ || 'song');
  }

  // Score candidate slugs across all query parts
  const allValidSlugs: Array<{ score: number; slug: string }> = [];

  for (const cand of candidates.slice(0, 3)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const searchUrl = `https://pagalworld.is/search/${encodeURIComponent(cand)}/`;
      const resp = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(timeout);

      if (!resp.ok) continue;

      const html = await resp.text();
      const slugs = Array.from(
        new Set(
          Array.from(html.matchAll(/https:\/\/pagalworld\.is\/song\/([a-zA-Z0-9\-]+)-mp3-download\//g)).map((m) => m[1])
        )
      );

      const targetSlug = cand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const words = cand.toLowerCase().split(/\s+/).filter((w) => w.length > 1);

      for (const s of slugs) {
        const sWords = s.split('-');
        // Count how many keywords from this candidate query match the slug
        const matchedCount = words.filter((w) => sWords.includes(w) || sWords.some((part) => part.includes(w))).length;

        // STRICT FILTER: A slug MUST contain at least one major word from the candidate!
        // This permanently prevents returning unrelated sidebar songs like "tera-mera-rishta-continues"
        if (matchedCount > 0) {
          const isExact = s === targetSlug ? 1 : 0;
          const isRemix = /remix|dance|reprise|acoustic|slowed|mix/i.test(s) ? 1 : 0;
          const score = isExact * 100 + matchedCount * 10 - isRemix * 20 - s.length * 0.1;
          allValidSlugs.push({ score, slug: s });
        }
      }
    } catch (err) {
      console.warn('Pagalworld search candidate error:', cand, err);
      continue;
    }
  }

  // If we found any valid relevant slug matching the song name
  if (allValidSlugs.length > 0) {
    allValidSlugs.sort((a, b) => b.score - a.score);
    return `https://pagalworld.is/song/${allValidSlugs[0].slug}-mp3-download/`;
  }

  // SAFEGUARD: Never redirect to a random song! Redirect to search page instead.
  return fallbackUrl;
}

// GET /api/redirect/pagalworld?q=Song+Title -> Direct HTTP 302 Redirect to exact PagalWorld song page
apiRouter.get('/redirect/pagalworld', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  if (!query.trim()) {
    return res.redirect('https://pagalworld.is/');
  }

  const targetUrl = await resolvePagalworldSongUrl(query);
  res.redirect(targetUrl);
});

// GET /api/resolve/pagalworld?q=Song+Title -> Returns JSON with exact download page URL
apiRouter.get('/resolve/pagalworld', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  const cleanTitle = cleanSongTitleForPagalworld(query);
  const targetUrl = await resolvePagalworldSongUrl(query);
  res.json({
    originalQuery: query,
    cleanTitle,
    targetUrl,
  });
});
