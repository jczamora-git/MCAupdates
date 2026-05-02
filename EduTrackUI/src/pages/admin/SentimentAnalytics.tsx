import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_ENDPOINTS, apiGet, apiPost, apiPut } from "@/lib/api";
import { useManilaTime } from "@/hooks/useManilaTime";
import { Inbox, MessageSquare, Send, Clock, CheckCircle2, RotateCcw, Loader2 } from "lucide-react";

type ConcernTicket = {
  id: number;
  ticket_no: string;
  subject: string;
  category: string;
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  overall_sentiment?: string | null;
  overall_confidence?: number | null;
  created_at?: string;
  last_message_at?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
};

type ConcernMessage = {
  id: number;
  message: string;
  sentiment?: string | null;
  confidence?: number | null;
  created_at?: string;
  sender_user_id?: number | null;
  sender_role?: string;
  sender_first_name?: string;
  sender_last_name?: string;
};

const statusOptions = ["all", "Open", "In Progress", "Resolved", "Closed"] as const;
const categoryOptions = ["all", "Payments", "Enrollments", "Grades", "Teachers", "Facilities", "Technology", "General"];

const sentimentBadgeClass = (value?: string | null) => {
  const sentiment = (value || "").toLowerCase();
  if (sentiment === "positive") return "bg-emerald-500/10 text-emerald-700 border-emerald-200";
  if (sentiment === "negative") return "bg-rose-500/10 text-rose-700 border-rose-200";
  if (sentiment === "neutral") return "bg-amber-500/10 text-amber-700 border-amber-200";
  return "bg-muted text-muted-foreground border-border";
};

const getInitials = (name: string) => {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
};

const AdminSentimentAnalytics = () => {
  const { formatDateTimeDisplay } = useManilaTime();
  const [tickets, setTickets] = useState<ConcernTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<ConcernTicket | null>(null);
  const [messages, setMessages] = useState<ConcernMessage[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [statusDraft, setStatusDraft] = useState<ConcernTicket["status"]>("Open");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  
  // Lazy loading states for tickets
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_PAGE = 20;
  
  // Lazy loading states for messages
  const [messagePage, setMessagePage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const messagesObserverRef = useRef<IntersectionObserver | null>(null);
  const loadMoreMessagesRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const MESSAGES_PER_PAGE = 30;

  const loadTickets = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingTickets(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (search.trim()) params.set("search", search.trim());
      
      // Add pagination parameters
      params.set("limit", String(ITEMS_PER_PAGE));
      params.set("offset", String((pageNum - 1) * ITEMS_PER_PAGE));

      const url = `${API_ENDPOINTS.CONCERNS}?${params.toString()}`;
      const response = await apiGet(url);
      const list = Array.isArray(response?.data) ? response.data : [];

      // Check if there are more items to load
      setHasMore(list.length === ITEMS_PER_PAGE);
      
      if (append) {
        setTickets((prev) => [...prev, ...list]);
      } else {
        setTickets(list);
        if (list.length > 0) {
          const current = selectedTicket ? list.find((entry: ConcernTicket) => entry.id === selectedTicket.id) : null;
          setSelectedTicket(current || list[0]);
        } else {
          setSelectedTicket(null);
          setMessages([]);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load concern tickets.";
      setError(message);
    } finally {
      setIsLoadingTickets(false);
      setIsLoadingMore(false);
    }
  }, [statusFilter, categoryFilter, search, selectedTicket, ITEMS_PER_PAGE]);

  const loadMessages = useCallback(async (ticketId: number, pageNum: number = 1, append: boolean = false) => {
    if (append) {
      setIsLoadingMoreMessages(true);
      shouldAutoScrollRef.current = false;
    } else {
      setIsLoadingMessages(true);
      shouldAutoScrollRef.current = true;
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("limit", String(MESSAGES_PER_PAGE));
      params.set("offset", String((pageNum - 1) * MESSAGES_PER_PAGE));
      
      const url = `${API_ENDPOINTS.CONCERN_MESSAGES(ticketId)}?${params.toString()}`;
      const response = await apiGet(url);
      const thread = Array.isArray(response?.messages) ? response.messages : [];
      
      setHasMoreMessages(thread.length === MESSAGES_PER_PAGE);
      
      if (append) {
        // When loading older messages, prepend them to maintain scroll position
        setMessages((prev) => [...thread, ...prev]);
      } else {
        setMessages(thread);
      }
      
      if (response?.ticket && !append) {
        setSelectedTicket(response.ticket);
        setStatusDraft(response.ticket.status || "Open");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load concern thread.";
      setError(message);
    } finally {
      setIsLoadingMessages(false);
      setIsLoadingMoreMessages(false);
    }
  }, [MESSAGES_PER_PAGE]);

  useEffect(() => {
    // Reset to page 1 when filters change
    setPage(1);
    setHasMore(true);
    const timer = setTimeout(() => {
      loadTickets(1, false);
    }, 250);
    return () => clearTimeout(timer);
  }, [statusFilter, categoryFilter, search]);

  useEffect(() => {
    if (!selectedTicket?.id) return;
    setMessagePage(1);
    setHasMoreMessages(true);
    loadMessages(selectedTicket.id, 1, false);
  }, [selectedTicket?.id, loadMessages]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (isLoadingTickets || isLoadingMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadTickets(nextPage, true);
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current = observer;

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [page, hasMore, isLoadingTickets, isLoadingMore, loadTickets]);

  // Intersection Observer for infinite scroll on messages (load older messages at top)
  useEffect(() => {
    if (!selectedTicket?.id || isLoadingMessages || isLoadingMoreMessages || !hasMoreMessages) return;

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
  }, [selectedTicket?.id, messagePage, hasMoreMessages, isLoadingMessages, isLoadingMoreMessages, loadMessages]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const summary = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((entry) => entry.status === "Open").length;
    const inProgress = tickets.filter((entry) => entry.status === "In Progress").length;
    const resolved = tickets.filter((entry) => entry.status === "Resolved").length;
    const closed = tickets.filter((entry) => entry.status === "Closed").length;
    return { total, open, inProgress, resolved, closed };
  }, [tickets]);

  const groupedMessages = useMemo(() => {
    const groups: Array<{
      sender: string;
      isOwn: boolean;
      key: string;
      entries: ConcernMessage[];
    }> = [];

    for (const entry of messages) {
      const sender = `${entry.sender_first_name || ""} ${entry.sender_last_name || ""}`.trim() || (entry.sender_role === "admin" ? "Admin" : "User");
      const isOwn = entry.sender_role === "admin";
      const key = `${entry.sender_role || ""}-${entry.sender_user_id ?? "none"}-${sender}`;
      const lastGroup = groups[groups.length - 1];

      if (lastGroup && lastGroup.key === key) {
        lastGroup.entries.push(entry);
      } else {
        groups.push({ sender, isOwn, key, entries: [entry] });
      }
    }

    return groups;
  }, [messages]);

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setPage(1);
    setHasMore(true);
  };

  const handleStatusUpdate = async () => {
    if (!selectedTicket?.id) return;
    setIsUpdatingStatus(true);
    setError(null);

    try {
      await apiPut(API_ENDPOINTS.CONCERN_STATUS(selectedTicket.id), { status: statusDraft });
      setMessagePage(1);
      setHasMoreMessages(true);
      await loadMessages(selectedTicket.id, 1, false);
      setPage(1);
      setHasMore(true);
      await loadTickets(1, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update concern status.";
      setError(message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket?.id || !reply.trim()) return;
    setIsSendingReply(true);
    setError(null);

    try {
      await apiPost(API_ENDPOINTS.CONCERN_MESSAGES(selectedTicket.id), { message: reply.trim() });
      setReply("");
      setMessagePage(1);
      setHasMoreMessages(true);
      await loadMessages(selectedTicket.id, 1, false);
      setPage(1);
      setHasMore(true);
      await loadTickets(1, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send reply.";
      setError(message);
    } finally {
      setIsSendingReply(false);
    }
  };

  const formatDate = useCallback((value?: string) => {
    if (!value) return "";
    return formatDateTimeDisplay(value);
  }, [formatDateTimeDisplay]);

  return (
    <DashboardLayout>
      <div className="px-4 py-4 sm:px-8 sm:py-8 min-h-screen bg-gradient-to-b from-background to-muted/30 space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md flex-shrink-0">
              <Inbox className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent leading-tight">
                Concern Inbox
              </h1>
              <p className="text-muted-foreground text-base">Review concerns, update status, and respond in-thread.</p>
            </div>
          </div>
        </div>

        {error && (
          <Card className="border-rose-200 bg-rose-50/50">
            <CardContent className="py-4 text-sm text-rose-700">{error}</CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 font-semibold">Total Concerns</p>
                  <p className="text-2xl font-bold text-slate-900">{summary.total}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                  <Inbox className="h-6 w-6 text-slate-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-yellow-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600 font-semibold">Open</p>
                  <p className="text-2xl font-bold text-yellow-700">{summary.open}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-yellow-200 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-semibold">In Progress</p>
                  <p className="text-2xl font-bold text-blue-700">{summary.inProgress}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-semibold">Resolved/Closed</p>
                  <p className="text-2xl font-bold text-green-700">{summary.resolved + summary.closed}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_170px_170px_auto] items-end">
              <div className="space-y-1.5">
                <Label htmlFor="concern-search">Search</Label>
                <Input
                  id="concern-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search concern no, title, name"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as (typeof statusOptions)[number])}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((entry) => (
                      <SelectItem key={entry} value={entry}>{entry}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((entry) => (
                      <SelectItem key={entry} value={entry}>{entry}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" onClick={handleResetFilters} className="gap-2">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1 border-blue-100/70 relative overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-cyan-500" />
            <CardHeader>
              <CardTitle className="text-lg">Concern Queue</CardTitle>
              <CardDescription>
                {isLoadingTickets ? "Loading..." : `${tickets.length} concern(s) loaded${hasMore ? ' (scroll for more)' : ''}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
              {tickets.length === 0 && !isLoadingTickets ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No concerns found.</div>
              ) : (
                <>
                  {tickets.map((ticket) => {
                    const owner = `${ticket.first_name || ""} ${ticket.last_name || ""}`.trim() || ticket.email || "Unknown user";
                    return (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => setSelectedTicket(ticket)}
                        className={`w-full rounded-xl border p-3 text-left transition ${selectedTicket?.id === ticket.id ? "border-blue-300 bg-gradient-to-r from-blue-50 to-cyan-50 shadow-sm" : "border-border hover:bg-muted/30"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold truncate">{ticket.subject}</p>
                          <Badge variant="outline" className="bg-white">{ticket.status}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground truncate">{ticket.ticket_no} • {owner}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="outline" className="bg-white">{ticket.category}</Badge>
                          <Badge variant="outline" className={sentimentBadgeClass(ticket.overall_sentiment)}>
                            {ticket.overall_sentiment || "N/A"}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                  
                  {/* Intersection observer target for infinite scroll */}
                  {hasMore && (
                    <div ref={loadMoreRef} className="py-2 text-center">
                      {isLoadingMore && (
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Loading more...</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!hasMore && tickets.length > 0 && (
                    <div className="py-2 text-center text-xs text-muted-foreground">
                      No more concerns to load
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-blue-100/70 relative overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-cyan-500" />
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Concern Thread
              </CardTitle>
              <CardDescription>
                {selectedTicket ? `${selectedTicket.ticket_no} • ${selectedTicket.subject}` : "Select a concern from the queue"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedTicket ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No concern selected.</div>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-3 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-cyan-50/80 px-3 py-2">
                    <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="bg-white">{selectedTicket.category}</Badge>
                      <Badge variant="outline" className={sentimentBadgeClass(selectedTicket.overall_sentiment)}>
                        Overall: {selectedTicket.overall_sentiment || "N/A"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Last update: {formatDate(selectedTicket.last_message_at || selectedTicket.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={statusDraft} onValueChange={(value) => setStatusDraft(value as ConcernTicket["status"])}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Set status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Resolved">Resolved</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={handleStatusUpdate} disabled={isUpdatingStatus} variant="outline" className="bg-white">
                        {isUpdatingStatus ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>

                  <div ref={messagesContainerRef} className="max-h-[360px] space-y-3 overflow-y-auto pr-1 rounded-2xl border border-blue-100 bg-gradient-to-b from-slate-50 to-white p-3">
                    {isLoadingMessages ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"} animate-pulse`}>
                            <div className={`max-w-[85%] flex gap-2 ${i % 2 === 0 ? "items-end" : "items-start"}`}>
                              {i % 2 !== 0 && <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200" />}
                              <div className={`px-4 py-3 rounded-2xl ${i % 2 === 0 ? "bg-blue-200" : "bg-slate-200"}`}>
                                <div className="h-3 bg-slate-300 rounded w-16 mb-2" />
                                <div className="h-4 bg-slate-300 rounded w-48 mb-1" />
                                <div className="h-4 bg-slate-300 rounded w-32" />
                              </div>
                              {i % 2 === 0 && <div className="h-8 w-8 shrink-0 rounded-full bg-blue-300" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No messages yet.</div>
                    ) : (
                      <>
                        {/* Load more older messages indicator at top */}
                        {hasMoreMessages && (
                          <div ref={loadMoreMessagesRef} className="py-2 text-center">
                            {isLoadingMoreMessages && (
                              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading older messages...</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {groupedMessages.map((group) => (
                          <div key={`${group.key}-${group.entries[0]?.id ?? "0"}`} className={`flex ${group.isOwn ? "justify-end" : "justify-start"}`}>
                            <div className="max-w-[85%] flex gap-2 items-end">
                              {!group.isOwn && (
                                <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                                  {getInitials(group.sender)}
                                </div>
                              )}

                              <div className="space-y-1.5">
                                {group.entries.map((entry, index) => (
                                  <div key={entry.id} className={`px-4 py-3 rounded-2xl shadow-sm ${group.isOwn ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white" : "bg-background text-foreground border border-border"} ${index === group.entries.length - 1 && group.isOwn ? "rounded-br-none" : ""} ${index === group.entries.length - 1 && !group.isOwn ? "rounded-bl-none" : ""}`}>
                                    {index === 0 && (
                                      <div className={`text-xs mb-1 ${group.isOwn ? "text-white/80" : "text-muted-foreground"}`}>
                                        {group.sender}
                                      </div>
                                    )}

                                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{entry.message}</p>

                                    <div className={`mt-2 pt-2 border-t ${group.isOwn ? "border-white/20" : "border-border/70"} flex flex-wrap items-center gap-2`}>
                                      {entry.sentiment && (
                                        <Badge variant="outline" className={`${group.isOwn ? "bg-white/15 text-white border-white/30" : sentimentBadgeClass(entry.sentiment)}`}>
                                          {entry.sentiment}
                                        </Badge>
                                      )}
                                      <div className={`text-[11px] ${group.isOwn ? "text-white/75" : "text-muted-foreground"}`}>
                                        {formatDate(entry.created_at)}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {group.isOwn && (
                                <div className="h-8 w-8 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                                  {getInitials(group.sender)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </>
                    )}
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-white p-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <Textarea
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        placeholder="Reply to this concern"
                        rows={3}
                        className="sm:flex-1 border-0 shadow-none focus-visible:ring-0"
                      />
                      <Button onClick={handleSendReply} disabled={isSendingReply || !reply.trim()} className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white">
                        <Send className="h-4 w-4" />
                        {isSendingReply ? "Sending..." : "Send reply"}
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

export default AdminSentimentAnalytics;
