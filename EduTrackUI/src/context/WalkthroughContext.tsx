import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "campuscompanion_walkthrough_questions_v1";

const DEFAULT_WALKTHROUGH_QUESTIONS: WalkthroughQuestion[] = [
  {
    id: "email-verification-activation",
    title: "Email Verification Activation",
    primaryQuestion: "paano mag activate ng email?",
    possibleQuestions: [
      "paano i-activate ang email",
      "paano i-verify ang email",
      "how to activate email",
      "how do i verify my email",
      "email verification steps",
      "activate my account email",
      "メールを有効化するには",
      "メールのアクティベート方法を教えてください",
      "メールをアクティベートする方法",
      "email activation",
    ],
    steps: [
      "Click the **Send Verification Email button.**",
      "**Open your email inbox** and click the verification link.",
      "**Log out, then log in again** after verification.",
      "**You can now access enrollment** and submit your admission.",
    ],
    answer: "**Here are the steps to activate your email:**",
    route: "/enrollee/dashboard",
    tags: ["email", "verification", "activation", "enrollment"],
    updatedAt: 1741500000000,
  },
  {
    id: "enrollment-requirements-checklist",
    title: "Enrollment Requirements Checklist",
    primaryQuestion: "enrollment requirements",
    possibleQuestions: [
      "what are the enrollment requirements",
      "requirements for enrollment",
      "ano ang requirements sa enrollment",
      "mga kailangan sa enrollment",
      "required documents for enrollment",
      "docs needed for enrollment",
      "入学要件",
      "入学に必要な書類",
    ],
    steps: [
      "Birth Certificate - proof of identity and age.",
      "Certificate of Good Moral Character - confirms student conduct.",
      "Data Privacy Consent Form - allows processing of student data.",
      "ECCD Checklist - school readiness assessment (if applicable).",
      "Enrollment Form - basic student registration details.",
      "Parent's Agreement Form - parent responsibilities and school policies.",
      "SF10 (School Form 10) - previous school academic record.",
      "**Bring original and photocopies, then confirm with the school office for any extra requirements.**",
    ],
    answer: "**Here is a simple checklist of common enrollment documents:**",
    route: "/enrollee/enrollment",
    tags: ["enrollment", "requirements", "documents", "checklist"],
    updatedAt: 1741500060000,
  },
  {
    id: "how-to-enroll-guide",
    title: "How To Enroll Guide",
    primaryQuestion: "paano mag-enroll?",
    possibleQuestions: [
      "paano mag enroll",
      "how to enroll",
      "how do i enroll",
      "enrollment process",
      "steps to enroll",
      "where do i start enrollment",
      "how to start enrollment",
      "paano magsimula mag-enroll",
      "saan sisimulan ang enrollment",
      "how can i apply for enrollment",
    ],
    steps: [
      "Sa Dashboard, i-click ang **Go to Enrollment** o **Start Enrollment Application**. Pareho lang ang function nila.",
      "Sa **My Enrollments** page, i-click ang **Start Your First Enrollment**.",
      "May lalabas na pagpipilian para sa enrollment type.",
      "Piliin kung alin ang tama para sa iyo: **New Student**, **Continuing / Old Student**, o **Transferee**.",
      "Pagkatapos pumili, i-click ang **Continue**.",
      "Awtomatiko kang dadalhin sa **Enrollment Application** para ma-fill out mo na ang form.",
    ],
    answer: "**Narito ang madaling steps para makapag-enroll:**",
    route: "/enrollee/dashboard",
    tags: ["enrollment", "apply", "start", "new student", "continuing", "transferee"],
    updatedAt: 1741510000000,
  },
];

export interface WalkthroughQuestion {
  id: string;
  title: string;
  primaryQuestion: string;
  possibleQuestions: string[];
  steps: string[];
  answer?: string;
  route?: string;
  tags?: string[];
  updatedAt: number;
}

export interface WalkthroughMatch {
  item: WalkthroughQuestion;
  score: number;
}

interface WalkthroughContextValue {
  items: WalkthroughQuestion[];
  upsertQuestion: (item: Omit<WalkthroughQuestion, "updatedAt"> & { updatedAt?: number }) => void;
  upsertQuestions: (items: Array<Omit<WalkthroughQuestion, "updatedAt"> & { updatedAt?: number }>) => void;
  removeQuestion: (id: string) => void;
  clearQuestions: () => void;
  getQuestionById: (id: string) => WalkthroughQuestion | undefined;
  findBestMatch: (input: string, minScore?: number) => WalkthroughMatch | null;
  exportQuestions: () => WalkthroughQuestion[];
}

const WalkthroughContext = createContext<WalkthroughContextValue | undefined>(undefined);

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function computeMatchScore(input: string, candidate: string): number {
  const normalizedInput = normalizeText(input);
  const normalizedCandidate = normalizeText(candidate);

  if (!normalizedInput || !normalizedCandidate) {
    return 0;
  }

  if (normalizedInput === normalizedCandidate) {
    return 1;
  }

  if (normalizedCandidate.includes(normalizedInput) || normalizedInput.includes(normalizedCandidate)) {
    return 0.92;
  }

  const inputTokens = tokenize(normalizedInput);
  const candidateTokens = tokenize(normalizedCandidate);

  if (inputTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  const candidateSet = new Set(candidateTokens);
  let overlapCount = 0;
  for (const token of inputTokens) {
    if (candidateSet.has(token)) {
      overlapCount += 1;
    }
  }

  const overlapRatio = overlapCount / Math.max(inputTokens.length, candidateTokens.length);
  return clamp(overlapRatio);
}

function loadStoredQuestions(): WalkthroughQuestion[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is WalkthroughQuestion => {
        return (
          !!item &&
          typeof item === "object" &&
          typeof (item as WalkthroughQuestion).id === "string" &&
          typeof (item as WalkthroughQuestion).title === "string" &&
          typeof (item as WalkthroughQuestion).primaryQuestion === "string" &&
          Array.isArray((item as WalkthroughQuestion).possibleQuestions) &&
          Array.isArray((item as WalkthroughQuestion).steps)
        );
      })
      .map((item) => ({
        ...item,
        updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now(),
      }));
  } catch {
    return [];
  }
}

function mergeById(
  base: WalkthroughQuestion[],
  incoming: WalkthroughQuestion[]
): WalkthroughQuestion[] {
  const map = new Map(base.map((item) => [item.id, item]));
  for (const item of incoming) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      continue;
    }

    if ((item.updatedAt ?? 0) >= (existing.updatedAt ?? 0)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function WalkthroughProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WalkthroughQuestion[]>(() => {
    const stored = loadStoredQuestions();
    return mergeById(stored, DEFAULT_WALKTHROUGH_QUESTIONS);
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const upsertQuestion = useCallback(
    (item: Omit<WalkthroughQuestion, "updatedAt"> & { updatedAt?: number }) => {
      setItems((prev) => {
        const nextItem: WalkthroughQuestion = {
          ...item,
          updatedAt: item.updatedAt ?? Date.now(),
        };

        const index = prev.findIndex((existing) => existing.id === nextItem.id);
        if (index === -1) {
          return [nextItem, ...prev];
        }

        const next = [...prev];
        next[index] = nextItem;
        return next;
      });
    },
    []
  );

  const upsertQuestions = useCallback(
    (nextItems: Array<Omit<WalkthroughQuestion, "updatedAt"> & { updatedAt?: number }>) => {
      if (!nextItems.length) {
        return;
      }

      setItems((prev) => {
        const map = new Map(prev.map((item) => [item.id, item]));
        for (const item of nextItems) {
          map.set(item.id, {
            ...item,
            updatedAt: item.updatedAt ?? Date.now(),
          });
        }
        return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
      });
    },
    []
  );

  const removeQuestion = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearQuestions = useCallback(() => {
    setItems([]);
  }, []);

  const getQuestionById = useCallback(
    (id: string) => items.find((item) => item.id === id),
    [items]
  );

  const findBestMatch = useCallback(
    (input: string, minScore = 0.45): WalkthroughMatch | null => {
      const normalizedInput = normalizeText(input);
      if (!normalizedInput) {
        return null;
      }

      let best: WalkthroughMatch | null = null;

      for (const item of items) {
        const candidates = [item.primaryQuestion, ...item.possibleQuestions];
        for (const candidate of candidates) {
          const score = computeMatchScore(normalizedInput, candidate);
          if (score < minScore) {
            continue;
          }

          if (!best || score > best.score) {
            best = { item, score };
          }
        }
      }

      return best;
    },
    [items]
  );

  const exportQuestions = useCallback(() => [...items], [items]);

  const value = useMemo<WalkthroughContextValue>(
    () => ({
      items,
      upsertQuestion,
      upsertQuestions,
      removeQuestion,
      clearQuestions,
      getQuestionById,
      findBestMatch,
      exportQuestions,
    }),
    [items, upsertQuestion, upsertQuestions, removeQuestion, clearQuestions, getQuestionById, findBestMatch, exportQuestions]
  );

  return <WalkthroughContext.Provider value={value}>{children}</WalkthroughContext.Provider>;
}

export function useWalkthroughStore(): WalkthroughContextValue {
  const context = useContext(WalkthroughContext);
  if (!context) {
    throw new Error("useWalkthroughStore must be used within WalkthroughProvider");
  }
  return context;
}
