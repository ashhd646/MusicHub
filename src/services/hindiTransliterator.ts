/**
 * Devanagari (Hindi) to Hinglish (Roman alphabet) phonetic transliterator
 * and song name cleaner.
 * Ensures queries sent to external music search engines (like PagalWorld)
 * are always in English/Hinglish (e.g., "जनम जनम" -> "janam janam").
 */

const DEVANAGARI_MAP: Record<string, string> = {
  // Consonants
  '\u0915': 'k',
  '\u0916': 'kh',
  '\u0917': 'g',
  '\u0918': 'gh',
  '\u0919': 'ng',
  '\u091A': 'ch',
  '\u091B': 'chh',
  '\u091C': 'j',
  '\u091D': 'jh',
  '\u091E': 'ny',
  '\u091F': 't',
  '\u0920': 'th',
  '\u0921': 'd',
  '\u0922': 'dh',
  '\u0923': 'n',
  '\u0924': 't',
  '\u0925': 'th',
  '\u0926': 'd',
  '\u0927': 'dh',
  '\u0928': 'n',
  '\u092A': 'p',
  '\u092B': 'ph',
  '\u092C': 'b',
  '\u092D': 'bh',
  '\u092E': 'm',
  '\u092F': 'y',
  '\u0930': 'r',
  '\u0932': 'l',
  '\u0933': 'l',
  '\u0935': 'v',
  '\u0936': 'sh',
  '\u0937': 'sh',
  '\u0938': 's',
  '\u0939': 'h',
  // Nukta Consonants
  '\u0958': 'q',
  '\u0959': 'kh',
  '\u095A': 'gh',
  '\u095B': 'z',
  '\u095C': 'd',
  '\u095D': 'dh',
  '\u095E': 'f',
  // Independent Vowels
  '\u0905': 'a',
  '\u0906': 'aa',
  '\u0907': 'i',
  '\u0908': 'ee',
  '\u0909': 'u',
  '\u090A': 'oo',
  '\u090B': 'ri',
  '\u090F': 'e',
  '\u0910': 'ai',
  '\u0913': 'o',
  '\u0914': 'au',
  // Dependent Vowel Signs (Matras)
  '\u093E': 'a',
  '\u093F': 'i',
  '\u0940': 'i',
  '\u0941': 'u',
  '\u0942': 'u',
  '\u0943': 'ri',
  '\u0947': 'e',
  '\u0948': 'ai',
  '\u094B': 'o',
  '\u094C': 'au',
  // Anusvara / Chandrabindu / Visarga / Virama
  '\u0902': 'n',
  '\u0901': 'n',
  '\u0903': 'h',
  '\u094D': '',
};

const CONSONANTS = new Set([
  '\u0915',
  '\u0916',
  '\u0917',
  '\u0918',
  '\u0919',
  '\u091A',
  '\u091B',
  '\u091C',
  '\u091D',
  '\u091E',
  '\u091F',
  '\u0920',
  '\u0921',
  '\u0922',
  '\u0923',
  '\u0924',
  '\u0925',
  '\u0926',
  '\u0927',
  '\u0928',
  '\u092A',
  '\u092B',
  '\u092C',
  '\u092D',
  '\u092E',
  '\u092F',
  '\u0930',
  '\u0932',
  '\u0933',
  '\u0935',
  '\u0936',
  '\u0937',
  '\u0938',
  '\u0939',
  '\u0958',
  '\u0959',
  '\u095A',
  '\u095B',
  '\u095C',
  '\u095D',
  '\u095E',
]);

const MATRAS = new Set([
  '\u093E',
  '\u093F',
  '\u0940',
  '\u0941',
  '\u0942',
  '\u0943',
  '\u0947',
  '\u0948',
  '\u094B',
  '\u094C',
  '\u094D',
  '\u0902',
  '\u0901',
  '\u0903',
]);

/**
 * Converts Devanagari Hindi text to clean English / Hinglish phonetics
 */
export function devanagariToHinglish(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (DEVANAGARI_MAP[ch] !== undefined) {
      let roman = DEVANAGARI_MAP[ch];
      if (CONSONANTS.has(ch)) {
        const next = i + 1 < text.length ? text[i + 1] : '';
        const hasMatra = MATRAS.has(next);
        const isEnd = !next || /\s/.test(next) || !/[\u0900-\u097F]/.test(next);
        // Hindi schwa addition: if consonant has no matra and is not end of word, add inherent 'a'
        if (!hasMatra && !isEnd) {
          roman += 'a';
        }
      }
      result += roman;
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * Takes any song title (in Hindi Devanagari, Hinglish, or English),
 * transliterates any Hindi text to Hinglish, removes extraneous tags,
 * and extracts the clean song title ready for search engines.
 */
export function cleanSongTitleToHinglish(rawTitle: string): string {
  if (!rawTitle) return '';

  // Transliterate Devanagari script to Hinglish if present
  let converted = rawTitle;
  if (/[\u0900-\u097F]/.test(rawTitle)) {
    converted = devanagariToHinglish(rawTitle);
  }

  // 1. Remove bracketed info like (Official Video), [4K UHD], (Full Song), (Audio), etc.
  const t = converted.replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]/gi, ' ').trim();

  // 2. Split by any delimiter: |, -, en-dash (–), em-dash (—), colon, bullet (•), slash
  const parts = t.split(/\s*[|\-–—:•\/]\s*/).map((p) => p.trim()).filter(Boolean);

  // 3. Take primary song part (usually first part)
  const firstPart = (parts[0] || t).replace(/[^a-zA-Z0-9\s]/g, ' ').trim();

  // 4. Strip leftover words like 'video song', 'audio song', 'full song'
  let cleanSong = firstPart
    .replace(/\b(video\s*song|audio\s*song|full\s*song|official\s*song|song|video|lyrical|audio|hd|4k)\b/gi, '')
    .trim();

  if (!cleanSong && parts.length > 1) {
    cleanSong = parts[1].replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  }

  const finalResult = (cleanSong || t.slice(0, 30))
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return finalResult;
}
