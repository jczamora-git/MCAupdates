/**
 * Google Translate GTX Service - FREE Translation without API Keys
 * Based on: https://github.com/ssut/py-googletrans/issues/268
 * 
 * Features:
 * - No API key required
 * - Unlimited translations (fair use)
 * - Fast and reliable
 * - Supports 100+ languages
 */

export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'zh' | 'ja' | 'ko' | 'ar' | 'tl';
export type SourceLanguageCode = LanguageCode | 'auto';

export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'tl', name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
];

interface CacheEntry {
  value: string;
  timestamp: number;
}

const CACHE_STORAGE_KEY = 'campuscompanion_translation_cache_v1';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_CACHE_ENTRIES = 2000;

// Translation cache layers
const translationCache = new Map<string, CacheEntry>();
const inFlightTranslations = new Map<string, Promise<string>>();

let cacheLoaded = false;
let persistTimer: number | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function pruneCache(): void {
  const now = Date.now();

  for (const [key, entry] of translationCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      translationCache.delete(key);
    }
  }

  if (translationCache.size <= MAX_CACHE_ENTRIES) {
    return;
  }

  const sortedByAge = Array.from(translationCache.entries()).sort(
    (a, b) => a[1].timestamp - b[1].timestamp
  );

  const removeCount = translationCache.size - MAX_CACHE_ENTRIES;
  for (let index = 0; index < removeCount; index++) {
    translationCache.delete(sortedByAge[index][0]);
  }
}

function persistCacheToStorage(): void {
  if (!isBrowser()) {
    return;
  }

  pruneCache();

  try {
    const serialized = JSON.stringify(Array.from(translationCache.entries()));
    localStorage.setItem(CACHE_STORAGE_KEY, serialized);
  } catch (error) {
    console.warn('Failed to persist translation cache:', error);
  }
}

function schedulePersistCache(): void {
  if (!isBrowser()) {
    return;
  }

  if (persistTimer !== null) {
    return;
  }

  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    persistCacheToStorage();
  }, 250);
}

function loadCacheFromStorage(): void {
  if (cacheLoaded || !isBrowser()) {
    return;
  }

  cacheLoaded = true;

  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as [string, CacheEntry][];
    if (!Array.isArray(parsed)) {
      return;
    }

    for (const item of parsed) {
      if (!Array.isArray(item) || item.length !== 2) {
        continue;
      }

      const [key, entry] = item;
      if (
        typeof key === 'string' &&
        entry &&
        typeof entry.value === 'string' &&
        typeof entry.timestamp === 'number'
      ) {
        translationCache.set(key, entry);
      }
    }

    pruneCache();
  } catch (error) {
    console.warn('Failed to load translation cache:', error);
  }
}

function getCachedValue(key: string): string | null {
  const entry = translationCache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    translationCache.delete(key);
    return null;
  }

  return entry.value;
}

function setCachedValue(key: string, value: string): void {
  translationCache.set(key, {
    value,
    timestamp: Date.now(),
  });

  pruneCache();
  schedulePersistCache();
}

function shouldSkipGoogleTranslation(text: string): boolean {
  const trimmed = text.trim();

  if (!trimmed) {
    return true;
  }

  const patterns = [
    /^https?:\/\//i, // URL
    /^[\w.%+-]+@[\w.-]+\.[a-z]{2,}$/i, // email
    /^\d{4}-\d{2}-\d{2}(?:[t\s]\d{2}:\d{2}(?::\d{2})?)?/i, // ISO date/datetime
    /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/, // common date format
    /^\d+(?:[.,]\d+)?$/, // pure numeric
    /^[A-Fa-f0-9]{16,}$/, // long hash/id
  ];

  if (patterns.some((regex) => regex.test(trimmed))) {
    return true;
  }

  // Skip likely backend identifiers, filenames, and code-like values
  if (/[_/\\]/.test(trimmed) && !/\s/.test(trimmed)) {
    return true;
  }

  // Skip if mostly symbols/digits and not natural sentence-like text
  const alphaCount = (trimmed.match(/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/g) || []).length;
  if (alphaCount > 0 && alphaCount / trimmed.length < 0.35) {
    return true;
  }

  return false;
}

/**
 * Generate cache key for translation
 */
function getCacheKey(text: string, from: string, to: string): string {
  return `${from}:${to}:${text}`;
}

/**
 * Translate text using Google Translate GTX API (Primary method)
 */
async function translateWithGoogleGTX(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string | null> {
  try {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodedText}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      console.warn(`Google GTX failed with status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // Parse response: [[["translated text","original text",...], ...], ...]
    if (Array.isArray(data) && data[0] && Array.isArray(data[0])) {
      const translations = data[0]
        .filter((item: any) => Array.isArray(item) && item[0])
        .map((item: any) => item[0]);
      
      return translations.join('');
    }

    return null;
  } catch (error) {
    console.error('Google GTX error:', error);
    return null;
  }
}

/**
 * Translate text using Google Chrome Extension API (Fallback method)
 */
async function translateWithGoogleChrome(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string | null> {
  try {
    const encodedText = encodeURIComponent(text);
    const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${sourceLang}&tl=${targetLang}&q=${encodedText}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      console.warn(`Google Chrome API failed with status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // Parse response: {"sentences":[{"trans":"translated text","orig":"original",...}],...}
    if (data?.sentences && Array.isArray(data.sentences)) {
      const translations = data.sentences
        .filter((s: any) => s.trans)
        .map((s: any) => s.trans);
      
      return translations.join('');
    }

    return null;
  } catch (error) {
    console.error('Google Chrome API error:', error);
    return null;
  }
}

/**
 * Main translation function with fallback strategy
 * 
 * Strategy:
 * 1. Check cache
 * 2. Try Google GTX (primary, fastest)
 * 3. Try Google Chrome Extension (fallback)
 * 4. Return original text if all fail
 */
export async function translateText(
  text: string,
  targetLang: LanguageCode,
  sourceLang: SourceLanguageCode = 'auto'
): Promise<string> {
  loadCacheFromStorage();

  // If target is same as source, return original
  if (targetLang === sourceLang) {
    return text;
  }

  // If text is empty or only whitespace, return as is
  if (!text || !text.trim()) {
    return text;
  }

  // Ignore likely backend/dynamic values to avoid unnecessary Google Translate requests
  if (shouldSkipGoogleTranslation(text)) {
    return text;
  }

  // Check cache first
  const cacheKey = getCacheKey(text, sourceLang, targetLang);
  const cached = getCachedValue(cacheKey);
  if (cached) {
    return cached;
  }

  const existingPromise = inFlightTranslations.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  const translationPromise = (async () => {
    // Try Google GTX first (primary method)
    console.log(`🌐 Translating "${text.substring(0, 50)}..." from ${sourceLang} to ${targetLang}`);
    
    let translated = await translateWithGoogleGTX(text, sourceLang, targetLang);
    if (translated) {
      console.log(`✅ Success with Google GTX: ${translated.substring(0, 50)}...`);
      setCachedValue(cacheKey, translated);
      return translated;
    }

    // Fallback to Google Chrome Extension API
    console.log('🔄 Trying Google Chrome Extension API...');
    translated = await translateWithGoogleChrome(text, sourceLang, targetLang);
    if (translated) {
      console.log(`✅ Success with Google Chrome API: ${translated.substring(0, 50)}...`);
      setCachedValue(cacheKey, translated);
      return translated;
    }

    // If all methods fail, return original text
    console.warn('⚠️ All translation methods failed, returning original text');
    return text;
  })();

  inFlightTranslations.set(cacheKey, translationPromise);

  try {
    return await translationPromise;
  } finally {
    inFlightTranslations.delete(cacheKey);
  }
}

/**
 * Batch translate multiple texts
 * Useful for translating multiple UI elements at once
 */
export async function translateBatch(
  texts: string[],
  targetLang: LanguageCode,
  sourceLang: LanguageCode = 'en'
): Promise<string[]> {
  const promises = texts.map((text) => translateText(text, targetLang, sourceLang));
  return Promise.all(promises);
}

/**
 * Clear translation cache (useful for memory management or testing)
 */
export function clearTranslationCache(): void {
  translationCache.clear();
  inFlightTranslations.clear();

  if (isBrowser()) {
    localStorage.removeItem(CACHE_STORAGE_KEY);
  }

  console.log('🗑️ Translation cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; keys: string[] } {
  loadCacheFromStorage();
  pruneCache();

  return {
    size: translationCache.size,
    keys: Array.from(translationCache.keys()).slice(0, 10), // First 10 keys
  };
}
