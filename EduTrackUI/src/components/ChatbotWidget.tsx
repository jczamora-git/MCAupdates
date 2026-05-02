import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS, apiPost } from "@/lib/api";
import { useTranslatedText, useTranslatedTexts } from "@/context/TranslationContext";
import { useWalkthroughStore } from "@/context/WalkthroughContext";
import { useTranslation } from "@/context/TranslationContext";
import { translateText } from "@/services/translateService";
import chatbotIcon from "@/assets/chatbot.svg";
import chatbotAltIcon from "@/assets/chatbot-alt.svg";

// â”€â”€ Link / button renderer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Parses assistant message content and replaces route tokens with clickable
 * pill buttons. Supports both [link:Label|/path] and [Label|/path] formats.
 * Path must start with "/" to avoid false positives on normal bracket prose.
 */
const renderWithLinks = (
  content: string,
  navigate: (path: string) => void,
): JSX.Element => {
  const renderStrongText = (text: string, keyPrefix: string): Array<JSX.Element> => {
    const nodes: Array<JSX.Element> = [];
    const boldPattern = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = boldPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(
          <span key={`${keyPrefix}-plain-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>
        );
      }
      nodes.push(
        <strong key={`${keyPrefix}-bold-${match.index}`} className="font-semibold text-foreground">
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      nodes.push(
        <span key={`${keyPrefix}-plain-tail`}>{text.slice(lastIndex)}</span>
      );
    }

    if (nodes.length === 0) {
      nodes.push(<span key={`${keyPrefix}-plain-full`}>{text}</span>);
    }

    return nodes;
  };

  const renderInlineParts = (text: string, keyPrefix: string): Array<JSX.Element> => {
    const parts: Array<{ type: "text" | "button"; value: string; href?: string }> = [];
    const pattern = /\[(?:link:)?([^\]|]+)\|(\/[^\]]*)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
      }
      parts.push({ type: "button", value: match[1].trim(), href: match[2].trim() });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ type: "text", value: text.slice(lastIndex) });
    }

    return parts.map((part, index) => {
      if (part.type === "button" && part.href) {
        return (
          <button
            key={`${keyPrefix}-nav-btn-${index}`}
            type="button"
            onClick={() => navigate(part.href!)}
            className="inline-flex items-center gap-1 mx-0.5 my-0.5 rounded-full border border-primary/50 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 active:scale-95 transition-all cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 shrink-0">
              <path fillRule="evenodd" d="M8.914 6.025a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06l-2.25 2.25a.75.75 0 1 1-1.06-1.06l.97-.97H3.75a.75.75 0 0 1 0-1.5h6.133l-.97-.97a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
            {part.value}
          </button>
        );
      }
      return (
        <span key={`${keyPrefix}-text-${index}`} className="whitespace-pre-wrap">
          {renderStrongText(part.value, `${keyPrefix}-text-${index}`)}
        </span>
      );
    });
  };

  const renderStepItem = (item: string, keyPrefix: string): JSX.Element => {
    const titleMatch = item.match(/^([^\-:]{2,80})\s*[-:]\s+(.+)$/);
    if (!titleMatch) {
      return <>{renderInlineParts(item, keyPrefix)}</>;
    }

    const title = titleMatch[1].trim();
    const detail = titleMatch[2].trim();

    return (
      <>
        <strong className="font-semibold text-foreground">{title}</strong>
        <span className="text-muted-foreground"> - </span>
        <span>{renderInlineParts(detail, `${keyPrefix}-detail`)}</span>
      </>
    );
  };

  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return <div>{renderInlineParts(content, "empty")}</div>;
  }

  const blocks: Array<{ type: "paragraph"; text: string } | { type: "list"; items: string[] }> = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      blocks.push({ type: "list", items: listBuffer });
      listBuffer = [];
    }
  };

  lines.forEach((line) => {
    const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      listBuffer.push(numberedMatch[1]);
      return;
    }

    flushList();
    blocks.push({ type: "paragraph", text: line });
  });

  flushList();

  return (
    <div className="space-y-2">
      {blocks.map((block, blockIndex) => {
        if (block.type === "list") {
          return (
            <ol key={`list-${blockIndex}`} className="list-decimal ml-5 space-y-1 marker:text-muted-foreground">
              {block.items.map((item, itemIndex) => (
                <li key={`list-${blockIndex}-item-${itemIndex}`} className="leading-relaxed">
                  {renderStepItem(item, `list-${blockIndex}-item-${itemIndex}`)}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={`para-${blockIndex}`} className="leading-relaxed">
            {renderInlineParts(block.text, `para-${blockIndex}`)}
          </p>
        );
      })}
    </div>
  );
};

// â”€â”€ Jiji character â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const JijiAvatar = ({
  size = "sm",
  iconSrc = chatbotIcon,
  variant = "header",
}: {
  size?: "sm" | "lg";
  iconSrc?: string;
  variant?: "header" | "chathead";
}) => (
  <div
    className={
      variant === "header"
        ? size === "lg"
          ? "h-10 w-10 rounded-full bg-primary ring-2 ring-white dark:ring-black flex items-center justify-center shrink-0 shadow-md"
          : "h-6 w-6 rounded-full bg-primary ring-2 ring-white dark:ring-black flex items-center justify-center shrink-0 shadow"
        : size === "lg"
          ? "h-10 w-10 rounded-full bg-white dark:bg-background border border-white/90 dark:border-border flex items-center justify-center shrink-0 shadow-md"
          : "h-6 w-6 rounded-full bg-white dark:bg-background border border-white/90 dark:border-border flex items-center justify-center shrink-0 shadow"
    }
  >
    <img
      src={iconSrc}
      alt="Jiji"
      className={
        variant === "chathead"
          ? "h-[75%] w-[75%] object-contain"
          : "h-[75%] w-[75%] object-contain brightness-0 invert dark:invert-0"
      }
    />
  </div>
);

const getJijiIntro = (role: string | undefined, firstName: string): string => {
  const name = firstName ? `, ${firstName}` : "";
  const wave = "\uD83D\uDC4B";
  const star = "\uD83C\uDF1F";
  const party = "\uD83C\uDF89";
  const spark = "\u2728";
  switch (role) {
    case "admin":
      return `Kamusta${name}! ${wave} Ako si Jiji ${spark}\n\nAng iyong Campus Companion ✨ Nandito ako para tumulong sa management ng school, student records, enrollment, at analytics. Ano ang kailangan mo ngayong araw?`;
    case "teacher":
      return `Kumusta${name}! ${wave} Ako si Jiji ${spark}\n\nAng iyong school assistant! Nandito ako para tumulong sa iyong mga subject, class schedule, grades ng mga estudyante, at announcements. Paano kita matutulungan?`;
    case "student":
      return `Hiii${name}! ${star} Ako si Jiji ${spark}\n\nAng iyong friendly school buddy! Maaari akong tumulong sa iyong fees, enrollment, subjects, teachers, at marami pa. Handa ka na bang mag-explore?`;
    case "enrollee":
      return `Maligayang pagdating${name}! ${party} Ako si Jiji ${spark}\n\nNandito ako para gabayan ka sa iyong enrollment journey! Maaari akong tumulong sa requirements, tuition fees, at pag-set up ng iyong account. Magsimula na tayo!`;
    default:
      return `Kamusta${name}! ${wave} Ako si Jiji ${spark}\n\nAng iyong Campus Companion ✨ Paano kita matutulungan ngayong araw?`;
  }
};

const FAQ_SUGGESTIONS: Record<string, string[]> = {
  admin: [
    "Enrollment statistics",
    "Fee overview",
    "Generate student report",
    "Pending enrollees",
  ],
  teacher: [
    "My class assignments",
    "How to submit grades",
    "View announcements",
    "Student list",
  ],
  student: [
    "Magkano ang tuition ko?",
    "Sino ang mga guro ko?",
    "Anong mga subject ko?",
    "Nakalimutan ko ang PIN ko",
  ],
  enrollee: [
    "Enrollment requirements",
    "Magkano ang tuition?",
    "Paano mag-enroll?",
    "Nakalimutan ko ang PIN ko",
    "Paano mag activate ng account?"
  ],
};

const ENROLLMENT_REQUIREMENTS_LABEL = "Enrollment requirements";

type GuidedTourSuggestion = {
  id: string;
  label: string;
  description: string;
};

const GUIDED_TOUR_SUGGESTIONS: Record<string, GuidedTourSuggestion[]> = {
  "/enrollee/dashboard": [
    {
      id: "verified",
      label: "Dashboard Overview",
      description: "See the main sections and where to start.",
    },
    {
      id: "enrollment-submitted",
      label: "Payment Planning Guide",
      description: "Learn the next steps after submitting enrollment.",
    },
    {
      id: "enrollment-records",
      label: "Enrollment Records",
      description: "Find and review your enrollment records quickly.",
    },
  ],
  "/enrollee/enrollment": [
    {
      id: "my-enrollments",
      label: "My Enrollments Guide",
      description: "Understand status, filters, and enrollment actions.",
    },
  ],
  "/enrollee/payment": [
    {
      id: "payment-management",
      label: "Payment Management Guide",
      description: "Learn how to manage your fees and payment records.",
    },
  ],
  "/enrollment/payment": [
    {
      id: "payment-management",
      label: "Payment Management Guide",
      description: "Learn how to manage your fees and payment records.",
    },
  ],
  "/enrollment/installment-plans": [
    {
      id: "installment-plans",
      label: "Installment Plans Guide",
      description: "Learn how to choose and confirm your installment schedule.",
    },
  ],
  "/enrollment/payment-process": [
    {
      id: "payment-process",
      label: "Payment Process Guide",
      description: "Learn how to submit payment details and proof correctly.",
    },
  ],
};

const getGuidedToursForPath = (pathname: string): GuidedTourSuggestion[] => {
  const matched = Object.entries(GUIDED_TOUR_SUGGESTIONS)
    .sort((first, second) => second[0].length - first[0].length)
    .find(([prefix]) => pathname.startsWith(prefix));

  return matched ? matched[1] : [];
};

// â”€â”€ Typing indicator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TypingIndicator = () => (
  <div className="flex items-end gap-2">
    <JijiAvatar iconSrc={chatbotAltIcon} variant="chathead" />
    <div className="bg-muted/50 border border-border rounded-2xl rounded-bl-sm px-3 py-2.5 flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
    </div>
  </div>
);

// â”€â”€ IndexedDB cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatCacheEntry = {
  id: string;
  userId: string | number | null;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

const createCacheEntryId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

const CHATBOT_DB_NAME = "chatbot-cache";
const CHATBOT_STORE = "messages";

const openChatbotDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(CHATBOT_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHATBOT_STORE)) {
        const store = db.createObjectStore(CHATBOT_STORE, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const saveChatEntries = async (entries: ChatCacheEntry[]) => {
  if (entries.length === 0) return;
  const db = await openChatbotDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CHATBOT_STORE, "readwrite");
    const store = tx.objectStore(CHATBOT_STORE);
    entries.forEach((entry) => store.put(entry));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};

const loadChatEntries = async (userId: string | number | null, limit = 60) => {
  const db = await openChatbotDb();
  const entries = await new Promise<ChatCacheEntry[]>((resolve, reject) => {
    const tx = db.transaction(CHATBOT_STORE, "readonly");
    const store = tx.objectStore(CHATBOT_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as ChatCacheEntry[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  const filtered = entries.filter((e) => e.userId === userId);
  filtered.sort((a, b) => a.createdAt - b.createdAt);
  return filtered.slice(-limit);
};

// â”€â”€ Main widget â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ChatbotWidget = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { findBestMatch } = useWalkthroughStore();
  const { translate, currentLanguage } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  // Current-session messages (user â†” assistant turns, not the intro)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Previously persisted messages loaded from IndexedDB
  const [historyMessages, setHistoryMessages] = useState<ChatMessage[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFaqChips, setShowFaqChips] = useState(true);
  const [showHelperSection, setShowHelperSection] = useState(true);
  // Pulse the FAB when Jiji has a new reply waiting
  const [hasNewReply, setHasNewReply] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const userId = user?.id ?? null;
  const role: string = user?.role ?? "student";
  const firstName: string = user?.first_name ?? user?.name ?? "";

  const jijiIntro = useMemo(() => getJijiIntro(role, firstName), [role, firstName]);
  const faqSuggestions = useMemo(
    () => FAQ_SUGGESTIONS[role] ?? FAQ_SUGGESTIONS.student,
    [role],
  );
  const guidedTourSuggestions = useMemo(
    () => (role === "enrollee" ? getGuidedToursForPath(location.pathname) : []),
    [location.pathname, role],
  );
  const translatedJijiIntro = useTranslatedText(jijiIntro);
  const translatedFaqSuggestions = useTranslatedTexts(faqSuggestions);
  const displayedFaqSuggestions = useMemo(
    () =>
      translatedFaqSuggestions.map((translatedValue, index) => {
        const sourceValue = faqSuggestions[index];
        if (currentLanguage === "tl" && sourceValue === ENROLLMENT_REQUIREMENTS_LABEL) {
          return ENROLLMENT_REQUIREMENTS_LABEL;
        }
        return translatedValue;
      }),
    [translatedFaqSuggestions, faqSuggestions, currentLanguage],
  );
  const translatedHelperTitle = useTranslatedText("Helper: Guided Tours");
  const translatedHelperDescription = useTranslatedText("Choose a tour below. To hide this list, click the info icon beside X. To show it again, click the same info icon.");
  const translatedGuidedTourSuggestions = useTranslatedTexts(
    guidedTourSuggestions.map((tour) => tour.label)
  );
  const translatedGuidedTourDescriptions = useTranslatedTexts(
    guidedTourSuggestions.map((tour) => tour.description)
  );

  // Load history the first time the panel opens
  useEffect(() => {
    if (!user || hasLoadedHistory || !isOpen) return;
    loadChatEntries(userId)
      .then((entries) => {
        setHistoryMessages(entries.map((e) => ({ role: e.role, content: e.content })));
      })
      .catch(() => {})
      .finally(() => setHasLoadedHistory(true));
  }, [user, isOpen, hasLoadedHistory, userId]);

  // Scroll to bottom whenever content changes
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isSending, isOpen, showHistory]);

  // Clear pulse indicator when panel opens
  useEffect(() => {
    if (isOpen) setHasNewReply(false);
  }, [isOpen]);

  useEffect(() => {
    if (guidedTourSuggestions.length > 0) {
      setShowHelperSection(true);
    }
  }, [location.pathname, guidedTourSuggestions.length]);

  const handleSend = async (messageOverride?: string) => {
    const message = (messageOverride ?? input).trim();
    if (!message || isSending) return;

    setError(null);
    setIsSending(true);
    if (!messageOverride) setInput("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);

    try {
      let normalizedForRouting = message;
      try {
        normalizedForRouting = await translateText(message, "en", "auto");
      } catch {
        normalizedForRouting = message;
      }

      const walkthroughMatch =
        findBestMatch(normalizedForRouting, 0.4) ?? findBestMatch(message, 0.4);
      if (walkthroughMatch) {
        const { item } = walkthroughMatch;
        const answerHeader = item.answer?.trim() || "Here are the steps:";
        const stepLines = item.steps.map((step, index) => `${index + 1}. ${step}`);
        const fullReply = [answerHeader, ...stepLines].join("\n");
        const translatedReply = await translate(fullReply);

        setMessages((prev) => [...prev, { role: "assistant", content: translatedReply }]);
        await saveChatEntries([
          { id: createCacheEntryId(), userId, role: "user", content: message, createdAt: Date.now() },
          { id: createCacheEntryId(), userId, role: "assistant", content: translatedReply, createdAt: Date.now() },
        ]);

        if (!isOpen) setHasNewReply(true);
        return;
      }

      const response = await apiPost(API_ENDPOINTS.CHATBOT_MESSAGE, {
        message: normalizedForRouting,
        original_message: message,
        knowledge_only: !navigator.onLine,
      });
      if (!response?.reply) throw new Error("Unexpected chatbot response.");

      setMessages((prev) => [...prev, { role: "assistant", content: response.reply }]);
      await saveChatEntries([
        { id: createCacheEntryId(), userId, role: "user", content: message, createdAt: Date.now() },
        { id: createCacheEntryId(), userId, role: "assistant", content: response.reply, createdAt: Date.now() },
      ]);
      if (!isOpen) setHasNewReply(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chatbot error.");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleStartGuidedTour = (tourId: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("campuscompanion:start-tour", {
          detail: { tourId },
        })
      );
    }

    setIsOpen(false);
  };

  if (!user) return null;

  const canSend = input.trim().length > 0 && !isSending;
  const showFaq = !isSending;

  return (
    <div className="fixed bottom-6 right-2 sm:right-4 z-10 flex flex-col items-end gap-2">
      {isOpen && (
        <div className="relative w-[88vw] sm:w-[350px] max-h-[calc(100vh-170px)] sm:max-h-[calc(100vh-120px)] rounded-2xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden">

          {/* â”€â”€ Header â”€â”€ */}
          <div className="bg-gradient-to-r from-primary to-accent px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <JijiAvatar size="lg" iconSrc={chatbotIcon} variant="header" />
              <div>
                <p className="text-sm font-bold text-white dark:text-black leading-tight">Jiji</p>
                <p className="text-xs text-white/80 dark:text-black/80">Campus Companion ✨</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* History toggle */}
              <button
                type="button"
                title={showHistory ? "Hide chat history" : "Show chat history"}
                onClick={() => setShowHistory((v) => !v)}
                className={[
                  "h-7 w-7 rounded-full flex items-center justify-center transition-colors",
                  showHistory
                    ? "bg-white/30 text-white dark:bg-black/30 dark:text-black"
                    : "text-white/70 hover:bg-white/20 hover:text-white dark:text-black/70 dark:hover:bg-black/20 dark:hover:text-black",
                ].join(" ")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                </svg>
              </button>
              {/* Helper tours toggle */}
              {guidedTourSuggestions.length > 0 && (
                <button
                  type="button"
                  title={showHelperSection ? "Hide guided tours" : "Show guided tours"}
                  onClick={() => setShowHelperSection((v) => !v)}
                  className={[
                    "h-7 w-7 rounded-full flex items-center justify-center transition-colors",
                    showHelperSection
                      ? "bg-white/30 text-white dark:bg-black/30 dark:text-black"
                      : "text-white/70 hover:bg-white/20 hover:text-white dark:text-black/70 dark:hover:bg-black/20 dark:hover:text-black",
                  ].join(" ")}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v.5a.75.75 0 0 0 1.5 0v-.5ZM10 9a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 10 9Z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
              {/* Close */}
              <button
                type="button"
                title="Close chat"
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 rounded-full text-white/70 hover:bg-white/20 hover:text-white dark:text-black/70 dark:hover:bg-black/20 dark:hover:text-black flex items-center justify-center transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
          </div>

          {/* â”€â”€ Messages â”€â”€ */}
          <div className="flex-1 min-h-0 overflow-y-auto px-2.5 sm:px-3 py-2.5 sm:py-3 space-y-2.5 sm:space-y-3">

            {/* Previous sessions (history toggle) */}
            {showHistory && historyMessages.length > 0 && (
              <>
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-muted-foreground px-1 shrink-0">Previous conversations</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {historyMessages.map((msg, i) => (
                  <div key={`hist-${i}`} className={msg.role === "user" ? "flex justify-end" : "flex items-end gap-2"}>
                    {msg.role === "assistant" && <JijiAvatar iconSrc={chatbotAltIcon} variant="chathead" />}
                    <div
                      className={
                        msg.role === "user"
                          ? "max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-2 text-sm opacity-70"
                          : "max-w-[80%] bg-muted/40 border border-border rounded-2xl rounded-bl-sm px-3 py-2 text-sm leading-relaxed opacity-70"
                      }
                    >
                      {msg.role === "assistant" ? renderWithLinks(msg.content, navigate) : msg.content}
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-muted-foreground px-1 shrink-0">New session</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              </>
            )}

            {/* Jiji intro â€” always shown, not stored */}
            <div className="flex items-end gap-2">
              <JijiAvatar iconSrc={chatbotAltIcon} variant="chathead" />
              <div className="max-w-[82%] bg-primary/5 border border-primary/20 rounded-2xl rounded-bl-sm px-3 py-2.5 text-sm leading-relaxed">
                <p className="text-[10px] font-semibold text-primary mb-1">Jiji</p>
                <span className="whitespace-pre-wrap">{translatedJijiIntro}</span>
              </div>
            </div>

            {showHelperSection && guidedTourSuggestions.length > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-primary">{translatedHelperTitle}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 mb-2">{translatedHelperDescription}</p>
                <div className="space-y-1.5">
                  {guidedTourSuggestions.map((tour, index) => (
                    <button
                      key={tour.id}
                      type="button"
                      onClick={() => handleStartGuidedTour(tour.id)}
                      className="w-full rounded-lg border border-primary/25 bg-background px-2.5 py-2 text-left hover:bg-primary/5 active:scale-[0.99] transition-all"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-foreground leading-tight">
                          {translatedGuidedTourSuggestions[index] ?? tour.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                          {translatedGuidedTourDescriptions[index] ?? tour.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Current session messages */}
            {messages.map((msg, index) => (
              <div
                key={`${msg.role}-${index}`}
                className={msg.role === "user" ? "flex justify-end" : "flex items-end gap-2"}
              >
                {msg.role === "assistant" && <JijiAvatar iconSrc={chatbotAltIcon} variant="chathead" />}
                <div
                  className={
                    msg.role === "user"
                      ? "max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-2 text-sm"
                      : "max-w-[82%] bg-muted/50 border border-border rounded-2xl rounded-bl-sm px-3 py-2 text-sm leading-relaxed"
                  }
                >
                  {msg.role === "assistant" && (
                    <p className="text-[10px] font-semibold text-primary mb-0.5">Jiji</p>
                  )}
                  {msg.role === "assistant"
                    ? renderWithLinks(msg.content, navigate)
                    : msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isSending && <TypingIndicator />}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl px-3 py-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
                  <path fillRule="evenodd" d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* â”€â”€ Quick Questions Section (lower part) â”€â”€ */}
          {showFaq && showFaqChips && (
            <div className="border-t border-border bg-background/90 px-3 py-2">
              <p className="text-[10px] text-muted-foreground mb-1">FAQ (Frequently Asked Questions)</p>
              <div className="overflow-x-auto [scrollbar-width:thin]">
                <div className="flex flex-nowrap gap-1.5 min-w-max">
                  {displayedFaqSuggestions.map((q, index) => (
                    <button
                      key={`${q}-${index}`}
                      type="button"
                      onClick={() => void handleSend(q)}
                      className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/20 active:scale-95 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {showFaq && (
            <button
              type="button"
              onClick={() => setShowFaqChips((prev) => !prev)}
              className={`absolute left-1/2 -translate-x-1/2 z-10 h-5 min-w-[44px] rounded-md border border-border bg-muted/70 px-2 flex items-center justify-center hover:bg-muted transition-colors ${
                showFaqChips ? "bottom-[150px]" : "bottom-[80px]"
              }`}
              title={showFaqChips ? "Hide quick questions" : "Show quick questions"}
            >
              {showFaqChips ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-muted-foreground">
                  <path fillRule="evenodd" d="M14.77 7.79a.75.75 0 0 0-1.06 0L10 11.5 6.29 7.79a.75.75 0 0 0-1.06 1.06l4.24 4.24a.75.75 0 0 0 1.06 0l4.24-4.24a.75.75 0 0 0 0-1.06Z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-muted-foreground">
                  <path fillRule="evenodd" d="M5.23 12.21a.75.75 0 0 0 1.06 0L10 8.5l3.71 3.71a.75.75 0 1 0 1.06-1.06l-4.24-4.24a.75.75 0 0 0-1.06 0l-4.24 4.24a.75.75 0 0 0 0 1.06Z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          )}

          {/* â”€â”€ Input â”€â”€ */}
          <div className="border-t border-border px-2.5 sm:px-3 py-2 sm:py-2.5 bg-background/80 backdrop-blur-sm">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Magtanong kay Jiji..."
                rows={1}
                className="resize-none flex-1 text-sm min-h-[36px] max-h-[80px] rounded-xl border-border focus-visible:ring-ring"
              />
              <button
                type="button"
                title="Send message"
                onClick={() => void handleSend()}
                disabled={!canSend}
                className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                  <path d="M2.87 2.298a.75.75 0 0 0-.812 1.21L6.632 8l-4.572 4.492a.75.75 0 0 0 .812 1.21l10.5-5.25a.75.75 0 0 0 0-1.344l-10.5-5.25Z" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
              Press Enter to send. Shift+Enter for new line
            </p>
          </div>
        </div>
      )}

      {/* â”€â”€ FAB â”€â”€ */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="relative h-11 w-11 sm:h-[52px] sm:w-[52px] rounded-full bg-gradient-to-br from-primary to-accent shadow-lg flex items-center justify-center hover:shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
        title="Chat with Jiji"
      >
        {/* Pulse ring when there's a new reply */}
        {hasNewReply && (
          <span className="absolute inset-0 rounded-full bg-primary/60 animate-ping" />
        )}
        <img src={chatbotIcon} alt="" className="h-6 w-6 brightness-0 invert dark:invert-0" />
        {hasNewReply && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-rose-500 border-2 border-background" />
        )}
      </button>
    </div>
  );
};

export default ChatbotWidget;
