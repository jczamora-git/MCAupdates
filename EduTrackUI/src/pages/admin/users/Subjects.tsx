import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, BookOpen, ArrowUpDown, LayoutGrid, List } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertMessage } from "@/components/AlertMessage";
import { useConfirm } from "@/components/Confirm";
import { API_ENDPOINTS, apiGet, apiPost, apiPut } from "@/lib/api";
import { Pagination } from "@/components/Pagination";

type Subject = {
  id: string;
  code: string;
  name: string;
  level: string;
  status: "active" | "inactive";
};

const Subjects = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Subjects loaded from backend
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 12;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Subject, "id">>({
    code: "",
    name: "",
    level: "Grade 1",
    status: "active",
  });

  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const showAlert = (type: "success" | "error" | "info", message: string) => {
    setAlert({ type, message });
  };

  const confirm = useConfirm();

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      navigate("/auth");
    }
  }, [isAuthenticated, user, navigate]);

  // Fetch subjects from backend when authorized
  useEffect(() => {
    const load = async () => {
      if (!isAuthenticated || user?.role !== 'admin') return;
      setIsLoading(true);
      try {
        const res = await apiGet(API_ENDPOINTS.SUBJECTS);
        // support different shapes: { success, subjects }, { data }, or array
        if (!res) return;
        // Normalizer to ensure required fields exist (prevents runtime errors like localeCompare on undefined)
          const normalize = (s: any): Subject => ({
          id: String(s.id ?? s.subject_id ?? s.code ?? Date.now()),
          code: s.code ?? s.course_code ?? s.subject_code ?? "",
          name: s.name ?? s.subject_name ?? s.course_name ?? s.title ?? "",
          level: s.level ?? s.year_level ?? s.year ?? "Grade 1",
          status: (s.status ?? s.state ?? "active") as "active" | "inactive",
        });

        const arr = Array.isArray(res) ? res : res.subjects ?? res.data ?? [];
        const mapped = (arr || []).map((it: any) => normalize(it));
        setSubjects(mapped as Subject[]);
      } catch (err: any) {
        console.error('Failed to load subjects', err);
        showAlert('error', err?.message || 'Failed to load subjects');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isAuthenticated, user]);

  const filteredSubjects = subjects.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery = q === "" || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
    const matchesLevel = levelFilter === "all" || s.level === levelFilter;
    return matchesQuery && matchesLevel;
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, levelFilter]);

  // Clamp currentPage to valid pages
  const totalItems = filteredSubjects.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pagedSubjects = filteredSubjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleOpenCreate = () => {
    setForm({
      code: "",
      name: "",
      level: "Grade 1",
      status: "active",
    });
    setIsCreateOpen(true);
  };

  const handleCreate = () => {
    if (!form.code.trim() || !form.name.trim()) {
      showAlert("error", "Course code and name are required");
      return;
    }
    (async () => {
      try {
        const payload = {
          code: form.code.trim(),
          name: form.name.trim(),
          level: form.level,
          status: form.status,
        };

        const res = await apiPost(API_ENDPOINTS.SUBJECTS, payload);
        // accept res.subject, res.data, or array
        const created = res && (res.subject || res.data || res) ? (res.subject || res.data || res) : null;
        // normalize created if present
        if (created && (created.id || created.code)) {
          const normalized: Subject = {
            id: String(created.id ?? created.subject_id ?? created.code),
            code: created.code ?? created.course_code ?? '',
            name: created.name ?? created.course_name ?? '',
            level: created.level ?? form.level,
            status: created.status ?? 'active',
          };
          setSubjects((s) => [normalized, ...s]);
        } else {
          // fallback local add
          const newSubject: Subject = { id: String(Date.now()), ...form };
          setSubjects((s) => [newSubject, ...s]);
        }

        setIsCreateOpen(false);
        showAlert('success', `Subject ${form.code} created`);
      } catch (err: any) {
        console.error('Failed to create subject', err);
        showAlert('error', err?.message || 'Failed to create subject');
      }
    })();
  };

  const handleOpenEdit = (s: Subject) => {
    setSelectedSubjectId(s.id);
    setForm({
      code: s.code,
      name: s.name,
      level: s.level,
      status: s.status,
    });
    setIsEditOpen(true);
  };

  const handleEdit = () => {
    if (!selectedSubjectId) return;
    (async () => {
      try {
        const payload = {
          code: form.code.trim(),
          name: form.name.trim(),
          level: form.level,
          status: form.status,
        };

        const res = await apiPut(API_ENDPOINTS.SUBJECT_BY_ID(selectedSubjectId), payload);
        const updated = res && (res.subject || res.data || res) ? (res.subject || res.data || res) : null;
        if (updated) {
          const mapped: Subject = {
            id: String(updated.id ?? updated.subject_id ?? selectedSubjectId),
            code: updated.code ?? updated.course_code ?? form.code,
            name: updated.name ?? updated.course_name ?? form.name,
            level: updated.level ?? form.level,
            status: updated.status ?? form.status,
          };
          setSubjects((prev) => prev.map((s) => (s.id === selectedSubjectId ? mapped : s)));
        } else {
          setSubjects((prev) => prev.map((s) => (s.id === selectedSubjectId ? { ...s, ...form } : s)));
        }

        setIsEditOpen(false);
        setSelectedSubjectId(null);
        showAlert('success', 'Subject updated');
      } catch (err: any) {
        console.error('Failed to update subject', err);
        showAlert('error', err?.message || 'Failed to update subject');
      }
    })();
  };

  const handleDelete = (id: string) => {
    const s = subjects.find((x) => x.id === id);
    if (!s) return;
    (async () => {
      const ok = await confirm({
        title: 'Inactivate subject',
        description: `Inactivate subject ${s.code} - ${s.name}? This will set the subject to INACTIVE status.`,
        emphasis: `${s.code} - ${s.name}`,
        confirmText: 'Inactivate',
        cancelText: 'Cancel',
        variant: 'destructive'
      });
      if (!ok) return;

      try {
        // soft-delete via PUT status update
        await apiPut(API_ENDPOINTS.SUBJECT_BY_ID(id), { status: 'inactive' });
        setSubjects((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'inactive' } : x)));
        showAlert('info', `Subject ${s.code} has been set to inactive`);
      } catch (err: any) {
        console.error('Failed to inactivate subject', err);
        showAlert('error', err?.message || 'Failed to inactivate subject');
      }
    })();
  };

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Manage Subjects</h1>
            <p className="text-muted-foreground text-lg">Create and manage the course catalog (Information Technology)</p>
          </div>
          <div className="flex items-center gap-3">
              <div className="w-48">
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="border-2 focus:border-accent-500 rounded-lg px-3 py-2 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="Nursery 1">Nursery 1</SelectItem>
                  <SelectItem value="Nursery 2">Nursery 2</SelectItem>
                  <SelectItem value="Kinder">Kinder</SelectItem>
                  <SelectItem value="Grade 1">Grade 1</SelectItem>
                  <SelectItem value="Grade 2">Grade 2</SelectItem>
                  <SelectItem value="Grade 3">Grade 3</SelectItem>
                  <SelectItem value="Grade 4">Grade 4</SelectItem>
                  <SelectItem value="Grade 5">Grade 5</SelectItem>
                  <SelectItem value="Grade 6">Grade 6</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleOpenCreate} className="bg-gradient-to-r from-primary to-accent text-white shadow-lg hover:shadow-xl">
              <Plus className="h-4 w-4 mr-2" />
              Create Subject
            </Button>
          </div>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-muted border-b pb-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">All Subjects ({filteredSubjects.length})</CardTitle>
                <CardDescription className="text-base">Course catalog for the institution</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                  <div className="relative w-72">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      placeholder="Search subjects by code or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-12 py-2 text-base border-2 focus:border-accent-500 rounded-lg"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSortOrder((s) => (s === "asc" ? "desc" : "asc"))}
                      className="flex items-center gap-2 font-medium"
                      title={`Sort ${sortOrder === "asc" ? "A → Z" : "Z → A"}`}
                      aria-pressed={sortOrder === "desc"}
                    >
                      <ArrowUpDown className="h-4 w-4" />
                      <span className="hidden sm:inline">{sortOrder === "asc" ? "A → Z" : "Z → A"}</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewMode((v) => (v === "grid" ? "list" : "grid"))}
                      className="flex items-center gap-2"
                      title="Toggle view"
                      aria-pressed={viewMode === "list"}
                    >
                      {viewMode === "grid" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                      <span className="hidden sm:inline">{viewMode === "grid" ? "Grid" : "List"}</span>
                    </Button>
                  </div>
                </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
              {(() => {
                const list = [...pagedSubjects];
                // apply sort
                list.sort((a, b) => (sortOrder === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
                return list.map((subject) => {
                  if (viewMode === "grid") {
                    // Enhanced grid card view (2 columns)
                    return (
                      <div
                        key={subject.id}
                        className={`rounded-2xl border-2 transition-all duration-300 flex flex-col justify-between overflow-hidden ${
                          subject.status === "inactive"
                            ? "bg-muted/50 border-muted opacity-70 hover:opacity-80"
                            : "bg-gradient-to-br from-card to-muted/30 border-accent-200 hover:border-accent-400 hover:shadow-xl"
                        }`}
                      >
                        {/* Main content */}
                        <div className={subject.status === "inactive" ? "opacity-60 pointer-events-none p-5" : "p-5"}>
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${
                                subject.status === "active"
                                  ? "bg-gradient-to-br from-primary to-accent"
                                  : "bg-gradient-to-br from-gray-300 to-gray-400"
                              }`}>
                                <BookOpen className="h-6 w-6 text-white" />
                              </div>
                              <div>
                                <p className="font-bold text-xl">{subject.code}</p>
                              </div>
                            </div>
                            <Badge
                              variant={subject.status === "active" ? "default" : "outline"}
                              className={`font-semibold px-3 py-1 ${
                                subject.status === "active"
                                  ? "bg-gradient-to-r from-primary to-accent text-white"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {subject.status.charAt(0).toUpperCase() + subject.status.slice(1)}
                            </Badge>
                          </div>

                          <div className="mb-4">
                            <p className="font-semibold text-base">{subject.name}</p>
                            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                              <span>{subject.level}</span>
                            </div>
                          </div>

                          <div className={`rounded-xl p-3 ${
                            subject.status === "active"
                              ? "bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20"
                              : "bg-card/50 border border-border/30"
                          }`}>
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-semibold text-slate-600">Level</span>
                              <Badge variant="secondary" className="capitalize text-xs">
                                {subject.level}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className={`mt-2 p-5 border-t ${
                          subject.status === "inactive" ? "border-muted bg-muted/30" : "border-accent-100 bg-card/50"
                        }`}>
                          <div className="flex gap-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEdit(subject)}
                              className="flex-1 gap-2 font-medium hover:bg-accent-50 hover:border-accent-300 transition-all"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(subject.id)}
                              disabled={subject.status === "inactive"}
                              className={`text-destructive hover:text-destructive hover:bg-destructive/10 flex-1 gap-2 font-medium transition-all ${
                                subject.status === "inactive" ? "opacity-50 cursor-not-allowed" : ""
                              }`}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    // List view (compact horizontal)
                    return (
                      <div
                        key={subject.id}
                        className={`rounded-2xl border-2 transition-all duration-300 flex items-center justify-between p-4 ${
                          subject.status === "inactive"
                            ? "bg-muted/50 border-muted opacity-80"
                            : "bg-card border-accent-100 hover:border-accent-300 hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 ${
                            subject.status === "active" ? "bg-gradient-to-br from-primary to-accent" : "bg-slate-200"
                          }`}>
                            <BookOpen className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-lg">{subject.code}</p>
                              <Badge variant="outline" className="text-xs">
                                {subject.level}
                              </Badge>
                            </div>
                            <p className="font-medium text-sm text-slate-700">{subject.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={subject.status === "active" ? "default" : "outline"}>
                            {subject.status}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(subject)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete(subject.id)}
                              disabled={subject.status === "inactive"}
                              className={subject.status === "inactive" ? "opacity-50 cursor-not-allowed" : ""}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                });
              })()}
              {filteredSubjects.length === 0 && (
                <div className={viewMode === "grid" ? "col-span-full text-center py-12" : "text-center py-12"}>
                  <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-lg text-muted-foreground font-medium">No subjects found matching your filters</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pagination controls */}
        {!isLoading && totalItems > 0 && (
          <div className="mt-6 px-2">
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={(p) => setCurrentPage(p)}
            />
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-0 shadow-2xl">
            <DialogHeader className="bg-gradient-to-r from-primary to-accent px-6 py-6 -mx-6 -mt-6 mb-6 rounded-t-lg">
              <DialogTitle className="text-2xl font-bold text-white">Create New Subject</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 px-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code" className="font-semibold">Subject Code *</Label>
                  <Input
                    id="code"
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="e.g., ENG"
                    className="mt-2 py-3 border-2 rounded-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="name" className="font-semibold">Subject Name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g., English"
                    className="mt-2 py-3 border-2 rounded-lg"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="level" className="font-semibold">Level *</Label>
                <Select value={form.level} onValueChange={(v) => setForm((f) => ({ ...f, level: v }))}>
                  <SelectTrigger className="mt-2 border-2 rounded-lg px-3 py-2 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nursery 1">Nursery 1</SelectItem>
                    <SelectItem value="Nursery 2">Nursery 2</SelectItem>
                    <SelectItem value="Kinder">Kinder</SelectItem>
                    <SelectItem value="Grade 1">Grade 1</SelectItem>
                    <SelectItem value="Grade 2">Grade 2</SelectItem>
                    <SelectItem value="Grade 3">Grade 3</SelectItem>
                    <SelectItem value="Grade 4">Grade 4</SelectItem>
                    <SelectItem value="Grade 5">Grade 5</SelectItem>
                    <SelectItem value="Grade 6">Grade 6</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full bg-gradient-to-r from-primary to-accent text-white py-3 font-semibold rounded-lg shadow-lg" onClick={handleCreate}>
                Create Subject
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-0 shadow-2xl">
            <DialogHeader className="bg-gradient-to-r from-primary to-accent px-6 py-6 -mx-6 -mt-6 mb-6 rounded-t-lg">
              <DialogTitle className="text-2xl font-bold text-white">Edit Subject</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 px-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-code" className="font-semibold">Subject Code *</Label>
                  <Input
                    id="edit-code"
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    className="mt-2 py-3 border-2 rounded-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-name" className="font-semibold">Subject Name *</Label>
                  <Input
                    id="edit-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-2 py-3 border-2 rounded-lg"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit-level" className="font-semibold">Level *</Label>
                <Select value={form.level} onValueChange={(v) => setForm((f) => ({ ...f, level: v }))}>
                  <SelectTrigger className="mt-2 border-2 rounded-lg px-3 py-2 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nursery 1">Nursery 1</SelectItem>
                    <SelectItem value="Nursery 2">Nursery 2</SelectItem>
                    <SelectItem value="Kinder">Kinder</SelectItem>
                    <SelectItem value="Grade 1">Grade 1</SelectItem>
                    <SelectItem value="Grade 2">Grade 2</SelectItem>
                    <SelectItem value="Grade 3">Grade 3</SelectItem>
                    <SelectItem value="Grade 4">Grade 4</SelectItem>
                    <SelectItem value="Grade 5">Grade 5</SelectItem>
                    <SelectItem value="Grade 6">Grade 6</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-status" className="font-semibold">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as any }))}>
                  <SelectTrigger className="mt-2 border-2 rounded-lg px-3 py-2 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 bg-gradient-to-r from-primary to-accent text-white py-3 font-semibold rounded-lg" onClick={handleEdit}>
                  Save Changes
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {alert && <AlertMessage type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
      </div>
    </DashboardLayout>
  );
};

export default Subjects;
