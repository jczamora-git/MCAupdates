import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, ArrowLeft, CheckSquare, Square, X, LayoutGrid, List, GraduationCap } from "lucide-react";
import { AlertMessage } from "@/components/AlertMessage";
import { useConfirm } from "@/components/Confirm";
import { API_ENDPOINTS, apiGet, apiPut } from "@/lib/api";

type Student = {
  id: string;
  name: string;
  email: string;
  studentId: string;
  yearLevel: string;
  section: string;
  status: "active" | "inactive" | "graduated";
};

const StudentGradeLevelManagement = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processingBulk, setProcessingBulk] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const showAlert = (type: "success" | "error" | "info", message: string) => {
    setAlert({ type, message });
  };

  const formatSection = (section: string) => {
    const value = (section || "").trim();
    if (!value) return "";
    return /^\d+$/.test(value) ? `Section ID: ${value}` : value;
  };

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      navigate("/auth");
    }
  }, [isAuthenticated, user, navigate]);

  const fetchGrade6Students = async () => {
    try {
      setLoading(true);
      const res = await apiGet(`${API_ENDPOINTS.STUDENTS}?year_level=${encodeURIComponent("Grade 6")}`);
      const rows = res && (res.data || res.students) ? (res.data || res.students) : Array.isArray(res) ? res : [];

      if (Array.isArray(rows)) {
        const mapped: Student[] = rows.map((r: any) => ({
          id: String(r.id ?? r.user_id ?? Date.now()),
          name: `${r.last_name || r.lastName || ""}, ${r.first_name || r.firstName || ""}`.trim() || (r.email || ""),
          email: r.email || r.user_email || "",
          studentId: r.student_id || r.studentId || "",
          yearLevel: r.year_level || "",
          section: r.section_name ?? r.section ?? (r.section_id ? String(r.section_id) : ""),
          status: r.status || r.user_status || "active",
        }));
        setStudents(mapped);
      }
    } catch (err) {
      console.error("Failed to load Grade 6 students:", err);
      showAlert("error", "Failed to load Grade 6 students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      fetchGrade6Students();
    }
  }, [isAuthenticated, user]);

  const filteredStudents = students.filter((s) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      query === "" ||
      s.name.toLowerCase().includes(query) ||
      s.email.toLowerCase().includes(query) ||
      s.studentId.toLowerCase().includes(query);
    const matchesStatus = filterStatus === "all" || s.status === filterStatus;
    return matchesQuery && matchesStatus;
  });

  const toggleSelectStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  const handleGraduateStudent = async (student: Student) => {
    if (student.status === "graduated") return;

    const ok = await confirm({
      title: "Mark as graduated",
      description: `Mark ${student.name} as graduated?`,
      emphasis: student.name,
      confirmText: "Graduate",
      cancelText: "Cancel",
      variant: "default",
    });
    if (!ok) return;

    try {
      await apiPut(`/api/students/${student.id}`, { status: "graduated" });
      setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, status: "graduated" } : s)));
      showAlert("success", `${student.name} marked as graduated`);
    } catch (err: any) {
      showAlert("error", err?.message || "Failed to graduate student");
    }
  };

  const handleBulkGraduate = async () => {
    const selectedList = filteredStudents.filter((s) => selectedStudents.has(s.id));
    const pending = selectedList.filter((s) => s.status !== "graduated");

    if (pending.length === 0) {
      showAlert("info", "Selected students are already graduated");
      return;
    }

    const ok = await confirm({
      title: "Bulk graduate students",
      description: `Mark ${pending.length} selected Grade 6 student(s) as graduated?`,
      confirmText: "Bulk Graduate",
      cancelText: "Cancel",
      variant: "default",
    });
    if (!ok) return;

    try {
      setProcessingBulk(true);
      let successCount = 0;
      let failedCount = 0;

      for (const student of pending) {
        try {
          await apiPut(`/api/students/${student.id}`, { status: "graduated" });
          successCount++;
        } catch (err) {
          console.error(`Failed to graduate ${student.name}:`, err);
          failedCount++;
        }
      }

      await fetchGrade6Students();
      setSelectedStudents(new Set());
      setShowBulkPanel(false);
      showAlert(
        "success",
        `Graduated ${successCount} student(s)${failedCount > 0 ? `, ${failedCount} failed` : ""}`
      );
    } catch (err: any) {
      showAlert("error", err?.message || "Bulk graduation failed");
    } finally {
      setProcessingBulk(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin/users/students")}
            className="mb-6 gap-2 text-base font-medium hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Students
          </Button>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Graduating Students
          </h1>
          <p className="text-muted-foreground text-lg">Grade 6 students with individual and bulk graduation actions</p>
        </div>

        <Card className="shadow-lg border-0 mb-6">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-muted border-b pb-6">
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <div className="relative flex-1 min-w-64">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or student ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 py-2.5 text-base border-2 focus:border-accent-500 rounded-xl"
                />
              </div>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="border-2 rounded-xl px-3 py-2 bg-background font-medium w-40">
                  {filterStatus === "all" ? "All Status" : filterStatus}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="graduated">Graduated</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode((v) => (v === "list" ? "grid" : "list"))}
                className="flex items-center gap-2"
                title="Toggle view"
              >
                {viewMode === "list" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {selectedStudents.size > 0 && (
              <div className="mb-6 p-4 bg-accent/10 border-2 border-accent/30 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckSquare className="h-5 w-5 text-accent" />
                  <span className="font-semibold text-base">{selectedStudents.size} student(s) selected</span>
                </div>
                <Button
                  onClick={() => setShowBulkPanel(true)}
                  className="bg-gradient-to-r from-primary to-accent text-white font-semibold gap-2"
                >
                  <GraduationCap className="h-4 w-4" />
                  Bulk Graduate
                </Button>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading Grade 6 students...</p>
                </div>
              </div>
            ) : filteredStudents.length > 0 ? (
              viewMode === "list" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg font-semibold">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center justify-center h-6 w-6 rounded border-2 border-border hover:border-primary transition-colors"
                    >
                      {selectedStudents.size === filteredStudents.length && filteredStudents.length > 0 ? (
                        <CheckSquare className="h-5 w-5 text-primary" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </button>
                    <span>{selectedStudents.size === filteredStudents.length && filteredStudents.length > 0 ? "Deselect All" : "Select All"}</span>
                  </div>

                  {filteredStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-card to-muted/20 border-2 border-border/30 rounded-xl hover:border-accent-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <button
                          onClick={() => toggleSelectStudent(student.id)}
                          className="flex items-center justify-center h-6 w-6 rounded border-2 border-border hover:border-primary transition-colors"
                        >
                          {selectedStudents.has(student.id) ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <p className="font-semibold text-base">{student.name}</p>
                            <Badge variant="secondary" className="font-semibold px-3 py-1">
                              {student.studentId}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>{student.email}</span>
                            <Badge variant="outline" className="text-xs">{student.yearLevel}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={student.status === "active" ? "default" : "outline"} className="text-xs font-semibold capitalize">
                          {student.status}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGraduateStudent(student)}
                          disabled={student.status === "graduated"}
                          className="gap-2"
                        >
                          <GraduationCap className="h-4 w-4" />
                          Graduate
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStudents.map((student) => (
                    <div key={student.id} className="p-4 border-2 border-border/30 rounded-xl bg-card hover:border-accent-300 hover:shadow-md transition-all">
                      <div className="flex items-start gap-3 mb-3">
                        <button
                          onClick={() => toggleSelectStudent(student.id)}
                          className="flex items-center justify-center h-6 w-6 rounded border-2 border-border hover:border-primary transition-colors flex-shrink-0 mt-1"
                        >
                          {selectedStudents.has(student.id) ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-sm truncate">{student.name}</p>
                            <Badge variant="secondary" className="text-xs flex-shrink-0">{student.studentId}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                          <Badge variant="outline" className="text-xs mt-2">{student.yearLevel}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={student.status === "active" ? "default" : "outline"} className="text-xs font-semibold capitalize">
                          {student.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleGraduateStudent(student)}
                          disabled={student.status === "graduated"}
                          className="gap-1"
                        >
                          <GraduationCap className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-lg text-muted-foreground font-medium">
                  {searchQuery ? "No Grade 6 students matching your search" : "No Grade 6 students found"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {showBulkPanel && (
          <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/40" onClick={() => !processingBulk && setShowBulkPanel(false)} />
            <div className="relative ml-auto w-full max-w-lg bg-background shadow-2xl flex flex-col border-l border-border">
              <div className="bg-gradient-to-r from-primary to-accent p-6 text-white flex items-center justify-between border-b">
                <h2 className="text-2xl font-bold">Bulk Graduate</h2>
                <button
                  onClick={() => !processingBulk && setShowBulkPanel(false)}
                  className="p-1 hover:bg-white/20 rounded-lg"
                  title="Close panel"
                  aria-label="Close bulk panel"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 p-6 space-y-6">
                <p className="text-sm text-muted-foreground">
                  Selected: <span className="font-semibold text-foreground">{selectedStudents.size} student(s)</span>
                </p>

                <div className="max-h-56 overflow-y-auto space-y-2 p-3 bg-muted/30 rounded-lg">
                  {filteredStudents
                    .filter((s) => selectedStudents.has(s.id))
                    .map((s) => (
                      <div key={s.id} className="text-sm p-2 bg-card rounded border border-border/50">
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.studentId} • {s.status}</p>
                      </div>
                    ))}
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowBulkPanel(false)} className="flex-1" disabled={processingBulk}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleBulkGraduate}
                    disabled={processingBulk}
                    className="flex-1 bg-gradient-to-r from-primary to-accent text-white font-semibold"
                  >
                    {processingBulk ? "Processing..." : `Graduate ${selectedStudents.size} Student(s)`}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {alert && <AlertMessage type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
      </div>
    </DashboardLayout>
  );
};

export default StudentGradeLevelManagement;
