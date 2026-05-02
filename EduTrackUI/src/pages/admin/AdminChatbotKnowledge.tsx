import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiDelete, apiGet, apiPost, apiPut, API_ENDPOINTS } from "@/lib/api";
import { BookOpen, Bot, Search, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

type KnowledgeItem = {
  id: number;
  title: string;
  content: string;
  tags?: string | null;
  route?: string | null;
  is_active: number;
  updated_at?: string | null;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const AdminChatbotKnowledge = () => {
  const navigate = useNavigate();
  const pageSize = 5;
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formRoute, setFormRoute] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatInstructions, setChatInstructions] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const loadKnowledge = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = API_ENDPOINTS.CHATBOT_KNOWLEDGE + (search ? `?search=${encodeURIComponent(search)}` : "");
      const response = await apiGet(url);
      const data = Array.isArray(response?.data) ? response.data : [];
      setItems(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load knowledge.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKnowledge();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, items.length]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const term = search.toLowerCase();
    return items.filter((item) =>
      item.title.toLowerCase().includes(term) ||
      item.content.toLowerCase().includes(term) ||
      (item.tags ?? "").toLowerCase().includes(term)
    );
  }, [items, search]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const startIndex = (safePage - 1) * pageSize;
  const pageItems = filteredItems.slice(startIndex, startIndex + pageSize);

  const resetForm = () => {
    setEditing(null);
    setFormTitle("");
    setFormContent("");
    setFormTags("");
    setFormRoute("");
    setFormActive(true);
  };

  const startEdit = (item: KnowledgeItem) => {
    setEditing(item);
    setFormTitle(item.title);
    setFormContent(item.content);
    setFormTags(item.tags ?? "");
    setFormRoute(item.route ?? "");
    setFormActive(item.is_active === 1);
  };

  const handleSave = async () => {
    const title = formTitle.trim();
    const content = formContent.trim();
    if (!title || !content) {
      setError("Title and content are required.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        title,
        content,
        tags: formTags.trim() || null,
        route: formRoute.trim() || null,
        is_active: formActive,
      };

      if (editing) {
        await apiPut(API_ENDPOINTS.CHATBOT_KNOWLEDGE_BY_ID(editing.id), payload);
      } else {
        await apiPost(API_ENDPOINTS.CHATBOT_KNOWLEDGE, payload);
      }

      resetForm();
      await loadKnowledge();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save knowledge.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      await apiDelete(API_ENDPOINTS.CHATBOT_KNOWLEDGE_BY_ID(id));
      await loadKnowledge();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete knowledge.";
      setError(message);
    }
  };

  const handleToggle = async (item: KnowledgeItem) => {
    setError(null);
    try {
      await apiPut(API_ENDPOINTS.CHATBOT_KNOWLEDGE_TOGGLE(item.id), {
        is_active: item.is_active !== 1,
      });
      await loadKnowledge();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update status.";
      setError(message);
    }
  };

  const handleChatSend = async () => {
    const message = chatInput.trim();
    if (!message) return;

    setChatError(null);
    setIsChatting(true);
    setChatMessages((prev) => [...prev, { role: "user", content: message }]);
    setChatInput("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/chatbot/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message,
          instructions: chatInstructions.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Chatbot request failed.");
      }

      const data = await response.json();
      if (!data?.reply) {
        throw new Error("Unexpected chatbot response.");
      }

      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Chatbot error.";
      setChatError(messageText);
    } finally {
      setIsChatting(false);
    }
  };

  const renderChatContent = (content: string) => {
    const parts: Array<{ type: "text" | "link"; value: string; href?: string }> = [];
    const pattern = /\[link:([^\]|]+)\|([^\]]+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
      }
      parts.push({ type: "link", value: match[1], href: match[2] });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({ type: "text", value: content.slice(lastIndex) });
    }

    return parts.map((part, index) => {
      if (part.type === "link" && part.href) {
        return (
          <button
            key={`link-${index}`}
            type="button"
            onClick={() => navigate(part.href!)}
            className="text-primary underline underline-offset-2"
          >
            {part.value}
          </button>
        );
      }

      return <span key={`text-${index}`}>{part.value}</span>;
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Chatbot Knowledge</h1>
          <p className="text-muted-foreground">Store system knowledge and test chatbot responses.</p>
        </div>

        {error && (
          <Card className="border-rose-200 bg-rose-50/50">
            <CardContent className="py-4 text-sm text-rose-700">{error}</CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Knowledge Entries
              </CardTitle>
              <CardDescription>Manage what the chatbot knows.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search knowledge"
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" onClick={loadKnowledge}>
                  Refresh
                </Button>
              </div>

              {isLoading ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Loading knowledge...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No knowledge entries yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {pageItems.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">{item.title}</p>
                          <p className="text-xs text-muted-foreground">Updated {item.updated_at ?? "--"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={item.is_active === 1 ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}>
                            {item.is_active === 1 ? "Active" : "Inactive"}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => handleToggle(item)}>
                            {item.is_active === 1 ? "Disable" : "Enable"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.content}</p>
                      {item.tags && (
                        <p className="text-xs text-muted-foreground">Tags: {item.tags}</p>
                      )}
                      {item.route && (
                        <p className="text-xs text-muted-foreground">Route: {item.route}</p>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span>
                      Showing {filteredItems.length === 0 ? 0 : startIndex + 1}-
                      {Math.min(startIndex + pageSize, filteredItems.length)} of {filteredItems.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={safePage <= 1}
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      >
                        Previous
                      </Button>
                      <span>
                        Page {safePage} of {pageCount}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={safePage >= pageCount}
                        onClick={() => setCurrentPage((prev) => Math.min(pageCount, prev + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Add / Edit Knowledge
              </CardTitle>
              <CardDescription>{editing ? "Edit selected knowledge entry." : "Create a new knowledge entry."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Title"
                value={formTitle}
                onChange={(event) => setFormTitle(event.target.value)}
              />
              <Textarea
                placeholder="Content"
                rows={6}
                value={formContent}
                onChange={(event) => setFormContent(event.target.value)}
              />
              <Input
                placeholder="Tags (comma separated)"
                value={formTags}
                onChange={(event) => setFormTags(event.target.value)}
              />
              <Input
                placeholder="Route (e.g. /admin/school-services)"
                value={formRoute}
                onChange={(event) => setFormRoute(event.target.value)}
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(event) => setFormActive(event.target.checked)}
                />
                <span>Active</span>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving" : editing ? "Update" : "Create"}
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Test Chatbot
            </CardTitle>
            <CardDescription>Ask a question to see how the chatbot uses your knowledge base.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Optional instructions for the chatbot (tone, role, restrictions)"
              rows={3}
              value={chatInstructions}
              onChange={(event) => setChatInstructions(event.target.value)}
            />
            <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/20">
              {chatMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              ) : (
                chatMessages.map((msg, index) => (
                  <div key={`${msg.role}-${index}`} className={msg.role === "user" ? "text-right" : "text-left"}>
                    <p className="text-xs text-muted-foreground">{msg.role === "user" ? "You" : "Chatbot"}</p>
                    <div className={msg.role === "user" ? "inline-block bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm" : "inline-block bg-white border border-border rounded-lg px-3 py-2 text-sm"}>
                      {msg.role === "assistant" ? renderChatContent(msg.content) : msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>
            {chatError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700">
                {chatError}
              </div>
            )}
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <Input
                placeholder="Type your question"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
              />
              <Button onClick={handleChatSend} disabled={isChatting}>
                {isChatting ? "Sending" : "Send"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminChatbotKnowledge;
