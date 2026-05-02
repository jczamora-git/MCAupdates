import { useCallback, useMemo } from "react";

const MANILA_TZ = "Asia/Manila";

export const useManilaTime = () => {
  const dateOnlyFormatter = useMemo(
    () => new Intl.DateTimeFormat("en-CA", { timeZone: MANILA_TZ }),
    []
  );

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-PH", {
        timeZone: MANILA_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
    []
  );

  const parseBackendDate = useCallback((value: any): Date | null => {
    if (!value) return null;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === "number") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const raw = String(value).trim();
    if (!raw) return null;

    const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      const [, y, m, d] = dateOnly;
      return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0));
    }

    const dateTimeNoTz = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
    if (dateTimeNoTz) {
      const [, y, m, d, hh, mm, ss] = dateTimeNoTz;
      // Hostinger DB returns UTC-like naive timestamps; parse as UTC then render in Manila.
      return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)));
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, []);

  const toIsoDate = useCallback(
    (value: any): string => {
      const date = parseBackendDate(value);
      if (!date) return "";
      return dateOnlyFormatter.format(date);
    },
    [parseBackendDate, dateOnlyFormatter]
  );

  const formatDateTimeDisplay = useCallback(
    (value: any): string => {
      const date = parseBackendDate(value);
      if (!date) return "-";
      return dateTimeFormatter.format(date);
    },
    [parseBackendDate, dateTimeFormatter]
  );

  const todayIsoManila = useCallback((): string => dateOnlyFormatter.format(new Date()), [dateOnlyFormatter]);

  return {
    timezone: MANILA_TZ,
    parseBackendDate,
    toIsoDate,
    formatDateTimeDisplay,
    todayIsoManila,
  };
};
