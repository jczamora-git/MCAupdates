import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { LanguageCode, SUPPORTED_LANGUAGES, translateText, Language } from '@/services/translateService';

interface TranslationContextType {
  currentLanguage: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  translate: (text: string) => Promise<string>;
  isTranslating: boolean;
  languages: Language[];
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

const STORAGE_KEY = 'campuscompanion_language';

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(() => {
    // Load saved language from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as LanguageCode) || 'en';
  });
  
  const [isTranslating] = useState(false);

  // Save language preference to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currentLanguage);
    
    // Update HTML lang attribute for accessibility
    document.documentElement.lang = currentLanguage;
    
    console.log(`🌍 Language changed to: ${currentLanguage}`);
  }, [currentLanguage]);

  const setLanguage = useCallback((lang: LanguageCode) => {
    setCurrentLanguage((prev) => (prev === lang ? prev : lang));
  }, []);

  const translate = useCallback(async (text: string): Promise<string> => {
    if (currentLanguage === 'en') {
      return text; // No translation needed for English
    }

    try {
      const translated = await translateText(text, currentLanguage, 'auto');
      return translated;
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Return original on error
    }
  }, [currentLanguage]);

  const value = useMemo(
    () => ({
      currentLanguage,
      setLanguage,
      translate,
      isTranslating,
      languages: SUPPORTED_LANGUAGES,
    }),
    [currentLanguage, setLanguage, translate, isTranslating]
  );

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

/**
 * Hook to use translation in components
 */
export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within TranslationProvider');
  }
  return context;
}

/**
 * Hook to translate a single text with automatic re-translation on language change
 */
export function useTranslatedText(text: string): string {
  const { currentLanguage, translate } = useTranslation();
  const [translatedText, setTranslatedText] = useState(text);

  useEffect(() => {
    if (currentLanguage === 'en') {
      setTranslatedText(text);
      return;
    }

    let isMounted = true;

    translate(text).then((result) => {
      if (isMounted) {
        setTranslatedText(result);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [text, currentLanguage, translate]);

  return translatedText;
}

/**
 * Hook to translate multiple texts
 */
export function useTranslatedTexts(texts: string[]): string[] {
  const { currentLanguage, translate } = useTranslation();
  const [translatedTexts, setTranslatedTexts] = useState<string[]>(texts);
  const textsKey = useMemo(() => texts.join('\u0001'), [texts]);

  useEffect(() => {
    if (currentLanguage === 'en') {
      setTranslatedTexts(texts);
      return;
    }

    let isMounted = true;

    Promise.all(texts.map((text) => translate(text))).then((results) => {
      if (isMounted) {
        setTranslatedTexts(results);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [textsKey, currentLanguage, translate]);

  return translatedTexts;
}
