import { useState, useEffect } from 'react';

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Set initial value
    setMatches(window.matchMedia(query).matches);

    // Create media query list
    const mediaQueryList = window.matchMedia(query);

    // Define handler
    const handler = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // Add listener
    mediaQueryList.addEventListener('change', handler);

    // Cleanup
    return () => {
      mediaQueryList.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
};
