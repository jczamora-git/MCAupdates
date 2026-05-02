import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Search, Grid3x3, List, Loader2, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { API_ENDPOINTS, apiGet } from "@/lib/api";
import { FEATURES } from "@/config/features";

type Course = {
  id: number | string;
  title: string;
  code: string;
  section?: string;
  students?: number;
  status?: string;
  yearLevel?: string;
  sections?: Array<{ id?: number | string; name: string; students?: number }>;
};

const Courses = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [sortOption, setSortOption] = useState<string>("code_asc");
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [manageCourse, setManageCourse] = useState<Course | null>(null);

  const renderText = (v: any) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (typeof v === 'function') return v.name || '[function]';
    try {
      return typeof v === 'object' ? (v.toString && v.toString() !== '[object Object]' ? v.toString() : JSON.stringify(v)) : String(v);
    } catch (e) {
      return String(v);
    }
  };

  // Filter courses based on search
  const filteredCourses = courses.filter((course) =>
    renderText(course.title).toLowerCase().includes(searchQuery.toLowerCase()) ||
    renderText(course.code).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort courses
  const sortedCourses = [...filteredCourses].sort((a, b) => {
    switch (sortOption) {
      case "code_asc":
        return String(a.code).localeCompare(String(b.code));
      case "code_desc":
        return String(b.code).localeCompare(String(a.code));
      case "title_asc":
        return String(a.title).localeCompare(String(b.title));
      case "title_desc":
        return String(b.title).localeCompare(String(a.title));
      case "students_asc":
        return (a.students || 0) - (b.students || 0);
      case "students_desc":
        return (b.students || 0) - (a.students || 0);
      default:
        return 0;
    }
  });

  // Helper: attach student counts per section (by year level) - only if not already populated
  const fetchTeacherCourses = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const subjectsRes = await apiGet(API_ENDPOINTS.TEACHER_MY_SUBJECTS);
      const subjects = Array.isArray(subjectsRes?.subjects) ? subjectsRes.subjects : [];

      if (subjects.length === 0) {
        setCourses([]);
        return;
      }

      // Backend now resolves section_id via year_level_sections JOIN —
      // collect unique real section IDs to fetch student counts in parallel.
      const sectionIds = Array.from(new Set(
        subjects
          .map((s: any) => s.section_id)
          .filter((id: any) => id && !String(id).startsWith('default-'))
      )) as Array<string | number>;

      const studentCountBySection = new Map<string, number>();
      await Promise.all(sectionIds.map(async (sectionId) => {
        try {
          const res = await apiGet(`${API_ENDPOINTS.STUDENTS}?section_id=${encodeURIComponent(String(sectionId))}`);
          const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
          studentCountBySection.set(String(sectionId), list.length);
        } catch (_) {}
      }));

      const mapped: Course[] = subjects.map((subject: any, idx: number) => {
        const level = subject.level || subject.subject_level || '';
        const sectionId = subject.section_id ?? null;
        const sectionName = subject.section_name ?? level;
        const sections = sectionId
          ? [{ id: sectionId, name: sectionName, students: studentCountBySection.get(String(sectionId)) }]
          : [];

        return {
          id: subject.subject_id ?? subject.id ?? idx,
          title: subject.name || subject.subject_name || '',
          code: subject.course_code || subject.code || '',
          yearLevel: level,
          sections,
          status: subject.status ?? 'active'
        };
      });

      setCourses(mapped);
    } catch (err: any) {
      console.error('fetchTeacherCourses error:', err);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "teacher") {
      navigate("/auth");
      return;
    }
    // fetch teacher courses when page mounts for teacher
    if (isAuthenticated && user?.role === 'teacher') {
      fetchTeacherCourses();
    }
  }, [isAuthenticated, user, navigate]);

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header Section */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              My Teaching Courses
            </h1>
            <p className="text-muted-foreground text-lg">
              {user?.name} • Manage your assigned courses and students
            </p>
          </div>
        </div>

        {/* Main Card */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-muted border-b pb-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      All Courses ({courses.length})
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </span>
                  ) : (
                    `All Courses (${sortedCourses.length})`
                  )}
                </CardTitle>
                <CardDescription className="text-base">
                  Courses assigned to you for this academic year
                </CardDescription>
              </div>
            </div>

            {/* Filters and Controls */}
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search courses by name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 py-2.5 text-base border-2 focus:border-accent-500 rounded-xl bg-background shadow-sm"
                />
              </div>

              <div className="w-48">
                <Select value={sortOption} onValueChange={setSortOption}>
                  <SelectTrigger className="border-2 rounded-xl px-4 py-2.5 bg-background font-medium shadow-sm">
                    {sortOption === "code_asc" && "Code A → Z"}
                    {sortOption === "code_desc" && "Code Z → A"}
                    {sortOption === "title_asc" && "Title A → Z"}
                    {sortOption === "title_desc" && "Title Z → A"}
                    {sortOption === "students_asc" && "Students ↑"}
                    {sortOption === "students_desc" && "Students ↓"}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="code_asc">Code A → Z</SelectItem>
                    <SelectItem value="code_desc">Code Z → A</SelectItem>
                    <SelectItem value="title_asc">Title A → Z</SelectItem>
                    <SelectItem value="title_desc">Title Z → A</SelectItem>
                    <SelectItem value="students_asc">Students ↑</SelectItem>
                    <SelectItem value="students_desc">Students ↓</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode((v) => (v === "list" ? "grid" : "list"))}
                className="px-4 py-2.5 rounded-xl font-medium border-2 gap-2 shadow-sm hover:bg-accent-50 hover:border-accent-300 transition-all"
                title="Toggle view"
                aria-pressed={viewMode === "grid"}
              >
                {viewMode === "grid" ? <Grid3x3 className="h-5 w-5" /> : <List className="h-5 w-5" />}
                <span>{viewMode === "grid" ? "Grid" : "List"}</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <span className="ml-4 text-lg text-muted-foreground">Loading your courses...</span>
              </div>
            ) : sortedCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground mb-2">No Courses Yet</h3>
                <p className="text-muted-foreground max-w-md">
                  {searchQuery
                    ? "No courses match your search. Try adjusting your filters."
                    : "You have no assigned courses yet. Please contact your administrator."}
                </p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedCourses.map((course) => (
                  <div
                    key={course.id}
                    className="rounded-2xl border-2 transition-all duration-300 flex flex-col overflow-hidden bg-white border-gray-200 hover:shadow-lg"
                  >
                    {/* Card Header - Course Title & Code */}
                    <div className="p-5 flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 bg-gradient-to-br from-primary to-accent">
                        <BookOpen className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base">{renderText(course.code)}</p>
                        <p className="text-sm text-muted-foreground text-wrap">{renderText(course.title)}</p>
                        {course.yearLevel && <p className="text-xs text-muted-foreground mt-1">Year Level: {renderText(course.yearLevel)}</p>}
                      </div>
                    </div>

                    {/* Sections with Student Counts */}
                    <div className="px-5 py-4 bg-blue-50 border-t border-gray-200">
                      <p className="text-xs font-semibold text-muted-foreground mb-3">Sections</p>
                      <div className="flex flex-col gap-3">
                        {course.sections && course.sections.length > 0 ? (
                          course.sections.map((s) => (
                            <div key={s.id ?? s.name} className="flex items-baseline justify-between">
                              <span className="font-semibold text-sm">{renderText(s.name)}</span>
                              <span className="text-xs text-muted-foreground">{typeof s.students === 'number' ? `${s.students} students` : '\u2014'}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm font-medium">{renderText(course.section || "—")}</p>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    {FEATURES.courseManagement && (
                      <div className="px-5 py-4 border-t border-gray-200 mt-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // If only one section, redirect directly
                            if (course.sections && course.sections.length === 1) {
                              const section = course.sections[0];
                              if (section.id) {
                                navigate(`/teacher/courses/${course.id}?section_id=${section.id}`);
                              } else {
                                navigate(`/teacher/courses/${course.id}`);
                              }
                            } else {
                              setManageCourse(course);
                              setManageModalOpen(true);
                            }
                          }}
                          className="w-full gap-2 font-medium"
                        >
                          <BookOpen className="h-4 w-4" />
                          Manage Course
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {sortedCourses.map((course) => (
                  <div
                    key={course.id}
                    className="rounded-2xl border-2 transition-all duration-300 flex items-center justify-between p-4 bg-card border-accent-100 hover:border-accent-300 hover:shadow-md"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 bg-gradient-to-br from-primary to-accent">
                        <BookOpen className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-lg">{renderText(course.title)}</p>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {renderText(course.code)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {course.sections && course.sections.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {course.sections.map((s) => (
                                <div key={s.id ?? s.name} className="flex items-center justify-between">
                                  <span className="font-medium">{renderText(s.name)}</span>
                                  <span className="text-sm text-muted-foreground">{typeof s.students === 'number' ? `${s.students} students` : '\u2014'}</span>
                                </div>
                              ))}
                              {course.yearLevel && <div className="text-xs text-muted-foreground mt-1">Year {renderText(course.yearLevel)}</div>}
                            </div>
                          ) : (
                            <>
                              {course.section && `${renderText(course.section)} • `}
                              {renderText(course.students || 0)} Students
                              {course.yearLevel && ` • Year ${renderText(course.yearLevel)}`}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {course.status && (
                        <Badge
                          variant={renderText(course.status) === "approved" ? "default" : "secondary"}
                          className={`text-xs ${renderText(course.status) === "approved" ? "bg-gradient-to-r from-primary to-accent text-white" : ""}`}
                        >
                          {renderText(course.status)}
                        </Badge>
                      )}
                      {FEATURES.courseManagement && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // If only one section, redirect directly
                            if (course.sections && course.sections.length === 1) {
                              const section = course.sections[0];
                              if (section.id) {
                                navigate(`/teacher/courses/${course.id}?section_id=${section.id}`);
                              } else {
                                navigate(`/teacher/courses/${course.id}`);
                              }
                            } else {
                              setManageCourse(course);
                              setManageModalOpen(true);
                            }
                          }}
                          className="gap-1 font-medium hover:bg-accent-50 hover:border-accent-300 transition-all"
                        >
                          <BookOpen className="h-4 w-4" />
                          Manage
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        {/* Manage Course Modal */}
        {FEATURES.courseManagement && (
          <Dialog open={manageModalOpen} onOpenChange={setManageModalOpen}>
            <DialogContent className="max-w-2xl border-0 shadow-2xl rounded-2xl overflow-hidden p-0">
              {/* Gradient header */}
              <div className="px-8 py-7 bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
                <div>
                  <h3 className="text-2xl font-bold">{manageCourse ? `Manage: ${renderText(manageCourse.title)}` : 'Manage Course'}</h3>
                  <p className="text-sm font-medium opacity-95 mt-2">Select a section to manage for this course.</p>
                </div>
              </div>

              {/* Body with side padding */}
              <div className="px-8 py-6 bg-white space-y-6">
                {manageCourse ? (
                  <div>
                    {manageCourse.sections && manageCourse.sections.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        {manageCourse.sections.map((s) => (
                          <div key={s.id ?? s.name} className="flex flex-col items-center justify-between p-6 border border-gray-200 rounded-2xl bg-white hover:shadow-md transition-all hover:border-blue-200">
                            <div className="text-center mb-4 w-full">
                              <div className="font-bold text-lg text-gray-900">{renderText(s.name)}</div>
                              <div className="text-sm text-gray-600 mt-1">{typeof s.students === 'number' ? `${s.students} students` : 'No students'}</div>
                            </div>
                            <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold hover:shadow-lg hover:from-blue-700 hover:to-cyan-600 transition-all shadow-md rounded-full px-6 py-2.5 text-sm" onClick={() => {
                              setManageModalOpen(false);
                              if (s.id) navigate(`/teacher/courses/${manageCourse.id}?section_id=${s.id}`);
                              else navigate(`/teacher/courses/${manageCourse.id}`);
                            }}>
                              Manage Section
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mb-4">No sections available for this course.</p>
                    )}

                    {/* Manage Course Overview button removed — per-section Manage Section handles navigation */}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No course selected.</p>
                )}
              </div>

              {/* Footer removed — close handled by the dialog X icon in the header */}
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Courses;
