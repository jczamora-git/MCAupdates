import React from 'react';
import { ExternalLink, Link as LinkIcon } from 'lucide-react';

type MessageBodyWithLinkPreviewProps = {
  text: string;
  isOwn?: boolean;
};

type UrlPreview = {
  raw: string;
  normalized: string;
  host: string;
  pathLabel: string;
};

const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

const safeParseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const extractFirstUrlPreview = (text: string): UrlPreview | null => {
  const match = text.match(URL_REGEX);
  if (!match || match.length === 0) return null;

  const raw = match[0];
  const parsed = safeParseUrl(raw);
  if (!parsed) return null;

  const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
  const pathLabel = `${path}${parsed.search || ''}` || 'Open link';

  return {
    raw,
    normalized: parsed.toString(),
    host: parsed.hostname,
    pathLabel: pathLabel.length > 60 ? `${pathLabel.slice(0, 57)}...` : pathLabel,
  };
};

const renderLinkedText = (text: string, isOwn: boolean) => {
  const lines = text.split('\n');

  return lines.map((line, lineIndex) => {
    const parts = line.split(URL_REGEX);

    return (
      <React.Fragment key={`line-${lineIndex}`}>
        {parts.map((part, partIndex) => {
          if (!part) return null;

          if (/^https?:\/\//i.test(part)) {
            const parsed = safeParseUrl(part);
            if (!parsed) {
              return (
                <React.Fragment key={`part-${lineIndex}-${partIndex}`}>
                  {part}
                </React.Fragment>
              );
            }

            return (
              <a
                key={`part-${lineIndex}-${partIndex}`}
                href={parsed.toString()}
                target="_blank"
                rel="noopener noreferrer"
                className={`underline break-all ${isOwn ? 'text-blue-100 hover:text-white' : 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'}`}
              >
                {part}
              </a>
            );
          }

          return (
            <React.Fragment key={`part-${lineIndex}-${partIndex}`}>
              {part}
            </React.Fragment>
          );
        })}
        {lineIndex < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

export const MessageBodyWithLinkPreview = ({ text, isOwn = false }: MessageBodyWithLinkPreviewProps) => {
  const preview = extractFirstUrlPreview(text);

  return (
    <div className="space-y-2">
      <div className="text-sm break-words">{renderLinkedText(text, isOwn)}</div>

      {preview && (
        <a
          href={preview.normalized}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
            isOwn
              ? 'bg-blue-600/50 border-blue-300/40 hover:bg-blue-600/70'
              : 'bg-background/50 border-border/60 hover:bg-background/80'
          }`}
        >
          <img
            src={`https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(preview.host)}`}
            alt="Site icon"
            className="h-8 w-8 rounded-sm flex-shrink-0"
            loading="lazy"
          />

          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wide opacity-70 truncate">{preview.host}</div>
            <div className="text-sm font-medium truncate">{preview.pathLabel}</div>
            <div className="text-xs opacity-70 mt-0.5">Tap to open link</div>
          </div>

          <ExternalLink className="h-4 w-4 mt-0.5 opacity-70 flex-shrink-0" />
        </a>
      )}

      {!preview && text.includes('www.') && (
        <div className={`flex items-center gap-2 text-xs ${isOwn ? 'opacity-75' : 'opacity-70'}`}>
          <LinkIcon className="h-3 w-3" />
          Link preview supports URLs starting with http:// or https://
        </div>
      )}
    </div>
  );
};
