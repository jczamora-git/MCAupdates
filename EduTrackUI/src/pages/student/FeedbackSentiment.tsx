import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS, apiGet, apiPost } from "@/lib/api";
import { ArrowLeft, Loader2, Plus, Search, Send, Sparkles } from "lucide-react";

type ConcernTicket = {
  id: number;
  ticket_no: string;
  subject: string;
  category: string;
  status: string;
  overall_sentiment?: string | null;
  created_at?: string;
  last_message_at?: string;
};

type ConcernMessage = {
  id: number;
  message: string;
  sentiment?: string | null;
  confidence?: number | null;
  created_at?: string;
  sender_user_id?: number | null;
  sender_first_name?: string;
  sender_last_name?: string;
  sender_role?: string;
};

const categories = [
  "Payments",
  "Enrollments",
  "Grades",
  "Teachers",
  "Facilities",
  "Technology",
  "General",
];

const StudentConcernTickets = () => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<"compose" | "conversation">("compose");
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("Payments");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<ConcernTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<ConcernTicket | null>(null);
  const [messages, setMessages] = useState<ConcernMessage[]>([]);
  const [reply, setReply] = useState("");
  const [ticketSearch, setTicketSearch] = useState("");
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadMoreMessagesRef = useRef<HTMLDivElement>(null);
  const messagesObserverRef = useRef<IntersectionObserver | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const [messagePage, setMessagePage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const MESSAGES_PER_PAGE = 30;

  const isTicketClosed = useMemo(() => {
    const status = selectedTicket?.status ?? "";
    return status === "Closed";
  }, [selectedTicket]);

  const analyzeMessage = async (text: string) => {
    try {
      const result = await apiPost(API_ENDPOINTS.SENTIMENT_PREDICT, { text });
      return {
        sentiment: result?.sentiment ?? null,
        confidence: result?.confidence ?? null,
        probabilities: result?.probabilities ?? null,
      };
    } catch {
      return {
        sentiment: null,
        confidence: null,
        probabilities: null,
      };
    }
  };

  const loadTickets = async () => {
    setIsLoadingTickets(true);
    try {
      const response = await apiGet(API_ENDPOINTS.CONCERNS_MY);
      const list = response?.data ?? [];
      const mapped: ConcernTicket[] = Array.isArray(list) ? list : [];
      setTickets(mapped);

      setSelectedTicket((prev) => {
        if (!prev) return null;
        return mapped.find((entry) => entry.id === prev.id) || null;
      });

      return mapped;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load your concerns.";
      setError(message);
      return [] as ConcernTicket[];
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const loadMessages = async (ticketId: number, pageNum: number = 1, append: boolean = false) => {
    if (append) {
      setIsLoadingMoreMessages(true);
      shouldAutoScrollRef.current = false;
    } else {
      setIsLoadingMessages(true);
      shouldAutoScrollRef.current = true;
    }

    try {
      const params = new URLSearchParams();
      params.set("limit", String(MESSAGES_PER_PAGE));
      params.set("offset", String((pageNum - 1) * MESSAGES_PER_PAGE));

      const response = await apiGet(`${API_ENDPOINTS.CONCERN_MESSAGES(ticketId)}?${params.toString()}`);
      const thread = Array.isArray(response?.messages) ? response.messages : [];
      setHasMoreMessages(thread.length === MESSAGES_PER_PAGE);
      if (append) {
        setMessages((prev) => [...thread, ...prev]);
      } else {
        setMessages(thread);
      }
      if (response?.ticket) {
        setSelectedTicket(response.ticket);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load concern messages.";
      setError(message);
    } finally {
      setIsLoadingMessages(false);
      setIsLoadingMoreMessages(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  useEffect(() => {
    if (viewMode !== "conversation" || !selectedTicket?.id) {
      setMessages([]);
      setMessagePage(1);
      setHasMoreMessages(true);
      return;
    }
    setMessagePage(1);
    setHasMoreMessages(true);
    loadMessages(selectedTicket.id, 1, false);
  }, [selectedTicket?.id, viewMode]);

  useEffect(() => {
    if (viewMode !== "conversation" || !selectedTicket?.id || !hasMoreMessages || isLoadingMessages || isLoadingMoreMessages) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreMessages && !isLoadingMoreMessages) {
          const nextPage = messagePage + 1;
          setMessagePage(nextPage);
          loadMessages(selectedTicket.id, nextPage, true);
        }
      },
      { threshold: 0.1 }
    );

    messagesObserverRef.current = observer;

    if (loadMoreMessagesRef.current) {
      observer.observe(loadMoreMessagesRef.current);
    }

    return () => {
      if (messagesObserverRef.current) {
        messagesObserverRef.current.disconnect();
      }
    };
  }, [viewMode, selectedTicket?.id, messagePage, hasMoreMessages, isLoadingMessages, isLoadingMoreMessages]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      setError("Subject and message are required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const sentiment = await analyzeMessage(message);
      const created = await apiPost(API_ENDPOINTS.CONCERNS, {
        subject: subject.trim(),
        message: message.trim(),
        category,
        ...sentiment,
      });

      setMessage("");
      setSubject("");

      const updatedTickets = await loadTickets();
      const createdId = Number(created?.ticket_id || 0);
      const createdTicket = createdId
        ? updatedTickets.find((entry) => entry.id === createdId)
        : updatedTickets[0];

      if (createdTicket) {
        setSelectedTicket(createdTicket);
        setViewMode("conversation");
        setMobilePane("detail");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit feedback.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket?.id || !reply.trim()) {
      return;
    }

    setIsSendingReply(true);
    setError(null);

    try {
      const sentiment = await analyzeMessage(reply.trim());
      await apiPost(API_ENDPOINTS.CONCERN_MESSAGES(selectedTicket.id), {
        message: reply.trim(),
        ...sentiment,
      });
      setReply("");
      setMessagePage(1);
      setHasMoreMessages(true);
      await loadMessages(selectedTicket.id, 1, false);
      await loadTickets();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send message.";
      setError(message);
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleStartNewTicket = () => {
    setViewMode("compose");
    setMobilePane("detail");
    setSelectedTicket(null);
    setReply("");
    setSubject("");
    setMessage("");
    setCategory("Payments");
    setError(null);
  };

  const formatDate = (value?: string) => {
    if (!value) return "";
    return new Date(value).toLocaleString();
  };

  const firstName = useMemo(() => {
    const raw = String(user?.first_name || "there").trim();
    return raw.split(" ")[0];
  }, [user]);

  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  };

  const filteredTickets = useMemo(() => {
    const key = ticketSearch.trim().toLowerCase();
    if (!key) return tickets;

    return tickets.filter((ticket) => {
      return [ticket.subject, ticket.ticket_no, ticket.category, ticket.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(key));
    });
  }, [tickets, ticketSearch]);

  const groupedMessages = useMemo(() => {
    const groups: Array<{
      senderName: string;
      isOwn: boolean;
      key: string;
      entries: ConcernMessage[];
    }> = [];

    for (const entry of messages) {
      const senderName = `${entry.sender_first_name || ""} ${entry.sender_last_name || ""}`.trim() || (entry.sender_role === "admin" ? "Admin" : "You");
      const isOwn = entry.sender_role !== "admin";
      const key = `${entry.sender_role || ""}-${entry.sender_user_id ?? "none"}-${senderName}`;
      const lastGroup = groups[groups.length - 1];

      if (lastGroup && lastGroup.key === key) {
        lastGroup.entries.push(entry);
      } else {
        groups.push({ senderName, isOwn, key, entries: [entry] });
      }
    }

    return groups;
  }, [messages]);

  const handleBackToList = () => {
    setMobilePane("list");
  };

  const moderationHelper =
    error && error.toLowerCase().includes("blocked or harmful")
      ? error
      : null;

  return (
    <DashboardLayout fullBleed>
      <div className="w-full px-2 pb-4 pt-4 sm:px-4 sm:pb-8 sm:pt-0 space-y-6 sm:space-y-8">
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl leading-tight font-bold text-gray-900">
                  <span className="block sm:inline">Hi {firstName}, what do you need</span>
                  <span className="block sm:inline"> help with?</span>
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground leading-snug">Create a concern and chat with admins in one place.</p>
              </div>
            </div>
          </div>
        </div>

        {error && !moderationHelper && (
          <Card className="border-rose-200 bg-rose-50/50">
            <CardContent className="py-4 text-sm text-rose-700">{error}</CardContent>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-12">
          <Card className={`xl:col-span-4 border-blue-100/70 ${mobilePane === "detail" ? "hidden xl:block" : ""}`}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">My Concerns</CardTitle>
                <Button
                  size="sm"
                  onClick={handleStartNewTicket}
                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
              <CardDescription>{isLoadingTickets ? "Loading..." : `${tickets.length} concern(s)`}</CardDescription>
              <div className="relative pt-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={ticketSearch}
                  onChange={(event) => setTicketSearch(event.target.value)}
                  placeholder="Search concerns"
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
              {filteredTickets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No concerns found.
                </div>
              ) : (
                filteredTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => {
                      setSelectedTicket(ticket);
                      setViewMode("conversation");
                      setMobilePane("detail");
                    }}
                    className={`w-full rounded-xl border p-3 text-left transition ${selectedTicket?.id === ticket.id ? "border-blue-300 bg-gradient-to-r from-blue-50 to-cyan-50" : "border-border hover:bg-muted/30"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">{ticket.subject}</p>
                      <Badge variant="outline" className="bg-white">{ticket.status}</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{ticket.ticket_no}</span>
                      <span>•</span>
                      <span>{ticket.category}</span>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className={`xl:col-span-8 border-blue-100/70 relative overflow-hidden min-h-[calc(100vh-11rem)] xl:min-h-0 ${mobilePane === "list" ? "hidden xl:block" : ""}`}>
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-cyan-500" />
            <CardHeader className="px-3 pt-4 pb-3 sm:px-6 sm:pt-6">
              <div className="xl:hidden mb-1">
                <Button type="button" variant="ghost" size="sm" onClick={handleBackToList} className="inline-flex items-center gap-1 px-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to concerns
                </Button>
              </div>
              <CardTitle className="text-lg">
                {viewMode === "compose" ? "New Concern" : "Concern Conversation"}
              </CardTitle>
              <CardDescription>
                {viewMode === "compose"
                  ? "Provide a clear title and details so admins can assist faster."
                  : selectedTicket
                    ? `${selectedTicket.ticket_no} • ${selectedTicket.subject}`
                    : "Select a concern to view messages"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-3 pb-3 sm:px-6 sm:pb-6">
              {viewMode === "compose" ? (
                <>
                  <Input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Title"
                  />
                  <div className="grid gap-3 md:grid-cols-12">
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="md:col-span-4">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((entry) => (
                          <SelectItem key={entry} value={entry}>{entry}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="md:col-span-8" />
                  </div>
                  <div className="relative">
                    <Textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Describe your concern"
                      rows={7}
                      className={moderationHelper ? "pb-10" : undefined}
                    />
                    {moderationHelper && (
                      <p className="pointer-events-none absolute bottom-3 left-3 right-3 text-xs text-rose-600">
                        {moderationHelper}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white" onClick={handleSubmit} disabled={!subject.trim() || !message.trim() || isSubmitting}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      {isSubmitting ? "Submitting..." : "Submit concern"}
                    </Button>
                  </div>
                </>
              ) : !selectedTicket ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No concern selected.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-cyan-50/80 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-white">{selectedTicket.status}</Badge>
                      <Badge variant="outline" className="bg-white">{selectedTicket.category}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">Updated: {formatDate(selectedTicket.last_message_at || selectedTicket.created_at)}</span>
                  </div>

                  <div className="max-h-[390px] space-y-3 overflow-y-auto pr-1 rounded-2xl border border-blue-100 bg-gradient-to-b from-slate-50 to-white p-3">
                    {isLoadingMessages ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((entry) => (
                          <div key={entry} className={`flex ${entry % 2 === 0 ? "justify-end" : "justify-start"} animate-pulse`}>
                            <div className={`max-w-[85%] ${entry % 2 === 0 ? "items-end" : "items-start"} flex gap-2`}>
                              {entry % 2 !== 0 && <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200" />}
                              <div className={`px-4 py-3 rounded-2xl ${entry % 2 === 0 ? "bg-blue-200" : "bg-slate-200"}`}>
                                <div className="h-3 w-16 rounded bg-slate-300 mb-2" />
                                <div className="h-4 w-44 rounded bg-slate-300 mb-1" />
                                <div className="h-4 w-28 rounded bg-slate-300" />
                              </div>
                              {entry % 2 === 0 && <div className="h-8 w-8 shrink-0 rounded-full bg-blue-300" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No messages found.</div>
                    ) : (
                      <>
                        {hasMoreMessages && (
                          <div ref={loadMoreMessagesRef} className="py-2 text-center">
                            {isLoadingMoreMessages && (
                              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Loading older messages...
                              </div>
                            )}
                          </div>
                        )}

                        {groupedMessages.map((group) => (
                          <div key={`${group.key}-${group.entries[0]?.id ?? "0"}`} className={`flex ${group.isOwn ? "justify-end" : "justify-start"}`}>
                            <div className="max-w-[85%] flex gap-2 items-end">
                              {!group.isOwn && (
                                <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                                  {getInitials(group.senderName)}
                                </div>
                              )}

                              <div className="space-y-1.5">
                                {group.entries.map((entry, index) => (
                                  <div key={entry.id} className={`px-4 py-3 rounded-2xl shadow-sm ${group.isOwn ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white" : "bg-background text-foreground border border-border"} ${index === group.entries.length - 1 && group.isOwn ? "rounded-br-none" : ""} ${index === group.entries.length - 1 && !group.isOwn ? "rounded-bl-none" : ""}`}>
                                    {index === 0 && (
                                      <div className={`text-xs mb-1 ${group.isOwn ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                                        {group.isOwn ? "You" : group.senderName}
                                      </div>
                                    )}
                                    <p className="text-sm whitespace-pre-wrap break-words">{entry.message}</p>
                                    <div className={`text-[11px] mt-2 ${group.isOwn ? "text-white/80" : "text-muted-foreground"}`}>
                                      {formatDate(entry.created_at)}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {group.isOwn && (
                                <div className="h-8 w-8 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                                  {getInitials(String(firstName || "You"))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-white p-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="relative sm:flex-1">
                        <Textarea
                          value={reply}
                          onChange={(event) => setReply(event.target.value)}
                          placeholder={isTicketClosed ? "This concern is closed." : "Write a follow-up message"}
                          rows={3}
                          disabled={isTicketClosed}
                          className={`border-0 shadow-none focus-visible:ring-0 ${moderationHelper ? "pb-9" : ""}`}
                        />
                        {moderationHelper && (
                          <p className="pointer-events-none absolute bottom-2 left-2 right-2 text-xs text-rose-600">
                            {moderationHelper}
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={handleSendReply}
                        disabled={isSendingReply || !reply.trim() || isTicketClosed}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                      >
                        <Send className="h-4 w-4" />
                        {isSendingReply ? "Sending..." : "Send"}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentConcernTickets;
