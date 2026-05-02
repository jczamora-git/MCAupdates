import { useTranslatedText } from '@/context/TranslationContext';
import { ReactNode } from 'react';

interface TranslatedTextProps {
  text: string;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  children?: never;
}

/**
 * Component to automatically translate text based on current language
 * 
 * Usage:
 * <TranslatedText text="Welcome to Campus Companion" />
 * <TranslatedText text="Hello" as="h1" className="text-2xl font-bold" />
 */
export function TranslatedText({ text, as = 'span', className }: TranslatedTextProps) {
  const translatedText = useTranslatedText(text);
  const Component = as;

  return <Component className={className}>{translatedText}</Component>;
}

/**
 * Hook-based component for inline usage
 * 
 * Usage:
 * const t = useT();
 * <h1>{t("Welcome")}</h1>
 */
export function useT() {
  return (text: string) => {
    const translated = useTranslatedText(text);
    return translated;
  };
}

/**
 * Component to translate children text content
 * Useful for wrapping existing JSX
 * 
 * Usage:
 * <T>
 *   <h1>Welcome to Campus Companion</h1>
 * </T>
 */
interface TProps {
  children: ReactNode;
  className?: string;
}

export function T({ children, className }: TProps) {
  // Extract text from children and translate it
  const text = typeof children === 'string' ? children : extractText(children);
  const translatedText = useTranslatedText(text);

  if (typeof children === 'string') {
    return <span className={className}>{translatedText}</span>;
  }

  // For complex children, return as-is (translation happens at leaf level)
  return <>{children}</>;
}

/**
 * Extract text content from React children (helper function)
 */
function extractText(children: ReactNode): string {
  if (typeof children === 'string') {
    return children;
  }

  if (Array.isArray(children)) {
    return children.map(extractText).join(' ');
  }

  if (children && typeof children === 'object' && 'props' in children) {
    return extractText((children as any).props.children);
  }

  return '';
}
